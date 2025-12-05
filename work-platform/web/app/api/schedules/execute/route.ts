/**
 * API Route: /api/schedules/execute
 *
 * Schedule executor endpoint - called by cron worker to process due schedules.
 * Uses unified /api/work/queue endpoint to create work_request + work_ticket.
 *
 * Security: Requires CRON_SECRET header for authentication.
 *
 * See: /docs/architecture/ADR_UNIFIED_WORK_ORCHESTRATION.md
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/clients";

interface WorkRecipe {
  id: string;
  slug: string;
  name: string;
  agent_type: string;
  context_requirements: Record<string, unknown>;
}

interface ScheduleRow {
  id: string;
  project_id: string;
  basket_id: string;
  recipe_id: string;
  frequency: string;
  day_of_week: number | null;
  time_of_day: string;
  recipe_parameters: Record<string, unknown> | null;
  enabled: boolean;
  next_run_at: string;
  run_count: number;
  created_by: string | null;
  work_recipes: WorkRecipe | null;
}

interface QueueResponse {
  work_request_id: string;
  work_ticket_id: string;
  status: string;
  message: string;
}

// Helper to call the unified queue endpoint
async function queueWork(payload: {
  basket_id: string;
  recipe_slug: string;
  parameters: Record<string, unknown>;
  source: "schedule";
  schedule_id: string;
  user_id: string;
  workspace_id: string;
  scheduling_intent: { mode: "recurring" };
}): Promise<{ success: boolean; data?: QueueResponse; error?: string }> {
  try {
    // Call our own queue endpoint internally
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const serviceSecret = process.env.SUBSTRATE_SERVICE_SECRET || process.env.CRON_SECRET || "";

    const response = await fetch(`${baseUrl}/api/work/queue`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json() as QueueResponse;
      return { success: true, data };
    } else {
      const error = await response.json();
      return { success: false, error: error.detail || `HTTP ${response.status}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// POST /api/schedules/execute - Process all due schedules
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    console.log("[SCHEDULE EXECUTOR] Auth check:", {
      hasSecret: !!cronSecret,
      secretLength: cronSecret?.length,
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 10),
    });

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { detail: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();

    // Find all due schedules
    const { data: dueSchedules, error: fetchError } = await supabase
      .from("project_schedules")
      .select(`
        id,
        project_id,
        basket_id,
        recipe_id,
        frequency,
        day_of_week,
        time_of_day,
        recipe_parameters,
        enabled,
        next_run_at,
        run_count,
        created_by,
        work_recipes (
          id,
          slug,
          name,
          agent_type,
          context_requirements
        )
      `)
      .eq("enabled", true)
      .lte("next_run_at", now)
      .order("next_run_at");

    if (fetchError) {
      console.error("[SCHEDULE EXECUTOR] Failed to fetch schedules:", fetchError);
      return NextResponse.json(
        { detail: "Failed to fetch schedules" },
        { status: 500 }
      );
    }

    if (!dueSchedules || dueSchedules.length === 0) {
      return NextResponse.json({
        message: "No schedules due",
        processed: 0,
      });
    }

    console.log(`[SCHEDULE EXECUTOR] Found ${dueSchedules.length} due schedules`);

    const results: Array<{
      schedule_id: string;
      work_request_id?: string;
      work_ticket_id?: string;
      status: "success" | "error";
      error?: string;
    }> = [];

    // Process each due schedule
    for (const schedule of dueSchedules as unknown as ScheduleRow[]) {
      try {
        const recipe = schedule.work_recipes;
        if (!recipe) {
          results.push({
            schedule_id: schedule.id,
            status: "error",
            error: "Recipe not found",
          });
          continue;
        }

        // Get workspace_id from basket
        const { data: basket } = await supabase
          .from("baskets")
          .select("workspace_id")
          .eq("id", schedule.basket_id)
          .single();

        if (!basket) {
          results.push({
            schedule_id: schedule.id,
            status: "error",
            error: "Basket not found",
          });
          continue;
        }

        // Get user_id from schedule creator or basket owner
        const userId = schedule.created_by || await getBasketOwner(supabase, schedule.basket_id);

        if (!userId) {
          results.push({
            schedule_id: schedule.id,
            status: "error",
            error: "Could not determine user_id for schedule",
          });
          continue;
        }

        // Queue work via unified endpoint
        const queueResult = await queueWork({
          basket_id: schedule.basket_id,
          recipe_slug: recipe.slug,
          parameters: schedule.recipe_parameters || {},
          source: "schedule",
          schedule_id: schedule.id,
          user_id: userId,
          workspace_id: basket.workspace_id,
          scheduling_intent: { mode: "recurring" },
        });

        if (!queueResult.success) {
          console.error(`[SCHEDULE EXECUTOR] Failed to queue for schedule ${schedule.id}:`, queueResult.error);
          results.push({
            schedule_id: schedule.id,
            status: "error",
            error: queueResult.error,
          });

          // Update schedule with failure
          await supabase
            .from("project_schedules")
            .update({
              last_run_at: now,
              last_run_status: "failed",
            })
            .eq("id", schedule.id);

          continue;
        }

        // Update schedule with success
        const { error: updateError } = await supabase
          .from("project_schedules")
          .update({
            last_run_at: now,
            last_run_status: "success",
            last_run_ticket_id: queueResult.data!.work_ticket_id,
            run_count: schedule.run_count + 1,
          })
          .eq("id", schedule.id);

        if (updateError) {
          console.error(`[SCHEDULE EXECUTOR] Failed to update schedule ${schedule.id}:`, updateError);
        }

        console.log(
          `[SCHEDULE EXECUTOR] Queued work for schedule ${schedule.id}: ` +
          `request=${queueResult.data!.work_request_id}, ticket=${queueResult.data!.work_ticket_id}`
        );

        results.push({
          schedule_id: schedule.id,
          work_request_id: queueResult.data!.work_request_id,
          work_ticket_id: queueResult.data!.work_ticket_id,
          status: "success",
        });

      } catch (err) {
        console.error(`[SCHEDULE EXECUTOR] Error processing schedule ${schedule.id}:`, err);
        results.push({
          schedule_id: schedule.id,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;

    return NextResponse.json({
      message: `Processed ${dueSchedules.length} schedules`,
      processed: dueSchedules.length,
      success: successCount,
      errors: errorCount,
      results,
    });

  } catch (error) {
    console.error("[SCHEDULE EXECUTOR] Error:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper to get basket owner
async function getBasketOwner(
  supabase: ReturnType<typeof createServiceRoleClient>,
  basketId: string
): Promise<string | null> {
  const { data: basket } = await supabase
    .from("baskets")
    .select("created_by")
    .eq("id", basketId)
    .single();

  return basket?.created_by || null;
}

// GET /api/schedules/execute - Health check / status
export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Count due schedules
    const { count: dueCount } = await supabase
      .from("project_schedules")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true)
      .lte("next_run_at", new Date().toISOString());

    // Count total active schedules
    const { count: totalCount } = await supabase
      .from("project_schedules")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true);

    // Count pending tickets in queue
    const { count: pendingCount } = await supabase
      .from("work_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    return NextResponse.json({
      status: "healthy",
      due_schedules: dueCount || 0,
      total_active_schedules: totalCount || 0,
      pending_tickets: pendingCount || 0,
      checked_at: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json(
      { status: "error", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
