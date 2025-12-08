import type { TimelineItem } from '@/shared/contracts/memory';
import { z } from 'zod';
import { withSchema } from '@/lib/fetchers/withSchema';

export type { TimelineItem };

const TimelineItemSchema: z.ZodType<TimelineItem> = z.union([
  z.object({
    kind: z.literal('dump'),
    ts: z.string(),
    ref_id: z.string(),
    preview: z.string().nullable(),
    payload: z.object({ id: z.string(), text: z.string().nullable(), created_at: z.string() }),
  }),
  z.object({
    kind: z.literal('reflection'),
    ts: z.string(),
    ref_id: z.string(),
    preview: z.string().nullable(),
    payload: z.object({
      pattern: z.string().nullable(),
      tension: z.string().nullable(),
      question: z.string().nullable(),
      computed_at: z.string(),
    }),
  }),
]);

const TimelinePageSchema = z.object({
  items: z.array(TimelineItemSchema),
  last_cursor: z
    .object({ ts: z.string(), id: z.string() })
    .nullable(),
});

export async function fetchTimeline(
  basketId: string,
  opts: { before?: string; limit?: number; kind?: string[] } = {},
): Promise<{ items: TimelineItem[]; last_cursor: { ts: string; id: string } | null }> {
  const params = new URLSearchParams();
  if (opts.before) params.set('before', opts.before);
  if (opts.limit) params.set('limit', String(opts.limit));
  (opts.kind ?? []).forEach((k) => params.append('kind', k));
  const res = await fetch(`/api/baskets/${basketId}/timeline?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`timeline ${res.status}`);
  return withSchema(TimelinePageSchema)(res);
}
