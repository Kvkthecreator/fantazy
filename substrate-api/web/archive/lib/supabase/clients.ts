import {
  createClientComponentClient,
  createServerComponentClient as createNextServerComponentClient,
  createRouteHandlerClient as createNextRouteHandlerClient,
} from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/dbTypes';

let browserClient: SupabaseClient<Database> | undefined;
let serviceRoleClient: SupabaseClient<Database> | undefined;

export const createBrowserClient = (): SupabaseClient<Database> => {
  if (!browserClient) {
    // Use auth-helpers client to ensure cookie-based session storage
    // This ensures server-side and client-side share the same session via cookies
    browserClient = createClientComponentClient<Database>();
  }
  return browserClient;
};

export const createServerComponentClient = ({ cookies }: { cookies: any }): SupabaseClient<Database> =>
  createNextServerComponentClient<Database>({ cookies });

export const createRouteHandlerClient = ({ cookies }: { cookies: any }): SupabaseClient<Database> =>
  createNextRouteHandlerClient<Database>({ cookies });

// Service role client for tests and admin operations (bypasses RLS)
export const createServiceRoleClient = (): SupabaseClient<Database> => {
  if (!serviceRoleClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase service role configuration');
    }
    
    serviceRoleClient = createClient<Database>(supabaseUrl, serviceRoleKey);
  }
  return serviceRoleClient;
};
