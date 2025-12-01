import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase/clients';

/**
 * POST /api/projects/[id]/purge
 *
 * Execute basket purge operation (archive blocks and/or redact dumps).
 * Implements purge directly using database operations (BFF pattern).
 *
 * Request Body:
 * - mode: 'archive_all' | 'redact_dumps'
 * - confirmation_text: string (must match project name)
 *
 * Returns:
 * - success: boolean
 * - total_operations: number
 * - totals: { archivedBlocks, redactedDumps }
 * - message: string
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = createRouteHandlerClient({ cookies });

    console.log(`[PURGE API] Request for project ${projectId}`);

    // Get Supabase session for auth
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      console.error('[PURGE API] Auth error:', authError);
      return NextResponse.json(
        { detail: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { mode, confirmation_text } = body;

    if (!mode || !confirmation_text) {
      return NextResponse.json(
        { detail: 'mode and confirmation_text are required' },
        { status: 400 }
      );
    }

    if (!['archive_all', 'redact_dumps'].includes(mode)) {
      return NextResponse.json(
        { detail: 'Invalid mode. Must be "archive_all" or "redact_dumps"' },
        { status: 400 }
      );
    }

    // Fetch project to get basket_id and verify ownership
    const projectResponse = await supabase
      .from('projects')
      .select('id, name, basket_id, user_id')
      .eq('id', projectId)
      .single();

    if (projectResponse.error || !projectResponse.data) {
      return NextResponse.json(
        { detail: 'Project not found' },
        { status: 404 }
      );
    }

    const {
      name: projectName,
      basket_id: basketId,
      user_id: projectOwnerId,
    } = projectResponse.data;

    // Verify ownership
    if (projectOwnerId !== session.user.id) {
      console.warn('[PURGE API] Access denied:', {
        userId: session.user.id,
        projectOwnerId,
      });
      return NextResponse.json(
        { detail: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify confirmation text matches project name
    if (confirmation_text !== projectName) {
      return NextResponse.json(
        { detail: 'Confirmation text does not match project name' },
        { status: 400 }
      );
    }

    if (!basketId) {
      return NextResponse.json(
        { detail: 'Project has no associated basket' },
        { status: 400 }
      );
    }

    console.log(`[PURGE API] Executing ${mode} purge for basket ${basketId}`);

    // Execute purge operations directly (BFF pattern)
    let archivedBlocks = 0;
    let redactedDumps = 0;

    if (mode === 'archive_all') {
      // Mark all active blocks as SUPERSEDED (soft delete)
      // Valid block states: PROPOSED, ACCEPTED, LOCKED, CONSTANT, SUPERSEDED, REJECTED
      console.log('[PURGE API] Marking blocks as SUPERSEDED...');
      const { data: updatedBlocks, error: archiveError } = await supabase
        .from('blocks')
        .update({ state: 'SUPERSEDED' })
        .eq('basket_id', basketId)
        .in('state', ['PROPOSED', 'ACCEPTED', 'LOCKED', 'CONSTANT'])
        .select('id');

      if (archiveError) {
        console.error('[PURGE API] Error archiving blocks:', archiveError);
        return NextResponse.json(
          { detail: 'Failed to archive blocks', error: archiveError.message },
          { status: 500 }
        );
      }

      archivedBlocks = updatedBlocks?.length || 0;
      console.log(`[PURGE API] Marked ${archivedBlocks} blocks as SUPERSEDED`);
    }

    if (mode === 'archive_all' || mode === 'redact_dumps') {
      // Delete all raw dumps
      console.log('[PURGE API] Redacting dumps...');

      // First count the dumps to delete
      const { data: dumpsToDelete, error: countError } = await supabase
        .from('raw_dumps')
        .select('id')
        .eq('basket_id', basketId);

      if (countError) {
        console.error('[PURGE API] Error counting dumps:', countError);
      }

      const dumpCount = dumpsToDelete?.length || 0;

      if (dumpCount > 0) {
        const { error: deleteError } = await supabase
          .from('raw_dumps')
          .delete()
          .eq('basket_id', basketId);

        if (deleteError) {
          console.error('[PURGE API] Error redacting dumps:', deleteError);
          return NextResponse.json(
            { detail: 'Failed to redact dumps', error: deleteError.message },
            { status: 500 }
          );
        }
      }

      redactedDumps = dumpCount;
      console.log(`[PURGE API] Redacted ${redactedDumps} dumps`);
    }

    const totalOperations = archivedBlocks + redactedDumps;
    console.log(`[PURGE API] Success: ${totalOperations} total operations`);

    // User-friendly message
    const message =
      mode === 'archive_all'
        ? `Successfully archived ${archivedBlocks} blocks and redacted ${redactedDumps} dumps`
        : `Successfully redacted ${redactedDumps} dumps`;

    return NextResponse.json({
      success: true,
      total_operations: totalOperations,
      totals: {
        archivedBlocks,
        redactedDumps,
      },
      message,
    });
  } catch (error) {
    console.error('[PURGE API] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
