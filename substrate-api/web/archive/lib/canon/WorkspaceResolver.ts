/**
 * Canonical Workspace Resolver
 * 
 * Enforces YARNNN Canon principle: "Single workspace per user (strong guarantee)"
 * Prevents multiple workspaces and ensures workspace isolation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/clients';

export interface SingleWorkspaceResult {
  workspaceId: string;
  isOwner: boolean;
}

export interface WorkspaceError {
  error: string;
  code?: 'MULTIPLE_WORKSPACES' | 'NO_WORKSPACE' | 'RESOLUTION_FAILED';
}

export class CanonicalWorkspaceResolver {
  private supabase: SupabaseClient;
  private serviceSupabase: SupabaseClient;
  
  constructor(supabase: SupabaseClient, serviceSupabase?: SupabaseClient) {
    this.supabase = supabase;
    try {
      this.serviceSupabase = serviceSupabase ?? createServiceRoleClient();
    } catch (error) {
      console.error('[Workspace Resolver] Service role client unavailable, falling back to auth client', error);
      this.serviceSupabase = supabase;
    }
  }

  /**
   * Resolve user's single authoritative workspace
   * Enforces canon compliance: exactly one workspace per user
   */
  async resolveSingleWorkspace(userId: string): Promise<SingleWorkspaceResult | WorkspaceError> {
    try {
      // Get ALL workspace memberships for user
      const { data: memberships, error } = await this.supabase
        .from('workspace_memberships')
        .select(`
          workspace_id,
          role,
          workspaces!inner(id, name, owner_id)
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('[Workspace Resolution Error]', error);
        return { 
          error: 'Failed to resolve workspace', 
          code: 'RESOLUTION_FAILED' 
        };
      }

      if (!memberships || memberships.length === 0) {
        console.warn('[CANON NOTICE] Missing workspace membership detected; repairing via service role', {
          userId,
        });
        return await this.ensureWorkspaceWithMembership(userId);
      }

      // Canon violation: multiple workspaces detected
      if (memberships.length > 1) {
        console.error('[CANON VIOLATION] Multiple workspaces detected', {
          userId,
          workspaceCount: memberships.length,
          workspaces: memberships.map(m => ({
            id: m.workspace_id,
            role: m.role
          }))
        });

        // For now, use the first workspace but log violation
        // TODO: Implement workspace consolidation
        const primaryMembership = memberships[0];
        return {
          workspaceId: primaryMembership.workspace_id,
          isOwner: primaryMembership.role === 'owner'
        };
      }

      // Single workspace - canon compliant
      const membership = memberships[0];
      return {
        workspaceId: membership.workspace_id,
        isOwner: membership.role === 'owner'
      };

    } catch (error) {
      console.error('[Workspace Resolution Exception]', error);
      return { 
        error: 'Workspace resolution failed', 
        code: 'RESOLUTION_FAILED' 
      };
    }
  }

  /**
   * Create single workspace for user (canon compliant)
   */
  private async ensureWorkspaceWithMembership(userId: string): Promise<SingleWorkspaceResult | WorkspaceError> {
    try {
      const { data: existingWorkspace, error: lookupError } = await this.serviceSupabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', userId)
        .limit(1)
        .maybeSingle();

      if (lookupError && lookupError.code !== 'PGRST116') {
        console.error('[Workspace Lookup Error]', lookupError);
        return {
          error: 'Failed to resolve workspace',
          code: 'RESOLUTION_FAILED',
        };
      }

      let workspaceId = existingWorkspace?.id;

      if (!workspaceId) {
        const { data: workspace, error: workspaceError } = await this.serviceSupabase
          .from('workspaces')
          .insert({
            owner_id: userId,
            name: 'My Workspace',
          })
          .select('id')
          .single();

        if (workspaceError || !workspace) {
          console.error('[Workspace Creation Error]', workspaceError);
          return {
            error: 'Failed to create workspace',
            code: 'RESOLUTION_FAILED',
          };
        }

        workspaceId = workspace.id;
      }

      const { data: membership, error: membershipError } = await this.serviceSupabase
        .from('workspace_memberships')
        .upsert(
          {
            workspace_id: workspaceId,
            user_id: userId,
            role: 'owner',
          },
          { onConflict: 'workspace_id,user_id' },
        )
        .select('role')
        .single();

      if (membershipError) {
        console.error('[Workspace Membership Repair Error]', membershipError);
        return {
          error: 'Failed to create workspace membership',
          code: 'RESOLUTION_FAILED',
        };
      }

      return {
        workspaceId,
        isOwner: membership?.role === 'owner',
      };

    } catch (error) {
      console.error('[Workspace Service Role Exception]', error);
      return {
        error: 'Workspace creation failed',
        code: 'RESOLUTION_FAILED',
      };
    }
  }

  /**
   * Validate workspace isolation for a resource
   */
  async validateWorkspaceIsolation(
    resourceWorkspaceId: string, 
    userWorkspaceId: string
  ): Promise<boolean> {
    return resourceWorkspaceId === userWorkspaceId;
  }

  /**
   * Get all workspace memberships (for debugging/admin)
   */
  async getAllWorkspaceMemberships(userId: string) {
    const { data, error } = await this.supabase
      .from('workspace_memberships')
      .select(`
        workspace_id,
        role,
        created_at,
        workspaces!inner(id, name, owner_id, created_at)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    return { memberships: data || [], error };
  }

  /**
   * Consolidate multiple workspaces (for fixing canon violations)
   * WARNING: This is a destructive operation
   */
  async consolidateWorkspaces(
    userId: string,
    primaryWorkspaceId: string
  ): Promise<{ success: boolean; error?: string }> {
    // This would be implemented for fixing multiple workspace violations
    // For now, just log the issue
    console.warn('[Workspace Consolidation Needed]', {
      userId,
      primaryWorkspaceId,
      message: 'Multiple workspaces detected - manual consolidation required'
    });
    
    return { 
      success: false, 
      error: 'Workspace consolidation not implemented' 
    };
  }
}

/**
 * Factory function for API routes
 */
export function createWorkspaceResolver(supabase: SupabaseClient): CanonicalWorkspaceResolver {
  return new CanonicalWorkspaceResolver(supabase);
}

/**
 * Helper function for backward compatibility
 */
export async function ensureSingleWorkspace(
  userId: string,
  supabase: SupabaseClient
): Promise<{ id: string } | never> {
  const resolver = new CanonicalWorkspaceResolver(supabase);
  const result = await resolver.resolveSingleWorkspace(userId);
  
  if ('error' in result) {
    throw new Error(`Workspace resolution failed: ${result.error}`);
  }
  
  return { id: result.workspaceId };
}
