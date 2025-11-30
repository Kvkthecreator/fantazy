# Substrate Data Types

**Version**: 1.0
**Date**: 2025-11-28
**Status**: Canonical
**Purpose**: Define the foundational data taxonomy for YARNNN's substrate layer

---

## Overview

YARNNN's substrate is a **source-agnostic knowledge layer** where both humans and AI agents contribute, access, and build upon shared context. This document defines the four core data types that comprise the substrate.

### Design Principles

1. **Source Agnostic**: All data types can be created and accessed by both users AND agents
2. **Capture vs Substrate**: Backend tables are ingestion points; UI presents unified views
3. **Processing Pipeline**: Raw inputs flow through extraction/classification into structured substrate
4. **Interoperability Vision**: Substrate should be shareable with any AI system (Claude, ChatGPT, Gemini)

---

## The Four Substrate Types

| Type | Purpose | Storage | Examples |
|------|---------|---------|----------|
| **Blocks** | Semantic knowledge units | PostgreSQL + pgvector | Facts, decisions, constraints, relationships |
| **Entries** | Raw text content | PostgreSQL (text) | Paste dumps, agent text outputs, notes |
| **Documents** | File-based content | Supabase Storage (blob) | PDFs, spreadsheets, data files |
| **Images** | Visual media | Supabase Storage (blob) | Screenshots, diagrams, brand samples |

---

## Type 1: Blocks

**Definition**: Propositional knowledge units with semantic types and vector embeddings.

**Characteristics**:
- Smallest unit of extractable meaning
- Has semantic type (fact, decision, constraint, assumption, etc.)
- State-based lifecycle (proposed → approved → active)
- Vector embeddings for semantic retrieval
- Governance workflow for mutations

**Backend Table**: `blocks`

**Key Fields**:
```sql
id, basket_id, body, semantic_type, state,
embedding, derived_from_asset_id, created_at
```

**Source**: Extracted from Entries, Documents, or created directly by users/agents.

**UI Behavior**: Full CRUD with governance (proposals for mutations).

---

## Type 2: Entries

**Definition**: Raw text content awaiting processing or serving as reference material.

**Characteristics**:
- Unstructured or semi-structured text
- Source-agnostic (user pastes OR agent text outputs)
- May feed P0-P1 pipeline for block extraction
- Supervision workflow for agent-generated content

**Backend Tables** (Capture Layer):
- `raw_dumps` - User-pasted text content
- `work_outputs` (where output_type is text-like) - Agent-generated text

**Unified View Logic**:
```typescript
// Entries = raw_dumps UNION work_outputs (text types)
const entries = [
  ...rawDumps.map(d => ({ ...d, source: 'user' })),
  ...workOutputs
    .filter(o => TEXT_OUTPUT_TYPES.includes(o.output_type))
    .map(o => ({ ...o, source: 'agent' }))
];
```

**Text Output Types**: `finding`, `recommendation`, `insight`, `draft_content`, `report_section`, `data_analysis`

**UI Behavior**:
- View all entries regardless of source
- Source indicator badge (user vs agent)
- Agent entries show supervision status
- "Add Entry" creates `raw_dumps` row

---

## Type 3: Documents

**Definition**: File-based content (non-image) stored as blobs.

**Characteristics**:
- Preserves original fidelity (PDFs, spreadsheets, data files)
- LLM-powered automatic classification
- Can be processed for block extraction
- Permanence rules (permanent vs temporary)

**Backend Table**: `reference_assets` WHERE mime_type matches document patterns

**Document MIME Types**:
```typescript
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'text/csv',
  'application/json',
  'text/plain', // .txt files (not paste dumps)
];
```

**Key Fields**:
```sql
id, basket_id, storage_path, file_name, mime_type,
asset_type, asset_category, classification_status,
classification_confidence, work_session_id, created_by_user_id
```

**Source Identification**:
- `created_by_user_id` set → User upload
- `work_session_id` set → Agent-generated file

**UI Behavior**:
- Upload documents (auto-classification)
- Download/preview
- Filter by asset_type, classification status
- Source indicator badge

---

## Type 4: Images

**Definition**: Visual media files stored as blobs.

**Characteristics**:
- Visual fidelity preservation (screenshots, diagrams, photos)
- LLM-powered classification and description
- Used as reference material for agents (brand voice, visual examples)
- NOT reduced to text blocks (preserves visual context)

**Backend Table**: `reference_assets` WHERE mime_type LIKE 'image/%'

**Image MIME Types**:
```typescript
const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];
```

**UI Behavior**:
- Upload images (auto-classification)
- Thumbnail preview in grid
- Full-size view/download
- Source indicator badge

---

## Source Metadata Pattern

All substrate types support source identification:

| Field | Meaning |
|-------|---------|
| `created_by_user_id` | UUID of user who created (user source) |
| `work_session_id` | UUID of agent session that created (agent source) |
| `agent_type` | Type of agent that created (for work_outputs) |

**UI Source Badge Logic**:
```typescript
function getSourceBadge(item: SubstrateItem) {
  if (item.work_session_id || item.agent_type) {
    return { label: 'Agent', variant: 'secondary' };
  }
  if (item.created_by_user_id) {
    return { label: 'User', variant: 'outline' };
  }
  return { label: 'System', variant: 'ghost' };
}
```

---

## Architectural Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CAPTURE LAYER                                 │
│                     (Ingestion / Source of Truth)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   User Text ────────► raw_dumps                                         │
│                           │                                             │
│   Agent Text ───────► work_outputs ◄──── Agent Reviews (supervision)    │
│                           │                                             │
│   User Files ───────► reference_assets ◄──── Agent Files                │
│   (upload)               (blob storage)      (via work_session_id)      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROCESSING LAYER                                │
│                    (P0-P4 Pipeline / Classification)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   raw_dumps ──────► P0 Capture ──► P1 Extraction ──► blocks (proposed)  │
│                                                                         │
│   reference_assets ──► LLM Classification ──► asset_type, description   │
│                                                                         │
│   work_outputs ──► Supervision ──► (future: substrate absorption)       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUBSTRATE LAYER                                 │
│                      (Unified Knowledge Base)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────┐    ┌─────────┐    ┌───────────┐    ┌─────────┐           │
│   │ Blocks  │    │ Entries │    │ Documents │    │ Images  │           │
│   │         │    │         │    │           │    │         │           │
│   │ blocks  │    │raw_dumps│    │ ref_assets│    │ref_assets│          │
│   │  table  │    │   +     │    │ (docs)    │    │ (images) │          │
│   │         │    │work_out │    │           │    │          │          │
│   └─────────┘    └─────────┘    └───────────┘    └──────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            UI LAYER                                     │
│                    (Context Page - Unified View)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  [+ Add Context ▼]                                               │  │
│   │                                                                  │  │
│   │  [ Blocks ] [ Entries ] [ Documents ] [ Images ]                 │  │
│   │      ↓          ↓            ↓            ↓                      │  │
│   │   Semantic   Raw Text     PDFs/XLSX    Screenshots               │  │
│   │   Knowledge  (any src)    Data Files   Diagrams                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Future Considerations

### Processed Entries Table (Deferred)

If we need structured entries with schema enforcement:

```sql
CREATE TABLE entries (
  id UUID PRIMARY KEY,
  basket_id UUID NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  entry_type TEXT, -- note, summary, transcript, etc.
  source TEXT NOT NULL, -- 'user' | 'agent'
  source_id UUID, -- FK to raw_dumps or work_outputs
  processed_at TIMESTAMPTZ,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

This would be a migration target for approved content from both capture tables.

### Work Output Absorption (Deferred)

When agent work_outputs are approved, they could be:
1. Kept in work_outputs with `supervision_status='approved'` (current)
2. Moved to appropriate substrate table (entries, reference_assets)
3. Extracted into blocks via P1 pipeline

Decision deferred until supervision workflows are mature.

---

## Related Documents

- [TERMINOLOGY_GLOSSARY.md](TERMINOLOGY_GLOSSARY.md) - Terminology standards
- [AGENT_SUBSTRATE_ARCHITECTURE.md](AGENT_SUBSTRATE_ARCHITECTURE.md) - Agent integration patterns
- [YARNNN_SUBSTRATE_CANON_V3.md](YARNNN_SUBSTRATE_CANON_V3.md) - P0-P4 pipeline details

---

**End of Document**
