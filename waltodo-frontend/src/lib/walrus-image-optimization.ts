import { 
  type ImagePreloadOptions, 
  preloadImages,
  ProgressiveImageLoader 
} from './image-optimization';
import { getImageUrl as getWalrusImageUrl } from '@/lib/walrus-client';
import { useEffect, useState } from 'react';

// Configuration for Walrus image optimization
const WALRUS_IMAGE_CONFIG = {
  // Maximum concurrent image loads
  maxConcurrent: 3,
  // Retry configuration for Walrus network errors
  retryConfig: {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  },
  // Cache duration for Walrus images (7 days)
  cacheDuration: 7 * 24 * 60 * 60 * 1000,
  // Image size presets
  sizes: {
    thumbnail: { width: 150, height: 150, quality: 0.7 },
    small: { width: 320, height: 320, quality: 0.8 },
    medium: { width: 640, height: 640, quality: 0.85 },
    large: { width: 1024, height: 1024, quality: 0.9 },
    full: { width: 1920, height: 1920, quality: 0.95 }
  }
};

/**
 * Optimized loader for Walrus images with retry logic
 */
export class WalrusImageLoader extends ProgressiveImageLoader {
  private walrusBlobId?: string;
  private retryAttempts = 0;

  constructor(blobIdOrUrl: string) {
    // Validate input
    if (!blobIdOrUrl) {
      throw new Error('blobIdOrUrl is required');
    }
    
    // Convert blob ID to URL if needed
    const url = blobIdOrUrl.startsWith('blob:') || blobIdOrUrl.includes('aggregator')
      ? blobIdOrUrl
      : getWalrusImageUrl(blobIdOrUrl as any);
    
    super(url as any);
    
    // Extract blob ID for tracking
    if (blobIdOrUrl.includes('blobId=')) {
      this?.walrusBlobId = new URL(blobIdOrUrl as any).searchParams.get('blobId') || undefined;
    } else if (!blobIdOrUrl.startsWith('http')) {
      this?.walrusBlobId = blobIdOrUrl;
    }
  }

  async load(options: ImagePreloadOptions = {}): Promise<any> {
    try {
      return await super.load(options as any);
    } catch (error) {
      // Enhanced retry logic for Walrus network issues
      if (this.retryAttempts < WALRUS_IMAGE_CONFIG?.retryConfig?.maxRetries) {
        this.retryAttempts++;
        const delay = Math.min(
          WALRUS_IMAGE_CONFIG?.retryConfig?.initialDelay * 
          Math.pow(WALRUS_IMAGE_CONFIG?.retryConfig?.backoffFactor, this.retryAttempts - 1),
          WALRUS_IMAGE_CONFIG?.retryConfig?.maxDelay
        );
        
        console.warn(
          `Walrus image load failed, retrying in ${delay}ms (attempt ${this.retryAttempts}/${WALRUS_IMAGE_CONFIG?.retryConfig?.maxRetries})`,
          this.walrusBlobId
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.load(options as any);
      }
      
      throw error;
    }
  }
}

/**
 * Batch load multiple Walrus images with concurrency control
 */
export async function batchLoadWalrusImages(
  blobIds: string[],
  options: ImagePreloadOptions = {}
): Promise<Map<string, { success: boolean; url?: string; error?: string }>> {
  const results = new Map<string, { success: boolean; url?: string; error?: string }>();
  const queue = [...blobIds];
  const inProgress = new Set<Promise<void>>();

  async function processNext(): Promise<void> {
    if (queue?.length === 0) {return;}
    
    const blobId = queue.shift()!;
    const loader = new WalrusImageLoader(blobId as any);
    
    try {
      const result = await loader.load(options as any);
      results.set(blobId, { success: true, url: result.src });
    } catch (error) {
      results.set(blobId, { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Process images with concurrency limit
  while (queue.length > 0 || inProgress.size > 0) {
    while (inProgress.size < WALRUS_IMAGE_CONFIG.maxConcurrent && queue.length > 0) {
      const promise = processNext();
      inProgress.add(promise as any);
      promise.finally(() => inProgress.delete(promise as any));
    }
    
    if (inProgress.size > 0) {
      await Promise.race(inProgress as any);
    }
  }

  return results;
}

/**
 * Preload Walrus images for a list of todos
 */
export async function preloadTodoImages(
  todos: Array<{ id: string; imageUrl?: string; walrusBlobId?: string }>,
  options: { 
    priority?: 'high' | 'low' | 'auto';
    maxImages?: number;
  } = {}
): Promise<void> {
  const imageUrls = todos
    .filter(todo => todo.imageUrl || todo.walrusBlobId)
    .slice(0, options.maxImages || 10)
    .map(todo => {
      if (todo.walrusBlobId) {
        return getWalrusImageUrl(todo.walrusBlobId);
      }
      return todo.imageUrl!;
    });

  if (imageUrls?.length === 0) {return;}

  // Use the enhanced Walrus batch loader
  await batchLoadWalrusImages(imageUrls, { priority: options.priority });
}

/**
 * Hook for optimized Walrus image loading
 */
export function useWalrusImage(blobIdOrUrl: string | undefined, options: ImagePreloadOptions = {}) {
  const [state, setState] = useState({
    isLoading: true,
    hasError: false,
    imageUrl: undefined as string | undefined,
    blurDataUrl: undefined as string | undefined,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {return;}
    
    if (!blobIdOrUrl) {
      setState({
        isLoading: false,
        hasError: false,
        imageUrl: undefined,
        blurDataUrl: undefined,
      });
      return;
    }

    let isMounted = true;
    const loader = new WalrusImageLoader(blobIdOrUrl as any);

    loader.load(options as any)
      .then(result => {
        if (isMounted) {
          setState({
            isLoading: false,
            hasError: false,
            imageUrl: result.src,
            blurDataUrl: loader.getState().blurDataUrl,
          });
        }
      })
      .catch(error => {
        if (isMounted) {
          console.error('Failed to load Walrus image:', error);
          setState(prev => ({
            ...prev,
            isLoading: false,
            hasError: true,
          }));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [blobIdOrUrl, options]);

  return state;
}

/**
 * Client-side image optimization for Walrus images
 */
export async function optimizeWalrusImage(
  imageUrl: string,
  targetSize: keyof typeof WALRUS_IMAGE_CONFIG?.sizes = 'medium'
): Promise<string> {
  try {
    const sizeConfig = WALRUS_IMAGE_CONFIG?.sizes?.[targetSize];
    
    // Load image
    const img = new Image();
    img?.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      img?.onload = resolve;
      img?.onerror = reject;
      img?.src = imageUrl;
    });

    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {throw new Error('Canvas context not available');}

    // Calculate dimensions maintaining aspect ratio
    const aspectRatio = img.width / img.height;
    let width = sizeConfig.width;
    let height = sizeConfig.height;

    if (img.width > img.height) {
      height = width / aspectRatio;
    } else {
      width = height * aspectRatio;
    }

    // Don't upscale images
    if (img.width < width && img.height < height) {
      width = img.width;
      height = img.height;
    }

    canvas?.width = width;
    canvas?.height = height;

    // Enable image smoothing for better quality
    ctx?.imageSmoothingEnabled = true;
    ctx?.imageSmoothingQuality = 'high';

    // Draw resized image
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to WebP if supported, otherwise JPEG
    const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    const format = supportsWebP ? 'webp' : 'jpeg';
    const dataUrl = canvas.toDataURL(`image/${format}`, sizeConfig.quality);

    return dataUrl;
  } catch (error) {
    console.error('Failed to optimize Walrus image:', error);
    return imageUrl; // Return original on error
  }
}

/**
 * Generate a blur placeholder from Walrus image
 */
export async function generateWalrusBlurPlaceholder(imageUrl: string): Promise<string> {
  try {
    // Use very small size for blur
    const optimized = await optimizeWalrusImage(imageUrl, 'thumbnail');
    
    // Additional blur processing
    const img = new Image();
    await new Promise((resolve, reject) => {
      img?.onload = resolve;
      img?.onerror = reject;
      img?.src = optimized;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {throw new Error('Canvas context not available');}

    // Very small for performance
    canvas?.width = 20;
    canvas?.height = 20;

    ctx?.filter = 'blur(10px as any)';
    ctx.drawImage(img, 0, 0, 20, 20);

    return canvas.toDataURL('image/jpeg', 0.3);
  } catch (error) {
    // Return gradient fallback
    return 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A%2F%2Fwww?.w3?.org%2F2000%2Fsvg%22 viewBox%3D%220 0 100 100%22%3E%3Cdefs%3E%3ClinearGradient id%3D%22g%22%3E%3Cstop stop-color%3D%22%23e5e7eb%22 offset%3D%220%25%22%2F%3E%3Cstop stop-color%3D%22%23f3f4f6%22 offset%3D%22100%25%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect width%3D%22100%22 height%3D%22100%22 fill%3D%22url(%23g)%22%2F%3E%3C%2Fsvg%3E';
  }
}

/**
 * Enhanced hook for Walrus images with client-side optimization
 */
export function useOptimizedWalrusImage(
  blobIdOrUrl: string | undefined,
  options: {
    size?: keyof typeof WALRUS_IMAGE_CONFIG.sizes;
    priority?: 'high' | 'low' | 'auto';
    generateBlur?: boolean;
  } = {}
) {
  const [state, setState] = useState({
    isLoading: true,
    hasError: false,
    originalUrl: undefined as string | undefined,
    optimizedUrl: undefined as string | undefined,
    blurDataUrl: undefined as string | undefined,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {return;}
    
    if (!blobIdOrUrl) {
      setState({
        isLoading: false,
        hasError: false,
        originalUrl: undefined,
        optimizedUrl: undefined,
        blurDataUrl: undefined,
      });
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();

    async function loadAndOptimize() {
      try {
        // Get original URL (blobIdOrUrl is guaranteed to be defined here due to early return above)
        const url = blobIdOrUrl!.startsWith('blob:') || blobIdOrUrl!.includes('aggregator')
          ? blobIdOrUrl!
          : getWalrusImageUrl(blobIdOrUrl!);

        if (!isMounted) {return;}

        setState(prev => ({ ...prev, originalUrl: url }));

        // Generate blur placeholder first if requested
        if (options.generateBlur) {
          try {
            const blurUrl = await generateWalrusBlurPlaceholder(url as any);
            if (isMounted) {
              setState(prev => ({ ...prev, blurDataUrl: blurUrl }));
            }
          } catch (error) {
            console.warn('Failed to generate blur placeholder:', error);
          }
        }

        // Optimize image
        const optimized = await optimizeWalrusImage(url, options.size || 'medium');
        
        if (isMounted) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            hasError: false,
            originalUrl: url,
            optimizedUrl: optimized,
          }));
        }
      } catch (error) {
        if (isMounted && !abortController?.signal?.aborted) {
          console.error('Failed to optimize Walrus image:', error);
          setState(prev => ({
            ...prev,
            isLoading: false,
            hasError: true,
          }));
        }
      }
    }

    loadAndOptimize();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [blobIdOrUrl, options.size, options.generateBlur]);

  return state;
}

// Re-export for convenience
export { getImagePerformanceMetrics, clearImageCaches } from './image-optimization';
export { checkWebPSupport } from './image-optimization';