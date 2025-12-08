/**
 * Component: useBasketOperations
 * Missing operational hook - handles all basket operations
 * Centralized state management for basket actions
 * @contract input  : BasketChangeRequest
 * @contract output : BasketDelta
 */

import { useState } from 'react'
import { basketApi } from '@/lib/api/client'
import type { BasketChangeRequest, BasketDelta } from '@/shared/contracts/basket'

interface UseBasketOperationsReturn {
  isLoading: boolean
  error: string | null
  processWork: (request: BasketChangeRequest) => Promise<BasketDelta | null>
  getDeltas: () => Promise<BasketDelta[] | null>
  applyDelta: (deltaId: string) => Promise<boolean>
  clearError: () => void
}

export function useBasketOperations(basketId: string): UseBasketOperationsReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = () => setError(null)

  const processWork = async (request: BasketChangeRequest): Promise<BasketDelta | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const delta = await basketApi.processWork(basketId, request)
      return delta
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process work'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const getDeltas = async (): Promise<BasketDelta[] | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const deltas = await basketApi.getDeltas(basketId)
      return deltas
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get deltas'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const applyDelta = async (deltaId: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      await basketApi.applyDelta(basketId, deltaId)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply delta'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    error,
    processWork,
    getDeltas,
    applyDelta,
    clearError,
  }
}