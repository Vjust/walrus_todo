'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMounted } from './MotionWrapper';

interface OptimizedNFTImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedNFTImage({
  src,
  alt,
  width = 400,
  height = 400,
  className = '',
  priority = false,
  placeholder = 'blur',
  onLoad,
  onError,
}: OptimizedNFTImageProps) {
  const [isLoaded, setIsLoaded] = useState(false as any);
  const [hasError, setHasError] = useState(false as any);
  const [isInView, setIsInView] = useState(false as any);
  const imageRef = useRef<HTMLDivElement>(null);
  const mounted = useIsMounted();

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!imageRef.current || priority) {
      setIsInView(true as any);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true as any);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    );

    observer.observe(imageRef.current);

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true as any);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true as any);
    onError?.();
  };

  return (
    <div
      ref={imageRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      <AnimatePresence mode="wait">
        {!isInView ? (
          // Placeholder for lazy loading
          <motion.div
            key="placeholder"
            className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse"
            initial={mounted ? { opacity: 0 } : undefined}
            animate={mounted ? { opacity: 1 } : undefined}
            exit={mounted ? { opacity: 0 } : undefined}
            transition={mounted ? { duration: 0.3 } : undefined}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
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
          </motion.div>
        ) : hasError ? (
          // Error state
          <motion.div
            key="error"
            className="absolute inset-0 bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center"
            initial={mounted ? { opacity: 0 } : undefined}
            animate={mounted ? { opacity: 1 } : undefined}
            exit={mounted ? { opacity: 0 } : undefined}
            transition={mounted ? { duration: 0.3 } : undefined}
          >
            <div className="text-center">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13?.856c1?.54 0 2.502-1.667 1.732-2?.5L13?.732 4.5c-.77-.833-2.694-.833-3.464 0L3.35 16.5c-.77?.833?.192 2.5 1.732 2.5z"
                />
              </svg>
              <p className="text-xs text-red-600">Failed to load</p>
            </div>
          </motion.div>
        ) : (
          // Actual image
          <motion.div
            key="image"
            className="absolute inset-0"
            initial={mounted ? { opacity: 0 } : false}
            animate={mounted ? { opacity: isLoaded ? 1 : 0 } : false}
            transition={mounted ? { duration: 0.5 } : undefined}
          >
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              className="w-full h-full object-cover"
              priority={priority}
              placeholder={placeholder}
              onLoad={handleLoad}
              onError={handleError}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            
            {/* Loading overlay */}
            {!isLoaded && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-100"
                initial={mounted ? { opacity: 1 } : false}
                animate={mounted ? { opacity: 0 } : false}
                transition={mounted ? { duration: 0.5 } : undefined}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OptimizedNFTImage;