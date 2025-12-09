'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { catalogs, entities, schemas, type Catalog, type RightsEntity, type RightsSchema } from '@/lib/api'
import Link from 'next/link'

export default function CatalogDetailPage() {
  const params = useParams()
  const catalogId = params.id as string

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogEntities, setEntities] = useState<RightsEntity[]>([])
  const [availableSchemas, setSchemas] = useState<RightsSchema[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewEntity, setShowNewEntity] = useState(false)
  const [newEntityTitle, setNewEntityTitle] = useState('')
  const [newEntityType, setNewEntityType] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const [catResult, entResult, schemaResult] = await Promise.all([
          catalogs.get(catalogId, session.access_token),
          entities.list(catalogId, session.access_token),
          schemas.list(session.access_token)
        ])

        setCatalog(catResult.catalog)
        setEntities(entResult.entities)
        setSchemas(schemaResult.schemas)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load catalog')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [catalogId])

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const result = await entities.create(catalogId, {
        rights_type: newEntityType,
        title: newEntityTitle
      }, session.access_token)

      setEntities([result.entity, ...catalogEntities])
      setShowNewEntity(false)
      setNewEntityTitle('')
      setNewEntityType('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entity')
    } finally {
      setIsCreating(false)
    }
  }

  const getStatusBadge = (status: string, embeddingStatus: string) => {
    if (embeddingStatus === 'processing') {
      return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">Processing</span>
    }
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Active</span>
      case 'draft':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Draft</span>
      case 'archived':
        return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded">Archived</span>
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded">{status}</span>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!catalog) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900">Catalog not found</h2>
        <Link href="/dashboard/catalogs" className="text-blue-600 hover:underline mt-2 inline-block">
          Back to Catalogs
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/catalogs" className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Catalogs
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{catalog.name}</h1>
            <p className="text-slate-600 mt-1">{catalog.description || 'No description'}</p>
          </div>
          <button
            onClick={() => setShowNewEntity(true)}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            Add Entity
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* New Entity Form */}
      {showNewEntity && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Add New Entity</h3>
          <form onSubmit={handleCreateEntity} className="space-y-4">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-1">
                Entity Type
              </label>
              <select
                id="type"
                value={newEntityType}
                onChange={(e) => setNewEntityType(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
              >
                <option value="">Select a type...</option>
                {availableSchemas.map((schema) => (
                  <option key={schema.id} value={schema.id}>
                    {schema.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
                Title
              </label>
              <input
                type="text"
                id="title"
                value={newEntityTitle}
                onChange={(e) => setNewEntityTitle(e.target.value)}
                required
                placeholder="Enter entity title..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isCreating || !newEntityTitle || !newEntityType}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Entity'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewEntity(false)}
                className="px-4 py-2 text-slate-600 text-sm font-medium hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entities List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Entities</h2>
          <span className="text-sm text-slate-500">{catalogEntities.length} total</span>
        </div>

        {catalogEntities.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No entities yet</h3>
            <p className="text-slate-500 mb-6">Add your first IP entity to this catalog.</p>
            <button
              onClick={() => setShowNewEntity(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Entity
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {catalogEntities.map((entity) => (
              <div key={entity.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusBadge(entity.status, entity.embedding_status)}
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {entity.rights_type}
                      </span>
                    </div>
                    <h3 className="font-medium text-slate-900">{entity.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span>v{entity.version}</span>
                      <span>{new Date(entity.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entity.ai_permissions && (
                      <div className="flex gap-1">
                        {entity.ai_permissions.training_allowed && (
                          <span className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded">Training</span>
                        )}
                        {entity.ai_permissions.commercial_allowed && (
                          <span className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">Commercial</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
