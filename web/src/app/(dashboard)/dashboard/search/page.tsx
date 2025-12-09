'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { search, type SearchResult } from '@/lib/api'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const supabase = createClient()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    setError(null)
    setSearched(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const data = await search.semantic(query, session.access_token, { limit: 20 })
      setResults(data.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Semantic Search</h1>
        <p className="text-slate-600 mt-1">Find IP assets using natural language search</p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
        <form onSubmit={handleSearch}>
          <div className="flex gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for music, voices, characters, visual works..."
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {searched && !isLoading && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              {results.length} {results.length === 1 ? 'result' : 'results'} found
            </h2>
          </div>

          {results.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No results found</h3>
              <p className="text-slate-500">Try a different search term or create some entities first.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {results.map((result) => (
                <div key={result.entity_id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">{result.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                          {result.rights_type.replace('_', ' ')}
                        </span>
                        {result.catalog_name && (
                          <span className="text-sm text-slate-500">{result.catalog_name}</span>
                        )}
                      </div>
                      {result.snippet && (
                        <p className="text-sm text-slate-600 mt-2 line-clamp-2">{result.snippet}</p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-sm font-medium text-slate-900">
                        {(result.similarity_score * 100).toFixed(1)}% match
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        {result.permissions_summary.training_allowed && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Training OK</span>
                        )}
                        {result.permissions_summary.commercial_allowed && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Commercial OK</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!searched && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Search your IP catalog</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Use natural language to find music, voice recordings, characters, and other intellectual property across your catalogs.
          </p>
        </div>
      )}
    </div>
  )
}
