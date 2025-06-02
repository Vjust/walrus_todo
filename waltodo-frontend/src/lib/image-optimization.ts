import { LRUCache } from 'lru-cache';
import { useState, useEffect } from 'react';
import type React from 'react';

// Types
interface ImageLoadingState {
  src: string;
  isLoading: boolean;
  hasError: boolean;
  loadedSrc?: string;
  blurDataUrl?: string;
}

interface ResponsiveImage {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
}

export interface ImagePreloadOptions {
  priority?: 'high' | 'low' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
}

interface PerformanceMetrics {
  loadTime: number;
  size: number;
  format: string;
  cached: boolean;
}

// Cache for processed images and blur placeholders
const imageCache = new LRUCache<string, string>({
  max: 100,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
  sizeCalculation: (value: string) => value.length,
  maxSize: 50 * 1024 * 1024, // 50MB
});

const blurCache = new LRUCache<string, string>({
  max: 200,
  ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
});

const performanceMetrics = new Map<string, PerformanceMetrics>();

// WebP support detection
let webpSupported: boolean | null = null;

export async function checkWebPSupport(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false; // Assume no WebP support during SSR
  }

  if (webpSupported !== null) return webpSupported;

  try {
    const webpData = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    const img = new Image();
    
    const result = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(img.width > 0 && img.height > 0);
      img.onerror = () => resolve(false);
      img.src = webpData;
    });

    webpSupported = result;
    return result;
  } catch {
    webpSupported = false;
    return false;
  }
}

// Generate blur placeholder using canvas
export async function generateBlurPlaceholder(src: string): Promise<string> {
  if (typeof window === 'undefined') {
    // Return a gradient fallback for SSR
    return 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 1 1%22%3E%3Cdefs%3E%3ClinearGradient id%3D%22g%22%3E%3Cstop stop-color%3D%22%23e0e0e0%22 offset%3D%220%25%22%2F%3E%3Cstop stop-color%3D%22%23f0f0f0%22 offset%3D%22100%25%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect width%3D%221%22 height%3D%221%22 fill%3D%22url(%23g)%22%2F%3E%3C%2Fsvg%3E';
  }

  const cached = blurCache.get(src);
  if (cached) return cached;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = src;
    });

    // Create small canvas for blur
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Use small dimensions for performance
    const scale = 0.1;
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    // Draw scaled down image
    ctx.filter = 'blur(5px)';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blurDataUrl = canvas.toDataURL('image/jpeg', 0.4);
    blurCache.set(src, blurDataUrl);
    
    return blurDataUrl;
  } catch (error) {
    console.error('Error generating blur placeholder:', error);
    // Return a simple gradient as fallback
    return 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 1 1%22%3E%3Cdefs%3E%3ClinearGradient id%3D%22g%22%3E%3Cstop stop-color%3D%22%23e0e0e0%22 offset%3D%220%25%22%2F%3E%3Cstop stop-color%3D%22%23f0f0f0%22 offset%3D%22100%25%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect width%3D%221%22 height%3D%221%22 fill%3D%22url(%23g)%22%2F%3E%3C%2Fsvg%3E';
  }
}

// Convert image to WebP format if supported
export async function convertToWebP(src: string): Promise<string> {
  if (typeof window === 'undefined') return src;
  if (!await checkWebPSupport()) return src;
  
  const cached = imageCache.get(`webp:${src}`);
  if (cached) return cached;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = src;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const webpDataUrl = canvas.toDataURL('image/webp', 0.85);
    imageCache.set(`webp:${src}`, webpDataUrl);
    
    return webpDataUrl;
  } catch (error) {
    console.error('Error converting to WebP:', error);
    return src;
  }
}

// Generate responsive srcset
export function generateSrcSet(src: string, sizes: number[] = [320, 640, 960, 1280, 1920]): string {
  const isWalrusUrl = src.includes('walrus') || src.includes('blob');
  
  if (isWalrusUrl) {
    // For Walrus URLs, we can't resize on the fly, so return the original
    return `${src} 1x`;
  }

  // For regular URLs, generate srcset
  return sizes
    .map(size => `${src}?w=${size} ${size}w`)
    .join(', ');
}

// Intersection Observer for lazy loading
let lazyImageObserver: IntersectionObserver | null = null;

function getLazyImageObserver(onIntersect: (entry: IntersectionObserverEntry) => void): IntersectionObserver {
  if (typeof window === 'undefined') {
    // Return a no-op observer for SSR
    return {
      observe: () => {},
      unobserve: () => {},
      disconnect: () => {},
    } as IntersectionObserver;
  }

  if (!lazyImageObserver) {
    lazyImageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onIntersect(entry);
            lazyImageObserver?.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01,
      }
    );
  }
  return lazyImageObserver;
}

// Progressive image loader class
export class ProgressiveImageLoader {
  private state: ImageLoadingState;
  private performanceStart: number = 0;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private offlineCache: Cache | null = null;

  constructor(src: string) {
    this.state = {
      src,
      isLoading: true,
      hasError: false,
    };
    this.initOfflineCache();
  }

  private async initOfflineCache() {
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        this.offlineCache = await caches.open('walrus-images-v1');
      } catch (error) {
        console.error('Failed to open offline cache:', error);
      }
    }
  }

  async load(options: ImagePreloadOptions = {}): Promise<ResponsiveImage> {
    if (typeof window === 'undefined') {
      // Return a basic result for SSR
      return {
        src: this.state.src,
        srcSet: generateSrcSet(this.state.src),
      };
    }

    this.performanceStart = performance.now();

    try {
      // Check offline cache first
      const cachedResponse = await this.checkOfflineCache(this.state.src);
      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        const cachedUrl = URL.createObjectURL(blob);
        this.recordPerformance(blob.size, blob.type, true);
        return {
          src: cachedUrl,
          srcSet: generateSrcSet(this.state.src),
        };
      }

      // Generate blur placeholder
      const blurPromise = generateBlurPlaceholder(this.state.src);

      // Load the actual image
      const img = new Image();
      if (options.priority === 'high') {
        img.loading = 'eager';
        img.fetchPriority = options.fetchPriority || 'high';
      } else {
        img.loading = 'lazy';
        img.fetchPriority = options.fetchPriority || 'auto';
      }

      const loadPromise = new Promise<ResponsiveImage>((resolve, reject) => {
        img.onload = async () => {
          this.state.isLoading = false;
          this.state.hasError = false;

          // Cache in offline storage
          await this.cacheOffline(this.state.src);

          // Try WebP conversion for non-WebP images
          let finalSrc = this.state.src;
          if (!this.state.src.includes('.webp') && await checkWebPSupport()) {
            try {
              finalSrc = await convertToWebP(this.state.src);
            } catch {
              // Fall back to original on error
            }
          }

          this.state.loadedSrc = finalSrc;
          this.recordPerformance(0, 'unknown', false);

          resolve({
            src: finalSrc,
            srcSet: generateSrcSet(this.state.src),
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        };

        img.onerror = () => {
          this.state.isLoading = false;
          this.state.hasError = true;
          
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            setTimeout(() => {
              img.src = this.state.src;
            }, 1000 * this.retryCount);
          } else {
            reject(new Error(`Failed to load image: ${this.state.src}`));
          }
        };

        img.src = this.state.src;
      });

      // Set blur placeholder while loading
      try {
        this.state.blurDataUrl = await blurPromise;
      } catch {
        // Ignore blur generation errors
      }

      return await loadPromise;
    } catch (error) {
      console.error('Image loading error:', error);
      throw error;
    }
  }

  private async checkOfflineCache(url: string): Promise<Response | null> {
    if (!this.offlineCache) return null;

    try {
      const cached = await this.offlineCache.match(url);
      return cached || null;
    } catch {
      return null;
    }
  }

  private async cacheOffline(url: string): Promise<void> {
    if (!this.offlineCache) return;

    try {
      const response = await fetch(url);
      if (response.ok) {
        await this.offlineCache.put(url, response.clone());
      }
    } catch (error) {
      console.error('Failed to cache image offline:', error);
    }
  }

  private recordPerformance(size: number, format: string, cached: boolean) {
    const loadTime = performance.now() - this.performanceStart;
    const metrics: PerformanceMetrics = {
      loadTime,
      size,
      format,
      cached,
    };
    
    performanceMetrics.set(this.state.src, metrics);
    
    // Log slow loads
    if (loadTime > 3000 && !cached) {
      console.warn(`Slow image load: ${this.state.src} took ${loadTime.toFixed(2)}ms`);
    }
  }

  getState(): ImageLoadingState {
    return { ...this.state };
  }
}

// Preload images with priority
export async function preloadImages(
  urls: string[],
  options: ImagePreloadOptions = {}
): Promise<void> {
  const promises = urls.map(async (url) => {
    try {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      
      if (options.priority === 'high') {
        link.fetchPriority = 'high';
      }

      document.head.appendChild(link);

      // Also trigger actual loading for caching
      const loader = new ProgressiveImageLoader(url);
      await loader.load(options);
    } catch (error) {
      console.error(`Failed to preload image: ${url}`, error);
    }
  });

  await Promise.allSettled(promises);
}

// React hook for progressive image loading
export function useProgressiveImage(src: string, options: ImagePreloadOptions = {}) {
  const [state, setState] = useState<ImageLoadingState>({
    src,
    isLoading: true,
    hasError: false,
  });

  useEffect(() => {
    if (!src || typeof window === 'undefined') return;

    const loader = new ProgressiveImageLoader(src);
    
    loader.load(options)
      .then((result) => {
        setState({
          src: result.src,
          isLoading: false,
          hasError: false,
          loadedSrc: result.src,
          blurDataUrl: loader.getState().blurDataUrl,
        });
      })
      .catch(() => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          hasError: true,
        }));
      });
  }, [src, options]);

  return state;
}

// Hook for lazy loading with intersection observer
export function useLazyImage(src: string, elementRef: React.RefObject<HTMLElement>) {
  const [isInView, setIsInView] = useState(false);
  const imageState = useProgressiveImage(isInView ? src : '', {
    priority: isInView ? 'high' : 'low',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const element = elementRef.current;
    if (!element) return;

    const observer = getLazyImageObserver((entry) => {
      if (entry.isIntersecting) {
        setIsInView(true);
      }
    });

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [elementRef]);

  return {
    ...imageState,
    isInView,
  };
}

// Get performance metrics
export function getImagePerformanceMetrics(): Map<string, PerformanceMetrics> {
  return new Map(performanceMetrics);
}

// Clear caches
export function clearImageCaches() {
  imageCache.clear();
  blurCache.clear();
  performanceMetrics.clear();
}

// Export utility to check if image is cached
export function isImageCached(src: string): boolean {
  return imageCache.has(src) || imageCache.has(`webp:${src}`);
}

// Component helper for responsive images
export interface OptimizedImageProps {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: 'high' | 'low' | 'auto';
  onLoad?: () => void;
  onError?: () => void;
}

export function getOptimizedImageProps(props: OptimizedImageProps): React.ImgHTMLAttributes<HTMLImageElement> {
  const { src, alt, sizes, className, priority = 'auto' } = props;

  return {
    src,
    alt,
    className,
    sizes: sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    srcSet: generateSrcSet(src),
    loading: priority === 'high' ? 'eager' : 'lazy',
    decoding: 'async',
    onLoad: props.onLoad,
    onError: props.onError,
  };
}