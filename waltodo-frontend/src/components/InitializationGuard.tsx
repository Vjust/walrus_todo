'use client';

import React, { ReactNode } from 'react';
import { useAppInitialization } from '@/app/ClientOnlyRoot';

interface InitializationGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireSuiClient?: boolean;
}

/**
 * Guards components from rendering until the app is properly initialized
 * Prevents premature access to Sui client and other services
 */
export function InitializationGuard({ 
  children, 
  fallback, 
  requireSuiClient = false 
}: InitializationGuardProps) {
  const { isAppReady, isSuiClientReady, initializationError } = useAppInitialization();
  
  // Determine if we're ready based on requirements
  const isReady = requireSuiClient ? (isAppReady && isSuiClientReady) : isAppReady;
  
  if (!isReady) {
    return fallback || (
      <div className='flex flex-col items-center justify-center py-8'>
        <div className='w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin'></div>
        <div className='mt-3 text-center'>
          <p className='text-sm text-gray-600'>
            {!isAppReady ? 'Initializing application...' : 'Connecting to blockchain...'}
          </p>
          {initializationError && (
            <p className='text-xs text-yellow-600 mt-1'>
              Warning: {initializationError}
            </p>
          )}
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

export default InitializationGuard;