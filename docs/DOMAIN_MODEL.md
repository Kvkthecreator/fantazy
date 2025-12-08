# Clearinghouse Domain Model

**Version**: 1.0
**Date**: 2025-12-08
**Status**: Planning

---

## Overview

Clearinghouse is designed as a **generic IP licensing infrastructure** that can handle any type of intellectual property. Rather than building separate systems for music, voice, characters, and visual art, we use a **schema-driven approach** where:

1. **Core tables** handle common patterns (ownership, licensing, governance)
2. **Type schemas** define the specific fields for each IP category
3. **AI permissions** are a first-class concept across all types

This document defines the domain model and terminology.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Entity Hierarchy](#2-entity-hierarchy)
3. [IP Type Taxonomy](#3-ip-type-taxonomy)
4. [Rights & Ownership Model](#4-rights--ownership-model)
5. [Licensing Model](#5-licensing-model)
6. [Governance Model](#6-governance-model)
7. [AI Permissions Framework](#7-ai-permissions-framework)
8. [Schema Architecture](#8-schema-architecture)
9. [Terminology Glossary](#9-terminology-glossary)

---

## 1. Core Concepts

### 1.1 The Clearinghouse Pattern

A **clearinghouse** is an intermediary that:
- **Aggregates** rights information from multiple sources
- **Standardizes** how rights are represented and queried
- **Facilitates** licensing transactions between parties
- **Tracks** usage and enables settlement

```
┌─────────────────┐                      ┌─────────────────┐
│  SUPPLY SIDE    │                      │  DEMAND SIDE    │
│                 │                      │                 │
│  Rights Holders │                      │  AI Platforms   │
│  - Labels       │    ┌──────────┐      │  - Suno         │
│  - Publishers   │───▶│CLEARING- │◀─────│  - Midjourney   │
│  - Artists      │    │  HOUSE   │      │  - ElevenLabs   │
│  - Agencies     │    └──────────┘      │  - OpenAI       │
│                 │         │            │                 │
└─────────────────┘         │            └─────────────────┘
                            ▼
                    ┌──────────────┐
                    │  SETTLEMENT  │
                    │  Usage →     │
                    │  Payment     │
                    └──────────────┘
```

### 1.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **IP-Agnostic** | Core architecture handles any IP type |
| **Schema-Driven** | Type-specific fields defined in schemas, not code |
| **Governance-First** | All changes go through controlled workflows |
| **Provenance-Complete** | Full audit trail for every mutation |
| **AI-Native** | AI permissions are first-class, not bolted on |
| **Multi-Tenant** | Workspace isolation from day one |

---

## 2. Entity Hierarchy

### 2.1 Core Entities

```
WORKSPACE
│   Multi-tenant container (organization/company)
│
├── CATALOG
│   │   Collection of related IP (portfolio, label catalog)
│   │
│   ├── RIGHTS ENTITY
│   │   │   Individual IP item with ownership & permissions
│   │   │
│   │   ├── Content (type-specific metadata)
│   │   ├── AI Permissions (usage rights)
│   │   ├── Ownership Chain (provenance)
│   │   └── Assets (files, documents)
│   │
│   ├── RIGHTS ENTITY
│   │   └── ...
│   │
│   └── LICENSE GRANT
│       │   Active license for an entity
│       │
│       ├── Terms (negotiated conditions)
│       ├── Territory (geographic scope)
│       └── Duration (time bounds)
│
├── LICENSE TEMPLATE
│   │   Reusable license terms
│   │
│   └── Standard Terms + AI Terms
│
└── PROPOSAL
    │   Pending change request
    │
    ├── Payload (proposed change)
    ├── Status (pending/approved/rejected)
    └── Audit (who, when, why)
```

### 2.2 Entity Relationships

```
┌─────────────┐         ┌─────────────┐
│  WORKSPACE  │────────▶│   CATALOG   │
└─────────────┘   1:N   └──────┬──────┘
                               │ 1:N
                               ▼
                      ┌─────────────────┐
                      │ RIGHTS ENTITY   │
                      │                 │
                      │ - rights_type   │◀───┐
                      │ - content       │    │
                      │ - ai_perms      │    │ references
                      └────────┬────────┘    │
                               │             │
              ┌────────────────┼─────────────┤
              │                │             │
              ▼                ▼             │
      ┌──────────────┐  ┌──────────────┐    │
      │   PROPOSAL   │  │LICENSE GRANT │    │
      │              │  │              │    │
      │ - type       │  │ - terms      │    │
      │ - payload    │  │ - territory  │    │
      │ - status     │  │ - duration   │    │
      └──────────────┘  └──────────────┘    │
                               │            │
                               ▼            │
                      ┌──────────────┐      │
                      │   LICENSEE   │──────┘
                      │   (future)   │
                      └──────────────┘
```

---

## 3. IP Type Taxonomy

### 3.1 Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Music** | Musical compositions and recordings | Songs, albums, samples |
| **Voice** | Voice and likeness rights | Voice actors, artists |
| **Character** | Fictional characters and personas | Game characters, mascots |
| **Visual** | Visual art and imagery | Artwork, photography, designs |
| **Literary** | Written works | Books, scripts, articles |
| **Video** | Moving image content | Films, shows, clips |

### 3.2 IP Types (Initial)

#### Music Category

| Type | Description | Key Identifiers |
|------|-------------|-----------------|
| `musical_work` | A song/composition | ISWC, writers, publishers |
| `sound_recording` | A recorded performance | ISRC, artist, label |
| `sample` | A reusable audio snippet | Source recording, clearance |
| `catalog` | Collection of works | Label, deal terms |

#### Voice Category

| Type | Description | Key Identifiers |
|------|-------------|-----------------|
| `voice_likeness` | Voice identity rights | Talent, agency, samples |
| `vocal_performance` | Specific recording | Session, rights holder |

#### Character Category

| Type | Description | Key Identifiers |
|------|-------------|-----------------|
| `character_ip` | Fictional character | Name, franchise, creator |
| `persona` | Public figure likeness | Individual, representation |

#### Visual Category

| Type | Description | Key Identifiers |
|------|-------------|-----------------|
| `visual_work` | Art/photography | Artist, medium, dimensions |
| `style` | Artistic style | Creator, examples |
| `brand_asset` | Logo, trademark | Owner, registration |

### 3.3 Type Schema Structure

Each IP type has a schema that defines:

```json
{
  "id": "musical_work",
  "display_name": "Musical Work",
  "description": "A musical composition (song)",
  "category": "music",

  "field_schema": {
    "type": "object",
    "properties": {
      "iswc": { "type": "string" },
      "writers": { "type": "array" },
      "publishers": { "type": "array" }
    },
    "required": ["writers"]
  },

  "ai_permission_fields": {
    "training": { "type": "boolean", "default": false },
    "style_reference": { "type": "boolean", "default": false },
    "generation": { "type": "boolean", "default": false }
  },

  "identifier_fields": ["iswc"],
  "display_field": "title"
}
```

---

## 4. Rights & Ownership Model

### 4.1 Ownership Types

| Type | Description | Example |
|------|-------------|---------|
| **Full** | Complete ownership of all rights | Original creator |
| **Partial** | Percentage ownership | Co-writer with 50% |
| **Licensed** | Temporary/conditional rights | Sub-publisher |
| **Administered** | Management without ownership | Administration deal |

### 4.2 Rights Holder Structure

```json
{
  "rights_holder": {
    "entity_type": "organization",  // or "individual"
    "name": "Sony Music Publishing",
    "identifiers": {
      "ipi": "123456789",
      "isni": "0000000123456789"
    }
  },
  "ownership_type": "partial",
  "share": 0.5,
  "territories": ["worldwide"],
  "rights_types": ["mechanical", "performance", "sync"]
}
```

### 4.3 Ownership Chain (Provenance)

Track how rights were acquired:

```json
{
  "ownership_chain": [
    {
      "date": "2020-01-15",
      "event": "original_creation",
      "from": null,
      "to": "artist:john-doe",
      "share": 1.0,
      "document_ref": "asset://contract-123"
    },
    {
      "date": "2020-06-01",
      "event": "publishing_deal",
      "from": "artist:john-doe",
      "to": "publisher:sony-music",
      "share": 0.5,
      "document_ref": "asset://contract-456"
    }
  ]
}
```

### 4.4 Verification Status

| Status | Description |
|--------|-------------|
| `unverified` | Claimed but not validated |
| `pending_verification` | Under review |
| `verified` | Confirmed by documentation |
| `disputed` | Conflicting claims exist |
| `expired` | Rights no longer valid |

---

## 5. Licensing Model

### 5.1 License Types

| Type | Description | Typical Use |
|------|-------------|-------------|
| **Exclusive** | Only licensee can use | Major sync deals |
| **Non-Exclusive** | Multiple licensees allowed | Stock music, AI training |
| **Sync** | Synchronization with visual | Film, TV, advertising |
| **Mechanical** | Reproduction rights | Covers, samples |
| **Performance** | Public performance | Radio, streaming |
| **AI Training** | Model training use | AI platforms |
| **AI Generation** | Generation output use | AI-generated content |

### 5.2 License Template Structure

```json
{
  "id": "ai-training-standard",
  "name": "AI Training License - Standard",
  "license_type": "ai_training",

  "terms": {
    "exclusivity": "non-exclusive",
    "duration_type": "perpetual",
    "territory": ["worldwide"],
    "attribution_required": true,
    "derivative_works": false,
    "sublicensing": false
  },

  "ai_terms": {
    "training_allowed": true,
    "generation_allowed": false,
    "style_reference_allowed": true,
    "model_types": ["music_generation", "style_transfer"],
    "output_restrictions": {
      "commercial_use": "requires_additional_license",
      "attribution": "required"
    }
  },

  "pricing": {
    "model": "per_use",  // or "flat_fee", "revenue_share"
    "base_rate": null,   // negotiable
    "usage_tiers": []
  }
}
```

### 5.3 License Grant Structure

```json
{
  "id": "grant-uuid",
  "rights_entity_id": "entity-uuid",
  "licensee_id": "licensee-uuid",
  "template_id": "template-uuid",

  "terms": {
    // Inherited from template, may have overrides
  },

  "territory": ["US", "CA", "MX"],
  "start_date": "2025-01-01",
  "end_date": null,  // perpetual

  "status": "active",
  "usage_tracking": {
    "enabled": true,
    "reporting_frequency": "monthly"
  }
}
```

---

## 6. Governance Model

### 6.1 Proposal Types

| Type | Description | Auto-Approve |
|------|-------------|--------------|
| `CREATE` | New rights entity | No |
| `UPDATE` | Modify existing entity | Depends on field |
| `TRANSFER` | Change ownership | No |
| `VERIFY` | Verify claimed rights | No |
| `DISPUTE` | Challenge existing claim | No |
| `LICENSE` | Grant new license | Depends on template |
| `REVOKE` | Revoke existing license | No |

### 6.2 Proposal Workflow

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│ PENDING │────▶│ APPROVED │────▶│ EXECUTED │
└────┬────┘     └──────────┘     └──────────┘
     │
     │          ┌──────────┐
     └─────────▶│ REJECTED │
                └──────────┘
```

### 6.3 Proposal Structure

```json
{
  "id": "proposal-uuid",
  "catalog_id": "catalog-uuid",

  "proposal_type": "CREATE",
  "target_entity_id": null,  // null for CREATE

  "payload": {
    "rights_type": "musical_work",
    "title": "New Song",
    "content": { /* type-specific fields */ },
    "ai_permissions": { /* permissions */ }
  },

  "reasoning": "Adding new release to catalog",

  "status": "pending",
  "created_by": "user:uuid",
  "created_at": "2025-01-01T00:00:00Z",

  "reviewed_by": null,
  "reviewed_at": null,
  "review_notes": null
}
```

### 6.4 Governance Rules

| Field Category | Change Type | Approval Required |
|----------------|-------------|-------------------|
| Core metadata | Any | Yes |
| AI permissions | Restriction | No (auto-approve) |
| AI permissions | Expansion | Yes |
| Ownership | Any | Yes (with verification) |
| Status | Activation | No |
| Status | Deactivation | Yes |

---

## 7. AI Permissions Framework

### 7.1 Permission Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Training** | Use in AI model training | Corpus inclusion, fine-tuning |
| **Generation** | AI can create similar content | Music generation, voice synthesis |
| **Reference** | AI can cite/reference style | Style transfer, influence |
| **Embedding** | Include in vector databases | Semantic search, RAG |

### 7.2 Permission Structure

```json
{
  "ai_permissions": {
    "training": {
      "allowed": false,
      "conditions": null
    },
    "generation": {
      "allowed": true,
      "conditions": {
        "attribution_required": true,
        "commercial_allowed": false,
        "derivative_of_derivative": false
      }
    },
    "style_reference": {
      "allowed": true,
      "conditions": {
        "explicit_mention_prohibited": true
      }
    },
    "embedding": {
      "allowed": true,
      "conditions": {
        "retrieval_only": true,
        "no_reproduction": true
      }
    }
  }
}
```

### 7.3 Permission Resolution

When querying permissions:

1. **Entity-level** permissions take precedence
2. **Catalog-level** defaults apply if entity doesn't specify
3. **Workspace-level** policies apply as fallback
4. **System defaults** (deny) if nothing specified

```
Query: "Can I use this for AI training?"

Resolution:
1. Check rights_entity.ai_permissions.training
2. If null → Check catalog.default_ai_permissions.training
3. If null → Check workspace.ai_policy.training
4. If null → Default: DENY
```

### 7.4 AI Permission Types by IP Category

| IP Type | Training | Generation | Style Ref | Embedding |
|---------|----------|------------|-----------|-----------|
| `musical_work` | Yes | Yes | Yes | Yes |
| `sound_recording` | Yes | Yes (sampling) | Yes | Yes |
| `voice_likeness` | Yes | Yes (cloning) | N/A | Yes |
| `character_ip` | Yes | Yes (image gen) | Yes | Yes |
| `visual_work` | Yes | Yes (style) | Yes | Yes |

---

## 8. Schema Architecture

### 8.1 Schema-Driven Design

The platform uses **JSON Schema** to define IP type structures:

```
┌─────────────────────────────────────────────────────────┐
│                   RIGHTS SCHEMAS TABLE                   │
├─────────────────────────────────────────────────────────┤
│ id: "musical_work"                                      │
│ field_schema: { JSON Schema for content }               │
│ ai_permission_fields: { schema for AI perms }           │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ validates
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   RIGHTS ENTITIES TABLE                  │
├─────────────────────────────────────────────────────────┤
│ rights_type: "musical_work"                             │
│ content: { validated against schema }                   │
│ ai_permissions: { validated against schema }            │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Adding New IP Types

To add a new IP type (no code changes required):

```sql
INSERT INTO rights_schemas (id, display_name, category, field_schema, ai_permission_fields)
VALUES (
  'podcast_episode',
  'Podcast Episode',
  'audio',
  '{
    "type": "object",
    "properties": {
      "show_name": {"type": "string"},
      "episode_number": {"type": "integer"},
      "hosts": {"type": "array"},
      "guests": {"type": "array"},
      "topics": {"type": "array"}
    }
  }',
  '{
    "training": {"type": "boolean"},
    "transcription": {"type": "boolean"},
    "summarization": {"type": "boolean"}
  }'
);
```

### 8.3 Schema Versioning

Schemas can evolve over time:

```json
{
  "id": "musical_work",
  "version": 2,
  "field_schema": { /* v2 schema */ },
  "migration_from_v1": {
    "add_fields": ["alternate_titles"],
    "rename_fields": {"composer": "writers"},
    "remove_fields": []
  }
}
```

---

## 9. Terminology Glossary

### Core Terms

| Term | Definition |
|------|------------|
| **Workspace** | Multi-tenant container representing an organization |
| **Catalog** | Collection of related IP (e.g., a label's catalog) |
| **Rights Entity** | Individual IP item with associated rights |
| **Rights Schema** | Type definition for a category of IP |
| **Rights Holder** | Entity that owns rights to IP |

### Licensing Terms

| Term | Definition |
|------|------------|
| **License Template** | Reusable set of license terms |
| **License Grant** | Specific license issued to a licensee |
| **Licensee** | Entity receiving license to use IP |
| **Territory** | Geographic scope of license |
| **Term** | Duration of license validity |

### Governance Terms

| Term | Definition |
|------|------------|
| **Proposal** | Request for change to rights data |
| **Governance Pipeline** | Workflow for processing proposals |
| **Verification** | Process of validating rights claims |
| **Provenance** | Chain of custody for rights |

### AI Terms

| Term | Definition |
|------|------------|
| **AI Permission** | Authorization for AI use of IP |
| **Training Rights** | Permission to include in model training |
| **Generation Rights** | Permission for AI to create similar content |
| **Style Reference** | Permission to cite influence/style |

### Industry Identifiers

| Identifier | Full Name | Used For |
|------------|-----------|----------|
| **ISWC** | International Standard Musical Work Code | Musical compositions |
| **ISRC** | International Standard Recording Code | Sound recordings |
| **IPI** | Interested Party Information | Rights holders |
| **ISNI** | International Standard Name Identifier | Creators, performers |
| **UPC** | Universal Product Code | Releases, albums |

---

## Appendix A: Example Rights Entity

### Musical Work Example

```json
{
  "id": "re-uuid-123",
  "catalog_id": "cat-uuid-456",
  "rights_type": "musical_work",
  "entity_key": "T-123.456.789-0",

  "title": "Dynamite",

  "content": {
    "iswc": "T-123.456.789-0",
    "alternate_titles": ["다이너마이트"],
    "writers": [
      {
        "name": "David Stewart",
        "ipi": "00123456789",
        "role": "composer",
        "split": 0.5
      },
      {
        "name": "Jessica Agombar",
        "ipi": "00987654321",
        "role": "composer",
        "split": 0.5
      }
    ],
    "publishers": [
      {
        "name": "Sony Music Publishing",
        "ipi": "00111222333",
        "share": 1.0,
        "territories": ["worldwide"]
      }
    ],
    "language": "en",
    "genre": ["pop", "disco"]
  },

  "ai_permissions": {
    "training": {
      "allowed": false,
      "conditions": null
    },
    "generation": {
      "allowed": false,
      "conditions": null
    },
    "style_reference": {
      "allowed": true,
      "conditions": {
        "attribution_required": false,
        "explicit_mention_prohibited": true
      }
    },
    "embedding": {
      "allowed": true,
      "conditions": {
        "retrieval_only": true
      }
    }
  },

  "ownership_chain": [
    {
      "date": "2020-08-21",
      "event": "original_creation",
      "parties": ["David Stewart", "Jessica Agombar"],
      "document_ref": null
    },
    {
      "date": "2020-08-21",
      "event": "publishing_assignment",
      "from": ["David Stewart", "Jessica Agombar"],
      "to": "Sony Music Publishing",
      "document_ref": "asset://pub-agreement-789"
    }
  ],

  "status": "active",
  "verification_status": "verified",
  "version": 1,

  "created_by": "user:admin-uuid",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

---

## Appendix B: API Endpoint Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/catalogs` | GET, POST | List/create catalogs |
| `/catalogs/{id}` | GET, PUT, DELETE | Catalog operations |
| `/catalogs/{id}/rights` | GET, POST | List/create rights in catalog |
| `/rights/{id}` | GET, PUT, DELETE | Rights entity operations |
| `/rights/query` | POST | Query rights (demand-side) |
| `/proposals` | GET, POST | List/create proposals |
| `/proposals/{id}/approve` | POST | Approve proposal |
| `/proposals/{id}/reject` | POST | Reject proposal |
| `/licenses/templates` | GET, POST | License templates |
| `/licenses/grants` | GET, POST | License grants |
| `/timeline` | GET | Audit trail |

---

**Document Owner**: Product
**Last Updated**: 2025-12-08
