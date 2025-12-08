import { z } from 'zod';
import { ApiErrorSchema } from './contracts';
import { MockApiAdapter } from './adapters/mock';
import { dlog } from '@/lib/dev/log';

export interface ApiRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromResponse(response: Response, body?: unknown): ApiError {
    // Try to parse error from response body
    if (body && typeof body === 'object' && 'error' in body) {
      try {
        const parsed = ApiErrorSchema.parse({ ...body, status: response.status });
        return new ApiError(parsed.error, parsed.status, parsed.details, parsed.code);
      } catch {
        // Fall through to default error
      }
    }

    return new ApiError(
      response.statusText || `HTTP ${response.status}`,
      response.status,
      typeof body === 'string' ? body : undefined
    );
  }
}

// Global mock adapter instance
let mockAdapter: MockApiAdapter | null = null;

// Session cache to prevent repeated auth calls
interface SessionCache {
  session: any | null;
  timestamp: number;
  expiry: number;
}

let sessionCache: SessionCache | null = null;
const SESSION_CACHE_TTL = 30000; // 30 seconds cache

/**
 * Clear the session cache (call this on auth state changes)
 */
export function clearSessionCache() {
  dlog('api/http/session-cache-clear', { timestamp: Date.now() });
  sessionCache = null;
}

/**
 * Get cached session (shared utility to prevent repeated auth calls)
 */
export async function getCachedSession() {
  if (typeof window === 'undefined') return null;
  
  const now = Date.now();
  
  // Check if we have a valid cached session
  if (sessionCache && now < sessionCache.expiry) {
    dlog('api/http/session-cache-shared-hit', { 
      cacheAge: now - sessionCache.timestamp 
    });
    return sessionCache.session;
  } else {
    // Cache miss or expired - fetch new session
    dlog('api/http/session-cache-shared-miss', { 
      reason: sessionCache ? 'expired' : 'no-cache' 
    });
    
    const { createBrowserClient } = await import('@/lib/supabase/clients');
    const supabase = createBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      sessionCache = null;
      return null;
    }
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session) {
      sessionCache = null;
      return null;
    }
    // Let Supabase SDK handle auto-refresh to prevent 429 conflicts
    const mergedSession = { ...session, user };
    sessionCache = {
      session: mergedSession,
      timestamp: now,
      expiry: now + SESSION_CACHE_TTL,
    };
    return mergedSession;
  }
}

/**
 * Centralized API client with auth, workspace headers, and request tracking
 */
export async function apiClient(request: ApiRequest): Promise<unknown> {
  // Check if we're in mock mode
  const apiMode = process.env.API_MODE || process.env.NEXT_PUBLIC_API_MODE;
  if (apiMode === 'mock') {
    if (!mockAdapter) {
      mockAdapter = new MockApiAdapter();
    }
    return mockAdapter.request(request.url, { 
      method: request.method,
      body: request.body,
      url: request.url,
    });
  }
  const { url, method = 'GET', body, headers = {}, signal } = request;
  
  // Generate request ID for tracking
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  // Get auth token if available (in browser context) with caching
  let authToken: string | undefined;
  if (typeof window !== 'undefined') {
    const session = await getCachedSession();
    authToken = session?.access_token;
  }
  
  // Build full URL - handle both absolute and relative URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  
  // Prepare headers
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    ...headers,
  };
  
  if (authToken) {
    finalHeaders['Authorization'] = `Bearer ${authToken}`;
    finalHeaders['sb-access-token'] = authToken;
  }
  
  
  // Log request in development
  dlog('api/http/request', {
    url,
    method,
    requestId,
    hasAuth: !!authToken,
  });
  
  try {
    let response = await fetch(fullUrl, {
      method,
      headers: finalHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal,
      credentials: 'include', // Include cookies for server-side auth
    });

    if (response.status === 401 && typeof window !== 'undefined') {
      clearSessionCache();
      const retrySession = await getCachedSession();
      const retryToken = retrySession?.access_token;
      if (retryToken) {
        finalHeaders['Authorization'] = `Bearer ${retryToken}`;
        finalHeaders['sb-access-token'] = retryToken;
        response = await fetch(fullUrl, {
          method,
          headers: finalHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal,
          credentials: 'include',
        });
      }
    }
    
    // Parse response
    let responseData: unknown;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }
    
    // Handle errors
    if (!response.ok) {
      throw ApiError.fromResponse(response, responseData);
    }
    
    // Log successful response in development
    dlog('api/http/response', {
      url,
      method,
      status: response.status,
      requestId,
    });
    
    return responseData;
    
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new ApiError('Network error - unable to reach server', 0, 'Check your internet connection');
    }
    
    // Handle abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request cancelled', 0, 'The request was aborted');
    }
    
    // Re-throw API errors
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Wrap unknown errors
    throw new ApiError(
      'An unexpected error occurred',
      0,
      error instanceof Error ? error.message : String(error)
    );
  }
}

// Helper to create a timeout signal
export function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}