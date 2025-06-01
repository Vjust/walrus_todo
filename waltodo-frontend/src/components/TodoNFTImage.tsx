'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { WalrusOptimizedImage } from './WalrusOptimizedImage';
import { OptimizedImage } from './OptimizedImage';

export type DisplayMode = 'thumbnail' | 'preview' | 'full';

interface TodoNFTImageProps {
  imageUrl: string;
  alt: string;
  displayMode?: DisplayMode;
  className?: string;
  onClick?: () => void;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  priority?: boolean;
  placeholder?: 'blur' | 'shimmer' | 'empty';
  blurDataURL?: string;
  quality?: number;
  sizes?: string;
}

// Dimensions for different display modes
const DISPLAY_MODE_CONFIG = {
  thumbnail: { 
    width: 150, 
    height: 150, 
    size: 'thumbnail' as const,
    containerClass: 'w-[150px] h-[150px]'
  },
  preview: { 
    width: 400, 
    height: 400, 
    size: 'medium' as const,
    containerClass: 'w-[400px] h-[400px]'
  },
  full: { 
    width: 1200, 
    height: 1200, 
    size: 'large' as const,
    containerClass: 'w-full max-w-[1200px] h-[600px]'
  },
} as const;

export function TodoNFTImage({
  imageUrl,
  alt,
  displayMode = 'preview',
  className = '',
  onClick,
  onLoad,
  onError,
  priority = false,
  placeholder = 'blur',
  blurDataURL,
  quality = 75,
  sizes,
}: TodoNFTImageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Parse Walrus URL to extract blob ID
  const walrusInfo = useMemo(() => {
    if (!imageUrl) return { isWalrus: false, blobId: null };
    
    // Handle walrus:// protocol
    if (imageUrl.startsWith('walrus://')) {
      return {
        isWalrus: true,
        blobId: imageUrl.replace('walrus://', '').split('/')[0]
      };
    }
    
    // Handle HTTP URLs from Walrus aggregator
    const walrusPattern = /\/v1\/([a-zA-Z0-9_-]+)/;
    const match = imageUrl.match(walrusPattern);
    if (match) {
      return {
        isWalrus: true,
        blobId: match[1]
      };
    }
    
    // Check if URL contains walrus indicators
    if (imageUrl.includes('walrus') || imageUrl.includes('aggregator')) {
      return {
        isWalrus: true,
        blobId: null
      };
    }
    
    // If it's already a blob ID
    if (/^[a-zA-Z0-9_-]+$/.test(imageUrl) && imageUrl.length > 20) {
      return {
        isWalrus: true,
        blobId: imageUrl
      };
    }
    
    return { isWalrus: false, blobId: null };
  }, [imageUrl]);

  // Handle image click
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: toggle expanded view
      setIsExpanded(!isExpanded);
    }
  }, [onClick, isExpanded]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
    if (e.key === 'Escape' && isExpanded) {
      setIsExpanded(false);
    }
  }, [handleClick, isExpanded]);

  // Get configuration based on display mode
  const config = useMemo(() => {
    const mode = isExpanded ? 'full' : displayMode;
    return DISPLAY_MODE_CONFIG[mode];
  }, [displayMode, isExpanded]);

  // Calculate responsive sizes
  const responsiveSizes = useMemo(() => {
    if (sizes) return sizes;
    
    switch (displayMode) {
      case 'thumbnail':
        return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, 150px';
      case 'preview':
        return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px';
      case 'full':
        return '(max-width: 1200px) 100vw, 1200px';
      default:
        return undefined;
    }
  }, [sizes, displayMode]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.(new Error('Failed to load image'));
  }, [onError]);

  // Image component props
  const imageProps = {
    alt,
    className: 'w-full h-full',
    priority: priority,
    placeholder,
    onLoad,
    onError: handleError,
    width: config.width,
    height: config.height,
  };

  // Expanded modal view
  const expandedModal = isExpanded && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
      onClick={() => setIsExpanded(false)}
      onKeyDown={(e) => e.key === 'Escape' && setIsExpanded(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Expanded image view"
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <button
          className="absolute -top-12 right-0 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          aria-label="Close expanded view"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="relative overflow-hidden rounded-lg" onClick={(e) => e.stopPropagation()}>
          {walrusInfo.isWalrus ? (
            <WalrusOptimizedImage
              blobId={walrusInfo.blobId || undefined}
              imageUrl={!walrusInfo.blobId ? imageUrl : undefined}
              {...imageProps}
              sizes="100vw"
              className="max-w-full max-h-[90vh] object-contain"
            />
          ) : (
            <OptimizedImage
              src={imageUrl}
              {...imageProps}
              sizes="100vw"
              className="max-w-full max-h-[90vh] object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        className={`relative inline-block ${className}`}
        role="img"
        aria-label={alt}
      >
        <div
          className={`relative overflow-hidden rounded-lg cursor-pointer transition-all duration-300 ${
            displayMode === 'thumbnail' ? 'hover:scale-110' :
            displayMode === 'preview' ? 'hover:scale-105' :
            'hover:scale-102'
          } hover:shadow-lg ${config.containerClass}`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-label={`${alt} - Click to ${isExpanded ? 'close' : 'expand'}`}
        >
          {walrusInfo.isWalrus ? (
            <WalrusOptimizedImage
              blobId={walrusInfo.blobId || undefined}
              imageUrl={!walrusInfo.blobId ? imageUrl : undefined}
              {...imageProps}
            />
          ) : (
            <OptimizedImage
              src={imageUrl}
              {...imageProps}
            />
          )}
          
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
            <svg
              className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
              />
            </svg>
          </div>
        </div>
      </div>
      
      {expandedModal}
    </>
  );
}

// Export a memoized version for performance
export default React.memo(TodoNFTImage);