import type { ZodSchema } from 'zod';

/**
 * Wrap a fetch Response with a Zod schema validation.
 * Throws a canonical error envelope on mismatch.
 */
export function withSchema<T>(schema: ZodSchema<T>) {
  return async (res: Response): Promise<T> => {
    const json = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw {
        error: 'invalid_response',
        issues: parsed.error.issues,
      };
    }
    return parsed.data;
  };
}
