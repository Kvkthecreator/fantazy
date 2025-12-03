"use client";

/**
 * ContextPageClient - Primary Context Management View
 *
 * ARCHITECTURE NOTE (2025-12-03):
 * This component now renders ONLY the ContextEntriesPanel, which provides
 * the schema-driven context entry system. The legacy 5-tab structure
 * (Blocks, Entries, Documents, Images) has been deprecated.
 *
 * Context Entries are the canonical source of context for work recipes.
 * Assets are managed within context entry fields (via asset:// references).
 *
 * See: /docs/architecture/ADR_CONTEXT_ENTRIES.md
 *
 * Legacy components (ContextBlocksClient, ContextEntriesClient, etc.) remain
 * in the codebase for knowledge extraction workflows but are not part of
 * the work platform context management flow.
 */

import ContextEntriesPanel from "@/components/context/ContextEntriesPanel";

interface ContextPageClientProps {
  projectId: string;
  basketId: string;
  addRole?: string | null; // Optional: pre-select anchor role to open editor
}

export default function ContextPageClient({
  projectId,
  basketId,
  addRole,
}: ContextPageClientProps) {
  return (
    <div className="w-full">
      <ContextEntriesPanel
        projectId={projectId}
        basketId={basketId}
        initialAnchorRole={addRole ?? undefined}
      />
    </div>
  );
}

// Export separate component for Add Context button to be used in header
export { default as AddContextButton } from "./AddContextButton";
