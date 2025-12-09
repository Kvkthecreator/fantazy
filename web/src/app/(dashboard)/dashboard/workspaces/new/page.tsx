'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { workspaces } from '@/lib/api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewWorkspacePage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Generate slug from name
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

      await workspaces.create({ name, slug, description }, session.access_token)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Create Workspace</h1>
        <p className="text-slate-600 mt-1">Set up a new workspace for your IP catalogs</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
              Workspace Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="My Music Catalog"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this workspace..."
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors resize-none"
            />
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={isLoading || !name}
              className="px-6 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Workspace'}
            </button>
            <Link
              href="/dashboard"
              className="px-6 py-2 text-slate-600 text-sm font-medium hover:text-slate-900 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
