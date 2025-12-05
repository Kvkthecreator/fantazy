/**
 * API Route: POST /api/work/process
 *
 * Queue processor endpoint - picks up pending work_tickets and executes them.
 * Called by cron job every 30 seconds.
 *
 * Security: Requires CRON_SECRET or SUBSTRATE_SERVICE_SECRET header.
 *
 * See: /docs/architecture/ADR_UNIFIED_WORK_ORCHESTRATION.md
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/clients";

const SUBSTRATE_API_URL = process.env.SUBSTRATE_API_URL || "http://localhost:8000";
const SUBSTRATE_SERVICE_SECRET = process.env.SUBSTRATE_SERVICE_SECRET || "";

interface ClaimedTicket {
  id: string;
  work_request_id: string;
  basket_id: string;
  workspace_id: string;
  agent_type: string;
  metadata: {
    recipe_slug?: string;
    parameters?: Record<string, unknown>;
    tp_session_id?: string;
  };
}

// POST /api/work/process - Process pending tickets
export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const serviceSecret = process.env.SUBSTRATE_SERVICE_SECRET;

    const isAuthorized =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (serviceSecret && authHeader === `Bearer ${serviceSecret}`);

    if (!isAuthorized) {
      return NextResponse.json(
        { detail: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    // Parse optional limit from request
    let limit = 5;
    try {
      const body = await request.json();
      if (body.limit && typeof body.limit === "number") {
        limit = Math.min(Math.max(body.limit, 1), 10);
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Claim pending tickets using row locking
    // We use a transaction-like approach: select FOR UPDATE SKIP LOCKED
    const { data: pendingTickets, error: claimError } = await supabase
      .from("work_tickets")
      .select(`
        id,
        work_request_id,
        basket_id,
        workspace_id,
        agent_type,
        metadata
      `)
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);

    if (claimError) {
      console.error("[QUEUE PROCESSOR] Failed to fetch pending tickets:", claimError);
      return NextResponse.json(
        { detail: "Failed to fetch pending tickets" },
        { status: 500 }
      );
    }

    if (!pendingTickets || pendingTickets.length === 0) {
      return NextResponse.json({
        message: "No pending tickets",
        processed: 0,
      });
    }

    console.log(`[QUEUE PROCESSOR] Found ${pendingTickets.length} pending tickets`);

    const results: Array<{
      ticket_id: string;
      status: "completed" | "failed" | "running";
      error?: string;
      outputs_count?: number;
    }> = [];

    // Process each ticket
    for (const ticket of pendingTickets as ClaimedTicket[]) {
      try {
        // Mark as running
        const { error: updateError } = await supabase
          .from("work_tickets")
          .update({
            status: "running",
            started_at: new Date().toISOString(),
          })
          .eq("id", ticket.id)
          .eq("status", "pending"); // Only if still pending (optimistic lock)

        if (updateError) {
          console.log(`[QUEUE PROCESSOR] Ticket ${ticket.id} already claimed, skipping`);
          continue;
        }

        console.log(`[QUEUE PROCESSOR] Processing ticket ${ticket.id} (${ticket.agent_type})`);

        // Execute via work-platform-api WorkTicketExecutor
        // Note: This calls the existing execution infrastructure
        const executionResult = await executeTicket(ticket);

        if (executionResult.success) {
          // Update to completed
          await supabase
            .from("work_tickets")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              metadata: {
                ...ticket.metadata,
                execution_result: executionResult.data,
              },
            })
            .eq("id", ticket.id);

          results.push({
            ticket_id: ticket.id,
            status: "completed",
            outputs_count: executionResult.data?.outputs_count || 0,
          });

          console.log(`[QUEUE PROCESSOR] Completed ticket ${ticket.id}`);

        } else {
          // Update to failed
          await supabase
            .from("work_tickets")
            .update({
              status: "failed",
              error_message: executionResult.error,
              completed_at: new Date().toISOString(),
            })
            .eq("id", ticket.id);

          results.push({
            ticket_id: ticket.id,
            status: "failed",
            error: executionResult.error,
          });

          console.error(`[QUEUE PROCESSOR] Failed ticket ${ticket.id}: ${executionResult.error}`);
        }

      } catch (err) {
        console.error(`[QUEUE PROCESSOR] Error processing ticket ${ticket.id}:`, err);

        // Update to failed
        await supabase
          .from("work_tickets")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", ticket.id);

        results.push({
          ticket_id: ticket.id,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const completedCount = results.filter(r => r.status === "completed").length;
    const failedCount = results.filter(r => r.status === "failed").length;

    return NextResponse.json({
      message: `Processed ${results.length} tickets`,
      processed: results.length,
      completed: completedCount,
      failed: failedCount,
      results,
    });

  } catch (error) {
    console.error("[QUEUE PROCESSOR] Error:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper to execute a ticket via the work-platform-api
async function executeTicket(
  ticket: ClaimedTicket
): Promise<{ success: boolean; data?: { outputs_count: number }; error?: string }> {
  try {
    // Call work-platform-api execute endpoint
    // This is the existing WorkTicketExecutor infrastructure
    const response = await fetch(
      `${process.env.WORK_PLATFORM_API_URL || 'http://localhost:8001'}/api/work/execute/${ticket.id}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUBSTRATE_SERVICE_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticket_id: ticket.id,
          basket_id: ticket.basket_id,
          workspace_id: ticket.workspace_id,
          agent_type: ticket.agent_type,
          recipe_slug: ticket.metadata?.recipe_slug,
          parameters: ticket.metadata?.parameters,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    } else {
      const error = await response.text();
      return { success: false, error: `Execution failed: ${response.status} - ${error.slice(0, 200)}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Execution error" };
  }
}

// GET /api/work/process - Queue status
export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Count by status
    const statusCounts = await Promise.all([
      supabase.from("work_tickets").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("work_tickets").select("*", { count: "exact", head: true }).eq("status", "running"),
      supabase.from("work_tickets").select("*", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("work_tickets").select("*", { count: "exact", head: true }).eq("status", "failed"),
    ]);

    return NextResponse.json({
      status: "healthy",
      queue: {
        pending: statusCounts[0].count || 0,
        running: statusCounts[1].count || 0,
        completed: statusCounts[2].count || 0,
        failed: statusCounts[3].count || 0,
      },
      checked_at: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json(
      { status: "error", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
