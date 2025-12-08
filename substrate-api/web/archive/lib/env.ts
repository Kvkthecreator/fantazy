const FALLBACK_API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.yarnnn.com'
  : 'http://127.0.0.1:8000';

const rawBase = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();

export const PUBLIC_API_BASE_URL = rawBase || FALLBACK_API_BASE_URL;

export function apiUrl(path: string): string {
  if (!PUBLIC_API_BASE_URL) return path;
  const base = PUBLIC_API_BASE_URL.endsWith('/')
    ? PUBLIC_API_BASE_URL.slice(0, -1)
    : PUBLIC_API_BASE_URL;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
