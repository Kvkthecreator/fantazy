"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/clients';
import type { User } from '@supabase/supabase-js';

/** Canon v1.4.0 compliant auth hook - single source of auth state */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | undefined>();
  
  useEffect(() => {
    const supabase = createBrowserClient();
    
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token);
    });
    
    // Single auth listener to prevent 429 conflicts
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setToken(session?.access_token);
        setLoading(false);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  return {
    token,
    user,
    isLoading: loading,
  };
}