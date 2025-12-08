# Clearinghouse

**IP Licensing Infrastructure for the AI Era**

Clearinghouse is a platform for registering intellectual property rights, managing AI training permissions, and licensing creative works with complete provenance tracking.

## Core Capabilities

- **Rights Registry**: Register musical works, sound recordings, voice likenesses, character IP, and visual works with industry-standard identifiers (ISRC, ISWC, etc.)
- **AI Permissions**: Define granular permissions for AI training, generation, style transfer, voice cloning, and derivative works
- **Governance Pipeline**: Proposal-based workflow for rights changes with configurable auto-approval rules
- **License Management**: Create license templates, grant licenses to platforms, and track usage
- **Complete Provenance**: Immutable timeline of all events with before/after states and full audit trail

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│                    substrate-api/web                     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   API Layer (FastAPI)                    │
│                 substrate-api/api/src/app                │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────────────┐ │
│  │Workspaces│ │ Catalogs │ │Entities│ │   Proposals    │ │
│  └─────────┘ └──────────┘ └────────┘ └────────────────┘ │
│  ┌─────────┐ ┌──────────┐ ┌────────────────────────────┐│
│  │Licenses │ │ Timeline │ │        Health              ││
│  └─────────┘ └──────────┘ └────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 Database (PostgreSQL)                    │
│                      Supabase                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Core: workspaces, catalogs, rights_entities       │  │
│  │ Schemas: rights_schemas (extensible IP types)     │  │
│  │ Governance: proposals, governance_rules           │  │
│  │ Licensing: license_templates, grants, usage       │  │
│  │ Audit: timeline_events (immutable log)            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Supported IP Types

Schema-driven architecture supports any intellectual property type. Pre-configured schemas:

| Category | IP Type | Key Fields |
|----------|---------|------------|
| Music | `musical_work` | ISWC, writers, publishers, genres |
| Music | `sound_recording` | ISRC, artist, label, duration |
| Voice | `voice_likeness` | talent_name, agency, union_affiliation |
| Character | `character_ip` | character_name, franchise, visual_assets |
| Visual | `visual_work` | artist, medium, dimensions, style |

## Technology Stack

- **Frontend**: Next.js 14 + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth + JWT

## Repository Structure

```
clearinghouse/
├── substrate-api/
│   ├── api/src/app/          # FastAPI application
│   │   ├── routes/           # API endpoints
│   │   ├── deps.py           # Database connection
│   │   └── main.py           # Application entry point
│   └── web/                  # Next.js frontend
│       ├── app/              # App router pages
│       └── package.json
├── supabase/
│   └── migrations/           # Database schema
│       ├── 00001_core_schema.sql
│       ├── 00002_rights_entities.sql
│       ├── 00003_governance.sql
│       ├── 00004_licensing.sql
│       ├── 00005_audit_trail.sql
│       └── 00006_seed_schemas.sql
├── docs/
│   ├── CLEARINGHOUSE_INFRASTRUCTURE.md
│   ├── DOMAIN_MODEL.md
│   └── MIGRATION_CHECKLIST.md
└── scripts/
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account

### Environment Setup

1. Copy environment template:
```bash
cp .env.example .env
```

2. Configure Supabase credentials in `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://...
```

### Run Migrations

See [SQL Direct Execution](#sql-direct-execution) for running migrations against Supabase.

### Start Development

**Frontend:**
```bash
cd substrate-api/web
npm install
npm run dev
```

**Backend:**
```bash
cd substrate-api/api
poetry install
poetry run uvicorn app.main:app --reload
```

## SQL Direct Execution

Migrations are run directly against Supabase PostgreSQL using `psql`.

### Connection Setup

Use the session pooler connection string (IPv4 compatible):
```bash
PG_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"
```

### Running Migrations

Execute migrations in order:
```bash
# Run a single migration
psql "$PG_URL" -f supabase/migrations/00001_core_schema.sql

# Run all migrations in sequence
for f in supabase/migrations/*.sql; do
  echo "Running $f..."
  psql "$PG_URL" -f "$f"
done
```

### Verify Tables

```bash
psql "$PG_URL" -c "\dt"
```

Expected tables:
- `workspaces`, `workspace_memberships`
- `catalogs`, `rights_schemas`, `rights_entities`, `reference_assets`
- `proposals`, `proposal_comments`, `governance_rules`
- `license_templates`, `licensees`, `license_grants`, `usage_records`
- `timeline_events`

## API Endpoints

### Health
- `GET /health` - API health check
- `GET /health/db` - Database connectivity
- `GET /health/tables` - Schema validation

### Workspaces
- `GET /api/v1/workspaces` - List user's workspaces
- `POST /api/v1/workspaces` - Create workspace
- `GET /api/v1/workspaces/{id}` - Get workspace details

### Catalogs
- `GET /api/v1/workspaces/{id}/catalogs` - List catalogs
- `POST /api/v1/workspaces/{id}/catalogs` - Create catalog

### Rights Entities
- `GET /api/v1/rights-schemas` - List IP type schemas
- `GET /api/v1/catalogs/{id}/entities` - List entities in catalog
- `POST /api/v1/catalogs/{id}/entities` - Create entity (governance-aware)
- `GET /api/v1/entities/{id}` - Get entity details
- `PATCH /api/v1/entities/{id}` - Update entity (governance-aware)

### Governance
- `GET /api/v1/catalogs/{id}/proposals` - List proposals
- `POST /api/v1/catalogs/{id}/proposals` - Create proposal
- `POST /api/v1/proposals/{id}/review` - Approve/reject proposal

### Licensing
- `GET /api/v1/workspaces/{id}/license-templates` - List templates
- `POST /api/v1/entities/{id}/licenses` - Grant license
- `POST /api/v1/licenses/{id}/usage` - Report usage

### Timeline
- `GET /api/v1/workspaces/{id}/timeline` - Workspace events
- `GET /api/v1/entities/{id}/timeline` - Entity history

## Documentation

- [Infrastructure Overview](docs/CLEARINGHOUSE_INFRASTRUCTURE.md) - System design and architecture
- [Domain Model](docs/DOMAIN_MODEL.md) - Core entities and relationships
- [Migration Checklist](docs/MIGRATION_CHECKLIST.md) - Setup and deployment guide

## License

MIT License - see [LICENSE](LICENSE) for details.
