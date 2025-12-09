'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { workspaces, catalogs, type Workspace, type Catalog } from '@/lib/api'
import Link from 'next/link'

export default function CatalogsPage() {
  const [allCatalogs, setCatalogs] = useState<(Catalog & { workspace_name: string })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const wsResult = await workspaces.list(session.access_token)

        // Fetch catalogs for each workspace
        const catalogPromises = wsResult.workspaces.map(async (ws) => {
          try {
            const catResult = await catalogs.list(ws.id, session.access_token)
            return catResult.catalogs.map(c => ({ ...c, workspace_name: ws.name }))
          } catch {
            return []
          }
        })

        const catalogResults = await Promise.all(catalogPromises)
        setCatalogs(catalogResults.flat())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load catalogs')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Catalogs</h1>
        <p className="text-slate-600 mt-1">Browse all catalogs across your workspaces</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {allCatalogs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No catalogs yet</h3>
          <p className="text-slate-500 mb-6">Create a catalog in one of your workspaces to get started.</p>
          <Link
            href="/dashboard/workspaces"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
          >
            Go to Workspaces
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allCatalogs.map((catalog) => (
            <Link
              key={catalog.id}
              href={`/dashboard/catalogs/${catalog.id}`}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </div>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                  {catalog.workspace_name}
                </span>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{catalog.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2">
                {catalog.description || 'No description'}
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center text-xs text-slate-400">
                <span>Created {new Date(catalog.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
