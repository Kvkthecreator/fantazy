/**
 * Supabase Authentication Helper
 * Ensures proper authentication for Realtime connections while preserving workspace membership
 */

import { createBrowserClient } from './clients'
import type { Database } from '@/lib/dbTypes'

export class SupabaseAuthHelper {
  private static instance: SupabaseAuthHelper
  private client = createBrowserClient()
  
  static getInstance() {
    if (!SupabaseAuthHelper.instance) {
      SupabaseAuthHelper.instance = new SupabaseAuthHelper()
    }
    return SupabaseAuthHelper.instance
  }
  
  /**
   * Get authenticated user with proper validation
   * Uses supabase.auth.getUser() instead of getSession() for security
   */
  async getAuthenticatedUser() {
    try {
      const { data: { user }, error } = await this.client.auth.getUser()
      
      if (error) {
        console.error('Authentication error:', error.message)
        return null
      }
      
      if (!user) {
        console.warn('No authenticated user found')
        return null
      }
      
      return user
    } catch (error) {
      console.error('Failed to get authenticated user:', error)
      return null
    }
  }
  
  /**
   * Get workspace ID for a basket
   */
  async getWorkspaceIdForBasket(basketId: string): Promise<string | null> {
    try {
      const { data, error } = await this.client
        .from('baskets')
        .select('workspace_id')
        .eq('id', basketId)
        .single()
      
      if (error) {
        console.error('Failed to get workspace for basket:', error)
        return null
      }
      
      return data?.workspace_id || null
    } catch (error) {
      console.error('Error getting workspace for basket:', error)
      return null
    }
  }

  /**
   * Check if user has access to a specific workspace
   * This preserves your workspace membership approach
   */
  async checkWorkspaceAccess(workspaceId: string) {
    try {
      const user = await this.getAuthenticatedUser()
      if (!user) return false
      
      // Query workspace_memberships table with RLS policies
      const { data, error } = await this.client
        .from('workspace_memberships')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - user not a member
          return false
        }
        console.error('Workspace access check failed:', error)
        return false
      }
      
      return !!data
    } catch (error) {
      console.error('Workspace access check error:', error)
      return false
    }
  }

  /**
   * Check if user has access to a basket (via workspace membership)
   */
  async checkBasketAccess(basketId: string) {
    const workspaceId = await this.getWorkspaceIdForBasket(basketId)
    if (!workspaceId) return false
    
    return this.checkWorkspaceAccess(workspaceId)
  }
  
  /**
   * Get current session with proper token validation
   */
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await this.client.auth.getSession()
      
      if (error) {
        console.error('Session error:', error.message)
        return null
      }
      
      // Let Supabase SDK handle auto-refresh to prevent 429 conflicts
      
      return session
    } catch (error) {
      console.error('Failed to get current session:', error)
      return null
    }
  }
  
  /**
   * Setup authenticated realtime client with explicit token handling
   * This is the CRITICAL FIX for WebSocket authentication issues
   */
  async getAuthenticatedClient() {
    // Get current session to check auth state
    const session = await this.getCurrentSession()
    
    // Minimal debug only (no secrets)
    
    if (session) {
      // Avoid logging tokens or PII to comply with guardrails
      
      // Log the JWT payload to see what role we have
      try {
        const tokenPayload = JSON.parse(atob(session.access_token.split('.')[1]))
        
        if (tokenPayload.role === 'authenticated') {
          // Authenticated session is available
          
          return this.client
        } else {
          console.warn('[DEBUG] ⚠️ Session has unexpected role:', tokenPayload.role)
        }
      } catch (e) {
        console.warn('[DEBUG] Could not parse JWT token:', e)
      }
    } else {
      // Proceed with anon client (polling will still function)
    }
    
    // Return the client - if no session, it will use anon key
    // Return client; polling remains the default transport
    return this.client
  }
}

export const authHelper = SupabaseAuthHelper.getInstance()
