import { z } from "zod";

export const MEMORY_PASTE_MAX = 20_000;

export const OnboardingSubmitSchema = z.object({
  basket_id: z.string().uuid(),
  name: z.string().min(1).max(60),
  tension: z.string().min(1).max(1200),
  aspiration: z.string().min(1).max(1200),
  memory_paste: z
    .preprocess(
      (v) => (typeof v === "string" ? v.slice(0, MEMORY_PASTE_MAX) : v),
      z.string().max(MEMORY_PASTE_MAX)
    )
    .optional(),
  create_profile_document: z.boolean().default(true),
});
export type OnboardingSubmitDTO = z.infer<typeof OnboardingSubmitSchema>;

export const OnboardingResultSchema = z.object({
  dump_ids: z.object({
    name: z.string().uuid(),
    tension: z.string().uuid(),
    aspiration: z.string().uuid(),
    memory_paste: z.string().uuid().optional(),
  }),
  context_item_id: z.string().uuid(),
  profile_document_id: z.string().uuid().optional(),
});
