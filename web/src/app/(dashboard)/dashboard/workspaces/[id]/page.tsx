'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { workspaces, catalogs, type Workspace, type Catalog } from '@/lib/api'
import Link from 'next/link'

export default function WorkspaceDetailPage() {
  const params = useParams()
  const workspaceId = params.id as string

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaceCatalogs, setCatalogs] = useState<Catalog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewCatalog, setShowNewCatalog] = useState(false)
  const [newCatalogName, setNewCatalogName] = useState('')
  const [newCatalogDesc, setNewCatalogDesc] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const wsResult = await workspaces.get(workspaceId, session.access_token)
        setWorkspace(wsResult.workspace)

        const catResult = await catalogs.list(workspaceId, session.access_token)
        setCatalogs(catResult.catalogs)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workspace')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [workspaceId])

  const handleCreateCatalog = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const result = await catalogs.create(workspaceId, {
        name: newCatalogName,
        description: newCatalogDesc || undefined
      }, session.access_token)

      setCatalogs([...workspaceCatalogs, result.catalog])
      setShowNewCatalog(false)
      setNewCatalogName('')
      setNewCatalogDesc('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create catalog')
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900">Workspace not found</h2>
        <Link href="/dashboard/workspaces" className="text-blue-600 hover:underline mt-2 inline-block">
          Back to Workspaces
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/workspaces" className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Workspaces
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{workspace.name}</h1>
            <p className="text-slate-600 mt-1">{workspace.description || 'No description'}</p>
          </div>
          <button
            onClick={() => setShowNewCatalog(true)}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            Add Catalog
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* New Catalog Form */}
      {showNewCatalog && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Create New Catalog</h3>
          <form onSubmit={handleCreateCatalog} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                Catalog Name
              </label>
              <input
                type="text"
                id="name"
                value={newCatalogName}
                onChange={(e) => setNewCatalogName(e.target.value)}
                required
                placeholder="My Music Catalog"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
              />
            </div>
            <div>
              <label htmlFor="desc" className="block text-sm font-medium text-slate-700 mb-1">
                Description (optional)
              </label>
              <textarea
                id="desc"
                value={newCatalogDesc}
                onChange={(e) => setNewCatalogDesc(e.target.value)}
                placeholder="A brief description..."
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isCreating || !newCatalogName}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Catalog'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewCatalog(false)}
                className="px-4 py-2 text-slate-600 text-sm font-medium hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Catalogs List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Catalogs</h2>
        </div>

        {workspaceCatalogs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No catalogs yet</h3>
            <p className="text-slate-500 mb-6">Create your first catalog to start adding IP entities.</p>
            <button
              onClick={() => setShowNewCatalog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Catalog
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {workspaceCatalogs.map((catalog) => (
              <Link
                key={catalog.id}
                href={`/dashboard/catalogs/${catalog.id}`}
                className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div>
                  <h3 className="font-medium text-slate-900">{catalog.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{catalog.description || 'No description'}</p>
                </div>
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
