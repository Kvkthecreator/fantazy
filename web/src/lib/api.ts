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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
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
  ownership_chain?: Record<string, unknown>[]
  semantic_metadata?: Record<string, unknown>
  status: string
  verification_status: string
  embedding_status: string
  version: number
  created_at: string
  updated_at: string
}

export interface RightsSchema {
  id: string
  display_name: string
  description?: string
  category: string
  field_schema: Record<string, unknown>
  ai_permission_fields?: Record<string, unknown>
  identifier_fields?: string[]
  display_field: string
}

export const entities = {
  list: (catalogId: string, token: string, params?: { rights_type?: string; status?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams()
    if (params?.rights_type) query.set('rights_type', params.rights_type)
    if (params?.status) query.set('status', params.status)
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

  update: (id: string, data: Partial<Pick<RightsEntity, 'title' | 'content' | 'ai_permissions' | 'semantic_metadata'>>, token: string) =>
    fetchAPI<{ updated: boolean; requires_approval: boolean }>(`/api/v1/entities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  triggerProcessing: (id: string, token: string, force = false) =>
    fetchAPI<{ job: { id: string; status: string } }>(`/api/v1/entities/${id}/process?force=${force}`, {
      method: 'POST',
      token,
    }),
}

export const schemas = {
  list: (token: string) =>
    fetchAPI<{ schemas: RightsSchema[] }>('/api/v1/rights-schemas', { token }),

  get: (id: string, token: string) =>
    fetchAPI<{ schema: RightsSchema }>(`/api/v1/rights-schemas/${id}`, { token }),
}

// =============================================================================
// Search
// =============================================================================

export interface SearchResult {
  entity_id: string
  title: string
  rights_type: string
  catalog_id: string
  catalog_name?: string
  similarity_score: number
  snippet?: string
  permissions_summary: {
    training_allowed: boolean
    commercial_allowed: boolean
    generation_allowed: boolean
    requires_attribution: boolean
  }
  semantic_metadata?: Record<string, unknown>
}

export const search = {
  semantic: (query: string, token: string, options?: {
    catalog_ids?: string[]
    rights_types?: string[]
    training_allowed?: boolean
    commercial_allowed?: boolean
    limit?: number
    offset?: number
  }) =>
    fetchAPI<{ results: SearchResult[]; total: number }>('/api/v1/search/semantic', {
      method: 'POST',
      body: JSON.stringify({ query, ...options }),
      token,
    }),

  similar: (entityId: string, token: string, options?: {
    catalog_ids?: string[]
    rights_types?: string[]
    exclude_same_catalog?: boolean
    limit?: number
  }) =>
    fetchAPI<{ results: SearchResult[]; total: number }>('/api/v1/search/similar', {
      method: 'POST',
      body: JSON.stringify({ entity_id: entityId, ...options }),
      token,
    }),

  filter: (token: string, options?: {
    catalog_ids?: string[]
    rights_types?: string[]
    training_allowed?: boolean
    commercial_allowed?: boolean
    mood?: string[]
    limit?: number
    offset?: number
  }) => {
    const query = new URLSearchParams()
    if (options?.rights_types) options.rights_types.forEach(t => query.append('rights_types', t))
    if (options?.training_allowed !== undefined) query.set('training_allowed', String(options.training_allowed))
    if (options?.commercial_allowed !== undefined) query.set('commercial_allowed', String(options.commercial_allowed))
    if (options?.limit) query.set('limit', String(options.limit))
    if (options?.offset) query.set('offset', String(options.offset))
    return fetchAPI<{ results: SearchResult[]; total: number }>(`/api/v1/search/filter?${query}`, {
      method: 'POST',
      token,
    })
  },
}

// =============================================================================
// Proposals
// =============================================================================

export interface Proposal {
  id: string
  catalog_id: string
  proposal_type: string
  target_entity_id?: string
  payload: Record<string, unknown>
  reasoning?: string
  status: string
  priority: string
  auto_approved: boolean
  created_by: string
  reviewed_by?: string
  created_at: string
  reviewed_at?: string
  entity_title?: string
  rights_type?: string
}

export const proposals = {
  list: (catalogId: string, token: string, params?: { status?: string; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.limit) query.set('limit', String(params.limit))
    const queryStr = query.toString()
    return fetchAPI<{ proposals: Proposal[]; total: number }>(`/api/v1/catalogs/${catalogId}/proposals${queryStr ? `?${queryStr}` : ''}`, { token })
  },

  get: (id: string, token: string) =>
    fetchAPI<{ proposal: Proposal }>(`/api/v1/proposals/${id}`, { token }),

  review: (id: string, data: { status: 'approved' | 'rejected'; review_notes?: string }, token: string) =>
    fetchAPI<{ status: string }>(`/api/v1/proposals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
}

// =============================================================================
// Assets
// =============================================================================

export interface Asset {
  id: string
  rights_entity_id: string
  asset_type: string
  filename: string
  mime_type?: string
  file_size_bytes?: number
  storage_bucket: string
  storage_path: string
  is_public: boolean
  duration_seconds?: number
  sample_rate?: number
  channels?: number
  processing_status: string
  processing_error?: string
  extracted_metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const assets = {
  list: (entityId: string, token: string, params?: { asset_type?: string; processing_status?: string }) => {
    const query = new URLSearchParams()
    if (params?.asset_type) query.set('asset_type', params.asset_type)
    if (params?.processing_status) query.set('processing_status', params.processing_status)
    const queryStr = query.toString()
    return fetchAPI<{ assets: Asset[] }>(`/api/v1/entities/${entityId}/assets${queryStr ? `?${queryStr}` : ''}`, { token })
  },

  get: (id: string, token: string) =>
    fetchAPI<{ asset: Asset }>(`/api/v1/assets/${id}`, { token }),

  upload: async (entityId: string, file: File, assetType: string, token: string, isPublic = false) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('asset_type', assetType)
    formData.append('is_public', String(isPublic))

    const response = await fetch(`${API_URL}/api/v1/entities/${entityId}/assets/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new APIError(response.status, data.detail || 'Upload failed', data)
    }

    return response.json() as Promise<{ asset: Asset; message: string }>
  },

  getDownloadUrl: (assetId: string, token: string, expiresIn = 3600) =>
    fetchAPI<{ url: string; filename: string; expires_in: number | null; is_public: boolean }>(
      `/api/v1/assets/${assetId}/url?expires_in=${expiresIn}`,
      { token }
    ),

  delete: (assetId: string, token: string) =>
    fetchAPI<{ deleted: boolean; asset_id: string }>(`/api/v1/assets/${assetId}`, {
      method: 'DELETE',
      token,
    }),

  triggerProcessing: (assetId: string, token: string, jobType = 'asset_analysis') => {
    const formData = new FormData()
    formData.append('job_type', jobType)
    return fetch(`${API_URL}/api/v1/assets/${assetId}/process`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new APIError(response.status, data.detail || 'Failed to trigger processing', data)
      }
      return response.json() as Promise<{ job: ProcessingJob; message: string }>
    })
  },
}

// =============================================================================
// Processing Jobs
// =============================================================================

export interface ProcessingJob {
  id: string
  job_type: string
  rights_entity_id?: string
  asset_id?: string
  status: string
  priority: number
  started_at?: string
  completed_at?: string
  error_message?: string
  retry_count: number
  max_retries: number
  config?: Record<string, unknown>
  result?: Record<string, unknown>
  created_at: string
  updated_at: string
  entity_title?: string
  rights_type?: string
}

export const jobs = {
  list: (token: string, params?: { status?: string; job_type?: string; entity_id?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.job_type) query.set('job_type', params.job_type)
    if (params?.entity_id) query.set('entity_id', params.entity_id)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    const queryStr = query.toString()
    return fetchAPI<{ jobs: ProcessingJob[]; total: number }>(`/api/v1/jobs${queryStr ? `?${queryStr}` : ''}`, { token })
  },

  listForEntity: (entityId: string, token: string, params?: { status?: string; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.limit) query.set('limit', String(params.limit))
    const queryStr = query.toString()
    return fetchAPI<{ jobs: ProcessingJob[] }>(`/api/v1/entities/${entityId}/jobs${queryStr ? `?${queryStr}` : ''}`, { token })
  },

  get: (jobId: string, token: string) =>
    fetchAPI<{ job: ProcessingJob }>(`/api/v1/jobs/${jobId}`, { token }),

  create: (data: { job_type: string; rights_entity_id?: string; asset_id?: string; priority?: number; config?: Record<string, unknown> }, token: string) =>
    fetchAPI<{ job: ProcessingJob; message: string }>('/api/v1/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  cancel: (jobId: string, token: string) =>
    fetchAPI<{ status: string; job_id: string }>(`/api/v1/jobs/${jobId}/cancel`, {
      method: 'POST',
      token,
    }),

  retry: (jobId: string, token: string) =>
    fetchAPI<{ job: ProcessingJob; original_job_id: string; message: string }>(`/api/v1/jobs/${jobId}/retry`, {
      method: 'POST',
      token,
    }),
}

// =============================================================================
// Bulk Import
// =============================================================================

export interface ImportResult {
  index: number
  success: boolean
  entity_id?: string
  title: string
  error?: string
}

export interface BulkImportResponse {
  total: number
  successful: number
  failed: number
  results: ImportResult[]
  job_id?: string
}

export const imports = {
  bulk: (catalogId: string, entities: Array<{
    rights_type: string
    title: string
    entity_key?: string
    content?: Record<string, unknown>
    ai_permissions?: Record<string, unknown>
  }>, token: string, autoProcess = false) =>
    fetchAPI<BulkImportResponse>(`/api/v1/catalogs/${catalogId}/import`, {
      method: 'POST',
      body: JSON.stringify({ entities, auto_process: autoProcess }),
      token,
    }),

  csv: async (catalogId: string, file: File, rightsType: string, token: string, autoProcess = false) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('rights_type', rightsType)
    formData.append('auto_process', String(autoProcess))

    const response = await fetch(`${API_URL}/api/v1/catalogs/${catalogId}/import/csv`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new APIError(response.status, data.detail || 'CSV import failed', data)
    }

    return response.json() as Promise<BulkImportResponse>
  },

  getTemplate: (catalogId: string, rightsType: string) =>
    `${API_URL}/api/v1/catalogs/${catalogId}/import/template?rights_type=${rightsType}`,
}
