import { z } from 'zod';

// Base schemas for common fields
const TimestampSchema = z.string().datetime();
const UUIDSchema = z.string().uuid();

// Basket schema
export const BasketSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  status: z.enum(['INIT', 'ACTIVE', 'ARCHIVED', 'DEPRECATED']),
  workspace_id: UUIDSchema,
  raw_dump_id: UUIDSchema.nullable().optional(),
  origin_template: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  created_at: TimestampSchema,
  // Aggregate counts for dashboard metrics
  blocks: z.number().optional(),
  raw_dumps: z.number().optional(),
  documents: z.number().optional(),
});

export type Basket = z.infer<typeof BasketSchema>;

// Block schema
export const BlockSchema = z.object({
  id: UUIDSchema,
  basket_id: UUIDSchema,
  raw_dump_id: UUIDSchema.nullable().optional(),
  title: z.string(),
  body_md: z.string(),
  status: z.enum(['proposed', 'accepted', 'rejected']),
  confidence_score: z.number().min(0).max(1).optional(),
  processing_agent: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema.optional(),
});

export type Block = z.infer<typeof BlockSchema>;

// Document schema
export const DocumentSchema = z.object({
  id: UUIDSchema,
  basket_id: UUIDSchema,
  workspace_id: UUIDSchema,
  title: z.string(),
  content_raw: z.string(),
  document_type: z.string(),
  metadata: z.record(z.unknown()).optional(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

export type Document = z.infer<typeof DocumentSchema>;

// Delta schema
export const DeltaSchema = z.object({
  delta_id: UUIDSchema,
  basket_id: UUIDSchema,
  summary: z.string(),
  status: z.string().optional(),
  changes: z.array(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: TimestampSchema,
});

export type Delta = z.infer<typeof DeltaSchema>;

// Event schema
export const EventSchema = z.object({
  id: UUIDSchema,
  basket_id: UUIDSchema,
  event_type: z.string(),
  event_data: z.record(z.unknown()),
  created_at: TimestampSchema,
});

export type Event = z.infer<typeof EventSchema>;

// Suggestion schema
export const SuggestionSchema = z.object({
  id: z.string(),
  basket_id: UUIDSchema,
  type: z.enum(['question', 'insight', 'action', 'resource']),
  title: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).optional(),
  created_at: TimestampSchema,
});

export type Suggestion = z.infer<typeof SuggestionSchema>;

// Pagination schemas
export const PaginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    cursor: z.object({
      after_created_at: TimestampSchema.optional(),
      after_id: UUIDSchema.optional(),
    }).optional(),
    has_more: z.boolean(),
    total_count: z.number().optional(),
  });

export type Paginated<T> = {
  items: T[];
  cursor?: {
    after_created_at?: string;
    after_id?: string;
  };
  has_more: boolean;
  total_count?: number;
};

// Events page schema
export const EventsPageSchema = z.object({
  events: z.array(EventSchema),
  last_cursor: z.object({
    created_at: TimestampSchema,
    id: UUIDSchema,
  }),
  has_more: z.boolean(),
});

export type EventsPage = z.infer<typeof EventsPageSchema>;

// API Error schema
export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  code: z.string().optional(),
  status: z.number(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// Request/Response helpers

export const UpdateBlockRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected']).optional(),
  title: z.string().optional(),
  body_md: z.string().optional(),
});

export type UpdateBlockRequest = z.infer<typeof UpdateBlockRequestSchema>;

// Raw dump schema
export const RawDumpSchema = z.object({
  id: UUIDSchema,
  basket_id: UUIDSchema,
  workspace_id: UUIDSchema,
  body_md: z.string(),
  file_url: z.string().url().nullable().optional(),
  processing_status: z.enum(['pending', 'processing', 'processed', 'failed']),
  metadata: z.record(z.unknown()).optional(),
  created_at: TimestampSchema,
  processed_at: TimestampSchema.optional(),
});

export type RawDump = z.infer<typeof RawDumpSchema>;


// Workspace schema
export const WorkspaceSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  created_at: TimestampSchema,
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
