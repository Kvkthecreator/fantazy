import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Check if user has any content or identity genesis marker */
export async function isFirstEverUser(userId: string): Promise<boolean> {
  const supabase = createServerSupabaseClient() as any;

  // Check for identity_genesis marker
  const { count: markerCount } = await supabase
    .from('context_items')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'task')
    .eq('content', 'identity_genesis')
    .eq('created_by', userId);

  if ((markerCount ?? 0) > 0) return false;

  // Check for any dumps, documents or blocks created by user
  const [{ count: dumpCount }, { count: docCount }, { count: blockCount }] = await Promise.all([
    supabase.from('raw_dumps').select('id', { count: 'exact', head: true }).eq('created_by', userId),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('created_by', userId),
    supabase.from('blocks').select('id', { count: 'exact', head: true }).eq('created_by', userId),
  ]);

  return (dumpCount ?? 0) === 0 && (docCount ?? 0) === 0 && (blockCount ?? 0) === 0;
}

/** Check if basket has any dumps, documents or blocks */
export async function isBlankBasket(basketId: string): Promise<boolean> {
  const supabase = createServerSupabaseClient() as any;
  const [{ count: dumpCount }, { count: docCount }, { count: blockCount }] = await Promise.all([
    supabase.from('raw_dumps').select('id', { count: 'exact', head: true }).eq('basket_id', basketId),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('basket_id', basketId),
    supabase.from('blocks').select('id', { count: 'exact', head: true }).eq('basket_id', basketId),
  ]);
  return (dumpCount ?? 0) === 0 && (docCount ?? 0) === 0 && (blockCount ?? 0) === 0;
}

/** Check if basket already has identity genesis marker */
export async function hasIdentityGenesis(basketId: string): Promise<boolean> {
  const supabase = createServerSupabaseClient() as any;
  const { count } = await supabase
    .from('context_items')
    .select('id', { count: 'exact', head: true })
    .eq('basket_id', basketId)
    .eq('type', 'task')
    .eq('content', 'identity_genesis');
  return (count ?? 0) > 0;
}

export async function createGenesisProfileDocument(opts: {
  basketId: string;
  title?: string;
  dumpIds: { name: string; tension: string; aspiration: string; memory_paste?: string };
  contextItemId: string;
  supabase: ReturnType<typeof createServerSupabaseClient>;
}): Promise<string> {
  const { supabase, basketId, dumpIds, contextItemId } = opts;
  const title = opts.title ?? 'Profile (Identity Genesis)';

  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({ basket_id: basketId, title, metadata: { kind: 'identity_genesis' } })
    .select('id')
    .single();
  if (docErr) throw docErr;

  const docId = doc.id as string;

  const attach = async (
    substrate_type: 'context_item' | 'dump',
    substrate_id: string,
    role?: string,
    weight?: number,
  ) => {
    await supabase.rpc('fn_document_attach_substrate', {
      p_document_id: docId,
      p_substrate_type: substrate_type,
      p_substrate_id: substrate_id,
      p_role: role ?? null,
      p_weight: weight ?? null,
      p_snippets: '[]',
      p_metadata: { origin: 'onboarding', is_genesis: true },
    });
  };

  await attach('context_item', contextItemId, 'marker', 1.0);
  await attach('dump', dumpIds.name, 'identity', 1.0);
  await attach('dump', dumpIds.tension, 'tension', 0.9);
  await attach('dump', dumpIds.aspiration, 'aspiration', 0.9);
  if (dumpIds.memory_paste) await attach('dump', dumpIds.memory_paste, 'memory', 0.7);

  return docId;
}

// Removed - no longer needed with unified flow
