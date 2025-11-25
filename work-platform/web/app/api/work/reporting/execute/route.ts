/**
 * API Route Proxy: POST /api/work/reporting/execute
 *
 * Proxies reporting execution requests to backend API.
 * Forwards JWT token for authentication.
 *
 * NOTE: Recipe execution with Skills can take 60-120 seconds.
 * maxDuration set to 300 seconds (5 min) to accommodate long-running agent tasks.
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/clients";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://yarnnn-app-fullstack.onrender.com";

// Vercel: Allow up to 5 minutes for agent execution (requires Pro plan for >60s)
// Free tier: 10s, Hobby: 10s, Pro: 300s max
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get Supabase session to extract JWT token
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    // Forward request to backend with Supabase JWT
    const backendResponse = await fetch(`${BACKEND_URL}/api/work/reporting/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const responseData = await backendResponse.json();

    return NextResponse.json(responseData, {
      status: backendResponse.status,
    });
  } catch (error: any) {
    console.error("[API Proxy] Reporting execute failed:", error);
    return NextResponse.json(
      { detail: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
