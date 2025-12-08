import { z } from 'zod';
import { cookies } from 'next/headers';
import { withSchema } from '@/lib/fetchers/withSchema';
import type { ReflectionDTO } from '@/shared/contracts/memory';

const ProjectionSchema = z.object({
  reflections: z.object({
    pattern: z.string().nullable(),
    tension: z.string().nullable(),
    question: z.string().nullable(),
    computed_at: z.string(),
  }) satisfies z.ZodType<ReflectionDTO>,
});

export async function fetchProjection(
  basketId: string,
): Promise<z.infer<typeof ProjectionSchema>> {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'https://www.yarnnn.com';
  const res = await fetch(`${base}/api/baskets/${basketId}/projection`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies().toString(),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`projection ${res.status}`);
  return withSchema(ProjectionSchema)(res);
}
