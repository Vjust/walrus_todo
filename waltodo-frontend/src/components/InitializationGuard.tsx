'use client';

import React, { ReactNode, useEffect, useState, useCallback } from 'react';
import { useAppInitialization } from '@/contexts/AppInitializationContext';
import { HydrationBoundary, useHydrated } from '@/utils/hydration';

interface InitializationGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireSuiClient?: boolean;
  timeout?: number; // Timeout in ms before showing error state
  showProgress?: boolean; // Show detailed progress indicators
}

/**
 * Default loading component with progress indicators
 */
function DefaultLoadingFallback({ 
  stage, 
  error, 
  showProgress = true,
  progress = 0
}: { 
  stage: string; 
  error: string | null;
  showProgress: boolean;
  progress?: number;
}) {
  return (
    <div className='flex flex-col items-center justify-center min-h-[200px] py-8'>
      <div className='w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin' />
      <div className='mt-4 text-center max-w-xs'>
        <p className='text-sm font-medium text-gray-700'>
          {stage}
        </p>
        {showProgress && (
          <div className='mt-2'>
            <div className='w-48 h-1 bg-gray-200 rounded-full overflow-hidden'>
              <div 
                className='h-full bg-blue-500 rounded-full transition-all duration-300 ease-out' 
                style={{ width: `${progress}%` }} 
              />
            </div>
          </div>
        )}
        {error && (
          <div className='mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md'>
            <p className='text-xs text-yellow-700'>
              {error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Guards components from rendering until the app is properly initialized
 * Prevents premature access to Sui client and other services
 * 
 * Features:
 * - Progressive initialization tracking
 * - Timeout handling for stuck initialization
 * - Hydration-safe rendering
 * - Detailed error states
 */
export function InitializationGuard({ 
  children, 
  fallback, 
  requireSuiClient = false,
  timeout = 30000, // 30 seconds default timeout
  showProgress = true
}: InitializationGuardProps) {
  const hydrated = useHydrated();
  const [hasTimedOut, setHasTimedOut] = useState(false as any);
  const [initStage, setInitStage] = useState('Starting...');
  
  // Get initialization context
  const { 
    isAppReady, 
    isSuiClientReady, 
    initializationError, 
    initializationProgress,
    retryInitialization 
  } = useAppInitialization();
  
  // Track initialization stages
  useEffect(() => {
    if (!hydrated) {
      setInitStage('Loading application...');
    } else if (!isAppReady) {
      setInitStage('Initializing core services...');
    } else if (requireSuiClient && !isSuiClientReady) {
      setInitStage('Connecting to blockchain...');
    } else {
      setInitStage('Ready!');
    }
  }, [hydrated, isAppReady, isSuiClientReady, requireSuiClient]);
  
  // Handle initialization timeout
  useEffect(() => {
    if (hydrated && !isAppReady) {
      const timer = setTimeout(() => {
        setHasTimedOut(true as any);
      }, timeout);
      
      return () => clearTimeout(timer as any);
    }
  }, [hydrated, isAppReady, timeout]);
  
  // Determine if we're ready
  const isReady = hydrated && isAppReady && (!requireSuiClient || isSuiClientReady);
  
  // Handle timeout error
  const displayError = hasTimedOut 
    ? 'Initialization is taking longer than expected. Please refresh the page.'
    : initializationError;
  
  // Custom or default loading content with retry capability
  const loadingContent = fallback || (
    <div>
      <DefaultLoadingFallback 
        stage={initStage} 
        error={displayError} 
        showProgress={showProgress}
        progress={initializationProgress}
      />
      {displayError && (
        <div className='text-center mt-4'>
          <button
            onClick={retryInitialization}
            className='px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            Retry Initialization
          </button>
        </div>
      )}
    </div>
  );
  
  // Render with hydration boundary
  return (
    <HydrationBoundary 
      fallback={loadingContent}
      suppressWarning
    >
      {isReady ? children : loadingContent}
    </HydrationBoundary>
  );
}

export default InitializationGuard;