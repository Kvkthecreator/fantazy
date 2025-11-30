# Context Page UI Refactoring Plan

**Date**: 2025-11-28
**Status**: Implementation Ready
**Related Canon**: [SUBSTRATE_DATA_TYPES.md](../canon/SUBSTRATE_DATA_TYPES.md)

---

## Objective

Refactor the Context page to support the four substrate data types taxonomy:
- **Blocks** - Semantic knowledge units
- **Entries** - Raw text content (from users AND agents)
- **Documents** - File-based content (PDFs, spreadsheets, data files)
- **Images** - Visual media (screenshots, diagrams)

### Key Changes

1. Expand tabs from 2 → 4 (Blocks, Entries, Documents, Images)
2. Consolidate "Add Context" into unified dropdown with type-specific actions
3. Split current "Assets" tab into Documents and Images
4. Create new "Entries" tab combining raw_dumps + text work_outputs
5. Add source badges (User/Agent) across all types

---

## Current State

```
work-platform/web/app/projects/[id]/context/
├── page.tsx                    # Server component
├── ContextPageClient.tsx       # Tab container (2 tabs: Blocks, Assets)
├── ContextBlocksClient.tsx     # Blocks list/grid
├── ContextAssetsClient.tsx     # Assets list/grid (all file types)
├── AddContextButton.tsx        # Opens AddContextModal
├── UploadAssetModal.tsx        # Asset upload with auto-classification
└── ContextInfoPopover.tsx      # Help popover

components/context/
├── AddContextModal.tsx         # Modal with text + file upload
└── AddContextComposer.tsx      # Composer UI
```

---

## Implementation Phases

### Phase 1: Backend API Preparation

**Goal**: Ensure APIs support type-filtered queries

#### 1.1 Entries API Route (NEW)
Create unified entries endpoint combining raw_dumps + work_outputs

**File**: `work-platform/web/app/api/baskets/[basketId]/entries/route.ts`

```typescript
// GET /api/baskets/{basketId}/entries
// Returns unified list:
// - raw_dumps (source: 'user')
// - work_outputs where output_type in TEXT_TYPES (source: 'agent')

const TEXT_OUTPUT_TYPES = [
  'finding', 'recommendation', 'insight',
  'draft_content', 'report_section', 'data_analysis'
];
```

**Backend substrate-api changes**: None required (use existing tables)

#### 1.2 Assets API Filter Enhancement
Ensure `/api/baskets/{basketId}/assets` supports mime_type filtering

**File**: Already exists at `work-platform/web/app/api/baskets/[basketId]/assets/route.ts`

Add query params:
- `mime_category=document` → filters to document MIME types
- `mime_category=image` → filters to image MIME types

---

### Phase 2: UI Components

#### 2.1 Update ContextPageClient.tsx
Expand from 2 tabs to 4 tabs

```tsx
// BEFORE:
<TabsList className="grid w-full max-w-[400px] grid-cols-2">
  <TabsTrigger value="blocks">Blocks</TabsTrigger>
  <TabsTrigger value="assets">Assets</TabsTrigger>
</TabsList>

// AFTER:
<TabsList className="grid w-full max-w-[600px] grid-cols-4">
  <TabsTrigger value="blocks">Blocks</TabsTrigger>
  <TabsTrigger value="entries">Entries</TabsTrigger>
  <TabsTrigger value="documents">Documents</TabsTrigger>
  <TabsTrigger value="images">Images</TabsTrigger>
</TabsList>
```

#### 2.2 Create ContextEntriesClient.tsx (NEW)
Display entries from both sources with unified UI

```tsx
interface Entry {
  id: string;
  title?: string;
  body: string;
  source: 'user' | 'agent';
  agent_type?: string;
  supervision_status?: string;
  created_at: string;
  // raw_dump specific
  processing_status?: string;
  // work_output specific
  output_type?: string;
  confidence?: number;
}
```

Features:
- List view with expandable content
- Source badge (User/Agent)
- Agent entries show supervision status
- Filter by source
- "Add Entry" button → opens text input modal

#### 2.3 Create ContextDocumentsClient.tsx (NEW)
Display document-type assets only

```tsx
// Filter assets where mime_type matches document patterns
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'application/json',
  'text/plain',
];
```

Features:
- Grid/list view with file icons by type
- Source badge (User upload / Agent generated)
- Classification status indicator
- Download/preview actions
- "Upload Document" button

#### 2.4 Create ContextImagesClient.tsx (NEW)
Display image-type assets only

```tsx
// Filter assets where mime_type LIKE 'image/%'
```

Features:
- Grid view with thumbnails
- Source badge
- Classification status/description
- Lightbox preview
- "Upload Image" button

#### 2.5 Refactor AddContextButton.tsx
Convert to dropdown with type-specific actions

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>
      <Plus className="h-4 w-4 mr-1.5" />
      Add Context
      <ChevronDown className="h-4 w-4 ml-1" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => openModal('text')}>
      <FileText className="h-4 w-4 mr-2" />
      Add Text Entry
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => openModal('document')}>
      <FileBox className="h-4 w-4 mr-2" />
      Upload Document
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => openModal('image')}>
      <Image className="h-4 w-4 mr-2" />
      Upload Image
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => openModal('paste')}>
      <Clipboard className="h-4 w-4 mr-2" />
      Paste Context (text + files)
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

#### 2.6 Create Source Badge Component (NEW)

**File**: `components/context/SourceBadge.tsx`

```tsx
interface SourceBadgeProps {
  source: 'user' | 'agent' | 'system';
  agentType?: string;
}

export function SourceBadge({ source, agentType }: SourceBadgeProps) {
  if (source === 'agent') {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <Bot className="h-3 w-3" />
        {agentType || 'Agent'}
      </Badge>
    );
  }
  if (source === 'user') {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <User className="h-3 w-3" />
        User
      </Badge>
    );
  }
  return null;
}
```

---

### Phase 3: Modal Refactoring

#### 3.1 Create AddEntryModal.tsx (NEW)
Simple text entry modal (replaces part of AddContextModal)

```tsx
interface AddEntryModalProps {
  open: boolean;
  onClose: () => void;
  basketId: string;
  onSuccess: () => void;
}
```

Features:
- Text area for entry content
- Optional title
- Submit creates `raw_dumps` row
- Triggers P0-P1 pipeline (optional toggle)

#### 3.2 Refactor UploadAssetModal.tsx
Add mime_type hints for document vs image context

```tsx
interface UploadAssetModalProps {
  // existing props
  suggestedCategory?: 'document' | 'image';  // NEW
}
```

When opened from Documents tab → hint for document types
When opened from Images tab → hint for image types

---

### Phase 4: State & Data Flow

#### 4.1 Shared Types

**File**: `types/substrate.ts`

```typescript
export type SubstrateSource = 'user' | 'agent' | 'system';

export interface SubstrateItem {
  id: string;
  source: SubstrateSource;
  created_at: string;
}

export interface Entry extends SubstrateItem {
  title?: string;
  body: string;
  output_type?: string;
  supervision_status?: string;
  processing_status?: string;
  agent_type?: string;
  confidence?: number;
}

export interface Asset extends SubstrateItem {
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  asset_type: string;
  classification_status?: string;
  classification_confidence?: number;
  description?: string;
}

export type Document = Asset; // semantic alias
export type Image = Asset;   // semantic alias
```

#### 4.2 Context Page State

```tsx
// ContextPageClient.tsx
const [activeTab, setActiveTab] = useState<
  'blocks' | 'entries' | 'documents' | 'images'
>('blocks');
const [addModalType, setAddModalType] = useState<
  'text' | 'document' | 'image' | 'paste' | null
>(null);
```

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `app/api/baskets/[basketId]/entries/route.ts` | Unified entries API |
| `app/projects/[id]/context/ContextEntriesClient.tsx` | Entries tab component |
| `app/projects/[id]/context/ContextDocumentsClient.tsx` | Documents tab component |
| `app/projects/[id]/context/ContextImagesClient.tsx` | Images tab component |
| `app/projects/[id]/context/AddEntryModal.tsx` | Text entry modal |
| `components/context/SourceBadge.tsx` | Reusable source indicator |
| `types/substrate.ts` | Shared TypeScript types |

### Modified Files
| File | Changes |
|------|---------|
| `ContextPageClient.tsx` | 4 tabs, state for add modal type |
| `AddContextButton.tsx` | Dropdown menu with type options |
| `UploadAssetModal.tsx` | Add suggestedCategory prop |
| `ContextAssetsClient.tsx` | Rename/deprecate (functionality split) |

### Potentially Deprecated
| File | Reason |
|------|--------|
| `ContextAssetsClient.tsx` | Split into Documents + Images clients |
| `AddContextModal.tsx` | Split into AddEntryModal + direct upload |

---

## Migration Path

1. **Phase 1**: Add new API routes (non-breaking)
2. **Phase 2**: Create new components alongside existing
3. **Phase 3**: Update ContextPageClient to use new tabs
4. **Phase 4**: Update AddContextButton to dropdown
5. **Phase 5**: Remove deprecated components

---

## Testing Checklist

- [ ] Blocks tab: Create, edit, delete, search, filter
- [ ] Entries tab: View user entries (raw_dumps)
- [ ] Entries tab: View agent entries (work_outputs)
- [ ] Entries tab: Source badge shows correctly
- [ ] Entries tab: Create new entry (raw_dumps)
- [ ] Documents tab: View documents only (mime filter)
- [ ] Documents tab: Upload document (classification)
- [ ] Documents tab: Source badge for agent-uploaded
- [ ] Images tab: View images only (mime filter)
- [ ] Images tab: Upload image (classification)
- [ ] Images tab: Thumbnail grid display
- [ ] Add Context dropdown: All options work
- [ ] Add Context dropdown: Opens correct modal/tab

---

## Deferred Items

1. **Agent entry creation**: Currently entries from users only. Agent text goes to work_outputs.
2. **Entry → Block extraction**: P0-P1 pipeline toggle on entry creation
3. **Work output absorption**: Approved work_outputs staying in place (not moving to entries table)
4. **Realtime updates**: Supabase realtime subscriptions for classification complete

---

**End of Plan**
