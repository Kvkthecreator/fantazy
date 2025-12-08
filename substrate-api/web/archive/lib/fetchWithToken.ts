import { createBrowserClient } from "./supabase/clients";

/**
 * Fetch wrapper that automatically adds Supabase auth tokens
 * and prepends API_BASE_URL for relative paths starting with /api
 */
export async function fetchWithToken(
  input: RequestInfo | URL,
  init: RequestInit = {},
  token?: string,
) {
  // Get JWT token
  let jwt = token;
  if (!jwt) {
    const supabase = createBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("No authenticated user found. Please log in to continue.");
    }
    const session = await supabase.auth.getSession();
    jwt = session.data.session?.access_token ?? "";
  }

  // Prepend API base URL for backend API paths only
  // Keep Next.js API routes (like /api/baskets/[id]/stats) on frontend
  let url: string;
  if (typeof input === 'string') {
    // Only redirect specific backend routes to api.yarnnn.com
    const backendRoutes = ['/api/p3/', '/api/p4/', '/api/dumps/', '/api/health/', '/api/integrations/'];
    const isBackendRoute = backendRoutes.some(route => input.startsWith(route));

    if (isBackendRoute) {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      url = `${apiBase}${input}`;
    } else {
      url = input;
    }
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
  }

  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!jwt || !apikey) {
    console.warn(
      "Missing access_token or apikey – this will break RLS or Supabase auth.",
    );
  }

  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "sb-access-token": jwt,
      Authorization: `Bearer ${jwt}`,
      apikey,
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
}
