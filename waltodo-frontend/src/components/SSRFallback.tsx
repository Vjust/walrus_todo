/**
 * SSR Fallback Components
 * 
 * Provides fallback components for server-side rendering that prevent
 * hydration mismatches and layout shifts.
 */

import React from 'react';

// Types
interface SSRFallbackProps {
  className?: string;
  children?: React.ReactNode;
}

interface SkeletonProps {
  className?: string;
  height?: string | number;
  width?: string | number;
  animate?: boolean;
  rounded?: boolean;
}

interface ContentSkeletonProps {
  lines?: number;
  showAvatar?: boolean;
  showImage?: boolean;
  className?: string;
}

/**
 * Basic skeleton component for loading states
 */
export function Skeleton({ 
  className = '', 
  height = '1rem', 
  width = '100%',
  animate = true,
  rounded = false,
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  const animationClasses = animate ? 'animate-pulse' : '';
  const shapeClasses = rounded ? 'rounded-full' : 'rounded';
  
  const style = {
    height: typeof height === 'number' ? `${height}px` : height,
    width: typeof width === 'number' ? `${width}px` : width,
  };

  return (
    <div 
      className={`${baseClasses} ${animationClasses} ${shapeClasses} ${className}`}
      style={style}
      aria-label="Loading..."
      role="status"
    />
  );
}

/**
 * Skeleton for text content with multiple lines
 */
export function TextSkeleton({ 
  lines = 3, 
  className = '',
}: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton 
          key={i}
          height="1rem"
          width={i === lines - 1 ? '75%' : '100%'}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for card-like content
 */
export function CardSkeleton({ 
  showAvatar = false, 
  showImage = false, 
  lines = 2,
  className = '',
}: ContentSkeletonProps) {
  return (
    <div className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {showImage && (
        <Skeleton 
          height="12rem" 
          className="mb-4" 
          rounded={false}
        />
      )}
      
      <div className="flex items-start space-x-3">
        {showAvatar && (
          <Skeleton 
            height="2.5rem" 
            width="2.5rem" 
            rounded 
          />
        )}
        
        <div className="flex-1 space-y-2">
          <Skeleton height="1.25rem" width="60%" />
          <TextSkeleton lines={lines} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for todo list items
 */
export function TodoItemSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <Skeleton height="1.25rem" width="1.25rem" rounded />
      <div className="flex-1 space-y-2">
        <Skeleton height="1.25rem" width="70%" />
        <Skeleton height="1rem" width="50%" />
        <div className="flex space-x-2">
          <Skeleton height="1.5rem" width="4rem" rounded />
          <Skeleton height="1.5rem" width="3rem" rounded />
        </div>
      </div>
      <Skeleton height="2rem" width="2rem" rounded />
    </div>
  );
}

/**
 * Skeleton for todo list
 */
export function TodoListSkeleton({ 
  itemCount = 3, 
  className = '' 
}: { 
  itemCount?: number; 
  className?: string; 
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: itemCount }, (_, i) => (
        <TodoItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for navigation bar
 */
export function NavbarSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center space-x-4">
        <Skeleton height="2rem" width="8rem" />
        <div className="hidden md:flex space-x-4">
          <Skeleton height="1.5rem" width="4rem" />
          <Skeleton height="1.5rem" width="4rem" />
          <Skeleton height="1.5rem" width="4rem" />
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Skeleton height="2rem" width="2rem" rounded />
        <Skeleton height="2.5rem" width="8rem" rounded />
      </div>
    </div>
  );
}

/**
 * Skeleton for wallet connect button
 */
export function WalletButtonSkeleton({ 
  size = 'md',
  className = '' 
}: { 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-8 w-24',
    md: 'h-10 w-32',
    lg: 'h-12 w-40',
  };

  return (
    <Skeleton 
      height={sizeClasses[size].split(' ')[0]}
      width={sizeClasses[size].split(' ')[1]}
      rounded
      className={className}
    />
  );
}

/**
 * Skeleton for stats/metrics cards
 */
export function StatCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton height="1rem" width="4rem" />
          <Skeleton height="2rem" width="3rem" />
        </div>
        <Skeleton height="2rem" width="2rem" rounded />
      </div>
    </div>
  );
}

/**
 * Skeleton for grid of stats cards
 */
export function StatsGridSkeleton({ 
  cardCount = 4,
  className = '' 
}: { 
  cardCount?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: cardCount }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for NFT card
 */
export function NFTCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      <Skeleton height="12rem" rounded={false} />
      <div className="p-4 space-y-3">
        <Skeleton height="1.5rem" width="80%" />
        <Skeleton height="1rem" width="60%" />
        <div className="flex justify-between items-center">
          <Skeleton height="1.5rem" width="4rem" rounded />
          <Skeleton height="1.5rem" width="3rem" rounded />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for NFT gallery grid
 */
export function NFTGridSkeleton({ 
  itemCount = 6,
  className = '' 
}: { 
  itemCount?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: itemCount }, (_, i) => (
        <NFTCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for form elements
 */
export function FormSkeleton({ 
  fields = 3,
  showSubmitButton = true,
  className = '' 
}: { 
  fields?: number;
  showSubmitButton?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton height="1rem" width="6rem" />
          <Skeleton height="2.5rem" width="100%" />
        </div>
      ))}
      
      {showSubmitButton && (
        <div className="flex gap-2 pt-4">
          <Skeleton height="2.5rem" width="8rem" rounded />
          <Skeleton height="2.5rem" width="6rem" rounded />
        </div>
      )}
    </div>
  );
}

/**
 * Generic page skeleton for full page loading
 */
export function PageSkeleton({ 
  showNavbar = true,
  showSidebar = false,
  className = '' 
}: { 
  showNavbar?: boolean;
  showSidebar?: boolean;
  className?: string;
}) {
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {showNavbar && <NavbarSkeleton />}
      
      <div className={`${showSidebar ? 'flex' : ''}`}>
        {showSidebar && (
          <div className="w-64 p-4 border-r border-gray-200 dark:border-gray-700">
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} height="2rem" width="100%" />
              ))}
            </div>
          </div>
        )}
        
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Hero section */}
            <div className="text-center space-y-4">
              <Skeleton height="3rem" width="60%" className="mx-auto" />
              <Skeleton height="1.5rem" width="80%" className="mx-auto" />
              <div className="flex justify-center space-x-4">
                <Skeleton height="2.5rem" width="8rem" rounded />
                <Skeleton height="2.5rem" width="8rem" rounded />
              </div>
            </div>
            
            {/* Stats grid */}
            <StatsGridSkeleton />
            
            {/* Content area */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <Skeleton height="2rem" width="8rem" className="mb-6" />
              <TodoListSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Error fallback component
 */
export function ErrorFallback({ 
  error,
  resetError,
  className = ''
}: {
  error?: Error;
  resetError?: () => void;
  className?: string;
}) {
  return (
    <div className={`text-center p-8 ${className}`}>
      <div className="max-w-md mx-auto">
        <div className="text-red-600 mb-4">
          <svg 
            className="h-16 w-16 mx-auto" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13?.856c1?.54 0 2.502-1.667 1.732-2?.5L13?.732 4c-.77-.833-1.732-.833-2.5 0L3.314 16.5c-.77?.833?.192 2.5 1.732 2.5z" 
            />
          </svg>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'An unexpected error occurred while loading this content.'}
        </p>
        
        {resetError && (
          <button
            onClick={resetError}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Network error fallback
 */
export function NetworkErrorFallback({ 
  onRetry,
  className = ''
}: {
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`text-center p-8 ${className}`}>
      <div className="max-w-md mx-auto">
        <div className="text-orange-600 mb-4">
          <svg 
            className="h-16 w-16 mx-auto" 
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
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Connection Error
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Unable to connect to the network. Please check your internet connection.
        </p>
        
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
}

// Export all components
export default {
  Skeleton,
  TextSkeleton,
  CardSkeleton,
  TodoItemSkeleton,
  TodoListSkeleton,
  NavbarSkeleton,
  WalletButtonSkeleton,
  StatCardSkeleton,
  StatsGridSkeleton,
  NFTCardSkeleton,
  NFTGridSkeleton,
  FormSkeleton,
  PageSkeleton,
  ErrorFallback,
  NetworkErrorFallback,
};