/**
 * API Route: POST /api/work/queue
 *
 * Unified work entry point - all work (manual, TP, scheduled, API) flows through here.
 *
 * Creates:
 * 1. work_request (audit trail, user intent)
 * 2. work_ticket (pending execution)
 *
 * The queue processor picks up pending tickets and executes them.
 *
 * See: /docs/architecture/ADR_UNIFIED_WORK_ORCHESTRATION.md
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase/clients";

interface QueueWorkRequest {
  basket_id: string;
  recipe_slug: string;
  parameters?: Record<string, unknown>;
  priority?: number;  // 1-10, default 5
  source?: "manual" | "thinking_partner" | "schedule" | "api";
  scheduling_intent?: {
    mode: "one_shot" | "recurring";
    frequency?: "weekly" | "biweekly" | "monthly" | "custom";
    day_of_week?: number;  // 0-6
    time_of_day?: string;  // "HH:MM:SS"
  };
  // For TP-originated requests
  tp_session_id?: string;
  // For schedule-originated requests
  schedule_id?: string;
}

interface QueueWorkResponse {
  work_request_id: string;
  work_ticket_id: string;
  status: "queued";
  message: string;
}

// POST /api/work/queue - Queue work for execution
export async function POST(request: NextRequest) {
  try {
    // Determine auth method - JWT header (for TP/internal) or session cookie (for UI)
    const authHeader = request.headers.get("authorization");
    let userId: string | null = null;
    let workspaceId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      // Service-to-service auth (TP, schedule executor)
      // For internal services, we trust the user_id in the body
      const serviceClient = createServiceRoleClient();
      // Extract user_id from request body for internal calls
      const body = await request.json() as QueueWorkRequest & { user_id?: string; workspace_id?: string };

      if (!body.user_id) {
        return NextResponse.json(
          { detail: "user_id required for service calls" },
          { status: 400 }
        );
      }

      userId = body.user_id;
      workspaceId = body.workspace_id || null;

      // Re-parse body for the rest of the logic
      return await processQueueRequest(body, userId, workspaceId, serviceClient);
    } else {
      // Session-based auth (UI)
      const supabase = createRouteHandlerClient({ cookies });
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (authError || !session) {
        return NextResponse.json(
          { detail: "Authentication required" },
          { status: 401 }
        );
      }

      userId = session.user.id;

      // Get workspace_id from user's membership
      const { data: membership } = await supabase
        .from("workspace_memberships")
        .select("workspace_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      workspaceId = membership?.workspace_id || null;

      const body = await request.json() as QueueWorkRequest;
      return await processQueueRequest(body, userId, workspaceId, createServiceRoleClient());
    }
  } catch (error) {
    console.error("[WORK QUEUE] Error:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

async function processQueueRequest(
  body: QueueWorkRequest,
  userId: string,
  workspaceId: string | null,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<NextResponse> {
  const {
    basket_id,
    recipe_slug,
    parameters = {},
    priority = 5,
    source = "manual",
    scheduling_intent,
    tp_session_id,
    schedule_id,
  } = body;

  // Validate required fields
  if (!basket_id || !recipe_slug) {
    return NextResponse.json(
      { detail: "basket_id and recipe_slug are required" },
      { status: 400 }
    );
  }

  // Fetch recipe
  const { data: recipe, error: recipeError } = await supabase
    .from("work_recipes")
    .select("id, slug, name, agent_type, context_requirements, schedulable")
    .eq("slug", recipe_slug)
    .eq("status", "active")
    .maybeSingle();

  if (recipeError || !recipe) {
    return NextResponse.json(
      { detail: `Recipe not found: ${recipe_slug}` },
      { status: 404 }
    );
  }

  // Validate context requirements
  const requiredContext = recipe.context_requirements?.required || [];
  if (requiredContext.length > 0) {
    const { data: contextItems } = await supabase
      .from("context_items")
      .select("item_type")
      .eq("basket_id", basket_id)
      .eq("status", "active")
      .in("item_type", requiredContext);

    const existingTypes = new Set((contextItems || []).map(c => c.item_type));
    const missing = requiredContext.filter((t: string) => !existingTypes.has(t));

    if (missing.length > 0) {
      return NextResponse.json(
        {
          detail: `Missing required context: ${missing.join(", ")}`,
          missing_context: missing,
        },
        { status: 400 }
      );
    }
  }

  // Validate scheduling if requested
  if (scheduling_intent?.mode === "recurring" && !recipe.schedulable) {
    return NextResponse.json(
      { detail: `Recipe ${recipe_slug} is not schedulable` },
      { status: 400 }
    );
  }

  // Get workspace_id from basket if not provided
  if (!workspaceId) {
    const { data: basket } = await supabase
      .from("baskets")
      .select("workspace_id")
      .eq("id", basket_id)
      .single();

    workspaceId = basket?.workspace_id;
  }

  if (!workspaceId) {
    return NextResponse.json(
      { detail: "Could not determine workspace_id" },
      { status: 400 }
    );
  }

  // Determine mode
  const mode = schedule_id ? "continuous" :
    scheduling_intent?.mode === "recurring" ? "continuous" : "one_shot";

  // Create work_request
  const { data: workRequest, error: requestError } = await supabase
    .from("work_requests")
    .insert({
      workspace_id: workspaceId,
      basket_id,
      requested_by_user_id: userId,
      request_type: recipe_slug,
      task_intent: (parameters as Record<string, string>).task_description ||
        `${recipe.name} via ${source}`,
      parameters,
      recipe_id: recipe.id,
      recipe_slug: recipe.slug,
      source,
      scheduling_intent,
      tp_session_id,
      priority: priority <= 3 ? "low" : priority >= 8 ? "urgent" : priority >= 6 ? "high" : "normal",
    })
    .select("id")
    .single();

  if (requestError || !workRequest) {
    console.error("[WORK QUEUE] Failed to create work_request:", requestError);
    return NextResponse.json(
      { detail: "Failed to create work request" },
      { status: 500 }
    );
  }

  // Create work_ticket
  const { data: workTicket, error: ticketError } = await supabase
    .from("work_tickets")
    .insert({
      work_request_id: workRequest.id,
      workspace_id: workspaceId,
      basket_id,
      agent_type: recipe.agent_type,
      status: "pending",
      priority: Math.min(Math.max(priority, 1), 10),
      source,
      mode,
      schedule_id,
      metadata: {
        recipe_slug: recipe.slug,
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        parameters,
        tp_session_id,
        created_at: new Date().toISOString(),
      },
    })
    .select("id")
    .single();

  if (ticketError || !workTicket) {
    console.error("[WORK QUEUE] Failed to create work_ticket:", ticketError);
    // Clean up work_request
    await supabase.from("work_requests").delete().eq("id", workRequest.id);
    return NextResponse.json(
      { detail: "Failed to create work ticket" },
      { status: 500 }
    );
  }

  console.log(`[WORK QUEUE] Created work_request=${workRequest.id}, work_ticket=${workTicket.id} for ${recipe_slug}`);

  return NextResponse.json({
    work_request_id: workRequest.id,
    work_ticket_id: workTicket.id,
    status: "queued",
    message: `${recipe.name} queued for execution. Check the supervision queue for results.`,
  } satisfies QueueWorkResponse);
}

// GET /api/work/queue - Queue status (health check)
export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Count pending tickets
    const { count: pendingCount } = await supabase
      .from("work_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // Count running tickets
    const { count: runningCount } = await supabase
      .from("work_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "running");

    return NextResponse.json({
      status: "healthy",
      queue: {
        pending: pendingCount || 0,
        running: runningCount || 0,
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
