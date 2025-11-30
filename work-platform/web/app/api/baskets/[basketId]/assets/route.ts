import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase/clients';
import { DOCUMENT_MIME_TYPES, IMAGE_MIME_TYPES } from '@/lib/types/substrate';
import type { MimeCategory } from '@/lib/types/substrate';

const SUBSTRATE_API_URL = process.env.SUBSTRATE_API_URL || 'http://localhost:10000';

/**
 * Filter assets by mime category (document, image, or other).
 */
function filterByMimeCategory(assets: any[], category: MimeCategory): any[] {
  return assets.filter((asset) => {
    const mimeType = asset.mime_type || '';

    if (category === 'image') {
      return mimeType.startsWith('image/');
    }

    if (category === 'document') {
      return DOCUMENT_MIME_TYPES.includes(mimeType as any);
    }

    // 'other' category: neither image nor document
    return !mimeType.startsWith('image/') && !DOCUMENT_MIME_TYPES.includes(mimeType as any);
  });
}

/**
 * POST /api/baskets/[basketId]/assets
 * Upload a reference asset (proxy to substrate-API)
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

    const token = session.access_token;

    // Get form data (multipart/form-data)
    const formData = await request.formData();

    // Forward to substrate-API
    const backendResponse = await fetch(
      `${SUBSTRATE_API_URL}/api/substrate/baskets/${basketId}/assets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData, // Forward form data directly
      }
    );

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({
        detail: 'Failed to upload asset',
      }));
      return NextResponse.json(errorData, { status: backendResponse.status });
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[UPLOAD ASSET API] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/baskets/[basketId]/assets
 * List reference assets (proxy to substrate-API)
 *
 * Extended query params (BFF-level filtering):
 * - mime_category: 'document' | 'image' | 'other' - Filter by mime type category
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

    const token = session.access_token;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;

    // Extract BFF-level filter (not passed to substrate-API)
    const mimeCategory = searchParams.get('mime_category') as MimeCategory | null;

    // Remove BFF-specific params before forwarding
    const forwardParams = new URLSearchParams(searchParams);
    forwardParams.delete('mime_category');

    const queryString = forwardParams.toString();
    const url = `${SUBSTRATE_API_URL}/api/substrate/baskets/${basketId}/assets${
      queryString ? `?${queryString}` : ''
    }`;

    // Forward to substrate-API
    const backendResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({
        detail: 'Failed to list assets',
      }));
      return NextResponse.json(errorData, { status: backendResponse.status });
    }

    const result = await backendResponse.json();

    // Apply BFF-level mime_category filtering if specified
    if (mimeCategory && result.assets) {
      const filteredAssets = filterByMimeCategory(result.assets, mimeCategory);
      return NextResponse.json({
        ...result,
        assets: filteredAssets,
        total: filteredAssets.length,
        _original_total: result.total, // Preserve original count for debugging
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[LIST ASSETS API] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
