
export function getApiBaseUrl(): string {
  // Preferred explicit API base
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (explicit) return explicit;

  // Derive from site URL when using standard yarnnn.com domains
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try {
    if (site) {
      const u = new URL(site);
      // If site is yarnnn.com or www.yarnnn.com, use api.yarnnn.com
      if (u.hostname === 'yarnnn.com' || u.hostname === 'www.yarnnn.com') {
        return 'https://api.yarnnn.com';
      }
      // If site is a custom domain like foo.yarnnn.com, prefer api.yarnnn.com
      if (u.hostname.endsWith('.yarnnn.com')) {
        return 'https://api.yarnnn.com';
      }
    }
  } catch {}

  // Fallback default for production
  return 'https://api.yarnnn.com';
}
