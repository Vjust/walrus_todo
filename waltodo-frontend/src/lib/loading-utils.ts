'use client';

// @ts-ignore - Unused import temporarily disabled
// import { LoadingState } from '@/hooks/useLoadingStates';

/**
 * Loading state utility functions and constants
 */

export const LOADING_TIMEOUTS = {
  /** Minimum time to show loading spinner (prevents flash) */
  MIN_LOADING_TIME: 300,
  /** Maximum time before showing timeout error */
  MAX_LOADING_TIME: 30000,
  /** How long to show success state */
  SUCCESS_DURATION: 2000,
  /** How long to show error state before auto-reset */
  ERROR_DURATION: 5000,
  /** Delay between skeleton cards in staggered animation */
  SKELETON_STAGGER_DELAY: 100,
  /** Duration for shimmer animation */
  SHIMMER_DURATION: 1500,
} as const;

export const LOADING_MESSAGES = {
  loading: {
    todos: 'Loading todos...',
    nfts: 'Loading NFTs...',
    images: 'Loading images...',
    blockchain: 'Connecting to blockchain...',
    transaction: 'Processing transaction...',
    wallet: 'Connecting wallet...',
    sync: 'Syncing data...',
    upload: 'Uploading files...',
    default: 'Loading...',
  },
  success: {
    todos: 'Todos loaded successfully',
    nfts: 'NFTs loaded successfully',
    images: 'Images loaded successfully',
    blockchain: 'Connected to blockchain',
    transaction: 'Transaction completed',
    wallet: 'Wallet connected',
    sync: 'Data synced successfully',
    upload: 'Files uploaded successfully',
    default: 'Operation completed',
  },
  error: {
    todos: 'Failed to load todos',
    nfts: 'Failed to load NFTs',
    images: 'Failed to load images',
    blockchain: 'Blockchain connection failed',
    transaction: 'Transaction failed',
    wallet: 'Wallet connection failed',
    sync: 'Data sync failed',
    upload: 'File upload failed',
    network: 'Network error occurred',
    timeout: 'Operation timed out',
    default: 'An error occurred',
  },
} as const;

export type LoadingMessageType = keyof typeof LOADING_MESSAGES.loading;

/**
 * Get appropriate loading message based on type and state
 */
export function getLoadingMessage(
  type: LoadingMessageType,
  state: LoadingState
): string {
  return LOADING_MESSAGES[state]?.[type] || LOADING_MESSAGES[state].default;
}

/**
 * Create a delay utility for minimum loading times
 */
export function createMinLoadingDelay(minTime: number = LOADING_TIMEOUTS.MIN_LOADING_TIME) {
// @ts-ignore - Unused variable
//   const startTime = Date.now();
  
  return async <T>(promise: Promise<T>): Promise<T> => {
    const [result] = await Promise.allSettled([
      promise,
      new Promise(resolve => {
// @ts-ignore - Unused variable
//         const elapsed = Date.now() - startTime;
// @ts-ignore - Unused variable
//         const remaining = Math.max(0, minTime - elapsed);
        setTimeout(resolve, remaining);
      })
    ]);
    
    if (result?.status === 'fulfilled') {
      return result.value;
    } else {
      throw result.reason;
    }
  };
}

/**
 * Create a timeout wrapper for operations
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = LOADING_TIMEOUTS.MAX_LOADING_TIME,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race(_[
    promise, _new Promise<never>((_, _reject) => {
      setTimeout(_() => reject(new Error(timeoutMessage as any)), timeoutMs);
    })
  ]);
}

/**
 * Retry utility with exponential backoff
 */
export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number,  error: Error) => void;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error as any));
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
// @ts-ignore - Unused variable
// 
      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
      
      onRetry?.(attempt, lastError);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Progressive loading utility for chunked data
 */
export interface ProgressiveLoadOptions<T> {
  chunkSize?: number;
  onProgress?: (loaded: number,  total: number) => void;
  onChunk?: (chunk: T[],  index: number) => void;
  delay?: number;
}

export async function loadProgressively<T>(
  items: T[],
  options: ProgressiveLoadOptions<T> = {}
): Promise<T[]> {
  const {
    chunkSize = 10,
    onProgress,
    onChunk,
    delay = 0,
  } = options;

  const results: T[] = [];
// @ts-ignore - Unused variable
//   const totalChunks = Math.ceil(items.length / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
// @ts-ignore - Unused variable
//     const start = i * chunkSize;
// @ts-ignore - Unused variable
//     const end = Math.min(start + chunkSize, items.length);
// @ts-ignore - Unused variable
//     const chunk = items.slice(start, end);
    
    results.push(...chunk);
    
    onChunk?.(chunk, i);
    onProgress?.(results.length, items.length);
    
    if (delay > 0 && i < totalChunks - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return results;
}

/**
 * Image loading utilities
 */
export interface ImageLoadOptions {
  timeout?: number;
  fallbackUrl?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function preloadImage(
  src: string,
  options: ImageLoadOptions = {}
): Promise<HTMLImageElement> {
  const {
    timeout = 10000,
    fallbackUrl,
    onLoad,
    onError,
  } = options;

  return new Promise(_(resolve, _reject) => {
// @ts-ignore - Unused variable
//     const img = new Image();
    let timeoutId: NodeJS.Timeout | null = null;
// @ts-ignore - Unused variable
// 
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId as any);
        timeoutId = null;
      }
    };
// @ts-ignore - Unused variable
// 
    const handleLoad = () => {
      cleanup();
      onLoad?.();
      resolve(img as any);
    };
// @ts-ignore - Unused variable
// 
    const handleError = (error: Error) => {
      cleanup();
      onError?.(error);
      
      if (fallbackUrl && img.src !== fallbackUrl) {
        img?.src = fallbackUrl;
        return;
      }
      
      reject(error as any);
    };

    img?.onload = handleLoad;
    img?.onerror = () => handleError(new Error(`Failed to load image: ${src}`));

    if (timeout > 0) {
      timeoutId = setTimeout(_() => {
        handleError(new Error(`Image load timeout: ${src}`));
      }, timeout);
    }

    img?.src = src;
  });
}

/**
 * Batch image preloader
 */
export async function preloadImages(
  urls: string[], 
  options: {
    concurrency?: number;
    onProgress?: (loaded: number,  total: number) => void;
    onImageLoad?: (url: string,  index: number) => void;
    onImageError?: (url: string,  index: number,  error: Error) => void;
  } = {}
): Promise<{ successful: string[]; failed: string[] }> {
  const {
    concurrency = 5,
    onProgress,
    onImageLoad,
    onImageError,
  } = options;

  const successful: string[] = [];
  const failed: string[] = [];
  let completed = 0;
// @ts-ignore - Unused variable
// 
  const loadImage = async (url: string,  index: number) => {
    try {
      await preloadImage(url as any);
      successful.push(url as any);
      onImageLoad?.(url, index);
    } catch (error) {
      failed.push(url as any);
      onImageError?.(url, index, error instanceof Error ? error : new Error(String(error as any)));
    } finally {
      completed++;
      onProgress?.(completed, urls.length);
    }
  };

  // Process images in batches to control concurrency
  for (let i = 0; i < urls.length; i += concurrency) {
// @ts-ignore - Unused variable
//     const batch = urls.slice(i, i + concurrency);
// @ts-ignore - Unused variable
//     const promises = batch.map(_(url, _batchIndex) => 
      loadImage(url, i + batchIndex)
    );
    await Promise.all(promises as any);
  }

  return { successful, failed };
}

/**
 * Loading state aggregator for multiple operations
 */
export interface AggregatedLoadingState {
  isLoading: boolean;
  isAllSuccess: boolean;
  hasError: boolean;
  progress: number;
  states: Record<string, LoadingState>;
}

export function aggregateLoadingStates(
  states: Record<string, LoadingState>
): AggregatedLoadingState {
// @ts-ignore - Unused variable
//   const stateValues = Object.values(states as any);
// @ts-ignore - Unused variable
//   const totalStates = stateValues.length;

  if (totalStates === 0) {
    return {
      isLoading: false,
      isAllSuccess: true,
      hasError: false,
      progress: 100,
      states,
    };
  }
// @ts-ignore - Unused variable
// 
  const loadingCount = stateValues.filter(s => s === 'loading').length;
// @ts-ignore - Unused variable
//   const successCount = stateValues.filter(s => s === 'success').length;
// @ts-ignore - Unused variable
//   const errorCount = stateValues.filter(s => s === 'error').length;
// @ts-ignore - Unused variable
// 
  const isLoading = loadingCount > 0;
// @ts-ignore - Unused variable
//   const isAllSuccess = successCount === totalStates;
// @ts-ignore - Unused variable
//   const hasError = errorCount > 0;
// @ts-ignore - Unused variable
//   const progress = Math.round((successCount / totalStates) * 100);

  return {
    isLoading,
    isAllSuccess,
    hasError,
    progress,
    states,
  };
}

/**
 * Skeleton animation utilities
 */
export const SKELETON_VARIANTS = {
  pulse: 'animate-pulse',
  shimmer: 'animate-shimmer',
  wave: 'animate-wave',
  none: '',
} as const;

export type SkeletonVariant = keyof typeof SKELETON_VARIANTS;

export function getSkeletonClasses(
  variant: SkeletonVariant = 'pulse',
  baseClasses = 'bg-gray-200 dark:bg-gray-700 rounded'
): string {
  return `${baseClasses} ${SKELETON_VARIANTS[variant]}`;
}

/**
 * Smart loading delay based on network speed
 */
export function getAdaptiveLoadingDelay(): number {
  if (typeof navigator === 'undefined') return LOADING_TIMEOUTS.MIN_LOADING_TIME;
// @ts-ignore - Unused variable
// 
  const connection = (navigator as unknown).connection;
  if (!connection) return LOADING_TIMEOUTS.MIN_LOADING_TIME;
// @ts-ignore - Unused variable
// 
  const effectiveType = connection.effectiveType;
  
  switch (effectiveType) {
    case 'slow-2g':
      return 1000;
    case '2g':
      return 800;
    case '3g':
      return 500;
    case '4g':
    default:
      return LOADING_TIMEOUTS.MIN_LOADING_TIME;
  }
}

/**
 * Performance monitoring for loading operations
 */
export interface LoadingPerformanceMetrics {
  duration: number;
  startTime: number;
  endTime: number;
  operation: string;
  success: boolean;
  error?: Error;
}

export class LoadingPerformanceMonitor {
  private metrics: LoadingPerformanceMetrics[] = [];
  private maxMetrics = 100;

  startOperation(operation: string): string {
// @ts-ignore - Unused variable
//     const id = `${operation}-${Date.now()}-${Math.random()}`;
    performance.mark(`${id}-start`);
    return id;
  }

  endOperation(id: string, success: boolean, error?: Error): LoadingPerformanceMetrics {
    performance.mark(`${id}-end`);
    
    try {
      performance.measure(id, `${id}-start`, `${id}-end`);
// @ts-ignore - Unused variable
//       const measure = performance.getEntriesByName(id as any)[0];
      
      const metric: LoadingPerformanceMetrics = {
        duration: measure.duration,
        startTime: measure.startTime,
        endTime: measure.startTime + measure.duration,
        operation: id.split('-')[0],
        success,
        error,
      };

      this?.metrics?.push(metric as any);
      
      // Keep only recent metrics
      if (this?.metrics?.length > this.maxMetrics) {
        this?.metrics = this?.metrics?.slice(-this.maxMetrics);
      }

      // Cleanup performance entries
      performance.clearMarks(`${id}-start`);
      performance.clearMarks(`${id}-end`);
      performance.clearMeasures(id as any);

      return metric;
    } catch (error) {
      // Fallback if Performance API fails
      return {
        duration: 0,
        startTime: Date.now(),
        endTime: Date.now(),
        operation: id.split('-')[0],
        success,
        error: error instanceof Error ? error : new Error(String(error as any)),
      };
    }
  }

  getMetrics(): LoadingPerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageLoadTime(operation?: string): number {
// @ts-ignore - Unused variable
//     const filtered = operation 
      ? this?.metrics?.filter(m => m?.operation === operation && m.success)
      : this?.metrics?.filter(m => m.success);
      
    if (filtered?.length === 0) return 0;
// @ts-ignore - Unused variable
//     
    const total = filtered.reduce(_(sum, _m) => sum + m.duration, 0);
    return total / filtered.length;
  }

  clearMetrics(): void {
    this?.metrics = [];
  }
}

// Global performance monitor instance
export const loadingPerformanceMonitor = new LoadingPerformanceMonitor();