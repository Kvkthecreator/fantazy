'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { entities, assets, jobs, type RightsEntity, type Asset, type ProcessingJob } from '@/lib/api'
import Link from 'next/link'
import { ProcessingStatus, ProcessingStatusWithJobs, EmbeddingStatusBadge } from '@/components/ProcessingStatus'
import { AssetUploader } from '@/components/AssetUploader'
import { AssetGallery } from '@/components/AssetGallery'
import { useEntityJobPolling } from '@/hooks/useJobPolling'

export default function EntityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const entityId = params.id as string

  const [entity, setEntity] = useState<RightsEntity | null>(null)
  const [entityAssets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [assetRefreshKey, setAssetRefreshKey] = useState(0)
  const supabase = createClient()

  // Job polling
  const { jobs: entityJobs, isLoading: jobsLoading, refetch: refetchJobs, hasActiveJobs } = useEntityJobPolling(
    entityId,
    token || undefined,
    { enabled: !!token, stopOnComplete: false }
  )

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Not authenticated')
        setIsLoading(false)
        return
      }

      const [entityResult, assetsResult] = await Promise.all([
        entities.get(entityId, session.access_token),
        assets.list(entityId, session.access_token),
      ])

      setEntity(entityResult.entity)
      setAssets(assetsResult.assets)
      setToken(session.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entity')
    } finally {
      setIsLoading(false)
    }
  }, [entityId, supabase.auth])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAssetUpload = async (asset: Asset) => {
    // Refresh asset list when new asset is uploaded
    setAssetRefreshKey(k => k + 1)

    // Trigger processing for the new asset
    if (token) {
      try {
        await assets.triggerProcessing(asset.id, token)
      } catch {
        console.warn('Asset uploaded but processing trigger failed')
      }
    }
  }

  const handleTriggerEmbedding = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      await entities.triggerProcessing(entityId, session.access_token)

      // Refresh jobs and entity
      await loadData()
      refetchJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger processing')
    }
  }

  const handleJobRetry = async (jobId: string) => {
    if (!token) return
    try {
      await jobs.retry(jobId, token)
      refetchJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry job')
    }
  }

  const handleJobCancel = async (jobId: string) => {
    if (!token) return
    try {
      await jobs.cancel(jobId, token)
      refetchJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!entity) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900">Entity not found</h2>
        <button onClick={() => router.back()} className="text-blue-600 hover:underline mt-2 inline-block">
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <div className="flex items-start justify-between mt-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                entity.status === 'active' ? 'bg-green-100 text-green-800' :
                entity.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                'bg-slate-100 text-slate-800'
              }`}>
                {entity.status}
              </span>
              <EmbeddingStatusBadge status={entity.embedding_status} />
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                {entity.rights_type}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{entity.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              <span>Version {entity.version}</span>
              <span>Created {new Date(entity.created_at).toLocaleDateString()}</span>
              {entity.entity_key && <span className="font-mono">{entity.entity_key}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {entity.embedding_status !== 'processing' && entity.embedding_status !== 'ready' && (
              <button
                onClick={handleTriggerEmbedding}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Generate Embeddings
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assets Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Upload Assets</h2>
              {token && (
                <AssetUploader
                  entityId={entityId}
                  token={token}
                  onUploadComplete={handleAssetUpload}
                />
              )}
            </div>

            <div className="p-6">
              <h3 className="text-md font-medium text-slate-900 mb-4">Uploaded Files</h3>
              {token && (
                <AssetGallery
                  key={assetRefreshKey}
                  entityId={entityId}
                  token={token}
                />
              )}
            </div>
          </div>

          {/* AI Permissions */}
          {entity.ai_permissions && Object.keys(entity.ai_permissions).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">AI Permissions</h2>
              <pre className="text-sm bg-slate-50 p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(entity.ai_permissions, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Processing Jobs */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Processing Jobs</h3>
              {hasActiveJobs && (
                <span className="text-xs text-blue-600 animate-pulse">Processing...</span>
              )}
            </div>
            {entityJobs.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No processing jobs yet
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-80 overflow-auto">
                {entityJobs.map((job) => (
                  <div key={job.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900 capitalize">
                        {job.job_type.replace(/_/g, ' ')}
                      </span>
                      <ProcessingStatus status={job.status} size="sm" />
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(job.created_at).toLocaleString()}
                    </p>
                    {job.error_message && (
                      <p className="text-xs text-red-600 mt-1 truncate" title={job.error_message}>
                        {job.error_message}
                      </p>
                    )}
                    {/* Job actions */}
                    <div className="flex gap-2 mt-2">
                      {job.status === 'failed' && (
                        <button
                          onClick={() => handleJobRetry(job.id)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Retry
                        </button>
                      )}
                      {(job.status === 'queued' || job.status === 'processing') && (
                        <button
                          onClick={() => handleJobCancel(job.id)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">ID</dt>
                <dd className="font-mono text-slate-900 text-xs">{entity.id.slice(0, 8)}...</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Catalog</dt>
                <dd>
                  <Link href={`/dashboard/catalogs/${entity.catalog_id}`} className="text-blue-600 hover:underline">
                    View
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Verification</dt>
                <dd className="text-slate-900">{entity.verification_status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Updated</dt>
                <dd className="text-slate-900">{new Date(entity.updated_at).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
