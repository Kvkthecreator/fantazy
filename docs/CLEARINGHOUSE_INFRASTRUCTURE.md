# Clearinghouse Infrastructure & Architecture

**Version**: 1.0
**Date**: 2025-12-08
**Status**: Planning
**Purpose**: IP Licensing Infrastructure for the AI Era

---

## Executive Summary

Clearinghouse is an IP licensing infrastructure platform that enables rights holders to manage, license, and monetize intellectual property in the age of AI. The platform provides:

- **Rights Registry**: Structured storage for any IP type (music, voice, character, visual)
- **Governance Pipeline**: Controlled workflows for rights changes and transfers
- **Provenance Tracking**: Complete audit trail and chain of custody
- **License Management**: Templates, grants, and usage tracking
- **API Layer**: Supply-side (rights holders) and demand-side (AI platforms)

This document outlines the infrastructure migration from the YARNNN AI work platform to the Clearinghouse IP licensing infrastructure.

---

## Table of Contents

1. [Current State: YARNNN Infrastructure](#1-current-state-yarnnn-infrastructure)
2. [Target State: Clearinghouse Architecture](#2-target-state-clearinghouse-architecture)
3. [Infrastructure Components](#3-infrastructure-components)
4. [Migration Plan](#4-migration-plan)
5. [Repository Restructuring](#5-repository-restructuring)
6. [Database Schema Strategy](#6-database-schema-strategy)
7. [Environment Configuration](#7-environment-configuration)
8. [Deployment Configuration](#8-deployment-configuration)
9. [Reusable Components](#9-reusable-components)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Current State: YARNNN Infrastructure

### 1.1 Deployed Services (Render)

| Service | Type | Purpose | Migration Action |
|---------|------|---------|------------------|
| `yarnnn-work-platform-api` | Docker/FastAPI | Agent orchestration, Claude SDK | **REMOVE** |
| `yarnnn-substrate-api` | Python/FastAPI | Context/memory storage, P0-P4 pipelines | **REPURPOSE** |
| `yarnnn-chatgpt-app` | Node | OpenAI GPT integration | **REMOVE** |
| `yarnnn-schedule-executor` | Cron | Scheduled work execution | **REMOVE** |
| `yarnnn-queue-processor` | Cron | Work queue processing | **REMOVE** |

### 1.2 Deployed Frontends (Vercel)

| Frontend | Location | Purpose | Migration Action |
|----------|----------|---------|------------------|
| `work-platform/web` | Vercel | Work UI, agent dashboards | **REMOVE** |
| `substrate-api/web` | Vercel | Substrate management (scaffolding) | **EVALUATE** |

### 1.3 Database (Supabase)

| Resource | Current State | Migration Action |
|----------|---------------|------------------|
| PostgreSQL | 163+ migrations, YARNNN schema | **NEW PROJECT** |
| Auth | User accounts, JWT | **NEW PROJECT** (keep patterns) |
| Storage | Reference assets | **NEW PROJECT** |
| Realtime | Live subscriptions | **NEW PROJECT** |

### 1.4 Current Repository Structure

```
clearinghouse/                    # Root (duplicated from YARNNN)
├── work-platform/                # Layer 2: Work Orchestration
│   ├── api/                      # FastAPI - Claude SDK, agents
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── work/         # Work tickets, sessions
│   │   │   │   ├── agents/       # Agent execution
│   │   │   │   └── recipes/      # Work recipes
│   │   │   └── services/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── web/                      # Next.js - Work supervision UI
│       ├── app/
│       │   ├── dashboard/
│       │   ├── projects/
│       │   └── api/
│       └── components/
│
├── substrate-api/                # Layer 1: Substrate Core
│   ├── api/                      # FastAPI - Context storage
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── routes/
│   │   │   │   │   ├── baskets.py
│   │   │   │   │   ├── blocks.py
│   │   │   │   │   ├── context_items.py
│   │   │   │   │   └── proposals.py
│   │   │   │   ├── models/
│   │   │   │   └── services/
│   │   │   └── schemas/
│   │   └── requirements.txt
│   ├── web/                      # Next.js - Substrate UI (minimal)
│   └── mcp-server/               # MCP integration
│
├── mcp-server/                   # MCP Server (monorepo)
│   ├── packages/
│   │   ├── integration-core/
│   │   ├── anthropic-mcp/
│   │   └── openai-apps/
│   └── adapters/
│
├── apps/                         # External integrations
│   └── chatgpt/                  # ChatGPT plugin
│
├── supabase/                     # Database
│   ├── migrations/               # 163+ migration files
│   └── config.toml
│
├── web/                          # Legacy frontend (partial)
├── scripts/                      # Utility scripts
├── tests/                        # Test suites
├── docs/                         # Documentation
│
├── render.yaml                   # Render deployment config
├── package.json                  # Root package.json
└── pyproject.toml                # Python dependencies
```

---

## 2. Target State: Clearinghouse Architecture

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLEARINGHOUSE                                │
│                   IP Licensing Infrastructure                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────┐              ┌──────────────────┐            │
│   │    Frontend      │              │      API         │            │
│   │    (Next.js)     │─────────────▶│    (FastAPI)     │            │
│   │                  │              │                  │            │
│   │  - Dashboard     │   REST/WS    │  - Rights CRUD   │            │
│   │  - Catalog Mgmt  │              │  - Governance    │            │
│   │  - License Mgmt  │              │  - Licensing     │            │
│   │  - Audit Trail   │              │  - Queries       │            │
│   │                  │              │                  │            │
│   │    [Vercel]      │              │    [Render]      │            │
│   └──────────────────┘              └────────┬─────────┘            │
│                                              │                       │
│                                     ┌────────▼─────────┐            │
│                                     │    Database      │            │
│                                     │   (Supabase)     │            │
│                                     │                  │            │
│                                     │  - PostgreSQL    │            │
│                                     │  - Auth          │            │
│                                     │  - Storage       │            │
│                                     │  - Realtime      │            │
│                                     │                  │            │
│                                     │  [NEW PROJECT]   │            │
│                                     └──────────────────┘            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

                    FUTURE INTEGRATIONS
    ┌─────────────────────────────────────────────────┐
    │                                                 │
    │  Supply Side          Demand Side    Settlement │
    │  ────────────         ───────────    ────────── │
    │  Rights Holders  ───▶ AI Platforms   Usage →    │
    │  Labels              Suno, etc.      Payment    │
    │  Publishers                                     │
    │  Agencies                                       │
    │                                                 │
    └─────────────────────────────────────────────────┘
```

### 2.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **Single API** | One FastAPI backend serving all functionality |
| **Single Frontend** | One Next.js application for all UI needs |
| **Fresh Database** | New Supabase project with clean schema |
| **Generic IP Model** | Schema supports any IP type via flexible metadata |
| **Governance First** | All rights changes go through proposal pipeline |
| **Provenance Always** | Complete audit trail for every mutation |
| **Multi-Tenant** | Workspace isolation via RLS from day one |

### 2.3 Target Repository Structure

```
clearinghouse/
├── api/                          # Single FastAPI Backend
│   ├── src/
│   │   ├── app/
│   │   │   ├── main.py           # Application entry point
│   │   │   ├── config.py         # Configuration management
│   │   │   ├── dependencies.py   # Dependency injection
│   │   │   │
│   │   │   ├── routes/           # API Endpoints
│   │   │   │   ├── __init__.py
│   │   │   │   ├── health.py     # Health checks
│   │   │   │   ├── auth.py       # Authentication
│   │   │   │   ├── workspaces.py # Multi-tenancy
│   │   │   │   ├── catalogs.py   # IP portfolios/catalogs
│   │   │   │   ├── rights.py     # Rights entities CRUD
│   │   │   │   ├── schemas.py    # IP type schemas
│   │   │   │   ├── proposals.py  # Governance pipeline
│   │   │   │   ├── licenses.py   # License management
│   │   │   │   ├── assets.py     # File/document storage
│   │   │   │   ├── timeline.py   # Audit trail
│   │   │   │   └── queries.py    # Rights queries (demand-side)
│   │   │   │
│   │   │   ├── models/           # Pydantic Models
│   │   │   │   ├── __init__.py
│   │   │   │   ├── workspace.py
│   │   │   │   ├── catalog.py
│   │   │   │   ├── rights.py
│   │   │   │   ├── proposal.py
│   │   │   │   ├── license.py
│   │   │   │   └── timeline.py
│   │   │   │
│   │   │   ├── services/         # Business Logic
│   │   │   │   ├── __init__.py
│   │   │   │   ├── supabase.py   # Database client
│   │   │   │   ├── governance.py # Proposal pipeline
│   │   │   │   ├── licensing.py  # License operations
│   │   │   │   └── provenance.py # Audit trail
│   │   │   │
│   │   │   └── schemas/          # JSON Schemas for IP Types
│   │   │       ├── musical_work.json
│   │   │       ├── sound_recording.json
│   │   │       ├── voice_likeness.json
│   │   │       ├── character_ip.json
│   │   │       └── visual_work.json
│   │   │
│   │   └── __init__.py
│   │
│   ├── tests/                    # API Tests
│   │   ├── __init__.py
│   │   ├── test_rights.py
│   │   ├── test_governance.py
│   │   └── test_licensing.py
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   └── build.sh
│
├── web/                          # Single Next.js Frontend
│   ├── app/
│   │   ├── (auth)/               # Auth pages
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/          # Main app
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx          # Dashboard home
│   │   │   ├── catalogs/         # Catalog management
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   └── new/
│   │   │   ├── rights/           # Rights entities
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   ├── licenses/         # License management
│   │   │   ├── proposals/        # Governance queue
│   │   │   └── timeline/         # Audit trail
│   │   └── api/                  # API routes (BFF)
│   │       └── [...]/
│   │
│   ├── components/               # React Components
│   │   ├── ui/                   # Base UI (shadcn/ui)
│   │   ├── forms/                # Form components
│   │   ├── tables/               # Data tables
│   │   └── layout/               # Layout components
│   │
│   ├── lib/                      # Utilities
│   │   ├── supabase/             # Supabase clients
│   │   ├── api/                  # API client
│   │   └── utils/
│   │
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── supabase/                     # Database (NEW PROJECT)
│   ├── migrations/               # Fresh migrations
│   │   ├── 00001_core_schema.sql
│   │   ├── 00002_rights_entities.sql
│   │   ├── 00003_governance.sql
│   │   ├── 00004_licensing.sql
│   │   ├── 00005_audit_trail.sql
│   │   └── 00006_seed_schemas.sql
│   │
│   ├── seed/                     # Test data
│   │   └── test_catalog.sql
│   │
│   └── config.toml
│
├── docs/                         # Documentation
│   ├── CLEARINGHOUSE_INFRASTRUCTURE.md  # This document
│   ├── DOMAIN_MODEL.md           # IP types, relationships
│   ├── API_REFERENCE.md          # API documentation
│   ├── GOVERNANCE_PIPELINE.md    # Proposal workflows
│   └── DEPLOYMENT.md             # Deployment guide
│
├── scripts/                      # Utility Scripts
│   ├── setup-local.sh
│   ├── seed-test-data.sh
│   └── migrate.sh
│
├── tests/                        # Integration Tests
│   ├── e2e/
│   └── integration/
│
├── .github/                      # CI/CD
│   └── workflows/
│
├── render.yaml                   # Render deployment
├── package.json                  # Root package.json
├── .env.example                  # Environment template
├── .gitignore
└── README.md
```

---

## 3. Infrastructure Components

### 3.1 Supabase (NEW Project)

**Decision**: Create a brand new Supabase project for clean separation.

| Component | Purpose | Configuration |
|-----------|---------|---------------|
| **PostgreSQL** | Primary database | Fresh schema, pgvector enabled |
| **Auth** | User authentication | Email/password, OAuth providers |
| **Storage** | File storage | Contract documents, master files |
| **Realtime** | Live subscriptions | Rights updates, proposal notifications |
| **Edge Functions** | Serverless compute | Future: webhooks, integrations |

**New Project Setup**:
1. Create project at [supabase.com](https://supabase.com)
2. Name: `clearinghouse-prod` (or similar)
3. Region: Choose based on primary user base
4. Enable pgvector extension
5. Configure auth providers as needed

### 3.2 Render (API Hosting)

**Services to Create**:

| Service | Type | Root Directory | Purpose |
|---------|------|----------------|---------|
| `clearinghouse-api` | Python | `api/` | Main API backend |

**Services to Delete/Archive**:
- `yarnnn-work-platform-api`
- `yarnnn-substrate-api`
- `yarnnn-chatgpt-app`
- `yarnnn-schedule-executor`
- `yarnnn-queue-processor`

### 3.3 Vercel (Frontend Hosting)

**Projects to Create**:

| Project | Root Directory | Purpose |
|---------|----------------|---------|
| `clearinghouse-web` | `web/` | Main frontend |

**Projects to Delete/Archive**:
- YARNNN work-platform frontend
- YARNNN substrate-api frontend (if exists)

---

## 4. Migration Plan

### Phase 1: Infrastructure Setup (Week 1)

#### 1.1 Create New Supabase Project
```bash
# Via Supabase Dashboard
# 1. Create new project: clearinghouse-prod
# 2. Note down:
#    - Project URL
#    - Anon Key
#    - Service Role Key
#    - Database URL (connection string)
```

#### 1.2 Initial Database Schema
- Run core migrations (see Section 6)
- Seed IP type schemas
- Create test workspace

#### 1.3 Configure Render
- Create new service: `clearinghouse-api`
- Configure environment variables
- Deploy initial API

#### 1.4 Configure Vercel
- Create new project: `clearinghouse-web`
- Connect to repository
- Configure environment variables

### Phase 2: Repository Cleanup (Week 1-2)

#### 2.1 Remove YARNNN-Specific Code
```bash
# Directories to remove
rm -rf work-platform/
rm -rf mcp-server/
rm -rf apps/
rm -rf substrate-api/mcp-server/

# Files to remove
rm -f render.yaml  # Will recreate
rm -f ARCHITECTURE_CORRECTION_SUMMARY.md
rm -f FRONTEND_*.md
rm -f RECIPE_*.md
rm -f WORK_ORCHESTRATION_*.md
rm -f SEMANTIC_TYPES_*.txt
rm -f LOGGING_ENHANCEMENT_SUMMARY.md
rm -f MIGRATION_SUCCESS_SUMMARY.md
rm -f TRACKING_PAGE_REFACTOR_SUMMARY.md
```

#### 2.2 Restructure Directories
```bash
# Move substrate-api/api to root api/
mv substrate-api/api api

# Evaluate and consolidate web directories
# (Choose between substrate-api/web and web/)

# Clean up empty directories
rm -rf substrate-api/
```

#### 2.3 Update Configurations
- New `render.yaml`
- New `package.json`
- New `.env.example`
- Update `.gitignore`

### Phase 3: Code Adaptation (Week 2-3)

#### 3.1 API Refactoring
- Rename routes: `baskets` → `catalogs`
- Rename models: `context_items` → `rights_entities`
- Update service layer for new domain
- Remove agent/work-related code

#### 3.2 Frontend Refactoring
- Update pages for new domain
- Update components for IP management
- Remove work/agent UI code

#### 3.3 Testing
- Update test suites
- Create new integration tests
- Verify all endpoints

### Phase 4: Documentation & Polish (Week 3-4)

#### 4.1 Documentation
- Update all documentation for new domain
- Create API reference
- Write deployment guide

#### 4.2 CI/CD
- Update GitHub Actions
- Configure deployment pipelines
- Set up monitoring

---

## 5. Repository Restructuring

### 5.1 Files/Directories to REMOVE

```
REMOVE ENTIRELY:
├── work-platform/              # Agent execution layer
├── mcp-server/                 # MCP integration
├── apps/                       # External integrations (ChatGPT)
├── substrate-api/mcp-server/   # MCP within substrate

ROOT FILES TO REMOVE:
├── ARCHITECTURE_CORRECTION_SUMMARY.md
├── FRONTEND_AGENT_SESSIONS_UPDATE.md
├── FRONTEND_IMPLEMENTATION_NEXT_STEPS.md
├── FRONTEND_WORK_RECIPES_INTEGRATION.md
├── LOGGING_ENHANCEMENT_SUMMARY.md
├── MIGRATION_SUCCESS_SUMMARY.md
├── RECIPE_EXECUTION_FLOW_VALIDATION.md
├── SEMANTIC_TYPES_QUICK_REFERENCE.txt
├── TRACKING_PAGE_REFACTOR_SUMMARY.md
├── WORK_ORCHESTRATION_FLOW_ASSESSMENT.md
├── apply_timeline_migration.sql
├── check_tp_session.py
├── diagnose_tp_sdk.py
├── mcp-auth-proxy.js
├── test_bff_foundation.py
├── test_tp_endpoint.sh
└── test-mcp-tools.sh
```

### 5.2 Files/Directories to KEEP & ADAPT

```
KEEP AND ADAPT:
├── substrate-api/api/          → MOVE TO: api/
│   ├── src/app/routes/         # Rename for IP domain
│   ├── src/app/models/         # Adapt for IP domain
│   └── src/app/services/       # Keep governance, provenance
│
├── substrate-api/web/          → MOVE TO: web/ (or merge)
│   ├── components/             # Adapt UI components
│   └── lib/                    # Keep utilities
│
├── supabase/                   # RESET (new project)
│   └── migrations/             # Fresh migrations only
│
├── docs/                       # KEEP structure, update content
├── scripts/                    # Adapt for new domain
└── tests/                      # Adapt for new domain
```

### 5.3 Files to CREATE

```
NEW FILES:
├── api/
│   └── src/app/
│       ├── routes/
│       │   ├── catalogs.py     # IP portfolios
│       │   ├── rights.py       # Rights entities
│       │   ├── licenses.py     # License management
│       │   └── queries.py      # Demand-side queries
│       └── schemas/
│           ├── musical_work.json
│           ├── sound_recording.json
│           └── [other IP types].json
│
├── supabase/migrations/
│   ├── 00001_core_schema.sql
│   ├── 00002_rights_entities.sql
│   └── [fresh migrations]
│
├── docs/
│   ├── CLEARINGHOUSE_INFRASTRUCTURE.md  # This document
│   ├── DOMAIN_MODEL.md
│   └── API_REFERENCE.md
│
└── render.yaml                 # New simplified config
```

---

## 6. Database Schema Strategy

### 6.1 Approach: Fresh Start

**Decision**: New Supabase project with clean migrations.

**Rationale**:
- No legacy data to migrate
- Clean schema without YARNNN artifacts
- Simpler maintenance
- Clear audit trail from day one

### 6.2 Core Tables

#### Migration 00001: Core Schema
```sql
-- Workspaces (multi-tenancy)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace memberships
CREATE TABLE workspace_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

-- Catalogs (IP portfolios)
CREATE TABLE catalogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Migration 00002: Rights Entities
```sql
-- Rights type schemas (defines structure per IP type)
CREATE TABLE rights_schemas (
    id TEXT PRIMARY KEY,  -- 'musical_work', 'sound_recording', etc.
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,  -- 'music', 'voice', 'visual', 'character'
    field_schema JSONB NOT NULL,  -- JSON Schema for content validation
    ai_permission_fields JSONB,   -- Schema for AI-specific permissions
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Rights entities (the actual IP records)
CREATE TABLE rights_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID REFERENCES catalogs(id) ON DELETE CASCADE,

    -- Classification
    rights_type TEXT NOT NULL REFERENCES rights_schemas(id),
    entity_key TEXT,  -- For non-singleton (e.g., ISRC, ISWC)

    -- Content
    title TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',  -- Type-specific metadata
    ai_permissions JSONB DEFAULT '{}',    -- AI usage permissions

    -- Ownership
    rights_holder_id UUID,  -- Future: link to rights_holders table
    ownership_chain JSONB,  -- Provenance of ownership

    -- Status
    status TEXT DEFAULT 'active',
    verification_status TEXT DEFAULT 'unverified',

    -- Versioning
    version INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES rights_entities(id),

    -- Audit
    created_by TEXT NOT NULL,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    UNIQUE(catalog_id, rights_type, entity_key)
);
```

#### Migration 00003: Governance
```sql
-- Proposals (rights change requests)
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID REFERENCES catalogs(id) ON DELETE CASCADE,

    -- Proposal details
    proposal_type TEXT NOT NULL,  -- 'CREATE', 'UPDATE', 'TRANSFER', 'DELETE'
    target_entity_id UUID REFERENCES rights_entities(id),
    payload JSONB NOT NULL,       -- Proposed changes
    reasoning TEXT,               -- Why this change

    -- Status
    status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'

    -- Review
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Migration 00004: Licensing
```sql
-- License templates
CREATE TABLE license_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT,
    license_type TEXT NOT NULL,  -- 'exclusive', 'non-exclusive', 'sync', etc.

    -- Terms
    terms JSONB NOT NULL,         -- Standard terms
    ai_terms JSONB,               -- AI-specific terms

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- License grants (active licenses)
CREATE TABLE license_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parties
    rights_entity_id UUID REFERENCES rights_entities(id),
    licensee_id UUID,             -- Future: licensees table
    template_id UUID REFERENCES license_templates(id),

    -- Terms
    terms JSONB NOT NULL,
    territory TEXT[],
    start_date DATE,
    end_date DATE,

    -- Status
    status TEXT DEFAULT 'active',

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Migration 00005: Audit Trail
```sql
-- Timeline events (complete audit trail)
CREATE TABLE timeline_events (
    id BIGSERIAL PRIMARY KEY,

    -- Scope
    workspace_id UUID REFERENCES workspaces(id),
    catalog_id UUID REFERENCES catalogs(id),

    -- Event details
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,    -- 'rights_entity', 'proposal', 'license'
    entity_id UUID NOT NULL,

    -- Content
    summary TEXT NOT NULL,
    payload JSONB,

    -- Actor
    actor_type TEXT NOT NULL,     -- 'user', 'system', 'api'
    actor_id TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX idx_timeline_catalog ON timeline_events(catalog_id, created_at DESC);
CREATE INDEX idx_timeline_entity ON timeline_events(entity_type, entity_id);
```

#### Migration 00006: Seed Schemas
```sql
-- Seed IP type schemas
INSERT INTO rights_schemas (id, display_name, description, category, field_schema, ai_permission_fields) VALUES
('musical_work', 'Musical Work', 'A musical composition (song)', 'music', '{
    "type": "object",
    "properties": {
        "iswc": {"type": "string", "description": "International Standard Musical Work Code"},
        "writers": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "ipi": {"type": "string"},
                "role": {"type": "string"},
                "split": {"type": "number"}
            }
        }},
        "publishers": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "share": {"type": "number"}
            }
        }}
    }
}', '{
    "training": {"type": "boolean", "description": "Allow AI model training"},
    "style_reference": {"type": "boolean", "description": "Allow style/influence reference"},
    "generation": {"type": "boolean", "description": "Allow AI generation of similar works"}
}'),

('sound_recording', 'Sound Recording', 'A recorded performance of a musical work', 'music', '{
    "type": "object",
    "properties": {
        "isrc": {"type": "string", "description": "International Standard Recording Code"},
        "artist": {"type": "string"},
        "label": {"type": "string"},
        "release_date": {"type": "string", "format": "date"},
        "duration_seconds": {"type": "integer"},
        "musical_work_id": {"type": "string", "description": "Reference to underlying musical work"}
    }
}', '{
    "training": {"type": "boolean"},
    "sampling": {"type": "boolean", "description": "Allow sampling in AI generations"},
    "derivative": {"type": "boolean", "description": "Allow derivative works"}
}'),

('voice_likeness', 'Voice Likeness', 'A persons voice identity rights', 'voice', '{
    "type": "object",
    "properties": {
        "talent_name": {"type": "string"},
        "agency": {"type": "string"},
        "union_affiliation": {"type": "string"},
        "sample_recordings": {"type": "array", "items": {"type": "string"}}
    }
}', '{
    "cloning": {"type": "boolean", "description": "Allow voice cloning"},
    "synthesis": {"type": "boolean", "description": "Allow voice synthesis"},
    "dubbing": {"type": "boolean", "description": "Allow AI dubbing"}
}'),

('character_ip', 'Character IP', 'A fictional character with associated rights', 'character', '{
    "type": "object",
    "properties": {
        "character_name": {"type": "string"},
        "franchise": {"type": "string"},
        "creator": {"type": "string"},
        "visual_assets": {"type": "array", "items": {"type": "string"}}
    }
}', '{
    "image_generation": {"type": "boolean"},
    "fan_art": {"type": "boolean"},
    "merchandise": {"type": "boolean"}
}'),

('visual_work', 'Visual Work', 'Visual art, photography, or imagery', 'visual', '{
    "type": "object",
    "properties": {
        "artist": {"type": "string"},
        "medium": {"type": "string"},
        "dimensions": {"type": "string"},
        "collection": {"type": "string"}
    }
}', '{
    "style_transfer": {"type": "boolean"},
    "training": {"type": "boolean"},
    "derivative": {"type": "boolean"}
}');
```

### 6.3 RLS Policies

All tables will have Row Level Security enabled:

```sql
-- Example: Rights entities RLS
ALTER TABLE rights_entities ENABLE ROW LEVEL SECURITY;

-- Select: workspace members can view
CREATE POLICY "rights_entities_select"
ON rights_entities FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM catalogs c
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE c.id = rights_entities.catalog_id
        AND wm.user_id = auth.uid()
    )
);

-- Insert/Update/Delete: similar patterns
-- Service role: full access for API backend
```

---

## 7. Environment Configuration

### 7.1 Environment Variables

#### API (.env)
```bash
# =============================================================================
# CLEARINGHOUSE API - Environment Configuration
# =============================================================================

# Environment
API_ENV=development  # development | staging | production

# Supabase (NEW PROJECT)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# CORS
CORS_ORIGINS=http://localhost:3000,https://clearinghouse.example.com

# Optional: Logging
LOG_LEVEL=INFO

# Optional: Rate Limiting
RATE_LIMIT_PER_MINUTE=100

# Future: AI Integration (for rights matching, etc.)
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
```

#### Frontend (.env.local)
```bash
# =============================================================================
# CLEARINGHOUSE WEB - Environment Configuration
# =============================================================================

# Environment
NEXT_PUBLIC_APP_ENV=development

# Supabase (NEW PROJECT)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API
NEXT_PUBLIC_API_URL=http://localhost:10000  # or production API URL

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 7.2 Secrets Management

| Secret | Where Stored | Used By |
|--------|--------------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Render env vars | API |
| `DATABASE_URL` | Render env vars | API |
| `SUPABASE_ANON_KEY` | Vercel env vars | Frontend |

---

## 8. Deployment Configuration

### 8.1 render.yaml (NEW)

```yaml
# =============================================================================
# CLEARINGHOUSE - Render Deployment Configuration
# =============================================================================

services:
  # Main API Backend
  - type: web
    name: clearinghouse-api
    env: python
    region: oregon  # or your preferred region
    plan: starter   # upgrade as needed

    # Build & Start
    buildCommand: pip install --upgrade pip && pip install -r requirements.txt
    startCommand: uvicorn src.app.main:app --host 0.0.0.0 --port 10000 --log-level info

    # Root directory
    root: api/

    # Health check
    healthCheckPath: /health

    # Environment variables
    envVars:
      - key: API_ENV
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: CORS_ORIGINS
        value: https://clearinghouse.example.com
      - key: LOG_LEVEL
        value: INFO

# Future: Add cron jobs for scheduled tasks if needed
# - type: cron
#   name: clearinghouse-usage-aggregator
#   ...
```

### 8.2 Vercel Configuration

Configure via Vercel Dashboard or `vercel.json`:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

---

## 9. Reusable Components

### 9.1 From Substrate API (KEEP)

| Component | Location | Adaptation Needed |
|-----------|----------|-------------------|
| **Governance Pipeline** | `routes/proposals.py` | Rename for rights domain |
| **Timeline Events** | `services/timeline.py` | Keep as-is, update event types |
| **RLS Patterns** | migrations | Apply to new tables |
| **Supabase Client** | `services/supabase.py` | Keep as-is |
| **Auth Middleware** | `dependencies.py` | Keep as-is |
| **Health Routes** | `routes/health.py` | Keep as-is |

### 9.2 From Frontend (KEEP)

| Component | Location | Adaptation Needed |
|-----------|----------|-------------------|
| **Supabase Clients** | `lib/supabase/` | Keep as-is |
| **Auth Components** | `components/auth/` | Keep as-is |
| **UI Primitives** | `components/ui/` | Keep as-is (Radix/shadcn) |
| **Data Tables** | `components/tables/` | Adapt columns |
| **Form Components** | `components/forms/` | Adapt fields |
| **Layout Components** | `components/layout/` | Keep as-is |

### 9.3 Patterns to Preserve

| Pattern | Description | Why Keep |
|---------|-------------|----------|
| **BFF Architecture** | Frontend calls API, not DB directly | Security, abstraction |
| **Proposal Pipeline** | All mutations go through proposals | Governance, audit |
| **Timeline Events** | Every change emits event | Provenance |
| **Tiered Content** | Foundation/working/ephemeral tiers | Maps to ownership/license/usage |
| **Flexible JSONB** | Schema-defined but flexible content | Supports any IP type |
| **Multi-tenant RLS** | Workspace isolation | Security |

---

## 10. Implementation Checklist

### Phase 1: Infrastructure Setup

- [ ] Create new Supabase project
  - [ ] Project name: `clearinghouse-prod`
  - [ ] Enable pgvector extension
  - [ ] Note credentials (URL, keys, connection string)
  - [ ] Configure auth providers

- [ ] Run initial migrations
  - [ ] 00001_core_schema.sql
  - [ ] 00002_rights_entities.sql
  - [ ] 00003_governance.sql
  - [ ] 00004_licensing.sql
  - [ ] 00005_audit_trail.sql
  - [ ] 00006_seed_schemas.sql

- [ ] Create Render service
  - [ ] Service name: `clearinghouse-api`
  - [ ] Configure environment variables
  - [ ] Deploy initial version

- [ ] Create Vercel project
  - [ ] Project name: `clearinghouse-web`
  - [ ] Connect to repository
  - [ ] Configure environment variables

### Phase 2: Repository Cleanup

- [ ] Remove YARNNN directories
  - [ ] `work-platform/`
  - [ ] `mcp-server/`
  - [ ] `apps/`

- [ ] Remove YARNNN files
  - [ ] Root markdown files
  - [ ] Test scripts
  - [ ] Legacy configs

- [ ] Restructure directories
  - [ ] Move `substrate-api/api/` → `api/`
  - [ ] Consolidate web directories
  - [ ] Update imports

- [ ] Update configurations
  - [ ] New `render.yaml`
  - [ ] New `package.json`
  - [ ] New `.env.example`

### Phase 3: Code Adaptation

- [ ] API refactoring
  - [ ] Rename routes for IP domain
  - [ ] Update models
  - [ ] Remove agent/work code
  - [ ] Update tests

- [ ] Frontend refactoring
  - [ ] Update pages
  - [ ] Update components
  - [ ] Remove work/agent UI

### Phase 4: Documentation & Polish

- [ ] Update documentation
  - [ ] Domain model docs
  - [ ] API reference
  - [ ] Deployment guide

- [ ] Configure CI/CD
  - [ ] GitHub Actions
  - [ ] Deployment pipelines

- [ ] Final testing
  - [ ] Integration tests
  - [ ] E2E tests

---

## Appendix A: Domain Model Mapping

| YARNNN Concept | Clearinghouse Concept |
|----------------|----------------------|
| Workspace | Workspace (same) |
| Basket | Catalog |
| Context Item | Rights Entity |
| Context Entry Schema | Rights Schema |
| Tier (foundation/working/ephemeral) | Layer (ownership/license/usage) |
| Proposal | Proposal (same pattern) |
| Timeline Event | Timeline Event (same pattern) |
| Reference Asset | Reference Asset (contracts, masters) |

---

## Appendix B: Future Considerations

### B.1 External Integrations

| Integration | Purpose | Priority |
|-------------|---------|----------|
| Supply-side API | Rights holder catalog upload | High |
| Demand-side API | AI platform license queries | High |
| Webhook endpoints | Usage reporting | Medium |
| Settlement system | Payment processing | Future |

### B.2 Scalability

| Consideration | Approach |
|---------------|----------|
| Large catalogs | Pagination, efficient indexes |
| High query volume | Read replicas, caching |
| Global distribution | Multi-region deployment |
| Real-time updates | Supabase Realtime, WebSockets |

---

**Document Owner**: Engineering
**Last Updated**: 2025-12-08
**Next Review**: After Phase 1 completion
