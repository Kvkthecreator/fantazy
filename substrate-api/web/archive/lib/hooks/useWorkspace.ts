/**
 * Workspace Hook - Canon v1.4.0 Compliant
 * Provides current user's workspace information
 */

'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/clients';
import { useAuth } from '../useAuth';

interface Workspace {
  id: string;
  name: string;
}

export function useWorkspace() {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!user?.id) {
      setWorkspace(null);
      setLoading(false);
      return;
    }
    
    const supabase = createBrowserClient();
    
    // Get user's workspace via workspace_memberships
    supabase
      .from('workspace_memberships')
      .select(`workspace_id, workspaces ( id, name )`)
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('Workspace fetch error:', error);
          setWorkspace(null);
        } else {
          const ws = data.workspaces as any;
          setWorkspace({ id: ws.id, name: ws.name });
        }
        setLoading(false);
      });
  }, [user?.id]);
  
  return { workspace, loading };
}
