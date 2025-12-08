/**
 * Component: ApiClient
 * Centralized API client - ONE source of truth for ALL API calls
 * No more scattered fetch() calls across components
 * @contract input  : BasketChangeRequest
 * @contract output : BasketDelta
 */

import type { BasketChangeRequest, BasketDelta } from '@/shared/contracts/basket'
import { fetchWithToken } from '@/lib/fetchWithToken'
import { getCacheManager } from '@/lib/performance/CacheManager'

// Use local Next.js API routes to avoid CORS issues
const API_BASE_URL = typeof window !== 'undefined' 
  ? window.location.origin 
  : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    try {
      let response = await fetchWithToken(url, config)

      // Single retry on 401 to handle token race conditions
      if (response.status === 401) {
        response = await fetchWithToken(url, config)
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return response.json()
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Network Error: Unable to connect to ${url}. Please check your internet connection.`)
      }
      throw error
    }
  }

  // Basket operations
  async getBasket(basketId: string): Promise<any> {
    try {
      const cache = getCacheManager()
      const cacheKey = `basket:${basketId}`
      const cached = await cache.get<any>(cacheKey)
      if (cached) return cached
      
      console.log(`🔄 API Client: Fetching basket ${basketId} from ${this.baseUrl}/api/baskets/${basketId}`)
      const data = await this.request<any>(`/api/baskets/${basketId}`)
      await cache.set(cacheKey, data, { tags: ['basket', cacheKey] })
      return data
    } catch (error) {
      console.error(`❌ API Client: Failed to get basket ${basketId}:`, error)
      throw error
    }
  }

  async listBaskets(): Promise<any[]> {
    const cache = getCacheManager()
    const cacheKey = 'basketList'
    const cached = await cache.get<any[]>(cacheKey)
    if (cached) return cached
    const data = await this.request<any[]>('/api/baskets')
    await cache.set(cacheKey, data, { tags: ['basketList'] })
    return data
  }

  async getBasketDeltas(basketId: string): Promise<BasketDelta[]> {
    const cache = getCacheManager()
    const cacheKey = `basket:${basketId}:deltas`
    const cached = await cache.get<BasketDelta[]>(cacheKey)
    if (cached) return cached
    const data = await this.request<BasketDelta[]>(`/api/baskets/${basketId}/deltas`)
    await cache.set(cacheKey, data, { tags: ['basket', `basket:${basketId}`] })
    return data
  }

  async processBasketWork(basketId: string, request: BasketChangeRequest): Promise<BasketDelta> {
    const result = await this.request<BasketDelta>(`/api/baskets/${basketId}/work`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
    const cache = getCacheManager()
    await cache.invalidateByPattern(`^basket:${basketId}`)
    await cache.invalidateByPattern('^basketList')
    return result
  }

  async applyBasketDelta(basketId: string, deltaId: string): Promise<{ status: string; basket_id: string; delta_id: string }> {
    const result = await this.request<{ status: string; basket_id: string; delta_id: string }>(`/api/baskets/${basketId}/apply/${deltaId}`, {
      method: 'POST',
    })
    const cache = getCacheManager()
    await cache.invalidateByPattern(`^basket:${basketId}`)
    await cache.invalidateByPattern('^basketList')
    return result
  }
}

// Singleton instance
export const apiClient = new ApiClient()

// Helper functions for direct usage
export const basketApi = {
  get: (basketId: string) => apiClient.getBasket(basketId),
  list: () => apiClient.listBaskets(),
  processWork: (basketId: string, request: BasketChangeRequest) =>
    apiClient.processBasketWork(basketId, request),

  getDeltas: (basketId: string) =>
    apiClient.getBasketDeltas(basketId),
  
  applyDelta: (basketId: string, deltaId: string) =>
    apiClient.applyBasketDelta(basketId, deltaId),
}
