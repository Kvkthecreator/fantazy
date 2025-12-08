# Shared Contracts

This directory contains the **Single Source of Truth (SST)** for all data contracts used across the monorepo.

## Purpose

- **TypeScript types and interfaces** shared between frontend (`/web`) and backend (`/api`)
- **No runtime logic** - only type definitions and schemas
- **Import via** `@shared/contracts/*` in TypeScript files
- **Python adapter** at `/api/src/contracts/__init__.py` for backend usage

## Annotation Standard

To maintain traceability, annotate files that use shared contracts:

### API Routes (TypeScript)
```typescript
/**
 * Route: GET /api/<path>
 * @contract input  : <TypeA> | <none>
 * @contract output : <TypeB>
 * RLS: <one-line note if relevant>
 */
```

### API Routes (Python)
```python
"""
Route: GET /api/<path>
@contract input  : <ModelA> | <none>
@contract output : <ModelB>
RLS: <one-line note if relevant>
"""
```

### Components
```typescript
/**
 * Component: <Name>
 * @contract input : <TypeX>
 * Renders fields: <field1>, <field2>
 */
```

### Pages
```typescript
/**
 * Page: /<route>
 * Data sources:
 *  - GET /api/<path> -> <TypeY>
 * @contract renders: <TypeY>, <TypeZ>
 */
```

## Usage Trace

Run the trace generator to update the contracts registry:

```bash
pnpm contracts:trace
```

This scans the codebase for annotations and generates `REGISTRY.md`.

## What Belongs Here

✅ **DO include:**
- TypeScript interfaces and types
- Zod schemas (if used for validation)
- Enums and constants directly related to data shapes
- DTOs (Data Transfer Objects)

❌ **DON'T include:**
- Implementation logic
- Helper functions
- React components
- API clients
- Business logic

## Breaking Change Policy

Follow semantic versioning for contract changes:

- **Major version bump**: Field removed or type changed incompatibly
- **Minor version bump**: New optional field added
- **Patch version bump**: Documentation or comment changes only

When making breaking changes:
1. Announce in team channels
2. Update all consumers in the same PR
3. Run `pnpm contracts:trace` to verify all usages are updated

## Directory Structure

```
shared/contracts/
├── README.md           # This file
├── REGISTRY.md         # Auto-generated usage map
├── index.ts            # Main exports
├── baskets.ts          # Basket-related contracts
├── memory.ts           # Memory/reflection contracts
├── dumps.ts            # Raw dump contracts
├── documents.ts        # Document contracts
└── ...                 # Other domain contracts
```

## Import Guidelines

In client-side code, always use type-only imports:

```typescript
import type { BasketDTO } from '@shared/contracts/baskets';
```

This prevents server-only values from contaminating client bundles.