import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase/clients';
import { TEXT_OUTPUT_TYPES } from '@/lib/types/substrate';
import type { Entry, EntriesListResponse } from '@/lib/types/substrate';

/**
 * GET /api/baskets/[basketId]/entries
 *
 * Unified entries endpoint combining:
 * - raw_dumps (user-created text entries)
 * - work_outputs (agent-generated text, filtered by TEXT_OUTPUT_TYPES)
 *
 * Query params:
 * - source: 'user' | 'agent' | 'all' (default: 'all')
 * - limit: number (default: 100)
 * - offset: number (default: 0)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ basketId: string }> }
) {
  try {
    const { basketId } = await params;

    // Get Supabase session
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { detail: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const sourceFilter = searchParams.get('source') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const entries: Entry[] = [];
    let rawDumpsCount = 0;
    let workOutputsCount = 0;

    // Fetch raw_dumps (user entries)
    if (sourceFilter === 'all' || sourceFilter === 'user') {
      const { data: rawDumps, error: rawDumpsError } = await supabase
        .from('raw_dumps')
        .select('id, basket_id, body_md, text_dump, processing_status, created_at')
        .eq('basket_id', basketId)
        .order('created_at', { ascending: false });

      if (rawDumpsError) {
        console.error('[ENTRIES API] raw_dumps query error:', rawDumpsError);
      } else if (rawDumps) {
        rawDumpsCount = rawDumps.length;

        // Transform raw_dumps to Entry format
        const rawDumpEntries: Entry[] = rawDumps.map((dump: any) => ({
          id: dump.id,
          basket_id: dump.basket_id,
          source: 'user' as const,
          source_table: 'raw_dumps' as const,
          title: undefined, // raw_dumps don't have titles
          body: dump.text_dump || dump.body_md || '',
          processing_status: dump.processing_status,
          created_at: dump.created_at,
        }));

        entries.push(...rawDumpEntries);
      }
    }

    // Fetch work_outputs (agent entries) - only text types
    if (sourceFilter === 'all' || sourceFilter === 'agent') {
      const { data: workOutputs, error: workOutputsError } = await supabase
        .from('work_outputs')
        .select(`
          id,
          basket_id,
          output_type,
          agent_type,
          title,
          body,
          confidence,
          supervision_status,
          work_ticket_id,
          created_at
        `)
        .eq('basket_id', basketId)
        .in('output_type', TEXT_OUTPUT_TYPES as unknown as string[])
        .order('created_at', { ascending: false });

      if (workOutputsError) {
        console.error('[ENTRIES API] work_outputs query error:', workOutputsError);
      } else if (workOutputs) {
        workOutputsCount = workOutputs.length;

        // Transform work_outputs to Entry format
        const workOutputEntries: Entry[] = workOutputs.map((output: any) => ({
          id: output.id,
          basket_id: output.basket_id,
          source: 'agent' as const,
          source_table: 'work_outputs' as const,
          title: output.title,
          body: output.body || '',
          output_type: output.output_type,
          agent_type: output.agent_type,
          supervision_status: output.supervision_status,
          confidence: output.confidence,
          work_ticket_id: output.work_ticket_id,
          created_at: output.created_at,
        }));

        entries.push(...workOutputEntries);
      }
    }

    // Sort combined entries by created_at descending
    entries.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Apply pagination
    const paginatedEntries = entries.slice(offset, offset + limit);

    const response: EntriesListResponse = {
      entries: paginatedEntries,
      total: entries.length,
      raw_dumps_count: rawDumpsCount,
      work_outputs_count: workOutputsCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ENTRIES API] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/baskets/[basketId]/entries
 *
 * Create a new text entry (raw_dump).
 * This is the user-facing entry point for adding text context.
 *
 * Body:
 * - body: string (required) - The text content
 * - title?: string (optional) - Title for the entry (stored in source_meta)
 * - trigger_pipeline?: boolean (default: true) - Whether to trigger P0-P1 extraction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ basketId: string }> }
) {
  try {
    const { basketId } = await params;

    // Get Supabase session
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { detail: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await request.json();
    const { body: textContent, title, trigger_pipeline = true } = body;

    if (!textContent || typeof textContent !== 'string' || textContent.trim().length === 0) {
      return NextResponse.json(
        { detail: 'body is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Get workspace_id from basket
    const { data: basket, error: basketError } = await supabase
      .from('baskets')
      .select('workspace_id')
      .eq('id', basketId)
      .single();

    if (basketError || !basket) {
      return NextResponse.json(
        { detail: 'Basket not found' },
        { status: 404 }
      );
    }

    // Create raw_dump entry
    const dumpRequestId = crypto.randomUUID();
    const { data: newDump, error: insertError } = await supabase
      .from('raw_dumps')
      .insert({
        basket_id: basketId,
        workspace_id: basket.workspace_id,
        text_dump: textContent,
        body_md: textContent, // Also store in body_md for compatibility
        dump_request_id: dumpRequestId,
        processing_status: trigger_pipeline ? 'unprocessed' : 'processed',
        source_meta: {
          title: title || undefined,
          created_by: userId,
          created_via: 'entries_api',
          client_ts: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[ENTRIES API] Insert error:', insertError);
      return NextResponse.json(
        { detail: 'Failed to create entry' },
        { status: 500 }
      );
    }

    // TODO: If trigger_pipeline is true, optionally trigger P0 processing
    // For now, the substrate-api polling mechanism will pick it up

    const entry: Entry = {
      id: newDump.id,
      basket_id: newDump.basket_id,
      source: 'user',
      source_table: 'raw_dumps',
      title: title,
      body: textContent,
      processing_status: newDump.processing_status,
      created_at: newDump.created_at,
    };

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('[ENTRIES API] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
