'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import { useAppInitialization } from '@/app/ClientOnlyRoot';

interface InitializationGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireSuiClient?: boolean;
}

/**
 * Guards components from rendering until the app is properly initialized
 * Prevents premature access to Sui client and other services
 * 
 * Uses suppressHydrationWarning to prevent hydration mismatches during initialization
 */
export function InitializationGuard({ 
  children, 
  fallback, 
  requireSuiClient = false 
}: InitializationGuardProps) {
  const [mounted, setMounted] = useState(false);
  
  // Always call hooks at the top level - never conditionally
  // useAppInitialization now safely returns default values during SSR
  const contextValue = useAppInitialization();
  
  // Track client-side mounting to prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const { isAppReady, isSuiClientReady, initializationError } = contextValue;
  
  // Determine if we're ready based on requirements
  const isReady = mounted && (requireSuiClient ? (isAppReady && isSuiClientReady) : isAppReady);
  
  const loadingContent = fallback || (
    <div className='flex flex-col items-center justify-center py-8'>
      <div className='w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin'></div>
      <div className='mt-3 text-center'>
        <p className='text-sm text-gray-600'>
          {!mounted ? 'Loading...' : (!isAppReady ? 'Initializing application...' : 'Connecting to blockchain...')}
        </p>
        {mounted && initializationError && (
          <p className='text-xs text-yellow-600 mt-1'>
            Warning: {initializationError}
          </p>
        )}
      </div>
    </div>
  );
  
  // Always render consistent structure, use suppressHydrationWarning for content that differs
  return (
    <div suppressHydrationWarning>
      {isReady ? children : loadingContent}
    </div>
  );
}

export default InitializationGuard;