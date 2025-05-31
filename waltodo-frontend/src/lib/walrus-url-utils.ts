/**
 * Walrus URL utilities for transforming and generating Walrus URLs
 */

export interface WalrusUrlConfig {
  aggregatorUrl: string;
  publisherUrl: string;
  cacheTimeoutMs: number;
}

// Default configuration
const DEFAULT_CONFIG: WalrusUrlConfig = {
  aggregatorUrl: 'https://walrus-testnet-aggregator.nodes.guru',
  publisherUrl: 'https://walrus-testnet-publisher.nodes.guru',
  cacheTimeoutMs: 300000, // 5 minutes
};

// URL cache for performance
const urlCache = new Map<string, { url: string; timestamp: number }>();

/**
 * Transform a Walrus blob ID to a readable URL
 */
export function transformWalrusBlobToUrl(
  blobId: string,
  config: Partial<WalrusUrlConfig> = {}
): string {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Check cache first
  const cacheKey = `${blobId}:${mergedConfig.aggregatorUrl}`;
  const cached = urlCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < mergedConfig.cacheTimeoutMs) {
    return cached.url;
  }
  
  // Clean blob ID
  const cleanBlobId = blobId.trim().replace(/^0x/, '');
  
  // Generate URL
  const url = `${mergedConfig.aggregatorUrl}/v1/${cleanBlobId}`;
  
  // Cache the result
  urlCache.set(cacheKey, { url, timestamp: Date.now() });
  
  return url;
}

/**
 * Generate thumbnail URLs for different sizes
 */
export function generateThumbnailUrls(
  blobId: string,
  config: Partial<WalrusUrlConfig> = {}
): Record<string, string> {
  const baseUrl = transformWalrusBlobToUrl(blobId, config);
  
  // Walrus doesn't support automatic resizing, but we can provide
  // different URLs for potential future use or client-side processing
  return {
    original: baseUrl,
    large: `${baseUrl}?size=large`,
    medium: `${baseUrl}?size=medium`,
    small: `${baseUrl}?size=small`,
    thumbnail: `${baseUrl}?size=thumbnail`,
  };
}

/**
 * Extract blob ID from Walrus URL
 */
export function extractBlobIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Look for v1/{blobId} pattern
    const v1Index = pathParts.indexOf('v1');
    if (v1Index !== -1 && pathParts.length > v1Index + 1) {
      return pathParts[v1Index + 1];
    }
    
    // Fallback: try to find a hex string that looks like a blob ID
    const hexPattern = /[a-fA-F0-9]{64,}/;
    const match = url.match(hexPattern);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

/**
 * Validate if a URL is a valid Walrus URL
 */
export function isValidWalrusUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      (urlObj.hostname.includes('walrus') || 
       urlObj.hostname.includes('nodes.guru')) &&
      urlObj.pathname.includes('/v1/')
    );
  } catch {
    return false;
  }
}

/**
 * Clear URL cache
 */
export function clearUrlCache(): void {
  urlCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: number } {
  let totalSize = 0;
  urlCache.forEach(value => {
    totalSize += value.url.length;
  });
  
  return {
    size: totalSize,
    entries: urlCache.size,
  };
}