'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { jobs, ProcessingJob } from '@/lib/api'

interface UseJobPollingOptions {
  interval?: number
  enabled?: boolean
  stopOnComplete?: boolean
}

interface UseJobPollingResult {
  jobs: ProcessingJob[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  hasActiveJobs: boolean
  summary: {
    queued: number
    processing: number
    completed: number
    failed: number
  }
}

export function useEntityJobPolling(
  entityId: string | undefined,
  token: string | undefined,
  options: UseJobPollingOptions = {}
): UseJobPollingResult {
  const {
    interval = 5000,
    enabled = true,
    stopOnComplete = true,
  } = options

  const [jobList, setJobList] = useState<ProcessingJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchJobs = useCallback(async () => {
    if (!entityId || !token) return

    try {
      setIsLoading(true)
      setError(null)
      const result = await jobs.listForEntity(entityId, token, { limit: 50 })
      setJobList(result.jobs)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch jobs'))
    } finally {
      setIsLoading(false)
    }
  }, [entityId, token])

  // Calculate summary
  const summary = {
    queued: jobList.filter(j => j.status === 'queued').length,
    processing: jobList.filter(j => j.status === 'processing').length,
    completed: jobList.filter(j => j.status === 'completed').length,
    failed: jobList.filter(j => j.status === 'failed').length,
  }

  const hasActiveJobs = summary.queued > 0 || summary.processing > 0

  // Set up polling
  useEffect(() => {
    if (!enabled || !entityId || !token) return

    // Initial fetch
    fetchJobs()

    // Set up interval
    intervalRef.current = setInterval(() => {
      // Stop polling if no active jobs and stopOnComplete is true
      if (stopOnComplete && !hasActiveJobs && jobList.length > 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        return
      }
      fetchJobs()
    }, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, entityId, token, interval, fetchJobs, stopOnComplete, hasActiveJobs, jobList.length])

  return {
    jobs: jobList,
    isLoading,
    error,
    refetch: fetchJobs,
    hasActiveJobs,
    summary,
  }
}

export function useJobPolling(
  token: string | undefined,
  params: { status?: string; job_type?: string; limit?: number } = {},
  options: UseJobPollingOptions = {}
): UseJobPollingResult & { total: number } {
  const {
    interval = 5000,
    enabled = true,
  } = options

  const [jobList, setJobList] = useState<ProcessingJob[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchJobs = useCallback(async () => {
    if (!token) return

    try {
      setIsLoading(true)
      setError(null)
      const result = await jobs.list(token, params)
      setJobList(result.jobs)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch jobs'))
    } finally {
      setIsLoading(false)
    }
  }, [token, params.status, params.job_type, params.limit])

  const summary = {
    queued: jobList.filter(j => j.status === 'queued').length,
    processing: jobList.filter(j => j.status === 'processing').length,
    completed: jobList.filter(j => j.status === 'completed').length,
    failed: jobList.filter(j => j.status === 'failed').length,
  }

  const hasActiveJobs = summary.queued > 0 || summary.processing > 0

  useEffect(() => {
    if (!enabled || !token) return

    fetchJobs()

    const intervalId = setInterval(fetchJobs, interval)
    return () => clearInterval(intervalId)
  }, [enabled, token, interval, fetchJobs])

  return {
    jobs: jobList,
    total,
    isLoading,
    error,
    refetch: fetchJobs,
    hasActiveJobs,
    summary,
  }
}

// Hook for polling a single job
export function useSingleJobPolling(
  jobId: string | undefined,
  token: string | undefined,
  options: UseJobPollingOptions = {}
): {
  job: ProcessingJob | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  isComplete: boolean
} {
  const { interval = 3000, enabled = true } = options

  const [job, setJob] = useState<ProcessingJob | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isComplete = job?.status === 'completed' || job?.status === 'failed' || job?.status === 'cancelled'

  const fetchJob = useCallback(async () => {
    if (!jobId || !token) return

    try {
      setIsLoading(true)
      setError(null)
      const result = await jobs.get(jobId, token)
      setJob(result.job)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch job'))
    } finally {
      setIsLoading(false)
    }
  }, [jobId, token])

  useEffect(() => {
    if (!enabled || !jobId || !token) return

    fetchJob()

    // Stop polling when job is complete
    if (isComplete) return

    const intervalId = setInterval(() => {
      if (!isComplete) fetchJob()
    }, interval)

    return () => clearInterval(intervalId)
  }, [enabled, jobId, token, interval, fetchJob, isComplete])

  return {
    job,
    isLoading,
    error,
    refetch: fetchJob,
    isComplete,
  }
}
