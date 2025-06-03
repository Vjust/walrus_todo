'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { OptimizedImage } from './OptimizedImage';

export interface WalrusOptimizedImageProps {
  blobId?: string;
  imageUrl?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'shimmer' | 'empty';
  quality?: number;
  sizes?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Optimized image component for Walrus storage with fallback support
 */
export function WalrusOptimizedImage({
  blobId,
  imageUrl,
  alt,
  className = '',
  width,
  height,
  priority = false,
  placeholder = 'blur',
  quality = 75,
  sizes,
  onLoad,
  onError,
}: WalrusOptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Generate Walrus URLs from blob ID
  const walrusUrls = useMemo(() => {
    if (!blobId) {return [];}
    
    // Common Walrus aggregator endpoints
    const aggregators = [
      'https://aggregator.walrus-testnet.walrus.space',
      'https://walrus-testnet-publisher.nodes.guru',
      'https://publisher-devnet.walrus.space'
    ];
    
    return aggregators.map(baseUrl => `${baseUrl}/v1/${blobId}`);
  }, [blobId]);

  // Determine the source URL to use
  const sourceUrl = useMemo(() => {
    if (imageUrl) {
      return imageUrl;
    }
    
    if (walrusUrls.length > 0) {
      return walrusUrls[0]; // Use first aggregator as primary
    }
    
    return undefined;
  }, [imageUrl, walrusUrls]);

  // Handle image load
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  // Handle image error with fallback
  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    
    const error = new Error('Failed to load Walrus image');
    onError?.(error);
  }, [onError]);

  // Show placeholder if no source URL
  if (!sourceUrl) {
    return (
      <div 
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <svg 
          className="w-12 h-12 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
      </div>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <div 
        className={`bg-red-100 border border-red-300 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <div className="text-center p-4">
          <svg 
            className="w-8 h-8 text-red-500 mx-auto mb-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <p className="text-xs text-red-600">Failed to load image</p>
          {blobId && (
            <p className="text-xs text-gray-500 mt-1 truncate" title={blobId}>
              Blob: {blobId.slice(0, 8)}...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Loading indicator */}
      {isLoading && (
        <div 
          className="absolute inset-0 bg-gray-200 flex items-center justify-center animate-pulse"
          style={{ width, height }}
        >
          <svg 
            className="w-8 h-8 text-gray-400 animate-spin" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}

      {/* Actual image */}
      <OptimizedImage
        src={sourceUrl}
        alt={alt}
        width={width}
        height={height}
        className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        priority={priority}
        placeholder={placeholder}
        quality={quality}
        sizes={sizes}
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && blobId && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1">
          <div className="truncate" title={blobId}>
            Blob: {blobId}
          </div>
          <div className="truncate" title={sourceUrl}>
            URL: {sourceUrl}
          </div>
        </div>
      )}
    </div>
  );
}

// Export memoized version for performance
export default React.memo(WalrusOptimizedImage);