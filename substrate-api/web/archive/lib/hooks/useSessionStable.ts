import { useEffect, useState } from 'react';
import type { Session } from '@supabase/auth-helpers-react';
import { createBrowserClient } from '@/lib/supabase/clients';

export type SessionStatus = 'loading' | 'ready' | 'error';

const supabase = createBrowserClient();

export function useSessionStable() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return;
        if (error) {
          setStatus('error');
          return;
        }
        setSession(session);
        setStatus('ready');
      })
      .catch(() => {
        if (mounted) setStatus('error');
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { session, jwt: session?.access_token ?? null, status };
}
