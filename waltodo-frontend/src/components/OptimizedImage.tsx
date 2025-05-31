'use client';

import React, { useRef, useState } from 'react';
import { 
  useProgressiveImage, 
  useLazyImage, 
  getOptimizedImageProps,
  type OptimizedImageProps 
} from '@/lib/image-optimization';

interface OptimizedImageComponentProps extends OptimizedImageProps {
  width?: number;
  height?: number;
  lazy?: boolean;
  placeholder?: 'blur' | 'empty' | 'shimmer';
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  sizes,
  className = '',
  priority = 'auto',
  lazy = true,
  placeholder = 'blur',
  onLoad,
  onError,
}: OptimizedImageComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Always call both hooks to maintain consistent hook order
  const lazyImageState = useLazyImage(src, containerRef);
  const progressiveImageState = useProgressiveImage(src, { priority });
  
  // Use the appropriate state based on lazy prop
  const imageState = lazy ? lazyImageState : progressiveImageState;

  const handleLoad = () => {
    setImageLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    onError?.();
  };

  // Determine placeholder content
  const renderPlaceholder = () => {
    if (placeholder === 'shimmer') {
      return (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-shimmer" />
      );
    }
    
    if (placeholder === 'blur' && imageState.blurDataUrl) {
      return (
        <img
          src={imageState.blurDataUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-lg scale-110"
          aria-hidden="true"
        />
      );
    }

    return null;
  };

  const optimizedProps = getOptimizedImageProps({
    src: imageState.loadedSrc || src,
    alt,
    sizes,
    className: `${className} ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`,
    priority,
    onLoad: handleLoad,
    onError: handleError,
  });

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${width ? `w-[${width}px]` : ''} ${height ? `h-[${height}px]` : ''}`}
      style={{ width, height }}
    >
      {/* Placeholder */}
      {!imageLoaded && renderPlaceholder()}

      {/* Main image */}
      {(!lazy || imageState.isInView) && !imageState.hasError && (
        <img
          {...optimizedProps}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Error state */}
      {imageState.hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <svg
              className="w-12 h-12 mx-auto text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">Failed to load image</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Gallery component that preloads visible images
export function OptimizedImageGallery({ 
  images,
  columns = 3,
}: { 
  images: Array<{ src: string; alt: string; id: string }>; 
  columns?: number;
}) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 12 });
  const galleryRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      if (!galleryRef.current) return;

      const rect = galleryRef.current.getBoundingClientRect();
      const itemHeight = rect.height / Math.ceil(images.length / columns);
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight;

      const start = Math.max(0, Math.floor((scrollTop - rect.top) / itemHeight) * columns);
      const end = Math.min(
        images.length,
        Math.ceil((scrollTop - rect.top + viewportHeight) / itemHeight) * columns + columns
      );

      setVisibleRange({ start, end });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [images.length, columns]);

  // Preload next batch of images
  React.useEffect(() => {
    const nextBatch = images.slice(
      visibleRange.end,
      Math.min(visibleRange.end + columns * 2, images.length)
    );

    if (nextBatch.length > 0) {
      import('@/lib/image-optimization').then(({ preloadImages }) => {
        preloadImages(
          nextBatch.map(img => img.src),
          { priority: 'low' }
        );
      });
    }
  }, [visibleRange, images, columns]);

  return (
    <div
      ref={galleryRef}
      className={`grid grid-cols-${columns} gap-4`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {images.map((image, index) => (
        <div key={image.id} className="aspect-square">
          <OptimizedImage
            src={image.src}
            alt={image.alt}
            className="w-full h-full object-cover rounded-lg"
            priority={index < columns * 2 ? 'high' : 'auto'}
            lazy={index >= columns * 2}
            placeholder="shimmer"
          />
        </div>
      ))}
    </div>
  );
}