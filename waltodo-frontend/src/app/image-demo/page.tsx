'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import components to avoid SSR issues
const OptimizedImageGallery = dynamic(
  () => import('@/components/OptimizedImage').then(mod => ({ default: mod.OptimizedImageGallery })),
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />
  }
);

// Dynamically import optimization functions to avoid SSR issues
const imageOptimizationPromise = typeof window !== 'undefined' 
  ? import('@/lib/image-optimization')
  : null;

// Demo images (you can replace these with actual Walrus URLs)
const demoImages = [
  {
    id: '1',
    src: 'https://images.unsplash.com/photo-1611095973763-414019e72400?w=800',
    alt: 'Todo image 1'
  },
  {
    id: '2',
    src: 'https://images.unsplash.com/photo-1611095973971-7d0238b7e8d9?w=800',
    alt: 'Todo image 2'
  },
  {
    id: '3',
    src: 'https://images.unsplash.com/photo-1611095973363-9f0a5d6d1e84?w=800',
    alt: 'Todo image 3'
  },
  {
    id: '4',
    src: 'https://images.unsplash.com/photo-1611095973715-95b2b28168f9?w=800',
    alt: 'Todo image 4'
  },
  {
    id: '5',
    src: 'https://images.unsplash.com/photo-1611095974172-2a979e6e0289?w=800',
    alt: 'Todo image 5'
  },
  {
    id: '6',
    src: 'https://images.unsplash.com/photo-1611095973362-88d8e92611a0?w=800',
    alt: 'Todo image 6'
  },
];

export default function ImageDemoPage() {
  const [showMetrics, setShowMetrics] = useState(true);
  const [webpSupport, setWebpSupport] = useState<boolean | null>(null);
  const [performanceData, setPerformanceData] = useState<Map<string, any>>(new Map());
  const [imageOptimization, setImageOptimization] = useState<any>(null);

  React.useEffect(() => {
    // Load image optimization functions dynamically
    if (imageOptimizationPromise) {
      imageOptimizationPromise.then(module => {
        setImageOptimization(module);
        // Check WebP support
        module.checkWebPSupport().then(setWebpSupport);
      });
    }
  }, []);

  React.useEffect(() => {
    if (!imageOptimization) return;

    // Update performance metrics periodically
    const interval = setInterval(() => {
      setPerformanceData(new Map(imageOptimization.getImagePerformanceMetrics()));
    }, 500);

    return () => clearInterval(interval);
  }, [imageOptimization]);

  const handlePreloadAll = async () => {
    if (!imageOptimization) return;
    const urls = demoImages.map(img => img.src);
    await imageOptimization.preloadImages(urls, { priority: 'high' });
  };

  const handleClearCache = () => {
    if (!imageOptimization) return;
    imageOptimization.clearImageCaches();
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Image Optimization Demo</h1>

      {/* System Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">System Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">WebP Support:</span>{' '}
            {webpSupport === null ? 'Checking...' : webpSupport ? '✅ Yes' : '❌ No'}
          </div>
          <div>
            <span className="font-medium">Intersection Observer:</span>{' '}
            {typeof window !== 'undefined' && 'IntersectionObserver' in window ? '✅ Yes' : '❌ No'}
          </div>
          <div>
            <span className="font-medium">Service Worker:</span>{' '}
            {typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? '✅ Yes' : '❌ No'}
          </div>
          <div>
            <span className="font-medium">Cache API:</span>{' '}
            {typeof window !== 'undefined' && 'caches' in window ? '✅ Yes' : '❌ No'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Controls</h2>
        <div className="flex gap-4">
          <button
            onClick={handlePreloadAll}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Preload All Images
          </button>
          <button
            onClick={handleClearCache}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Clear Cache & Reload
          </button>
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            {showMetrics ? 'Hide' : 'Show'} Metrics
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      {showMetrics && performanceData.size > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Image</th>
                  <th className="text-left p-2">Load Time</th>
                  <th className="text-left p-2">Size</th>
                  <th className="text-left p-2">Format</th>
                  <th className="text-left p-2">Cached</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(performanceData.entries()).map(([url, metrics]) => (
                  <tr key={url} className="border-b">
                    <td className="p-2 truncate max-w-xs">{url.split('/').pop()}</td>
                    <td className="p-2">{metrics.loadTime.toFixed(0)}ms</td>
                    <td className="p-2">{(metrics.size / 1024).toFixed(1)}KB</td>
                    <td className="p-2">{metrics.format}</td>
                    <td className="p-2">{metrics.cached ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Summary Stats */}
          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Images:</span> {performanceData.size}
            </div>
            <div>
              <span className="font-medium">Avg Load Time:</span>{' '}
              {performanceData.size > 0
                ? (
                    Array.from(performanceData.values()).reduce(
                      (sum, m) => sum + m.loadTime,
                      0
                    ) / performanceData.size
                  ).toFixed(0)
                : 0}
              ms
            </div>
            <div>
              <span className="font-medium">Cached:</span>{' '}
              {Array.from(performanceData.values()).filter(m => m.cached).length} /{' '}
              {performanceData.size}
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Optimized Image Gallery</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Scroll down to see lazy loading in action. Images are loaded progressively with blur placeholders.
        </p>
        
        <OptimizedImageGallery images={demoImages} columns={3} />
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="font-semibold mb-2">Features Demonstrated:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Progressive image loading with blur placeholders</li>
          <li>Lazy loading with Intersection Observer</li>
          <li>WebP format conversion when supported</li>
          <li>Responsive images with srcset</li>
          <li>Image preloading for visible items</li>
          <li>Offline caching with Cache API</li>
          <li>Performance monitoring and metrics</li>
          <li>Error handling and retry logic</li>
        </ul>
      </div>
    </div>
  );
}