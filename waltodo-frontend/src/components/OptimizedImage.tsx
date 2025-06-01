'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import Image from 'next/image';
import { useProgressiveImage, useLazyImage } from '@/lib/image-optimization';
import { useOptimizedWalrusImage } from '@/lib/walrus-image-optimization';

interface OptimizedImageComponentProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  placeholder?: 'blur' | 'empty' | 'shimmer';
  priority?: boolean | 'high' | 'low' | 'auto';
  size?: 'thumbnail' | 'small' | 'medium' | 'large' | 'full';
  sizes?: string;
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
}

export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  lazy = true,
  placeholder = 'blur',
  priority = 'auto',
  size = 'medium',
  sizes,
  quality = 75,
  onLoad,
  onError,
  fallbackSrc = '/images/nft-placeholder.png'
}: OptimizedImageComponentProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFallback, setShowFallback] = useState(false);
  
  // Determine if this is a Walrus image
  const isWalrusImage = src && (src.includes('walrus') || src.includes('blob'));
  
  // Convert boolean priority to string format for Walrus hook
  const walrusPriority: 'high' | 'low' | 'auto' = 
    typeof priority === 'boolean' 
      ? (priority ? 'high' : 'auto')
      : priority;
  
  // Use appropriate hook based on image source
  const walrusImageState = useOptimizedWalrusImage(
    isWalrusImage ? src : undefined,
    { size, priority: walrusPriority, generateBlur: placeholder === 'blur' }
  );
  
  const progressiveImageState = useProgressiveImage(
    !isWalrusImage ? src : '',
    { priority: walrusPriority }
  );
  
  const lazyImageState = useLazyImage(
    lazy && !isWalrusImage ? src : '',
    containerRef
  );
  
  // Choose the appropriate state
  const imageState = isWalrusImage ? {
    isLoading: walrusImageState.isLoading,
    hasError: walrusImageState.hasError || showFallback,
    loadedSrc: walrusImageState.optimizedUrl,
    blurDataUrl: walrusImageState.blurDataUrl
  } : lazy ? lazyImageState : progressiveImageState;
  
  const handleImageError = useCallback(() => {
    setShowFallback(true);
    onError?.();
  }, [onError]);
  
  const handleImageLoad = useCallback(() => {
    onLoad?.();
  }, [onLoad]);
  
  // Placeholder rendering
  const renderPlaceholder = () => {
    if (placeholder === 'shimmer') {
      return (
        <div className="animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 w-full h-full" />
      );
    }
    
    if (placeholder === 'blur' && imageState.blurDataUrl) {
      return (
        <Image
          src={imageState.blurDataUrl}
          alt=""
          fill
          className="absolute inset-0 w-full h-full object-cover filter blur-lg scale-110"
          aria-hidden="true"
          unoptimized
        />
      );
    }
    
    return (
      <div className="bg-gray-200 w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  };
  
  // Error state
  if (imageState.hasError) {
    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden ${className}`}
        style={{ width, height }}
      >
        <Image
          src={fallbackSrc}
          alt={alt}
          fill
          className="w-full h-full object-cover"
          onError={() => console.error('Even fallback image failed to load')}
          unoptimized
        />
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {/* Show placeholder while loading */}
      {imageState.isLoading && renderPlaceholder()}
      
      {/* Main image */}
      {imageState.loadedSrc && (
        <Image
          src={imageState.loadedSrc}
          alt={alt}
          fill
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageState.isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading={lazy ? 'lazy' : 'eager'}
          priority={priority === 'high' || priority === true}
          sizes={sizes}
          quality={quality}
          unoptimized={Boolean(isWalrusImage)}
        />
      )}
    </div>
  );
}

// Gallery component that preloads visible images
export function OptimizedImageGallery({ 
  images,
  columns = 3,
  imageSize = 'medium',
  gap = 4,
  aspectRatio = 'square'
}: { 
  images: Array<{ src: string; alt: string; id: string; priority?: boolean }>; 
  columns?: number;
  imageSize?: 'thumbnail' | 'small' | 'medium' | 'large';
  gap?: number;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'landscape';
}) {
  // Preload first few images
  useEffect(() => {
    const imagesToPreload = images.slice(0, columns * 2).map(img => img.src);
    
    // Preload images in the background
    imagesToPreload.forEach((src, index) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      // Higher priority for first row
      if (index < columns) {
        link.fetchPriority = 'high';
      }
      document.head.appendChild(link);
      
      // Clean up
      return () => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      };
    });
  }, [images, columns]);
  
  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
    landscape: 'aspect-[4/3]'
  }[aspectRatio];
  
  return (
    <div
      className={`grid gap-${gap}`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {images.map((image, index) => (
        <div key={image.id} className={`${aspectRatioClass} relative overflow-hidden rounded-lg`}>
          <OptimizedImage
            src={image.src}
            alt={image.alt}
            className="absolute inset-0 w-full h-full"
            size={imageSize}
            priority={image.priority || index < columns ? 'high' : 'auto'}
            lazy={index >= columns * 2} // Lazy load images beyond second row
          />
        </div>
      ))}
    </div>
  );
}

// Progressive image loader component
export function ProgressiveImage({
  src,
  alt,
  className,
  thumbnail,
  onLoad
}: {
  src: string;
  alt: string;
  className?: string;
  thumbnail?: string;
  onLoad?: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(thumbnail || '');
  
  useEffect(() => {
    // Load thumbnail first if provided
    if (thumbnail && !isLoaded) {
      const img = new window.Image();
      img.src = thumbnail;
      img.onload = () => setCurrentSrc(thumbnail);
    }
    
    // Load full image
    const fullImage = new window.Image();
    fullImage.src = src;
    fullImage.onload = () => {
      setCurrentSrc(src);
      setIsLoaded(true);
      onLoad?.();
    };
  }, [src, thumbnail, isLoaded, onLoad]);
  
  return (
    <div className={`relative ${className}`}>
      {currentSrc && (
        <Image
          src={currentSrc}
          alt={alt}
          fill
          className={`w-full h-full object-cover transition-all duration-500 ${
            !isLoaded ? 'filter blur-sm scale-105' : ''
          }`}
          unoptimized
        />
      )}
      {!currentSrc && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}