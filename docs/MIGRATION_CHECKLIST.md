# Clearinghouse Migration Checklist

**Status**: In Progress
**Started**: 2025-12-08
**Target**: Complete infrastructure pivot from YARNNN to Clearinghouse

---

## Quick Reference

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | [ ] | Infrastructure Setup |
| Phase 2 | [ ] | Repository Cleanup |
| Phase 3 | [ ] | Code Adaptation |
| Phase 4 | [ ] | Documentation & Polish |

---

## Phase 1: Infrastructure Setup

### 1.1 Supabase (New Project)

- [ ] **Create new Supabase project**
  - Project name: `clearinghouse-prod`
  - Region: _______________
  - Organization: _______________

- [ ] **Record credentials**
  ```
  SUPABASE_URL=
  SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  DATABASE_URL=
  ```

- [ ] **Enable extensions**
  - [ ] pgvector
  - [ ] uuid-ossp (usually enabled)

- [ ] **Configure authentication**
  - [ ] Email/password auth
  - [ ] (Optional) OAuth providers

- [ ] **Configure storage**
  - [ ] Create bucket: `assets` (for contracts, master files)
  - [ ] Set bucket policies

### 1.2 Database Schema

- [ ] **Run migrations** (in order)
  - [ ] 00001_core_schema.sql
  - [ ] 00002_rights_entities.sql
  - [ ] 00003_governance.sql
  - [ ] 00004_licensing.sql
  - [ ] 00005_audit_trail.sql
  - [ ] 00006_seed_schemas.sql

- [ ] **Verify tables created**
  - [ ] workspaces
  - [ ] workspace_memberships
  - [ ] catalogs
  - [ ] rights_schemas
  - [ ] rights_entities
  - [ ] proposals
  - [ ] license_templates
  - [ ] license_grants
  - [ ] timeline_events

- [ ] **Verify RLS enabled on all tables**

- [ ] **Create test workspace**
  ```sql
  INSERT INTO workspaces (name, slug) VALUES ('Test Workspace', 'test');
  ```

### 1.3 Render (API)

- [ ] **Archive/delete old services** (from YARNNN)
  - [ ] yarnnn-work-platform-api
  - [ ] yarnnn-substrate-api
  - [ ] yarnnn-chatgpt-app
  - [ ] yarnnn-schedule-executor
  - [ ] yarnnn-queue-processor

- [ ] **Create new service**
  - Service name: `clearinghouse-api`
  - Environment: Python
  - Region: _______________
  - Plan: Starter (upgrade later)

- [ ] **Configure environment variables**
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_SERVICE_ROLE_KEY
  - [ ] DATABASE_URL
  - [ ] API_ENV=production
  - [ ] CORS_ORIGINS
  - [ ] LOG_LEVEL=INFO

- [ ] **Configure build settings**
  - Root directory: `api/`
  - Build command: `pip install -r requirements.txt`
  - Start command: `uvicorn src.app.main:app --host 0.0.0.0 --port 10000`

- [ ] **Deploy and verify**
  - [ ] Health check passes
  - [ ] Can connect to database

### 1.4 Vercel (Frontend)

- [ ] **Archive/delete old projects** (from YARNNN)
  - [ ] yarnnn-work-platform-web (if exists)
  - [ ] yarnnn-substrate-web (if exists)

- [ ] **Create new project**
  - Project name: `clearinghouse-web`
  - Framework: Next.js
  - Root directory: `web/`

- [ ] **Configure environment variables**
  - [ ] NEXT_PUBLIC_SUPABASE_URL
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
  - [ ] NEXT_PUBLIC_API_URL
  - [ ] NEXT_PUBLIC_APP_ENV=production

- [ ] **Deploy and verify**
  - [ ] Build succeeds
  - [ ] Auth flow works

---

## Phase 2: Repository Cleanup

### 2.1 Remove YARNNN Directories

- [ ] **Remove work-platform**
  ```bash
  rm -rf work-platform/
  ```

- [ ] **Remove MCP server**
  ```bash
  rm -rf mcp-server/
  ```

- [ ] **Remove apps**
  ```bash
  rm -rf apps/
  ```

- [ ] **Remove substrate-api MCP**
  ```bash
  rm -rf substrate-api/mcp-server/
  ```

### 2.2 Remove YARNNN Root Files

- [ ] **Remove documentation files**
  ```bash
  rm -f ARCHITECTURE_CORRECTION_SUMMARY.md
  rm -f FRONTEND_AGENT_SESSIONS_UPDATE.md
  rm -f FRONTEND_IMPLEMENTATION_NEXT_STEPS.md
  rm -f FRONTEND_WORK_RECIPES_INTEGRATION.md
  rm -f LOGGING_ENHANCEMENT_SUMMARY.md
  rm -f MIGRATION_SUCCESS_SUMMARY.md
  rm -f RECIPE_EXECUTION_FLOW_VALIDATION.md
  rm -f SEMANTIC_TYPES_QUICK_REFERENCE.txt
  rm -f TRACKING_PAGE_REFACTOR_SUMMARY.md
  rm -f WORK_ORCHESTRATION_FLOW_ASSESSMENT.md
  ```

- [ ] **Remove test/debug scripts**
  ```bash
  rm -f apply_timeline_migration.sql
  rm -f check_tp_session.py
  rm -f diagnose_tp_sdk.py
  rm -f mcp-auth-proxy.js
  rm -f test_bff_foundation.py
  rm -f test_tp_endpoint.sh
  rm -f test-mcp-tools.sh
  ```

### 2.3 Restructure Directories

- [ ] **Move API to root**
  ```bash
  # Backup first
  cp -r substrate-api/api api_new

  # Remove old structure
  rm -rf substrate-api/

  # Rename
  mv api_new api
  ```

- [ ] **Consolidate web directories**
  - [ ] Evaluate `substrate-api/web/` vs `web/`
  - [ ] Choose one, move to `web/`
  - [ ] Delete the other

- [ ] **Clean supabase directory**
  ```bash
  # Archive old migrations
  mkdir -p supabase/archive
  mv supabase/migrations/* supabase/archive/

  # Create fresh migrations directory
  mkdir -p supabase/migrations
  ```

### 2.4 Update Root Configuration

- [ ] **Update render.yaml**
  - [ ] Remove old services
  - [ ] Add clearinghouse-api service

- [ ] **Update package.json**
  - [ ] Update name to "clearinghouse"
  - [ ] Remove YARNNN-specific scripts
  - [ ] Update postinstall paths

- [ ] **Update .env.example**
  - [ ] Remove YARNNN variables
  - [ ] Add Clearinghouse variables

- [ ] **Update .gitignore**
  - [ ] Review and clean up

- [ ] **Update README.md**
  - [ ] New project description
  - [ ] Setup instructions

---

## Phase 3: Code Adaptation

### 3.1 API Refactoring

- [ ] **Rename entry point**
  - [ ] `agent_server.py` → `main.py`

- [ ] **Update routes**
  - [ ] `baskets.py` → `catalogs.py`
  - [ ] `context_items.py` → `rights.py`
  - [ ] Keep `proposals.py` (update for rights domain)
  - [ ] Keep `health.py`
  - [ ] Add `licenses.py`
  - [ ] Add `queries.py`

- [ ] **Remove agent/work routes**
  - [ ] Remove work-related endpoints
  - [ ] Remove agent execution code
  - [ ] Remove MCP integration code

- [ ] **Update models**
  - [ ] Rename context_item → rights_entity
  - [ ] Rename basket → catalog
  - [ ] Update field names

- [ ] **Update services**
  - [ ] Keep governance service
  - [ ] Keep timeline service
  - [ ] Remove agent services
  - [ ] Remove work services

- [ ] **Update tests**
  - [ ] Rename test files
  - [ ] Update assertions

### 3.2 Frontend Refactoring

- [ ] **Update pages**
  - [ ] Dashboard → Catalogs overview
  - [ ] Projects → Catalogs
  - [ ] Context → Rights
  - [ ] Remove work/agent pages

- [ ] **Update components**
  - [ ] Rename context components → rights components
  - [ ] Remove work supervision components
  - [ ] Remove agent dashboard components

- [ ] **Update navigation**
  - [ ] Update sidebar items
  - [ ] Update breadcrumbs

- [ ] **Update API calls**
  - [ ] Update endpoint paths
  - [ ] Update request/response types

### 3.3 Testing

- [ ] **API tests**
  - [ ] Catalogs CRUD
  - [ ] Rights entities CRUD
  - [ ] Proposals workflow
  - [ ] License management

- [ ] **Frontend tests**
  - [ ] Auth flow
  - [ ] Navigation
  - [ ] Forms

- [ ] **Integration tests**
  - [ ] End-to-end workflows

---

## Phase 4: Documentation & Polish

### 4.1 Documentation

- [ ] **Update docs/**
  - [ ] Archive YARNNN docs
  - [ ] Update architecture docs
  - [ ] Create API reference
  - [ ] Create deployment guide

- [ ] **README.md**
  - [ ] Project description
  - [ ] Quick start guide
  - [ ] Development setup

- [ ] **CONTRIBUTING.md**
  - [ ] Development workflow
  - [ ] Code style

### 4.2 CI/CD

- [ ] **Update GitHub Actions**
  - [ ] Update build paths
  - [ ] Update test commands
  - [ ] Update deploy triggers

- [ ] **Configure branch protection**
  - [ ] main branch rules
  - [ ] Required checks

### 4.3 Final Verification

- [ ] **Full test suite passes**
- [ ] **Manual testing complete**
  - [ ] Auth flow
  - [ ] Create catalog
  - [ ] Add rights entity
  - [ ] Create proposal
  - [ ] Approve proposal
  - [ ] View timeline

- [ ] **Production deploy successful**
- [ ] **Monitoring configured**

---

## Notes & Decisions

### Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-08 | New Supabase project | Clean slate, no legacy |
| 2025-12-08 | Keep governance pipeline | Proven pattern, fits domain |
| 2025-12-08 | Schema-driven IP types | Extensible without code changes |

### Blockers

| Issue | Status | Resolution |
|-------|--------|------------|
| | | |

### Open Questions

- [ ] Domain name for production?
- [ ] Initial IP types to support?
- [ ] Auth provider requirements?

---

## Post-Migration Tasks

- [ ] Set up monitoring/alerting
- [ ] Configure backups
- [ ] Document operational procedures
- [ ] Plan first catalog import

---

**Last Updated**: 2025-12-08
