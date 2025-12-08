/**
 * Component: ServerIngest
 * Server-side ingest operations
 * @contract input  : IngestItem
 * @contract output : IngestRes
 */
import { createUserClient } from '@/lib/supabase/user';
import type { IngestRes, IngestItem } from '@/shared/contracts/ingest';
import { IngestResSchema } from '@/lib/schemas/ingest';

interface IngestArgs {
  workspaceId: string;
  userId: string;
  idempotency_key: string;
  basket?: { name?: string };
  dumps: IngestItem[];
  token: string;
  batch_id?: string;
  comprehensive_review?: boolean;
}

export async function ingestBasketAndDumps(
  args: IngestArgs
): Promise<{ raw: unknown; data: IngestRes }> {
  const supabase = createUserClient(args.token);

  // 1) Create-or-retrieve basket idempotently within workspace
  const basketName = args.basket?.name ?? null;
  const { data: basketRow, error: basketErr } = await supabase
    .from('baskets')
    .insert({
      workspace_id: args.workspaceId,
      idempotency_key: args.idempotency_key,
      name: basketName,
    })
    .select('id')
    .single();

  let basketId: string;
  if (basketRow?.id) {
    basketId = basketRow.id as string;
  } else {
    // If conflict or already exists, fetch by idempotency
    const { data: existing, error: fetchErr } = await supabase
      .from('baskets')
      .select('id')
      .eq('workspace_id', args.workspaceId)
      .eq('idempotency_key', args.idempotency_key)
      .maybeSingle();
    if (fetchErr || !existing) throw new Error(basketErr?.message || 'Failed to resolve basket');
    basketId = existing.id as string;
  }

  // 2) Enrich dumps with batch metadata and call fn_ingest_dumps in one shot
  const enrichedDumps = args.dumps.map((dump) => ({
    dump_request_id: dump.dump_request_id,
    text_dump: dump.text_dump,
    file_url: dump.file_url,
    source_meta: {
      ...(dump.meta || {}),
      ...(args.batch_id && { batch_id: args.batch_id }),
      ...(args.comprehensive_review && { comprehensive_review: true }),
    },
  }));

  const { data, error } = await supabase.rpc('fn_ingest_dumps', {
    p_workspace_id: args.workspaceId,
    p_basket_id: basketId,
    p_dumps: enrichedDumps,
  });
  if (error) throw new Error(error.message);

  // 3) Shape response to IngestRes
  const parsed = IngestResSchema.parse({
    basket_id: basketId,
    id: basketId,
    name: basketName || '',
    dumps: (data as any[])?.map((r: any) => ({ dump_id: r.dump_id })) ?? [],
  });
  return { raw: data, data: parsed };
}
