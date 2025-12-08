// Reflections - Legacy format (deprecated)
// Use ReflectionDTO from './reflections.ts' for new code
export type LegacyReflectionDTO = {
  pattern: string | null;
  tension: string | null;
  question: string | null;
  computed_at: string; // ISO
};

// For backward compatibility
export type ReflectionDTO = LegacyReflectionDTO;

// Timeline
export type TimelineItem =
  | {
      kind: "dump";
      ts: string;
      ref_id: string;
      preview: string | null;
      payload: { id: string; text: string | null; created_at: string };
    }
  | {
      kind: "reflection";
      ts: string;
      ref_id: string; // reflection_cache.id
      preview: string | null;
      payload: ReflectionDTO;
    };

export type TimelinePage = {
  items: TimelineItem[];
  last_cursor: { ts: string; id: string } | null;
};