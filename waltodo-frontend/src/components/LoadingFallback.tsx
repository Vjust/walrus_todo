'use client';

import React from 'react';

interface LoadingFallbackProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

/**
 * LoadingFallback - Consistent loading component for various states
 */
export function LoadingFallback({ 
  message = 'Loading...', 
  size = 'md',
  fullScreen = false 
}: LoadingFallbackProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const containerClasses = fullScreen 
    ? 'min-h-screen bg-gray-50 flex items-center justify-center'
    : 'flex items-center justify-center p-4';

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <div className={`animate-spin rounded-full border-b-2 border-blue-600 mx-auto mb-4 ${sizeClasses[size]}`} />
        <p className={`text-gray-600 ${textSizeClasses[size]}`}>{message}</p>
      </div>
    </div>
  );
}