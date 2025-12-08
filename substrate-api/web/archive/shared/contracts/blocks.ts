// Block core types and API contracts
// DEPRECATED: Use substrate_references.ts for new implementations
// This file maintained for backward compatibility only

export type Block = {
  id: string;
  basket_id?: string;
  workspace_id?: string;
  document_id?: string;
  raw_dump_id?: string | null;
  parent_block_id?: string | null;  // V3.0: Universal versioning
  title?: string;
  body_md?: string;
  content: string; // Legacy field for backward compatibility (required)
  type: string; // Legacy field for backward compatibility (required)
  status?: "proposed" | "accepted" | "rejected";
  state?: string;  // V3.0: PROPOSED | ACCEPTED | LOCKED | CONSTANT | SUPERSEDED
  semantic_type?: string;
  confidence_score?: number;
  anchor_role?: string | null;  // V3.0: Emergent anchor
  anchor_status?: string | null;  // V3.0: proposed | accepted | locked
  anchor_confidence?: number | null;  // V3.0: 0.0-1.0
  scope?: string | null;  // V3.0: WORKSPACE | ORG | GLOBAL
  version?: number | null;
  processing_agent?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  last_validated_at?: string | null;
};

export type BlockWithHistory = Block & {
  prev_rev_id?: string | null;
  prev_content?: string | null;
};

// API Request/Response types
export type UpdateBlockRequest = {
  status?: "accepted" | "rejected";
  title?: string;
  body_md?: string;
};
