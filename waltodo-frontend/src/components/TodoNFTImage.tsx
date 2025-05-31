'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { walrusClient } from '@/lib/walrus-client';
import toast from 'react-hot-toast';

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
  placeholder?: string;
  blurDataURL?: string;
  quality?: number;
  sizes?: string;
}

interface ImageState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  imageData?: string;
  isIntersecting: boolean;
  isExpanded: boolean;
}

// Dimensions for different display modes
const DISPLAY_MODE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  preview: { width: 400, height: 400 },
  full: { width: 1200, height: 1200 },
} as const;

// Default placeholder image (1x1 transparent pixel)
const DEFAULT_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function TodoNFTImage({
  imageUrl,
  alt,
  displayMode = 'preview',
  className = '',
  onClick,
  onLoad,
  onError,
  priority = false,
  placeholder = DEFAULT_PLACEHOLDER,
  blurDataURL,
  quality = 75,
  sizes,
}: TodoNFTImageProps) {
  const [state, setState] = useState<ImageState>({
    isLoading: true,
    hasError: false,
    isIntersecting: false,
    isExpanded: false,
  });

  const imageRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Parse Walrus URL to extract blob ID
  const blobId = useMemo(() => {
    if (!imageUrl) return null;
    
    // Handle walrus:// protocol
    if (imageUrl.startsWith('walrus://')) {
      return imageUrl.replace('walrus://', '').split('/')[0];
    }
    
    // Handle HTTP URLs from Walrus aggregator
    const walrusPattern = /\/v1\/([a-zA-Z0-9_-]+)/;
    const match = imageUrl.match(walrusPattern);
    if (match) {
      return match[1];
    }
    
    // If it's already a blob ID
    if (/^[a-zA-Z0-9_-]+$/.test(imageUrl) && imageUrl.length > 20) {
      return imageUrl;
    }
    
    return null;
  }, [imageUrl]);

  // Get the appropriate image URL
  const getImageUrl = useCallback(() => {
    if (!imageUrl) return placeholder;
    
    // If it's already an HTTP URL, use it directly
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // If we have a blob ID, construct the URL
    if (blobId) {
      return walrusClient.getBlobUrl(blobId);
    }
    
    return placeholder;
  }, [imageUrl, blobId, placeholder]);

  // Fetch image data from Walrus if needed
  const fetchWalrusImage = useCallback(async () => {
    if (!blobId || !state.isIntersecting) return;

    setState(prev => ({ ...prev, isLoading: true, hasError: false }));

    try {
      const blob = await walrusClient.download(blobId);
      
      // Convert Uint8Array to base64 for display
      const base64 = btoa(
        Array.from(blob.data)
          .map(byte => String.fromCharCode(byte))
          .join('')
      );
      
      const mimeType = blob.contentType || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        imageData: dataUrl,
      }));
      
      onLoad?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load image';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage,
      }));
      
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      
      if (process.env.NODE_ENV === 'production') {
        toast.error('Failed to load NFT image');
      }
    }
  }, [blobId, state.isIntersecting, onLoad, onError]);

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (priority || !imageRef.current) {
      setState(prev => ({ ...prev, isIntersecting: true }));
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setState(prev => ({ ...prev, isIntersecting: true }));
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      }
    );

    observerRef.current.observe(imageRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority]);

  // Fetch image when it becomes visible
  useEffect(() => {
    if (blobId && state.isIntersecting && !state.imageData && !state.hasError) {
      fetchWalrusImage();
    }
  }, [blobId, state.isIntersecting, state.imageData, state.hasError, fetchWalrusImage]);

  // Handle image click
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: toggle expanded view
      setState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
    }
  }, [onClick]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
    if (e.key === 'Escape' && state.isExpanded) {
      setState(prev => ({ ...prev, isExpanded: false }));
    }
  }, [handleClick, state.isExpanded]);

  // Get dimensions based on display mode
  const dimensions = useMemo(() => {
    const mode = state.isExpanded ? 'full' : displayMode;
    return DISPLAY_MODE_SIZES[mode];
  }, [displayMode, state.isExpanded]);

  // Determine final image source
  const imageSrc = useMemo(() => {
    if (state.imageData) return state.imageData;
    if (!blobId) return getImageUrl();
    return state.hasError ? placeholder : getImageUrl();
  }, [state.imageData, state.hasError, blobId, getImageUrl, placeholder]);

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

  // Loading skeleton
  const loadingSkeleton = (
    <div
      className={`animate-pulse bg-gray-200 rounded-lg ${
        displayMode === 'thumbnail' ? 'w-[150px] h-[150px]' :
        displayMode === 'preview' ? 'w-[400px] h-[400px]' :
        'w-full h-[600px]'
      }`}
      aria-label="Loading image..."
    />
  );

  // Error placeholder
  const errorPlaceholder = (
    <div
      className={`flex flex-col items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 ${
        displayMode === 'thumbnail' ? 'w-[150px] h-[150px]' :
        displayMode === 'preview' ? 'w-[400px] h-[400px]' :
        'w-full h-[600px]'
      }`}
      aria-label="Failed to load image"
    >
      <svg
        className="w-12 h-12 text-gray-400 mb-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p className="text-sm text-gray-500">
        {state.errorMessage || 'Image unavailable'}
      </p>
    </div>
  );

  // Expanded modal view
  const expandedModal = state.isExpanded && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
      onClick={() => setState(prev => ({ ...prev, isExpanded: false }))}
      onKeyDown={(e) => e.key === 'Escape' && setState(prev => ({ ...prev, isExpanded: false }))}
      role="dialog"
      aria-modal="true"
      aria-label="Expanded image view"
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <button
          className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setState(prev => ({ ...prev, isExpanded: false }));
          }}
          aria-label="Close expanded view"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <Image
          src={imageSrc}
          alt={alt}
          width={dimensions.width}
          height={dimensions.height}
          quality={quality}
          className="rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={imageRef}
        className={`relative inline-block ${className}`}
        role="img"
        aria-label={alt}
      >
        {state.isLoading && !state.imageData && loadingSkeleton}
        
        {state.hasError && errorPlaceholder}
        
        {!state.isLoading && !state.hasError && state.isIntersecting && (
          <div
            className={`relative overflow-hidden rounded-lg cursor-pointer transition-all duration-300 ${
              displayMode === 'thumbnail' ? 'hover:scale-110' :
              displayMode === 'preview' ? 'hover:scale-105' :
              'hover:scale-102'
            } hover:shadow-lg`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label={`${alt} - Click to ${state.isExpanded ? 'close' : 'expand'}`}
          >
            <Image
              src={imageSrc}
              alt={alt}
              width={dimensions.width}
              height={dimensions.height}
              quality={quality}
              sizes={responsiveSizes}
              placeholder={blurDataURL ? 'blur' : 'empty'}
              blurDataURL={blurDataURL}
              className="object-cover"
              onLoad={() => {
                setState(prev => ({ ...prev, isLoading: false }));
                onLoad?.();
              }}
              onError={() => {
                setState(prev => ({ 
                  ...prev, 
                  isLoading: false, 
                  hasError: true,
                  errorMessage: 'Failed to load image'
                }));
                onError?.(new Error('Failed to load image'));
              }}
            />
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-opacity duration-300 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity duration-300"
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
        )}
      </div>
      
      {expandedModal}
    </>
  );
}

// Export a memoized version for performance
export default React.memo(TodoNFTImage);