/**
 * Clearinghouse API Client
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000'

export class APIError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message)
    this.name = 'APIError'
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new APIError(response.status, data.detail || 'API request failed', data)
  }

  return response.json()
}

// =============================================================================
// Workspaces
// =============================================================================

export interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  settings?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const workspaces = {
  list: (token: string) =>
    fetchAPI<{ workspaces: Workspace[] }>('/api/v1/workspaces', { token }),

  get: (id: string, token: string) =>
    fetchAPI<{ workspace: Workspace }>(`/api/v1/workspaces/${id}`, { token }),

  create: (data: { name: string; slug: string; description?: string }, token: string) =>
    fetchAPI<{ workspace: Workspace }>('/api/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
}

// =============================================================================
// Catalogs
// =============================================================================

export interface Catalog {
  id: string
  workspace_id: string
  name: string
  description?: string
  default_ai_permissions?: Record<string, unknown>
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const catalogs = {
  list: (workspaceId: string, token: string) =>
    fetchAPI<{ catalogs: Catalog[] }>(`/api/v1/workspaces/${workspaceId}/catalogs`, { token }),

  get: (id: string, token: string) =>
    fetchAPI<{ catalog: Catalog }>(`/api/v1/catalogs/${id}`, { token }),

  create: (workspaceId: string, data: { name: string; description?: string }, token: string) =>
    fetchAPI<{ catalog: Catalog }>(`/api/v1/workspaces/${workspaceId}/catalogs`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
}

// =============================================================================
// Rights Entities
// =============================================================================

export interface RightsEntity {
  id: string
  catalog_id: string
  rights_type: string
  title: string
  entity_key?: string
  content?: Record<string, unknown>
  ai_permissions?: Record<string, unknown>
  semantic_metadata?: Record<string, unknown>
  status: string
  embedding_status: string
  version: number
  created_at: string
  updated_at: string
}

export const entities = {
  list: (catalogId: string, token: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    const queryStr = query.toString()
    return fetchAPI<{ entities: RightsEntity[]; total: number }>(`/api/v1/catalogs/${catalogId}/entities${queryStr ? `?${queryStr}` : ''}`, { token })
  },

  get: (id: string, token: string) =>
    fetchAPI<{ entity: RightsEntity }>(`/api/v1/entities/${id}`, { token }),

  create: (catalogId: string, data: { rights_type: string; title: string; content?: Record<string, unknown>; ai_permissions?: Record<string, unknown> }, token: string) =>
    fetchAPI<{ entity: RightsEntity; requires_approval: boolean }>(`/api/v1/catalogs/${catalogId}/entities`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
}

// =============================================================================
// Licenses
// =============================================================================

export interface License {
  id: string
  rights_entity_id: string
  licensee_id: string
  template_id?: string
  status: string
  terms: Record<string, unknown>
  effective_date: string
  expiration_date?: string
  created_at: string
}

export const licenses = {
  listForEntity: (entityId: string, token: string) =>
    fetchAPI<{ licenses: License[] }>(`/api/v1/entities/${entityId}/licenses`, { token }),

  get: (id: string, token: string) =>
    fetchAPI<{ license: License }>(`/api/v1/licenses/${id}`, { token }),
}

// =============================================================================
// Rights Schemas
// =============================================================================

export interface RightsSchema {
  id: string
  display_name: string
  description?: string
  category: string
  field_schema: Record<string, unknown>
}

export const schemas = {
  list: (token: string) =>
    fetchAPI<{ schemas: RightsSchema[] }>('/api/v1/rights-schemas', { token }),
}
