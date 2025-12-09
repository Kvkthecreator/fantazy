'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { workspaces, catalogs, proposals, type Workspace, type Catalog, type Proposal } from '@/lib/api'
import Link from 'next/link'

export default function ProposalsPage() {
  const [allProposals, setProposals] = useState<(Proposal & { catalog_name: string; workspace_name: string })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const wsResult = await workspaces.list(session.access_token)

        // Fetch all catalogs and their proposals
        const proposalPromises = wsResult.workspaces.flatMap(async (ws) => {
          try {
            const catResult = await catalogs.list(ws.id, session.access_token)
            const catalogProposals = await Promise.all(
              catResult.catalogs.map(async (cat) => {
                try {
                  const propResult = await proposals.list(cat.id, session.access_token)
                  return propResult.proposals.map(p => ({
                    ...p,
                    catalog_name: cat.name,
                    workspace_name: ws.name
                  }))
                } catch {
                  return []
                }
              })
            )
            return catalogProposals.flat()
          } catch {
            return []
          }
        })

        const results = await Promise.all(proposalPromises)
        const allProps = results.flat().sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setProposals(allProps)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load proposals')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const filteredProposals = filter === 'all'
    ? allProposals
    : allProposals.filter(p => p.status === filter)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Pending</span>
      case 'approved':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Approved</span>
      case 'rejected':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Rejected</span>
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded">{status}</span>
    }
  }

  const getProposalTypeLabel = (type: string) => {
    switch (type) {
      case 'create_entity':
        return 'Create Entity'
      case 'update_entity':
        return 'Update Entity'
      case 'delete_entity':
        return 'Delete Entity'
      case 'update_permissions':
        return 'Update Permissions'
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

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
        <h1 className="text-2xl font-bold text-slate-900">Proposals</h1>
        <p className="text-slate-600 mt-1">Review and manage change proposals across your catalogs</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && allProposals.filter(p => p.status === 'pending').length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                {allProposals.filter(p => p.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredProposals.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            {filter === 'all' ? 'No proposals yet' : `No ${filter} proposals`}
          </h3>
          <p className="text-slate-500">
            {filter === 'all'
              ? 'Proposals will appear here when changes are submitted for review.'
              : `There are no proposals with ${filter} status.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-200">
          {filteredProposals.map((proposal) => (
            <div key={proposal.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(proposal.status)}
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {getProposalTypeLabel(proposal.proposal_type)}
                    </span>
                  </div>
                  <h3 className="font-medium text-slate-900 mb-1">
                    {proposal.entity_title || 'Untitled Entity'}
                  </h3>
                  {proposal.reasoning && (
                    <p className="text-sm text-slate-500 mb-2 line-clamp-2">{proposal.reasoning}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>{proposal.workspace_name} / {proposal.catalog_name}</span>
                    <span>{new Date(proposal.created_at).toLocaleDateString()}</span>
                    {proposal.rights_type && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded">{proposal.rights_type}</span>
                    )}
                  </div>
                </div>
                {proposal.status === 'pending' && (
                  <Link
                    href={`/dashboard/proposals/${proposal.id}`}
                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Review
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
