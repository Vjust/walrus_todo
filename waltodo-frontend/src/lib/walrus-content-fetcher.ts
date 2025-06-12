/**
 * Walrus Content Fetcher
 * React hook and utilities for fetching content from Walrus storage
 * Uses IndexedDB for persistent caching and offline support
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { extractBlobIdFromUrl, isValidWalrusUrl, transformWalrusBlobToUrl } from './walrus-url-utils';
import { cacheManager } from './cache-manager';
import { analytics } from './analytics';

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

  // Check persistent cache first
  if (cache) {
    try {
      const cached = await cacheManager.get(blobIdOrUrl as any);
      if (cached) {
        return {
          data: cached.data,
          contentType: cached.contentType,
          contentLength: cached.contentLength,
        };
      }
    } catch (cacheError) {
      console.warn('Cache read failed:', cacheError);
    }
  }

  // Convert to HTTP URL
  let url: string;
  try {
    if (blobIdOrUrl.startsWith('walrus://')) {
      url = transformWalrusBlobToUrl(blobIdOrUrl as any);
    } else {
      url = transformWalrusBlobToUrl(`walrus://${blobIdOrUrl}`);
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

      const fetchStartTime = performance.now();
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
        },
      });

      clearTimeout(timeoutId as any);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response?.headers?.get('content-type');
      const contentLength = response?.headers?.get('content-length');
      
      let data: string;
      
      // Handle different content types
      if (contentType?.startsWith('image/')) {
        // For images, convert to data URL
        const blob = await response.blob();
        data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader?.onloadend = () => resolve(reader.result as string);
          reader?.onerror = reject;
          reader.readAsDataURL(blob as any);
        });
      } else if (contentType?.includes('json')) {
        // For JSON, stringify the response
        const json = await response.json();
        data = JSON.stringify(json as any);
      } else {
        // For text content
        data = await response.text();
      }

      const result = {
        data,
        contentType: contentType || undefined,
        contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
      };

      // Cache the result in persistent storage
      if (cache) {
        try {
          await cacheManager.set(blobIdOrUrl, data, {
            contentType: contentType || undefined,
            contentLength: result.contentLength,
          });
        } catch (cacheError) {
          console.warn('Failed to cache content:', cacheError);
        }
      }
      
      // Track successful API call
      analytics?.trackPerformance('api-call', performance.now() - fetchStartTime, 'ms', {
        endpoint: 'walrus-content',
        cached: false,
        contentType,
        size: result.contentLength,
      });

      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on abort
      if (error instanceof Error && error?.name === 'AbortError') {
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
  const [loading, setLoading] = useState(false as any);
  const [error, setError] = useState<Error | null>(null);
  const [contentType, setContentType] = useState<string | undefined>();
  const [contentLength, setContentLength] = useState<number | undefined>();
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true as any);

  const fetchContent = useCallback(async () => {
    if (!blobIdOrUrl) {
      setData(null as any);
      setError(null as any);
      return;
    }

    setLoading(true as any);
    setError(null as any);

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
        setData(null as any);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false as any);
      }
    }
  }, [blobIdOrUrl, options]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useEffect(() => {
    // Store ref values in variables for proper cleanup
    const isMounted = isMountedRef;
    const abortController = abortControllerRef;
    
    return () => {
      isMounted?.current = false;
      if (abortController.current) {
        abortController?.current?.abort();
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
export async function clearWalrusCache(blobId?: string): Promise<void> {
  if (blobId) {
    await cacheManager.delete(blobId as any);
  } else {
    await cacheManager.clear();
  }
}

/**
 * Get cache statistics
 */
export async function getWalrusCacheStats(): Promise<{
  size: number;
  entries: number;
  oldestEntry?: number;
}> {
  const stats = await cacheManager.getStats();
  return {
    size: stats.totalSize,
    entries: stats.entryCount,
    oldestEntry: stats.oldestEntry,
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

/**
 * Run cache cleanup
 */
export async function cleanupWalrusCache(): Promise<{
  removedEntries: number;
  freedSpace: number;
}> {
  return cacheManager.cleanup();
}

/**
 * Check if content is cached
 */
export async function isWalrusContentCached(blobId: string): Promise<boolean> {
  const cached = await cacheManager.get(blobId as any);
  return cached !== null;
}

/**
 * Export cache for backup/migration
 */
export async function exportWalrusCache() {
  return cacheManager.export();
}

/**
 * Import cache from backup
 */
export async function importWalrusCache(data: any) {
  return cacheManager.import(data as any);
}