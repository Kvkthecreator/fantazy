'use client'

import { useState, useCallback, useRef } from 'react'
import { assets, Asset } from '@/lib/api'
import { Upload, File, Image, Music, Video, FileText, X, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface AssetUploaderProps {
  entityId: string
  token: string
  onUploadComplete?: (asset: Asset) => void
  maxFileSizeMB?: number
  acceptedTypes?: string[]
}

interface UploadItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'complete' | 'error'
  progress: number
  error?: string
  asset?: Asset
  assetType: string
}

const ASSET_TYPE_MAP: Record<string, string> = {
  'audio/': 'audio',
  'image/': 'image',
  'video/': 'video',
  'application/pdf': 'document',
  'text/': 'document',
}

function detectAssetType(mimeType: string): string {
  for (const [prefix, type] of Object.entries(ASSET_TYPE_MAP)) {
    if (mimeType.startsWith(prefix) || mimeType === prefix) {
      return type
    }
  }
  return 'other'
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('audio/')) return <Music className="h-5 w-5 text-purple-500" />
  if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />
  if (mimeType.startsWith('video/')) return <Video className="h-5 w-5 text-pink-500" />
  if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />
  return <File className="h-5 w-5 text-slate-500" />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AssetUploader({
  entityId,
  token,
  onUploadComplete,
  maxFileSizeMB = 50,
  acceptedTypes = ['audio/*', 'image/*', 'video/*', 'application/pdf'],
}: AssetUploaderProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((files: FileList | File[]) => {
    const newUploads: UploadItem[] = []

    Array.from(files).forEach(file => {
      // Validate file size
      if (file.size > maxFileSizeMB * 1024 * 1024) {
        newUploads.push({
          id: crypto.randomUUID(),
          file,
          status: 'error',
          progress: 0,
          error: `File too large (max ${maxFileSizeMB}MB)`,
          assetType: detectAssetType(file.type),
        })
        return
      }

      newUploads.push({
        id: crypto.randomUUID(),
        file,
        status: 'pending',
        progress: 0,
        assetType: detectAssetType(file.type),
      })
    })

    setUploads(prev => [...prev, ...newUploads])

    // Start uploading pending files
    newUploads
      .filter(u => u.status === 'pending')
      .forEach(upload => uploadFile(upload))
  }, [maxFileSizeMB])

  const uploadFile = async (upload: UploadItem) => {
    setUploads(prev => prev.map(u =>
      u.id === upload.id ? { ...u, status: 'uploading', progress: 10 } : u
    ))

    try {
      // Simulate progress updates (actual upload doesn't provide progress)
      const progressInterval = setInterval(() => {
        setUploads(prev => prev.map(u =>
          u.id === upload.id && u.status === 'uploading'
            ? { ...u, progress: Math.min(u.progress + 10, 90) }
            : u
        ))
      }, 200)

      const result = await assets.upload(entityId, upload.file, upload.assetType, token)

      clearInterval(progressInterval)

      setUploads(prev => prev.map(u =>
        u.id === upload.id
          ? { ...u, status: 'complete', progress: 100, asset: result.asset }
          : u
      ))

      onUploadComplete?.(result.asset)

    } catch (err) {
      setUploads(prev => prev.map(u =>
        u.id === upload.id
          ? { ...u, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
          : u
      ))
    }
  }

  const retryUpload = (upload: UploadItem) => {
    setUploads(prev => prev.map(u =>
      u.id === upload.id ? { ...u, status: 'pending', progress: 0, error: undefined } : u
    ))
    uploadFile({ ...upload, status: 'pending', progress: 0, error: undefined })
  }

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }, [addFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const completedCount = uploads.filter(u => u.status === 'complete').length
  const hasErrors = uploads.some(u => u.status === 'error')

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50'
          }
        `}
      >
        <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
        <p className="text-sm text-slate-600 mb-1">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs text-slate-500">
          Audio, images, videos, PDFs up to {maxFileSizeMB}MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Upload List */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              {completedCount} of {uploads.length} files uploaded
            </span>
            {completedCount === uploads.length && !hasErrors && (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                All complete
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-auto">
            {uploads.map(upload => (
              <div
                key={upload.id}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
              >
                {getFileIcon(upload.file.type)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {upload.file.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatFileSize(upload.file.size)}
                    </span>
                  </div>

                  {upload.status === 'uploading' && (
                    <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-200"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  )}

                  {upload.status === 'error' && (
                    <p className="text-xs text-red-600 mt-1">{upload.error}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {upload.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                  )}
                  {upload.status === 'complete' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {upload.status === 'error' && (
                    <>
                      <button
                        onClick={() => retryUpload(upload)}
                        className="p-1 hover:bg-slate-200 rounded"
                        title="Retry"
                      >
                        <RefreshCw className="h-4 w-4 text-slate-600" />
                      </button>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </>
                  )}
                  <button
                    onClick={() => removeUpload(upload.id)}
                    className="p-1 hover:bg-slate-200 rounded"
                    title="Remove"
                  >
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
