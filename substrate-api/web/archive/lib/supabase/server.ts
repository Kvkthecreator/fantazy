import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/dbTypes';

/**
 * Canon-compliant server Supabase client.
 * Uses the Next.js auth helper which handles cookies with the Server Actions API contract.
 */
export function createServerSupabaseClient(): SupabaseClient<Database> {
  return createServerComponentClient<Database>({ cookies });
}
