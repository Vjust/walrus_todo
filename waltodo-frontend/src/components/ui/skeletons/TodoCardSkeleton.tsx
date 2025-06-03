'use client';

import React from 'react';

export interface TodoCardSkeletonProps {
  /** Variant of the skeleton (default or list) */
  variant?: 'default' | 'list';
  /** Additional CSS classes */
  className?: string;
  /** Whether to include action buttons */
  showActions?: boolean;
  /** Animation speed */
  animationSpeed?: 'slow' | 'normal' | 'fast';
}

/**
 * TodoCardSkeleton Component
 * 
 * A skeleton loading component that matches the structure of TodoNFTCard
 * to prevent layout shift during loading states.
 */
export const TodoCardSkeleton: React.FC<TodoCardSkeletonProps> = ({
  variant = 'default',
  className = '',
  showActions = true,
  animationSpeed = 'normal'
}) => {
  const animationClass = {
    slow: 'animate-pulse-slow',
    normal: 'animate-pulse',
    fast: 'animate-pulse-fast'
  }[animationSpeed];

  // List variant skeleton
  if (variant === 'list') {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
        <div className="flex items-center gap-4">
          {/* Thumbnail skeleton */}
          <div className="flex-shrink-0 w-20 h-20 relative">
            <div className={`w-full h-full bg-gray-200 dark:bg-gray-700 rounded-md ${animationClass}`} />
            {/* Priority badge skeleton */}
            <div className="absolute -top-2 -left-2">
              <div className={`w-6 h-4 bg-gray-300 dark:bg-gray-600 rounded-full ${animationClass}`} />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                {/* Title */}
                <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 ${animationClass}`} />
                
                {/* Description */}
                <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 ${animationClass}`} />
                
                {/* Meta info */}
                <div className="flex items-center gap-3">
                  <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 ${animationClass}`} />
                  <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 ${animationClass}`} />
                  <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 ${animationClass}`} />
                </div>
              </div>

              {/* Actions skeleton */}
              {showActions && (
                <div className="flex items-center gap-1 ml-4">
                  <div className={`w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-md ${animationClass}`} />
                  <div className={`w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-md ${animationClass}`} />
                  <div className={`w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-md ${animationClass}`} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default card variant skeleton
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden h-full flex flex-col ${className}`}>
      {/* Image section skeleton */}
      <div className="relative h-48 bg-gray-200 dark:bg-gray-700">
        <div className={`w-full h-full ${animationClass}`} />
        
        {/* Status badge skeleton */}
        <div className="absolute top-2 right-2">
          <div className={`w-16 h-6 bg-gray-300 dark:bg-gray-600 rounded-full ${animationClass}`} />
        </div>
        
        {/* Priority badge skeleton */}
        <div className="absolute top-2 left-2">
          <div className={`w-12 h-6 bg-gray-300 dark:bg-gray-600 rounded-full ${animationClass}`} />
        </div>
      </div>

      {/* Content section skeleton */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Title skeleton */}
        <div className={`h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-4/5 ${animationClass}`} />
        
        {/* Description skeleton */}
        <div className="space-y-2 mb-4">
          <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-full ${animationClass}`} />
          <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 ${animationClass}`} />
        </div>

        {/* Metadata skeleton */}
        <div className="flex-1 space-y-3">
          {/* Owner info */}
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
            <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 ${animationClass}`} />
          </div>
          
          {/* Created date */}
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
            <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded w-40 ${animationClass}`} />
          </div>
          
          {/* Tags skeleton */}
          <div className="flex items-start gap-2">
            <div className={`w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
            <div className="flex flex-wrap gap-1">
              <div className={`w-12 h-5 bg-gray-200 dark:bg-gray-700 rounded-full ${animationClass}`} />
              <div className={`w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded-full ${animationClass}`} />
              <div className={`w-10 h-5 bg-gray-200 dark:bg-gray-700 rounded-full ${animationClass}`} />
            </div>
          </div>
        </div>

        {/* Action buttons skeleton */}
        {showActions && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className={`flex-1 h-9 bg-gray-200 dark:bg-gray-700 rounded-md ${animationClass}`} />
            <div className={`flex-1 h-9 bg-gray-200 dark:bg-gray-700 rounded-md ${animationClass}`} />
            <div className={`w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-md ${animationClass}`} />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Multiple card skeletons for grid layouts
 */
export interface TodoCardSkeletonGridProps extends Omit<TodoCardSkeletonProps, 'className'> {
  /** Number of skeleton cards to render */
  count?: number;
  /** Grid columns configuration */
  columns?: 'auto' | 1 | 2 | 3 | 4 | 5 | 6;
  /** Gap between skeleton cards */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes for the container */
  containerClassName?: string;
}

export const TodoCardSkeletonGrid: React.FC<TodoCardSkeletonGridProps> = ({
  count = 6,
  columns = 'auto',
  gap = 'md',
  containerClassName = '',
  ...skeletonProps
}) => {
  const gridClasses = {
    auto: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
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
        <TodoCardSkeleton
          key={index}
          {...skeletonProps}
        />
      ))}
    </div>
  );
};

export default TodoCardSkeleton;