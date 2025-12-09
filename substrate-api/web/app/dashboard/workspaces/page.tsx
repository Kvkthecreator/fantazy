'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { workspaces, type Workspace } from '@/lib/api'
import Link from 'next/link'

export default function WorkspacesPage() {
  const [data, setData] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const result = await workspaces.list(session.access_token)
        setData(result.workspaces)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
            <span>/</span>
            <span className="text-gray-900">Workspaces</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
            <Link
              href="/dashboard/workspaces/new"
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Create Workspace
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {!isLoading && !error && data.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No workspaces yet</h3>
            <p className="text-gray-500 mb-4">Create your first workspace to get started.</p>
            <Link
              href="/dashboard/workspaces/new"
              className="inline-block px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Create Workspace
            </Link>
          </div>
        )}

        {!isLoading && data.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 divide-y">
            {data.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/dashboard/workspaces/${workspace.id}`}
                className="block p-6 hover:bg-gray-50"
              >
                <h3 className="font-medium text-gray-900">{workspace.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{workspace.description || 'No description'}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
