'use client';

import React from 'react';
import { OptimizedImage, OptimizedImageGallery } from './OptimizedImage';
import { getImagePerformanceMetrics, clearImageCaches } from '@/lib/image-optimization';

interface TodoImageDisplayProps {
  todoId: string;
  imageUrl?: string;
  imageUrls?: string[];
  showPerformanceMetrics?: boolean;
}

export function TodoImageDisplay({ 
  todoId, 
  imageUrl, 
  imageUrls,
  showPerformanceMetrics = false 
}: TodoImageDisplayProps) {
  // Convert Walrus blob IDs to accessible URLs
  const processImageUrl = (url: string): string => {
    // If it's a Walrus blob ID, convert to URL
    if (url.startsWith('0x') || url.includes('walrus')) {
      // Use testnet aggregator URL
      const aggregatorUrl = 'https://aggregator.walrus-testnet.walrus.space';
      return `${aggregatorUrl}/v1/${url}`;
    }
    return url;
  };

  // Performance monitoring
  React.useEffect(() => {
    if (!showPerformanceMetrics) return;

    const interval = setInterval(() => {
      const metrics = getImagePerformanceMetrics();
      if (metrics.size > 0) {
        console.log('Image Performance Metrics:', Array.from(metrics.entries()));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [showPerformanceMetrics]);

  // Single image display
  if (imageUrl) {
    return (
      <div className="todo-image-container">
        <OptimizedImage
          src={processImageUrl(imageUrl)}
          alt={`Image for todo ${todoId}`}
          width={400}
          height={300}
          className="rounded-lg shadow-md"
          priority="high"
          placeholder="blur"
          onLoad={() => console.log(`Image loaded for todo ${todoId}`)}
          onError={() => console.error(`Failed to load image for todo ${todoId}`)}
        />
        
        {showPerformanceMetrics && (
          <PerformanceDisplay />
        )}
      </div>
    );
  }

  // Multiple images gallery
  if (imageUrls && imageUrls.length > 0) {
    const images = imageUrls.map((url, index) => ({
      src: processImageUrl(url),
      alt: `Image ${index + 1} for todo ${todoId}`,
      id: `${todoId}-${index}`,
    }));

    return (
      <div className="todo-gallery-container">
        <OptimizedImageGallery 
          images={images}
          columns={3}
        />
        
        {showPerformanceMetrics && (
          <PerformanceDisplay />
        )}
      </div>
    );
  }

  return null;
}

// Performance metrics display component
function PerformanceDisplay() {
  const [metrics, setMetrics] = React.useState<Map<string, any>>(new Map());

  React.useEffect(() => {
    const updateMetrics = () => {
      setMetrics(new Map(getImagePerformanceMetrics()));
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000);

    return () => clearInterval(interval);
  }, []);

  if (metrics.size === 0) return null;

  return (
    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
      <h4 className="font-semibold mb-2">Performance Metrics</h4>
      <div className="space-y-1">
        {Array.from(metrics.entries()).map(([url, metric]) => (
          <div key={url} className="flex justify-between text-xs">
            <span className="truncate max-w-xs">{url.split('/').pop()}</span>
            <span>
              {metric.loadTime.toFixed(0)}ms | {(metric.size / 1024).toFixed(1)}KB | 
              {metric.cached ? ' (cached)' : ''} {metric.format}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          clearImageCaches();
          window.location.reload();
        }}
        className="mt-2 text-xs text-blue-600 hover:text-blue-800"
      >
        Clear Caches
      </button>
    </div>
  );
}

// Hook for managing todo images with optimization
export function useTodoImages(todoId: string, imageUrls?: string[]) {
  const [optimizedUrls, setOptimizedUrls] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!imageUrls || imageUrls.length === 0) return;

    // Preload and optimize images
    const processImages = async () => {
      const { preloadImages } = await import('@/lib/image-optimization');
      
      const processed = imageUrls.map(url => {
        // If it's a Walrus blob ID, convert to URL
        if (url.startsWith('0x') || url.includes('walrus')) {
          // Use testnet aggregator URL
          const aggregatorUrl = 'https://aggregator.walrus-testnet.walrus.space';
          return `${aggregatorUrl}/v1/${url}`;
        }
        return url;
      });

      // Preload first 3 images with high priority
      await preloadImages(processed.slice(0, 3), { priority: 'high' });
      
      // Preload rest with low priority
      if (processed.length > 3) {
        await preloadImages(processed.slice(3), { priority: 'low' });
      }

      setOptimizedUrls(processed);
    };

    processImages();
  }, [imageUrls]);

  return optimizedUrls;
}