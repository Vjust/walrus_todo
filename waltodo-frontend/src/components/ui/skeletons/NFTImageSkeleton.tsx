'use client';

import React from 'react';

export interface NFTImageSkeletonProps {
  /** Width of the skeleton */
  width?: number | string;
  /** Height of the skeleton */
  height?: number | string;
  /** Display mode that affects skeleton appearance */
  displayMode?: 'thumbnail' | 'preview' | 'hero' | 'gallery';
  /** Animation speed */
  animationSpeed?: 'slow' | 'normal' | 'fast';
  /** Whether to show overlay elements like badges */
  showOverlay?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Aspect ratio for responsive sizing */
  aspectRatio?: 'square' | 'video' | 'portrait' | 'landscape';
}

/**
 * NFTImageSkeleton Component
 * 
 * A skeleton loading component for NFT images that matches different
 * display modes and prevents layout shift during image loading.
 */
export const NFTImageSkeleton: React.FC<NFTImageSkeletonProps> = ({
  width,
  height,
  displayMode = 'preview',
  animationSpeed = 'normal',
  showOverlay = true,
  className = '',
  aspectRatio
}) => {
  const animationClass = {
    slow: 'animate-pulse-slow',
    normal: 'animate-pulse',
    fast: 'animate-pulse-fast'
  }[animationSpeed];

  // Determine dimensions based on display mode and props
  const getDimensions = () => {
    if (width && height) {
      return { width, height };
    }

    switch (displayMode) {
      case 'thumbnail':
        return { width: '80px', height: '80px' };
      case 'preview':
        return { width: '100%', height: '200px' };
      case 'hero':
        return { width: '100%', height: '400px' };
      case 'gallery':
        return { width: '100%', height: '300px' };
      default:
        return { width: '100%', height: '200px' };
    }
  };

  // Get aspect ratio classes
  const getAspectRatioClass = () => {
    if (!aspectRatio) return '';
    
    switch (aspectRatio) {
      case 'square':
        return 'aspect-square';
      case 'video':
        return 'aspect-video';
      case 'portrait':
        return 'aspect-[3/4]';
      case 'landscape':
        return 'aspect-[4/3]';
      default:
        return '';
    }
  };

  const dimensions = getDimensions();
  const aspectRatioClass = getAspectRatioClass();

  const containerClasses = [
    'relative overflow-hidden bg-gray-200 dark:bg-gray-700',
    displayMode === 'thumbnail' ? 'rounded-md' : 'rounded-lg',
    aspectRatioClass,
    className
  ].filter(Boolean as any).join(' ');

  const skeletonStyle = aspectRatio ? undefined : dimensions;

  return (
    <div 
      className={containerClasses}
      style={skeletonStyle}
      role="img"
      aria-label="Loading image..."
    >
      {/* Main skeleton background */}
      <div className={`absolute inset-0 ${animationClass}`} />

      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Image placeholder icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`text-gray-400 dark:text-gray-500 ${getIconSize()}`}>
          <svg 
            className="w-full h-full" 
            fill="currentColor" 
            viewBox="0 0 24 24"
            xmlns="http://www?.w3?.org/2000/svg"
          >
            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      {/* Overlay elements skeleton */}
      {showOverlay && displayMode !== 'thumbnail' && (
        <>
          {/* Top-right badge (status) */}
          <div className="absolute top-2 right-2">
            <div className={`w-16 h-6 bg-gray-300 dark:bg-gray-600 rounded-full ${animationClass}`} />
          </div>
          
          {/* Top-left badge (priority) */}
          <div className="absolute top-2 left-2">
            <div className={`w-12 h-6 bg-gray-300 dark:bg-gray-600 rounded-full ${animationClass}`} />
          </div>

          {/* Bottom overlay for gallery mode */}
          {displayMode === 'gallery' && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
              <div className={`h-4 bg-gray-300 rounded w-3/4 mb-2 ${animationClass}`} />
              <div className={`h-3 bg-gray-300 rounded w-1/2 ${animationClass}`} />
            </div>
          )}
        </>
      )}

      {/* Loading indicator */}
      {displayMode === 'hero' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>
      )}
    </div>
  );

  function getIconSize() {
    switch (displayMode) {
      case 'thumbnail':
        return 'w-6 h-6';
      case 'preview':
        return 'w-8 h-8';
      case 'hero':
        return 'w-16 h-16';
      case 'gallery':
        return 'w-12 h-12';
      default:
        return 'w-8 h-8';
    }
  }
};

/**
 * NFT Image Gallery Skeleton
 * 
 * Displays multiple NFT image skeletons in a grid layout
 */
export interface NFTImageGallerySkeletonProps {
  /** Number of skeleton images to show */
  count?: number;
  /** Grid columns configuration */
  columns?: 'auto' | 1 | 2 | 3 | 4 | 5 | 6;
  /** Gap between images */
  gap?: 'sm' | 'md' | 'lg';
  /** Display mode for individual images */
  displayMode?: NFTImageSkeletonProps?.["displayMode"];
  /** Animation speed */
  animationSpeed?: NFTImageSkeletonProps?.["animationSpeed"];
  /** Additional CSS classes for container */
  containerClassName?: string;
}

export const NFTImageGallerySkeleton: React.FC<NFTImageGallerySkeletonProps> = ({
  count = 8,
  columns = 'auto',
  gap = 'md',
  displayMode = 'gallery',
  animationSpeed = 'normal',
  containerClassName = ''
}) => {
  const gridClasses = {
    auto: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[columns];

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  }[gap];

  return (
    <div className={`grid ${gridClasses} ${gapClasses} ${containerClassName}`}>
      {Array.from({ length: count }).map((_, index) => (
        <NFTImageSkeleton
          key={index}
          displayMode={displayMode}
          animationSpeed={animationSpeed}
          aspectRatio="square"
        />
      ))}
    </div>
  );
};

/**
 * NFT Hero Image Skeleton
 * 
 * Large hero-style image skeleton with additional elements
 */
export const NFTHeroImageSkeleton: React.FC<{
  animationSpeed?: NFTImageSkeletonProps?.["animationSpeed"];
  className?: string;
}> = ({
  animationSpeed = 'normal',
  className = ''
}) => {
  const animationClass = {
    slow: 'animate-pulse-slow',
    normal: 'animate-pulse',
    fast: 'animate-pulse-fast'
  }[animationSpeed];

  return (
    <div className={`relative w-full h-96 bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden ${className}`}>
      {/* Main skeleton */}
      <div className={`absolute inset-0 ${animationClass}`} />
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-8 bg-gradient-to-t from-black/60 to-transparent">
        <div className="space-y-4">
          <div className={`h-8 bg-gray-300 rounded w-2/3 ${animationClass}`} />
          <div className={`h-5 bg-gray-300 rounded w-1/2 ${animationClass}`} />
          <div className="flex gap-2">
            <div className={`w-20 h-8 bg-gray-300 rounded ${animationClass}`} />
            <div className={`w-24 h-8 bg-gray-300 rounded ${animationClass}`} />
          </div>
        </div>
      </div>
      
      {/* Floating elements */}
      <div className="absolute top-4 right-4 flex gap-2">
        <div className={`w-10 h-10 bg-gray-300 rounded-full ${animationClass}`} />
        <div className={`w-10 h-10 bg-gray-300 rounded-full ${animationClass}`} />
      </div>
    </div>
  );
};

export default NFTImageSkeleton;