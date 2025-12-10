'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ProcessingJob, jobs as jobsApi } from '@/lib/api'
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, X } from 'lucide-react'

interface ProcessingStatusProps {
  status: string
  size?: 'sm' | 'md'
  showLabel?: boolean
}

const statusConfig: Record<string, { color: string; bgColor: string; label: string; animate?: boolean }> = {
  pending: { color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Pending' },
  queued: { color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Queued' },
  processing: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Processing', animate: true },
  ready: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Ready' },
  completed: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Completed' },
  failed: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Failed' },
  cancelled: { color: 'text-slate-500', bgColor: 'bg-slate-100', label: 'Cancelled' },
  skipped: { color: 'text-slate-500', bgColor: 'bg-slate-50', label: 'Skipped' },
  uploaded: { color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Uploaded' },
}

export function ProcessingStatus({ status, size = 'sm', showLabel = true }: ProcessingStatusProps) {
  const config = statusConfig[status] || statusConfig.pending
  const sizeClasses = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full', config.bgColor)}>
      <span className={cn(
        'rounded-full',
        sizeClasses,
        config.animate ? 'animate-pulse' : '',
        config.color.replace('text-', 'bg-')
      )} />
      {showLabel && (
        <span className={cn(textSize, 'font-medium', config.color)}>
          {config.label}
        </span>
      )}
    </span>
  )
}

export function EmbeddingStatusBadge({ status }: { status: string }) {
  return <ProcessingStatus status={status} size="sm" />
}

// Job status icon component
function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    case 'queued':
      return <Clock className="h-4 w-4 text-amber-500" />
    case 'cancelled':
      return <X className="h-4 w-4 text-slate-400" />
    default:
      return <Clock className="h-4 w-4 text-slate-400" />
  }
}

// Enhanced status with job details popover
interface ProcessingStatusWithJobsProps {
  status: string
  jobs: ProcessingJob[]
  onRetry?: (jobId: string) => void
  onCancel?: (jobId: string) => void
  isLoading?: boolean
}

export function ProcessingStatusWithJobs({
  status,
  jobs,
  onRetry,
  onCancel,
  isLoading = false,
}: ProcessingStatusWithJobsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'processing')
  const failedJobs = jobs.filter(j => j.status === 'failed')
  const recentJobs = jobs.slice(0, 5)

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
      >
        <ProcessingStatus status={status} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border z-20 p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-900">Processing Jobs</h4>
              {isLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
            </div>

            {jobs.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">No processing jobs</p>
            ) : (
              <div className="space-y-2">
                {activeJobs.length > 0 && (
                  <div className="text-xs text-blue-600 font-medium">
                    {activeJobs.length} active job{activeJobs.length !== 1 ? 's' : ''}
                  </div>
                )}

                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-start gap-2 p-2 bg-slate-50 rounded text-sm"
                  >
                    <JobStatusIcon status={job.status} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-700 truncate">
                        {job.job_type.replace(/_/g, ' ')}
                      </div>
                      {job.error_message && (
                        <div className="text-xs text-red-600 truncate" title={job.error_message}>
                          {job.error_message}
                        </div>
                      )}
                      <div className="text-xs text-slate-500">
                        {job.status === 'processing' && job.started_at && (
                          <>Started {formatRelativeTime(job.started_at)}</>
                        )}
                        {job.status === 'completed' && job.completed_at && (
                          <>Completed {formatRelativeTime(job.completed_at)}</>
                        )}
                        {job.status === 'failed' && (
                          <>Retry {job.retry_count}/{job.max_retries}</>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {job.status === 'failed' && onRetry && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRetry(job.id) }}
                          className="p-1 hover:bg-slate-200 rounded"
                          title="Retry"
                        >
                          <RefreshCw className="h-3 w-3 text-slate-600" />
                        </button>
                      )}
                      {(job.status === 'queued' || job.status === 'processing') && onCancel && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCancel(job.id) }}
                          className="p-1 hover:bg-slate-200 rounded"
                          title="Cancel"
                        >
                          <X className="h-3 w-3 text-slate-600" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {jobs.length > 5 && (
                  <div className="text-xs text-slate-500 text-center pt-1">
                    +{jobs.length - 5} more jobs
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Summary component for catalog/list views
interface ProcessingSummaryProps {
  summary: {
    queued: number
    processing: number
    completed: number
    failed: number
  }
}

export function ProcessingSummary({ summary }: ProcessingSummaryProps) {
  const total = summary.queued + summary.processing + summary.completed + summary.failed
  if (total === 0) return null

  const activeCount = summary.queued + summary.processing

  return (
    <div className="flex items-center gap-3 text-sm">
      {activeCount > 0 && (
        <span className="flex items-center gap-1 text-blue-600">
          <Loader2 className="h-3 w-3 animate-spin" />
          {activeCount} processing
        </span>
      )}
      {summary.completed > 0 && (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-3 w-3" />
          {summary.completed} ready
        </span>
      )}
      {summary.failed > 0 && (
        <span className="flex items-center gap-1 text-red-600">
          <XCircle className="h-3 w-3" />
          {summary.failed} failed
        </span>
      )}
    </div>
  )
}

// Utility function for relative time formatting
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return date.toLocaleDateString()
}
