'use client';

import React, { ReactNode } from 'react';
import { StorageContextWarning } from './StorageContextWarning';
import { isUsingFallbackStorage } from '@/lib/storage-utils';

interface ErrorHandlingProviderProps {
  children: ReactNode;
}

/**
 * Global error handling provider that wraps the application
 * and provides warnings and fallbacks for common errors
 */
export function ErrorHandlingProvider({
  children,
}: ErrorHandlingProviderProps) {
  // Only show storage warning if fallback is in use
  const showStorageWarning = isUsingFallbackStorage();

  return (
    <div className='relative'>
      {/* Show storage context warning at the top of the app when needed */}
      {showStorageWarning && (
        <div className='sticky top-0 z-50 w-full'>
          <StorageContextWarning />
        </div>
      )}

      {/* Render the application */}
      {children}
    </div>
  );
}
