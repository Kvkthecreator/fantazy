import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase/clients';

/**
 * POST /api/storage/signed-url
 * Generate a fresh signed URL for a storage path
 *
 * This is used for generated assets (images) where we store the permanent
 * storage path rather than a signed URL (which expires).
 *
 * Request body:
 * - storage_path: The path in Supabase Storage (e.g., "baskets/uuid/generated/file.png")
 * - bucket: Optional bucket name (defaults to "yarnnn-assets")
 * - expires_in: Optional expiration in seconds (defaults to 3600 = 1 hour)
 */
export async function POST(request: NextRequest) {
  try {
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

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { storage_path, bucket = 'yarnnn-assets', expires_in = 3600 } = body;

    if (!storage_path) {
      return NextResponse.json(
        { detail: 'storage_path is required' },
        { status: 400 }
      );
    }

    // Validate the path belongs to a basket the user has access to
    // Extract basket_id from path like "baskets/{basket_id}/generated/..."
    const pathParts = storage_path.split('/');
    if (pathParts[0] !== 'baskets' || pathParts.length < 3) {
      return NextResponse.json(
        { detail: 'Invalid storage path format' },
        { status: 400 }
      );
    }

    const basketId = pathParts[1];

    // Check user has access to this basket (via project membership)
    const { data: projectAccess, error: accessError } = await supabase
      .from('projects')
      .select('id')
      .eq('basket_id', basketId)
      .limit(1)
      .maybeSingle();

    if (accessError || !projectAccess) {
      return NextResponse.json(
        { detail: 'Access denied to this storage path' },
        { status: 403 }
      );
    }

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(storage_path, expires_in);

    if (signedUrlError) {
      console.error('[SIGNED URL API] Error generating signed URL:', signedUrlError);
      return NextResponse.json(
        { detail: 'Failed to generate signed URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signed_url: signedUrlData.signedUrl,
      expires_in,
    });
  } catch (error) {
    console.error('[SIGNED URL API] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
