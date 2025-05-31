/**
 * Walrus Content Fetcher
 * React hook and utilities for fetching content from Walrus storage
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { walrusToHttpUrl, isValidBlobId, parseWalrusHeaders } from './walrus-url-utils';

export interface WalrusContentOptions {
  network?: 'mainnet' | 'testnet';
  gateway?: string;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  cache?: boolean;
}

export interface WalrusContentResult {
  data: string | null;
  loading: boolean;
  error: Error | null;
  contentType?: string;
  contentLength?: number;
  refetch: () => void;
}

// In-memory cache for content
const contentCache = new Map<string, {
  data: string;
  contentType?: string;
  contentLength?: number;
  timestamp: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch content from Walrus
 */
export async function fetchWalrusContent(
  blobIdOrUrl: string,
  options?: WalrusContentOptions
): Promise<{
  data: string;
  contentType?: string;
  contentLength?: number;
}> {
  const {
    network = 'testnet',
    gateway,
    timeout = 30000,
    retryCount = 3,
    retryDelay = 1000,
    cache = true,
  } = options || {};

  // Check cache first
  if (cache) {
    const cached = contentCache.get(blobIdOrUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        data: cached.data,
        contentType: cached.contentType,
        contentLength: cached.contentLength,
      };
    }
  }

  // Convert to HTTP URL
  let url: string;
  try {
    if (isValidBlobId(blobIdOrUrl)) {
      url = walrusToHttpUrl(`walrus://${blobIdOrUrl}`, network, gateway);
    } else {
      url = walrusToHttpUrl(blobIdOrUrl, network, gateway);
    }
  } catch (error) {
    throw new Error(`Invalid Walrus URL or blob ID: ${error}`);
  }

  // Fetch with retries
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      let data: string;
      
      // Handle different content types
      if (contentType?.startsWith('image/')) {
        // For images, convert to data URL
        const blob = await response.blob();
        data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else if (contentType?.includes('json')) {
        // For JSON, stringify the response
        const json = await response.json();
        data = JSON.stringify(json);
      } else {
        // For text content
        data = await response.text();
      }

      const result = {
        data,
        contentType: contentType || undefined,
        contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
      };

      // Cache the result
      if (cache) {
        contentCache.set(blobIdOrUrl, {
          ...result,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      // Wait before retrying
      if (attempt < retryCount) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to fetch content');
}

/**
 * React hook for fetching Walrus content
 */
export function useWalrusContent(
  blobIdOrUrl: string | null,
  options?: WalrusContentOptions
): WalrusContentResult {
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [contentType, setContentType] = useState<string | undefined>();
  const [contentLength, setContentLength] = useState<number | undefined>();
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const fetchContent = useCallback(async () => {
    if (!blobIdOrUrl) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchWalrusContent(blobIdOrUrl, options);
      
      if (isMountedRef.current) {
        setData(result.data);
        setContentType(result.contentType);
        setContentLength(result.contentLength);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error);
        setData(null);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [blobIdOrUrl, options]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    contentType,
    contentLength,
    refetch: fetchContent,
  };
}

/**
 * Clear the content cache
 */
export function clearWalrusCache(blobId?: string): void {
  if (blobId) {
    contentCache.delete(blobId);
  } else {
    contentCache.clear();
  }
}

/**
 * Get cache statistics
 */
export function getWalrusCacheStats(): {
  size: number;
  entries: number;
  oldestEntry?: number;
} {
  let oldestTimestamp: number | undefined;
  
  for (const entry of contentCache.values()) {
    if (!oldestTimestamp || entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
    }
  }

  return {
    size: Array.from(contentCache.values()).reduce(
      (total, entry) => total + entry.data.length,
      0
    ),
    entries: contentCache.size,
    oldestEntry: oldestTimestamp,
  };
}

/**
 * Preload content into cache
 */
export async function preloadWalrusContent(
  blobIds: string[],
  options?: WalrusContentOptions
): Promise<void> {
  await Promise.all(
    blobIds.map(blobId => 
      fetchWalrusContent(blobId, { ...options, cache: true })
        .catch(err => console.error(`Failed to preload ${blobId}:`, err))
    )
  );
}