'use client'

import { useState, useEffect } from 'react'
import { assets, Asset } from '@/lib/api'
import { ProcessingStatus } from './ProcessingStatus'
import {
  Music,
  Image,
  Video,
  FileText,
  File,
  Download,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Play,
  MoreVertical,
} from 'lucide-react'

interface AssetGalleryProps {
  entityId: string
  token: string
  onAssetDelete?: (assetId: string) => void
}

function getAssetIcon(assetType: string, mimeType?: string) {
  if (assetType === 'audio' || mimeType?.startsWith('audio/')) {
    return <Music className="h-8 w-8 text-purple-500" />
  }
  if (assetType === 'image' || mimeType?.startsWith('image/')) {
    return <Image className="h-8 w-8 text-blue-500" />
  }
  if (assetType === 'video' || mimeType?.startsWith('video/')) {
    return <Video className="h-8 w-8 text-pink-500" />
  }
  if (assetType === 'document' || mimeType === 'application/pdf') {
    return <FileText className="h-8 w-8 text-red-500" />
  }
  return <File className="h-8 w-8 text-slate-500" />
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds?: number): string {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function AssetGallery({ entityId, token, onAssetDelete }: AssetGalleryProps) {
  const [assetList, setAssetList] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Fetch assets
  useEffect(() => {
    async function fetchAssets() {
      try {
        setIsLoading(true)
        setError(null)
        const result = await assets.list(entityId, token)
        setAssetList(result.assets)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load assets')
      } finally {
        setIsLoading(false)
      }
    }

    if (entityId && token) {
      fetchAssets()
    }
  }, [entityId, token])

  // Handle download
  const handleDownload = async (asset: Asset) => {
    try {
      setDownloadingId(asset.id)
      const result = await assets.getDownloadUrl(asset.id, token)

      // Open download URL
      const link = document.createElement('a')
      link.href = result.url
      link.download = asset.filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  // Handle delete
  const handleDelete = async (assetId: string) => {
    try {
      await assets.delete(assetId, token)
      setAssetList(prev => prev.filter(a => a.id !== assetId))
      setDeleteConfirm(null)
      onAssetDelete?.(assetId)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  // Refresh assets (for external use)
  const refresh = async () => {
    try {
      const result = await assets.list(entityId, token)
      setAssetList(result.assets)
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
        <AlertCircle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    )
  }

  if (assetList.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <File className="h-10 w-10 mx-auto mb-2 text-slate-300" />
        <p>No assets uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Asset Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assetList.map(asset => (
          <div
            key={asset.id}
            className="relative group border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            {/* Asset Preview/Icon */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 p-2 bg-slate-100 rounded-lg">
                {getAssetIcon(asset.asset_type, asset.mime_type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-slate-900 truncate" title={asset.filename}>
                  {asset.filename}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{formatFileSize(asset.file_size_bytes)}</span>
                  {asset.duration_seconds && (
                    <span>{formatDuration(asset.duration_seconds)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Status & Metadata */}
            <div className="flex items-center justify-between">
              <ProcessingStatus status={asset.processing_status} size="sm" />
              <span className="text-xs text-slate-400 capitalize">{asset.asset_type}</span>
            </div>

            {/* Actions (shown on hover) */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1 bg-white rounded-lg shadow-sm border p-1">
                <button
                  onClick={() => handleDownload(asset)}
                  disabled={downloadingId === asset.id}
                  className="p-1.5 hover:bg-slate-100 rounded"
                  title="Download"
                >
                  {downloadingId === asset.id ? (
                    <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 text-slate-600" />
                  )}
                </button>
                <button
                  onClick={() => setDeleteConfirm(asset.id)}
                  className="p-1.5 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </div>

            {/* Delete Confirmation */}
            {deleteConfirm === asset.id && (
              <div className="absolute inset-0 bg-white/95 rounded-lg flex items-center justify-center p-4">
                <div className="text-center">
                  <p className="text-sm text-slate-700 mb-3">Delete this asset?</p>
                  <div className="flex items-center gap-2 justify-center">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Asset Count */}
      <div className="text-sm text-slate-500 text-center">
        {assetList.length} asset{assetList.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

// Export a combined component for entity pages
interface EntityAssetsProps {
  entityId: string
  token: string
}

export function EntityAssets({ entityId, token }: EntityAssetsProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-900 mb-4">Upload Assets</h3>
        <div className="border rounded-lg p-4">
          {/* Import AssetUploader separately to use it here */}
          <p className="text-sm text-slate-500">
            Use the asset uploader component to add files
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-slate-900 mb-4">Uploaded Assets</h3>
        <AssetGallery
          key={refreshKey}
          entityId={entityId}
          token={token}
          onAssetDelete={() => setRefreshKey(k => k + 1)}
        />
      </div>
    </div>
  )
}
