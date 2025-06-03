'use client';

import React from 'react';

export interface TodoListSkeletonProps {
  /** Number of skeleton items to render */
  itemCount?: number;
  /** Display variant */
  variant?: 'default' | 'compact' | 'detailed';
  /** Animation speed */
  animationSpeed?: 'slow' | 'normal' | 'fast';
  /** Whether to show filter controls skeleton */
  showFilters?: boolean;
  /** Whether to show search bar skeleton */
  showSearch?: boolean;
  /** Whether to show action buttons */
  showActions?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TodoListSkeleton Component
 * 
 * A skeleton loading component for todo lists that matches the structure
 * of the actual todo list to prevent layout shift.
 */
export const TodoListSkeleton: React.FC<TodoListSkeletonProps> = ({
  itemCount = 3,
  variant = 'default',
  animationSpeed = 'normal',
  showFilters = false,
  showSearch = false,
  showActions = true,
  className = ''
}) => {
  const animationClass = {
    slow: 'animate-pulse-slow',
    normal: 'animate-pulse',
    fast: 'animate-pulse-fast'
  }[animationSpeed];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search bar skeleton */}
      {showSearch && (
        <div className="flex items-center gap-4 mb-4">
          <div className={`flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg ${animationClass}`} />
          <div className={`w-20 h-10 bg-gray-200 dark:bg-gray-700 rounded-md ${animationClass}`} />
        </div>
      )}

      {/* Filter controls skeleton */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
            <div className={`w-24 h-8 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
            <div className={`w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
            <div className="flex gap-1">
              <div className={`w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
              <div className={`w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
              <div className={`w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} />
            </div>
          </div>
        </div>
      )}

      {/* Todo items skeleton */}
      <div className="space-y-3">
        {Array.from({ length: itemCount }).map((_, index) => (
          <TodoItemSkeleton
            key={index}
            variant={variant}
            animationClass={animationClass}
            showActions={showActions}
            delay={index * 100} // Stagger animation
          />
        ))}
      </div>

      {/* Load more button skeleton */}
      {itemCount > 5 && (
        <div className="text-center pt-4">
          <div className={`w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded-md mx-auto ${animationClass}`} />
        </div>
      )}
    </div>
  );
};

interface TodoItemSkeletonProps {
  variant: 'default' | 'compact' | 'detailed';
  animationClass: string;
  showActions: boolean;
  delay?: number;
}

const TodoItemSkeleton: React.FC<TodoItemSkeletonProps> = ({
  variant,
  animationClass,
  showActions,
  delay = 0
}) => {
  const style = delay > 0 ? { animationDelay: `${delay}ms` } : undefined;

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        {/* Checkbox skeleton */}
        <div className={`w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full ${animationClass}`} style={style} />
        
        {/* Content */}
        <div className="flex-1 space-y-1">
          <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 ${animationClass}`} style={style} />
          <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 ${animationClass}`} style={style} />
        </div>

        {/* Priority badge */}
        <div className={`w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full ${animationClass}`} style={style} />
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex items-start gap-3">
          {/* Checkbox skeleton */}
          <div className={`w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0 mt-1 ${animationClass}`} style={style} />
          
          {/* Main content */}
          <div className="flex-1 space-y-3">
            {/* Title and priority */}
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className={`h-5 bg-gray-200 dark:bg-gray-700 rounded w-4/5 ${animationClass}`} style={style} />
                <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-full ${animationClass}`} style={style} />
                <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 ${animationClass}`} style={style} />
              </div>
              <div className={`w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full ml-4 ${animationClass}`} style={style} />
            </div>

            {/* Tags and metadata */}
            <div className="flex items-center gap-4">
              <div className="flex gap-1">
                <div className={`w-12 h-5 bg-gray-200 dark:bg-gray-700 rounded-full ${animationClass}`} style={style} />
                <div className={`w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded-full ${animationClass}`} style={style} />
              </div>
              <div className={`w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} style={style} />
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className={`w-16 h-8 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} style={style} />
                <div className={`w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} style={style} />
                <div className={`w-14 h-8 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} style={style} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Checkbox skeleton */}
      <div className={`w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0 mt-1 ${animationClass}`} style={style} />
      
      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className={`h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 ${animationClass}`} style={style} />
            <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 ${animationClass}`} style={style} />
          </div>
          <div className={`w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full ml-4 ${animationClass}`} style={style} />
        </div>
        
        {/* Meta info */}
        <div className="flex items-center gap-3 text-sm">
          <div className={`w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} style={style} />
          <div className={`w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} style={style} />
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2">
            <div className={`w-16 h-7 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} style={style} />
            <div className={`w-12 h-7 bg-gray-200 dark:bg-gray-700 rounded ${animationClass}`} style={style} />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Empty state skeleton
 */
export const TodoListEmptySkeleton: React.FC<{ animationSpeed?: 'slow' | 'normal' | 'fast' }> = ({
  animationSpeed = 'normal'
}) => {
  const animationClass = {
    slow: 'animate-pulse-slow',
    normal: 'animate-pulse',
    fast: 'animate-pulse-fast'
  }[animationSpeed];

  return (
    <div className="text-center py-12">
      <div className={`w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 ${animationClass}`} />
      <div className={`h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mx-auto mb-2 ${animationClass}`} />
      <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 mx-auto mb-6 ${animationClass}`} />
      <div className={`w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded mx-auto ${animationClass}`} />
    </div>
  );
};

export default TodoListSkeleton;