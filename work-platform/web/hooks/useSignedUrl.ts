import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage signed URLs for storage assets.
 *
 * Signed URLs expire after a period (default 1 hour). This hook:
 * 1. Uses the provided URL initially
 * 2. If the URL fails (expired), fetches a fresh signed URL using the storage path
 * 3. Caches the fresh URL for the component's lifetime
 *
 * @param initialUrl - The initially provided URL (may be expired)
 * @param storagePath - The permanent storage path for fetching fresh URLs
 * @param bucket - The storage bucket name (defaults to 'yarnnn-assets')
 */
export function useSignedUrl(
  initialUrl: string | null | undefined,
  storagePath: string | null | undefined,
  bucket: string = 'yarnnn-assets'
): {
  url: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [url, setUrl] = useState<string | null>(initialUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  // Fetch a fresh signed URL from the API
  const fetchFreshUrl = useCallback(async () => {
    if (!storagePath) {
      setError('No storage path available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/storage/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: storagePath,
          bucket,
          expires_in: 3600, // 1 hour
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: 'Failed to get signed URL' }));
        throw new Error(data.detail || 'Failed to get signed URL');
      }

      const data = await response.json();
      setUrl(data.signed_url);
    } catch (err) {
      console.error('[useSignedUrl] Error fetching fresh URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to load image');
    } finally {
      setLoading(false);
    }
  }, [storagePath, bucket]);

  // Handle image load error (expired URL)
  const handleError = useCallback(() => {
    if (storagePath && !needsRefresh) {
      setNeedsRefresh(true);
    }
  }, [storagePath, needsRefresh]);

  // Effect to fetch fresh URL when needed
  useEffect(() => {
    if (needsRefresh) {
      fetchFreshUrl();
      setNeedsRefresh(false);
    }
  }, [needsRefresh, fetchFreshUrl]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (storagePath) {
      fetchFreshUrl();
    }
  }, [storagePath, fetchFreshUrl]);

  return { url, loading, error, refresh };
}

/**
 * Component wrapper for handling signed URL images with automatic refresh.
 * Use this when you have a content_asset with both url and storage_path.
 */
export function useContentAssetUrl(body: {
  url?: string;
  storage_path?: string;
  storage_bucket?: string;
  asset_type?: string;
}): {
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  onError: () => void;
  refresh: () => void;
} {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use fresh URL if we have one, otherwise use the original
  const imageUrl = freshUrl || body.url || null;

  // Fetch fresh URL
  const fetchFresh = useCallback(async () => {
    if (!body.storage_path) {
      setError('No storage path available to refresh');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/storage/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: body.storage_path,
          bucket: body.storage_bucket || 'yarnnn-assets',
          expires_in: 3600,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: 'Failed to get signed URL' }));
        throw new Error(data.detail || 'Failed to get signed URL');
      }

      const data = await response.json();
      setFreshUrl(data.signed_url);
    } catch (err) {
      console.error('[useContentAssetUrl] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [body.storage_path, body.storage_bucket]);

  // Effect to fetch when needed
  useEffect(() => {
    if (needsRefresh && body.storage_path) {
      fetchFresh();
      setNeedsRefresh(false);
    }
  }, [needsRefresh, body.storage_path, fetchFresh]);

  const onError = useCallback(() => {
    if (body.storage_path && !freshUrl) {
      setNeedsRefresh(true);
    }
  }, [body.storage_path, freshUrl]);

  const refresh = useCallback(() => {
    if (body.storage_path) {
      fetchFresh();
    }
  }, [body.storage_path, fetchFresh]);

  return { imageUrl, loading, error, onError, refresh };
}
