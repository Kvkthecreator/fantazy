/**
 * Attribution tracking utilities for capturing UTM parameters and signup source
 */

export interface Attribution {
  source: string | null;
  campaign: string | null;
  medium: string | null;
  content: string | null;
  landingPage: string;
  referrer: string;
}

const STORAGE_KEY = 'signup_attribution';

/**
 * Capture attribution data from current URL and browser context
 * Call this when user first lands on the site
 */
export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') {
    return getDefaultAttribution();
  }

  const params = new URLSearchParams(window.location.search);

  const attribution: Attribution = {
    source: params.get('utm_source'),
    campaign: params.get('utm_campaign'),
    medium: params.get('utm_medium'),
    content: params.get('utm_content'),
    landingPage: window.location.pathname,
    referrer: document.referrer || 'direct'
  };

  // Store in localStorage to persist through auth flow
  // This survives page redirects during OAuth/magic link flows
  localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));

  return attribution;
}

/**
 * Get previously stored attribution data
 * Returns null if no attribution has been captured
 */
export function getStoredAttribution(): Attribution | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to parse stored attribution:', error);
    return null;
  }
}

/**
 * Clear stored attribution data
 * Call this after successfully saving attribution to database
 */
export function clearAttribution(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get default attribution when none is available
 */
function getDefaultAttribution(): Attribution {
  return {
    source: null,
    campaign: null,
    medium: null,
    content: null,
    landingPage: '/',
    referrer: 'direct'
  };
}

/**
 * Check if current page has UTM parameters
 */
export function hasUtmParameters(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return (
    params.has('utm_source') ||
    params.has('utm_campaign') ||
    params.has('utm_medium') ||
    params.has('utm_content')
  );
}

/**
 * Format attribution for display
 */
export function formatAttribution(attribution: Attribution | null): string {
  if (!attribution) {
    return 'unknown';
  }

  const parts: string[] = [];

  if (attribution.source) parts.push(attribution.source);
  if (attribution.campaign) parts.push(attribution.campaign);

  return parts.length > 0 ? parts.join(' / ') : 'direct';
}
