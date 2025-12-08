import { z } from 'zod';

export function withSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options: { status: number } = { status: 200 }
): Response {
  try {
    const validatedData = schema.parse(data);
    return Response.json(validatedData, { status: options.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Schema validation failed', details: error.flatten() },
        { status: 422 }
      );
    }
    throw error;
  }
}