import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Workspace Utility Functions
 * 
 * Centralized utilities for handling workspace_id resolution and validation
 * across all API routes. This ensures consistent workspace scoping for all
 * database records.
 */

export interface WorkspaceFromBasketResult {
  workspaceId: string;
  basket: {
    id: string;
    name: string;
    workspace_id: string;
    status: string;
    created_at: string;
    [key: string]: any;
  };
}

export interface WorkspaceError {
  error: string;
}

/**
 * Get workspace_id from a basket ID with proper error handling
 * 
 * This utility ensures all API routes consistently:
 * 1. Fetch the basket with workspace_id
 * 2. Validate basket existence and access
 * 3. Return workspace_id for creating workspace-scoped records
 * 
 * @param supabase - Supabase client instance
 * @param basketId - The basket ID to lookup
 * @returns WorkspaceFromBasketResult on success, WorkspaceError on failure
 */
export async function getWorkspaceFromBasket(
  supabase: SupabaseClient,
  basketId: string
): Promise<WorkspaceFromBasketResult | WorkspaceError> {
  if (!basketId) {
    return { error: 'Basket ID is required' };
  }

  try {
    const { data: basket, error } = await supabase
      .from('baskets')
      .select('*, workspace_id')
      .eq('id', basketId)
      .single();
      
    if (error) {
      console.error('Failed to fetch basket workspace:', error);
      return { error: 'Basket not found or unauthorized' };
    }
    
    if (!basket) {
      return { error: 'Basket not found' };
    }

    if (!basket.workspace_id) {
      console.error('Basket missing workspace_id:', { basketId, basket });
      return { error: 'Basket has no associated workspace' };
    }
    
    return { 
      workspaceId: basket.workspace_id, 
      basket 
    };
  } catch (error) {
    console.error('Error fetching basket workspace:', error);
    return { error: 'Failed to validate basket access' };
  }
}

/**
 * Validate workspace access for a user
 * 
 * @param supabase - Supabase client instance
 * @param workspaceId - The workspace ID to validate
 * @param userId - The user ID to check access for
 * @returns boolean indicating if user has access
 */
export async function validateWorkspaceAccess(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('workspace_memberships')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Get workspace_id and validate user access in one call
 * 
 * @param supabase - Supabase client instance
 * @param basketId - The basket ID to lookup
 * @param userId - The user ID to validate access for
 * @returns WorkspaceFromBasketResult on success, WorkspaceError on failure
 */
export async function getValidatedWorkspaceFromBasket(
  supabase: SupabaseClient,
  basketId: string,
  userId: string
): Promise<WorkspaceFromBasketResult | WorkspaceError> {
  const result = await getWorkspaceFromBasket(supabase, basketId);
  
  if ('error' in result) {
    return result;
  }

  const hasAccess = await validateWorkspaceAccess(supabase, result.workspaceId, userId);
  if (!hasAccess) {
    return { error: 'Insufficient workspace access' };
  }

  return result;
}