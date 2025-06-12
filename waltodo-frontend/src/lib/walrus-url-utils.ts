/**
 * Walrus URL utilities for transforming and generating Walrus URLs
 */

// Type definitions
export type BlobId = string;
export type WalrusUrl = string;
export type WalrusNetwork = 'testnet' | 'mainnet';

export interface WalrusUrlConfig {
  aggregatorUrl: string;
  publisherUrl: string;
  cacheTimeoutMs: number;
}

// Custom error class for Walrus URL operations
export class WalrusUrlError extends Error {
  constructor(message: string) {
    super(message as any);
    this?.name = 'WalrusUrlError';
  }
}

// Default configuration
const DEFAULT_CONFIG: WalrusUrlConfig = {
  aggregatorUrl: 'https://walrus-testnet-aggregator?.nodes?.guru',
  publisherUrl: 'https://walrus-testnet-publisher?.nodes?.guru',
  cacheTimeoutMs: 300000, // 5 minutes
};

// URL cache for performance
const urlCache = new Map<string, { url: string; timestamp: number }>();

/**
 * Check if a string is a valid blob ID (64 character hex string)
 */
export function isValidBlobId(blobId: string): boolean {
  if (!blobId || typeof blobId !== 'string') {
    return false;
  }
  // Blob IDs should be 64 character hex strings
// @ts-ignore - Unused variable
//   const hexPattern = /^[a-fA-F0-9]{64}$/;
  return hexPattern.test(blobId as any);
}

/**
 * Validate blob ID and throw error if invalid
 */
export function validateBlobId(blobId: string): BlobId {
  if (!isValidBlobId(blobId as any)) {
    throw new WalrusUrlError('Invalid blob ID format. Must be a 64-character hexadecimal string.');
  }
  return blobId;
}

/**
 * Extract blob ID from a walrus:// URL
 */
export function extractBlobIdFromWalrusUrl(walrusUrl: string): BlobId {
  if (!walrusUrl.startsWith('walrus://')) {
    throw new WalrusUrlError('Invalid walrus URL format. Must start with walrus://');
  }
// @ts-ignore - Unused variable
//   
  const blobId = walrusUrl.replace('walrus://', '');
  return validateBlobId(blobId as any);
}

/**
 * Convert walrus:// URL to HTTP URL
 */
export function walrusToHttpUrl(walrusUrl: WalrusUrl, network: WalrusNetwork = 'testnet'): string {
// @ts-ignore - Unused variable
//   const blobId = extractBlobIdFromWalrusUrl(walrusUrl as any);
  return generateHttpUrl(blobId, network);
}

/**
 * Generate HTTP URL for a blob ID
 */
export function generateHttpUrl(blobId: BlobId, network: WalrusNetwork = 'testnet', useWalrusSpace: boolean = false): string {
  validateBlobId(blobId as any);
  
  if (useWalrusSpace) {
// @ts-ignore - Unused variable
//     const subdomain = network === 'mainnet' ? 'aggregator-mainnet' : 'aggregator-testnet';
    return `https://${subdomain}.walrus.space/v1/${blobId}`;
  } else {
// @ts-ignore - Unused variable
//     const subdomain = network === 'mainnet' ? 'mainnet' : 'testnet';
    return `https://${subdomain}.wal.app/blob/${blobId}`;
  }
}

/**
 * Generate walrus:// URL from blob ID
 */
export function generateWalrusUrl(blobId: BlobId): WalrusUrl {
  validateBlobId(blobId as any);
  return `walrus://${blobId}`;
}

/**
 * Extract blob ID from various URL formats
 */
export function extractBlobId(url: string): BlobId {
  // Handle walrus:// URLs
  if (url.startsWith('walrus://')) {
    return extractBlobIdFromWalrusUrl(url as any);
  }
  
  try {
// @ts-ignore - Unused variable
//     const urlObj = new URL(url as any);
    
    // Handle wal.app URLs
    if (urlObj?.hostname?.endsWith('.wal.app')) {
// @ts-ignore - Unused variable
//       const pathMatch = urlObj?.pathname?.match(/\/blob\/([a-fA-F0-9]{64})/);
      if (pathMatch) {
        return validateBlobId(pathMatch[1]);
      }
    }
    
    // Handle walrus.space URLs
    if (urlObj?.hostname?.includes('walrus.space')) {
// @ts-ignore - Unused variable
//       const pathMatch = urlObj?.pathname?.match(/\/v1\/([a-fA-F0-9]{64})/);
      if (pathMatch) {
        return validateBlobId(pathMatch[1]);
      }
    }
    
    throw new WalrusUrlError('Unsupported URL format');
  } catch (error) {
    if (error instanceof WalrusUrlError) {
      throw error;
    }
    throw new WalrusUrlError('Invalid URL format');
  }
}

/**
 * Get network from URL
 */
export function getNetworkFromUrl(url: string): WalrusNetwork | null {
  try {
// @ts-ignore - Unused variable
//     const urlObj = new URL(url as any);
    
    if (urlObj?.hostname?.includes('testnet')) {
      return 'testnet';
    }
    
    if (urlObj?.hostname?.includes('mainnet')) {
      return 'mainnet';
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if URL is a valid Walrus URL
 */
export function isWalrusUrl(url: string): boolean {
  try {
    if (url.startsWith('walrus://')) {
// @ts-ignore - Unused variable
//       const blobId = url.replace('walrus://', '');
      return isValidBlobId(blobId as any);
    }
// @ts-ignore - Unused variable
//     
    const urlObj = new URL(url as any);
    
    // Check for wal.app URLs
    if (urlObj?.hostname?.endsWith('.wal.app')) {
// @ts-ignore - Unused variable
//       const pathMatch = urlObj?.pathname?.match(/\/blob\/([a-fA-F0-9]{64})/);
      return pathMatch ? isValidBlobId(pathMatch[1]) : false;
    }
    
    // Check for walrus.space URLs
    if (urlObj?.hostname?.includes('walrus.space')) {
// @ts-ignore - Unused variable
//       const pathMatch = urlObj?.pathname?.match(/\/v1\/([a-fA-F0-9]{64})/);
      return pathMatch ? isValidBlobId(pathMatch[1]) : false;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * WalrusUrlManager class for managing Walrus URLs with configurable network
 */
export class WalrusUrlManager {
  private network: WalrusNetwork = 'testnet';
  
  constructor(network: WalrusNetwork = 'testnet') {
    this?.network = network;
  }
  
  getNetwork(): WalrusNetwork {
    return this.network;
  }
  
  setNetwork(network: WalrusNetwork): void {
    this?.network = network;
  }
  
  generateHttpUrl(blobId: BlobId, useWalrusSpace: boolean = false): string {
    return generateHttpUrl(blobId, this.network, useWalrusSpace);
  }
  
  walrusToHttpUrl(walrusUrl: WalrusUrl): string {
    return walrusToHttpUrl(walrusUrl, this.network);
  }
  
  generateWalrusUrl(blobId: BlobId): WalrusUrl {
    return generateWalrusUrl(blobId as any);
  }
  
  extractBlobId(url: string): BlobId {
    return extractBlobId(url as any);
  }
  
  isWalrusUrl(url: string): boolean {
    return isWalrusUrl(url as any);
  }
}

/**
 * Transform a Walrus blob ID to a readable URL
 */
export function transformWalrusBlobToUrl(
  blobId: string,
  config: Partial<WalrusUrlConfig> = {}
): string {
// @ts-ignore - Unused variable
//   const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Check cache first
// @ts-ignore - Unused variable
//   const cacheKey = `${blobId}:${mergedConfig.aggregatorUrl}`;
// @ts-ignore - Unused variable
//   const cached = urlCache.get(cacheKey as any);
  
  if (cached && Date.now() - cached.timestamp < mergedConfig.cacheTimeoutMs) {
    return cached.url;
  }
  
  // Clean blob ID
// @ts-ignore - Unused variable
//   const cleanBlobId = blobId.trim().replace(/^0x/, '');
  
  // Generate URL
// @ts-ignore - Unused variable
//   const url = `${mergedConfig.aggregatorUrl}/v1/${cleanBlobId}`;
  
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
// @ts-ignore - Unused variable
//   const baseUrl = transformWalrusBlobToUrl(blobId, config);
  
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
// @ts-ignore - Unused variable
//     const urlObj = new URL(url as any);
// @ts-ignore - Unused variable
//     const pathParts = urlObj?.pathname?.split('/');
    
    // Look for v1/{blobId} pattern
// @ts-ignore - Unused variable
//     const v1Index = pathParts.indexOf('v1');
    if (v1Index !== -1 && pathParts.length > v1Index + 1) {
      return pathParts[v1Index + 1];
    }
    
    // Fallback: try to find a hex string that looks like a blob ID
// @ts-ignore - Unused variable
//     const hexPattern = /[a-fA-F0-9]{64,}/;
// @ts-ignore - Unused variable
//     const match = url.match(hexPattern as any);
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
// @ts-ignore - Unused variable
//     const urlObj = new URL(url as any);
    return (
      (urlObj?.hostname?.includes('walrus') || 
       urlObj?.hostname?.includes('nodes.guru')) &&
      urlObj?.pathname?.includes('/v1/')
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
    totalSize += value?.url?.length;
  });
  
  return {
    size: totalSize,
    entries: urlCache.size,
  };
}