# Phase 2 Implementation Plan: Bulk Upload, File Processing & Embeddings

> **Date**: 2025-12-10
> **Status**: Planning
> **Estimated Scope**: 4 work streams, ~15-20 implementation tasks

---

## Executive Summary

This plan covers the implementation of core Phase 2 features for Clearinghouse:

| Priority | Feature | Current State | Target State |
|----------|---------|---------------|--------------|
| **P0** | Bulk catalog upload | API exists, basic UI | Full CSV/JSON import with validation UI |
| **P0** | Multi-modal file upload | API exists, no UI | Drag-drop upload with progress tracking |
| **P1** | Async embedding pipeline | Schema ready, no worker | Background worker processing jobs |
| **P1** | Processing status UI | Component exists | Real-time status polling/display |

---

## Current Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js 15    │────▶│   FastAPI       │────▶│   Supabase      │
│   (Vercel)      │     │   (Render)      │     │   (PostgreSQL)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │                       │
                                │                       ▼
                                │               ┌─────────────────┐
                                │               │  Supabase       │
                                │               │  Storage        │
                                │               └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │  OpenAI API     │
                        │  (Embeddings)   │
                        └─────────────────┘
```

### What Already Exists

**Backend (substrate-api/api)**:
- `routes/imports.py` - CSV/JSON bulk import endpoints
- `routes/assets.py` - File upload to Supabase Storage
- `routes/jobs.py` - Processing job CRUD
- `services/embeddings.py` - OpenAI embedding generation
- Database schema with `processing_jobs`, `entity_embeddings`, `reference_assets`

**Frontend (web/src)**:
- `lib/api.ts` - Full API client with all endpoints
- `components/ProcessingStatus.tsx` - Status badge component
- Basic CSV import form in catalog detail page

### What's Missing

1. **Background Job Worker** - No process to consume `processing_jobs` queue
2. **Vector Search Implementation** - Endpoints return 501
3. **Upload UI** - No drag-drop, progress tracking, or file preview
4. **Real-time Status** - No polling/WebSocket for job status updates

---

## Implementation Streams

### Stream 1: Bulk Import UI Enhancement

**Goal**: Robust CSV/JSON import with validation, preview, and error handling

**Files to Modify**:
- `web/src/app/(dashboard)/dashboard/catalogs/[id]/page.tsx`
- `web/src/components/BulkImportDialog.tsx` (new)
- `web/src/components/ImportPreview.tsx` (new)

**Tasks**:

#### 1.1 Create BulkImportDialog Component
```typescript
// Components needed:
// - File drop zone (CSV/JSON)
// - Rights type selector
// - Preview table with validation
// - Error display per row
// - Auto-process checkbox
// - Import progress bar
```

**Acceptance Criteria**:
- [ ] Drag-drop or click-to-upload for CSV/JSON files
- [ ] Client-side parsing and validation before upload
- [ ] Preview table showing first 10 rows with validation status
- [ ] Clear error messages for invalid rows (missing title, bad JSON, etc.)
- [ ] Rights type dropdown populated from `/rights-schemas`
- [ ] "Auto-generate embeddings" checkbox (default: true)
- [ ] Progress indicator during import
- [ ] Success/failure summary with downloadable error report

#### 1.2 CSV Template Download
```typescript
// Add template download button per rights_type
// Fetches from: GET /api/v1/catalogs/{id}/import/template?rights_type=X
```

**Acceptance Criteria**:
- [ ] Download button for each rights type
- [ ] Template includes example data
- [ ] Headers match schema field definitions

#### 1.3 JSON Import Support
```typescript
// Add JSON file support alongside CSV
// Parse and validate against rights_schema.field_schema
```

**Acceptance Criteria**:
- [ ] Accept .json files with array of entities
- [ ] Validate each entity against selected rights_type schema
- [ ] Same preview/error UX as CSV

---

### Stream 2: Multi-Modal File Upload

**Goal**: Upload reference assets (audio, image, video, documents) with proper UX

**Files to Modify**:
- `web/src/app/(dashboard)/dashboard/entities/[id]/page.tsx`
- `web/src/components/AssetUploader.tsx` (new)
- `web/src/components/AssetGallery.tsx` (new)
- `substrate-api/api/src/app/routes/assets.py` (minor updates)

**Tasks**:

#### 2.1 Create AssetUploader Component
```typescript
// Features:
// - Drag-drop zone with file type icons
// - Multi-file selection
// - Asset type auto-detection from MIME
// - Upload progress per file
// - Retry failed uploads
```

**Acceptance Criteria**:
- [ ] Drag-drop zone accepts multiple files
- [ ] File type validation (audio/*, image/*, video/*, application/pdf)
- [ ] Auto-detect asset_type from MIME type
- [ ] Individual progress bars per file
- [ ] Cancel in-progress uploads
- [ ] Retry failed uploads
- [ ] Max file size validation (50MB default)

#### 2.2 Create AssetGallery Component
```typescript
// Display uploaded assets with:
// - Thumbnails for images
// - Audio player for audio files
// - PDF preview (first page)
// - Processing status badge
// - Download/delete actions
```

**Acceptance Criteria**:
- [ ] Grid view of assets with appropriate previews
- [ ] ProcessingStatus badge for each asset
- [ ] Click to expand/preview
- [ ] Download button (signed URL)
- [ ] Delete with confirmation
- [ ] Filter by asset_type

#### 2.3 Integrate with Entity Detail Page
```typescript
// Add AssetUploader + AssetGallery to entity detail
// Fetch assets on mount, refresh after upload
```

**Acceptance Criteria**:
- [ ] Assets section on entity detail page
- [ ] Upload triggers asset refresh
- [ ] Processing status updates visible

---

### Stream 3: Background Job Worker

**Goal**: Process queued jobs (embeddings, asset analysis) asynchronously

**Files to Create**:
- `substrate-api/api/src/worker/main.py` (new)
- `substrate-api/api/src/worker/handlers.py` (new)
- `substrate-api/api/src/worker/config.py` (new)

**Architecture**:
```
┌─────────────────────────────────────────────────────────┐
│                    Worker Process                        │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │  Job Poller  │───▶│  Dispatcher  │───▶│ Handlers  │  │
│  │  (10s loop)  │    │              │    │           │  │
│  └──────────────┘    └──────────────┘    └───────────┘  │
│                              │                          │
│                              ▼                          │
│                     ┌──────────────┐                    │
│                     │  Status      │                    │
│                     │  Updater     │                    │
│                     └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

**Tasks**:

#### 3.1 Create Worker Entry Point
```python
# worker/main.py
# - Async polling loop
# - Graceful shutdown handling
# - Configurable poll interval
# - Max concurrent jobs setting
```

**Acceptance Criteria**:
- [ ] Polls `processing_jobs` table every 10 seconds
- [ ] Selects jobs with `status='queued'` ordered by priority DESC, created_at ASC
- [ ] Limits concurrent processing (default: 3)
- [ ] Graceful shutdown on SIGTERM/SIGINT
- [ ] Logging with correlation IDs

#### 3.2 Implement Job Handlers
```python
# worker/handlers.py
# Handler for each job_type:

async def handle_embedding_generation(job, db):
    """Generate text embedding for entity"""
    # 1. Fetch entity data
    # 2. Build text using EmbeddingService.build_entity_text()
    # 3. Generate embedding via OpenAI
    # 4. Store in entity_embeddings table
    # 5. Update entity.embedding_status = 'ready'

async def handle_batch_import(job, db):
    """Process entities from bulk import"""
    # 1. Get entity IDs from job.config
    # 2. For each entity, create embedding_generation job
    # 3. Update job.result with counts

async def handle_asset_analysis(job, db):
    """Extract metadata from asset file"""
    # 1. Download asset from Supabase Storage
    # 2. Extract metadata based on MIME type:
    #    - Audio: duration, sample_rate, channels
    #    - Image: dimensions, format
    #    - PDF: page count, text preview
    # 3. Update asset.extracted_metadata
    # 4. Update asset.processing_status = 'ready'

async def handle_metadata_extraction(job, db):
    """OCR/transcription for text extraction"""
    # Future: Whisper for audio, OCR for images
    pass
```

**Acceptance Criteria**:
- [ ] `embedding_generation` handler works end-to-end
- [ ] `batch_import` creates child jobs for entities
- [ ] `asset_analysis` extracts basic metadata
- [ ] All handlers update job.status and job.result
- [ ] Errors captured in job.error_message
- [ ] Retry logic respects max_retries

#### 3.3 Status Update Mechanism
```python
# Ensure all status transitions are atomic:
# Job: queued → processing → completed/failed
# Entity: pending → processing → ready/failed
# Asset: pending → processing → ready/failed
```

**Acceptance Criteria**:
- [ ] Job claimed with `UPDATE ... WHERE status='queued' ... RETURNING`
- [ ] Entity/asset status updated atomically with job
- [ ] Failed jobs increment retry_count
- [ ] Jobs exceeding max_retries marked as failed permanently

#### 3.4 Deployment Configuration
```yaml
# render.yaml additions for worker service
services:
  - type: worker
    name: clearinghouse-worker
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: python -m src.worker.main
    envVars:
      - key: DATABASE_URL
        fromDatabase: ...
```

**Acceptance Criteria**:
- [ ] Worker runs as separate Render service
- [ ] Shares DATABASE_URL and OPENAI_API_KEY with API
- [ ] Health check endpoint for monitoring
- [ ] Restart on failure

---

### Stream 4: Processing Status UI

**Goal**: Real-time visibility into job processing status

**Files to Modify**:
- `web/src/components/ProcessingStatus.tsx` (enhance)
- `web/src/components/JobQueue.tsx` (new)
- `web/src/hooks/useJobPolling.ts` (new)
- `web/src/app/(dashboard)/dashboard/catalogs/[id]/page.tsx`

**Tasks**:

#### 4.1 Create useJobPolling Hook
```typescript
// Custom hook for polling job status
function useJobPolling(entityId: string, options?: {
  interval?: number;  // default 5000ms
  enabled?: boolean;
}) {
  // Returns: { jobs, isLoading, error, refetch }
}
```

**Acceptance Criteria**:
- [ ] Polls `/entities/{id}/jobs` at configurable interval
- [ ] Stops polling when all jobs completed/failed
- [ ] Exponential backoff on errors
- [ ] Cleanup on unmount

#### 4.2 Enhance ProcessingStatus Component
```typescript
// Add job details popover:
// - List of active/recent jobs
// - Progress indication
// - Error messages for failed jobs
// - Retry button for failed jobs
```

**Acceptance Criteria**:
- [ ] Clickable status badge opens popover
- [ ] Shows list of jobs with status icons
- [ ] Failed jobs show error message
- [ ] Retry button calls `POST /jobs/{id}/retry`
- [ ] Cancel button for queued jobs

#### 4.3 Create JobQueue Dashboard Component
```typescript
// Admin view of all processing jobs
// Filters: status, job_type, date range
// Actions: cancel, retry, view details
```

**Acceptance Criteria**:
- [ ] Table view of all workspace jobs
- [ ] Filter by status, job_type
- [ ] Sort by created_at, priority
- [ ] Bulk actions (cancel selected)
- [ ] Auto-refresh toggle

#### 4.4 Integrate Status into Entity/Catalog Views
```typescript
// Show embedding status on entity cards
// Show processing summary on catalog page
```

**Acceptance Criteria**:
- [ ] Entity cards show embedding_status badge
- [ ] Catalog page shows "X entities processing, Y ready"
- [ ] Visual indicator for entities with failed processing

---

## Implementation Order

```
Week 1: Foundation
├── 3.1 Worker entry point
├── 3.2 Embedding handler (basic)
└── 4.1 useJobPolling hook

Week 2: Core Features
├── 3.2 Complete all handlers
├── 3.3 Status update mechanism
├── 1.1 BulkImportDialog component
└── 4.2 Enhanced ProcessingStatus

Week 3: Upload & Polish
├── 2.1 AssetUploader component
├── 2.2 AssetGallery component
├── 1.2 CSV template download
└── 1.3 JSON import support

Week 4: Integration & Deploy
├── 2.3 Entity detail integration
├── 4.3 JobQueue dashboard
├── 4.4 Status integration
└── 3.4 Worker deployment
```

---

## Technical Decisions

### Why Polling vs WebSocket?

**Decision**: Start with polling, add WebSocket later if needed.

**Rationale**:
- Polling is simpler to implement and debug
- Job processing is typically 5-30 seconds (not real-time critical)
- WebSocket adds complexity (connection management, reconnection, server-sent events)
- Can upgrade to WebSocket/SSE if polling proves insufficient

### Why Separate Worker Process?

**Decision**: Worker runs as separate Render service, not within API.

**Rationale**:
- Isolates CPU-intensive work from API response times
- Can scale worker independently
- Prevents API timeouts during long processing
- Cleaner separation of concerns
- Render's worker service type is designed for this

### Embedding Model Choice

**Decision**: OpenAI `text-embedding-3-small` (1536 dimensions)

**Rationale**:
- Good balance of quality and cost
- 1536 dims supported by pgvector efficiently
- Can upgrade to `text-embedding-3-large` (3072 dims) later if needed
- Existing code already uses this model

---

## Database Queries Reference

### Poll for Queued Jobs
```sql
UPDATE processing_jobs
SET status = 'processing', started_at = now(), updated_at = now()
WHERE id = (
  SELECT id FROM processing_jobs
  WHERE status = 'queued'
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

### Vector Similarity Search
```sql
SELECT re.*, 1 - (ee.embedding <=> $1::vector) as similarity
FROM rights_entities re
JOIN entity_embeddings ee ON ee.rights_entity_id = re.id
WHERE ee.embedding_type = 'content'
ORDER BY ee.embedding <=> $1::vector
LIMIT 20;
```

### Job Status Summary by Entity
```sql
SELECT
  rights_entity_id,
  COUNT(*) FILTER (WHERE status = 'queued') as queued,
  COUNT(*) FILTER (WHERE status = 'processing') as processing,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM processing_jobs
WHERE rights_entity_id = ANY($1)
GROUP BY rights_entity_id;
```

---

## Environment Variables Required

```bash
# Worker service needs these (same as API):
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Worker-specific (optional):
WORKER_POLL_INTERVAL=10        # seconds
WORKER_MAX_CONCURRENT=3        # parallel jobs
WORKER_LOG_LEVEL=INFO
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OpenAI rate limits | Implement exponential backoff, batch requests |
| Long-running jobs timeout | Set reasonable job timeouts, checkpoint progress |
| Worker crash loses jobs | Jobs stay in 'processing' until completed, restart reclaims |
| Large file uploads fail | Use signed URLs for client-side upload, chunking |
| Database connection exhaustion | Connection pooling, limit worker concurrency |

---

## Success Metrics

- [ ] Bulk import: 100 entities in < 30 seconds
- [ ] File upload: 50MB file uploads successfully
- [ ] Embedding generation: < 5 seconds per entity
- [ ] Job queue: No jobs stuck in 'processing' > 5 minutes
- [ ] UI responsiveness: Status updates visible within 10 seconds

---

## Next Steps

1. **Review this plan** - Confirm priorities and technical decisions
2. **Set up OpenAI API key** - Required for embedding generation
3. **Start with Stream 3.1** - Worker foundation is the blocker
4. **Iterate** - Ship incremental improvements

---

*Document maintained in `/docs/implementation/PHASE2_IMPLEMENTATION_PLAN.md`*
