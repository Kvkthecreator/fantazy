import { apiClient } from '@/lib/api/client';
import { fetchWithToken } from '@/lib/fetchWithToken';
import { CANONICAL_ACCEPT_ATTRIBUTE } from '@/shared/constants/canonical_file_types';

export type BasketSeedMode = 'upload' | 'manual';

export interface BasketCreationOptions {
  name: string;
  mode: BasketSeedMode;
  intent?: string;
  rawDump?: string;
  files?: File[];
  anchors?: {
    problem?: string;
    customer?: string;
    vision?: string;
    metrics?: string;
  };
}

export interface BasketCreationResult {
  basketId: string;
  nextUrl: string;
  dumps?: {
    dump_id: string | null;
    work_id: string | null;
    processing_method: string | null;
  }[];
  anchorsSeeded?: boolean;
}

function assertHasFiles(files?: File[]): File[] {
  if (!files) return [];
  return files;
}

export async function createBasketWithSeed(options: BasketCreationOptions): Promise<BasketCreationResult> {
  const files = assertHasFiles(options.files);
  const anchorPayload = options.anchors ?? {};

  const createPayload = {
    idempotency_key: crypto.randomUUID(),
    basket: { name: options.name.trim() || 'Untitled Basket' },
  };

  const createResponse = await apiClient.request<{ basket_id: string; id: string }>(
    '/api/baskets/new',
    {
      method: 'POST',
      body: JSON.stringify(createPayload),
    },
  );

  const basketId = createResponse.basket_id;
  let anchorsSeeded = false;

  const hasAnchorContent = Object.values(anchorPayload).some((value) => value?.trim().length);

  if (hasAnchorContent) {
    try {
      await fetchWithToken(`/api/baskets/${basketId}/anchors/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemStatement: anchorPayload.problem?.trim() || null,
          primaryCustomer: anchorPayload.customer?.trim() || null,
          productVision: anchorPayload.vision?.trim() || null,
          successMetrics: anchorPayload.metrics?.trim() || null,
        }),
      });
      anchorsSeeded = true;
    } catch (anchorError) {
      console.warn('Failed to seed anchors during basket creation:', anchorError);
    }
  }

  let dumpsResult: BasketCreationResult['dumps'];
  const trimmedRawDump = options.rawDump?.trim();
  const hasUpload = Boolean(trimmedRawDump) || files.length > 0;

  if (hasUpload) {
    const ingestTraceId = crypto.randomUUID();
    const formData = new FormData();
    formData.append('basket_id', basketId);

    const meta = {
      ingest_trace_id: ingestTraceId,
      seed_origin: 'basket_creation',
      seed_mode: options.mode,
    } satisfies Record<string, unknown>;

    formData.append('meta', JSON.stringify(meta));

    if (trimmedRawDump) {
      formData.append('text_dump', trimmedRawDump);
      formData.append('dump_request_id', crypto.randomUUID());
    }

    files.slice(0, 5).forEach((file) => {
      formData.append('files', file);
      formData.append('dump_request_id', crypto.randomUUID());
    });

    const uploadResponse = await fetch('/api/dumps/upload', {
      method: 'POST',
      body: formData,
    });

    if (uploadResponse.ok) {
      const json = await uploadResponse.json();
      dumpsResult = (json.dumps ?? []).map((dump: any) => ({
        dump_id: dump.dump_id ?? null,
        work_id: dump.work_id ?? null,
        processing_method: dump.processing_method ?? null,
      }));
    } else {
      const text = await uploadResponse.text();
      throw new Error(text || 'Failed to seed basket content');
    }
  }

  const basketDetails = await apiClient.request<{ id: string; has_setup_wizard?: boolean }>(`/api/baskets/${basketId}`, {
    method: 'GET',
  });

  const nextUrl = basketDetails.has_setup_wizard
    ? `/baskets/${basketId}/setup-wizard`
    : `/baskets/${basketId}/overview`;

  return {
    basketId,
    nextUrl,
    dumps: dumpsResult,
    anchorsSeeded,
  };
}

export const ACCEPTED_FILE_TYPES = CANONICAL_ACCEPT_ATTRIBUTE;
