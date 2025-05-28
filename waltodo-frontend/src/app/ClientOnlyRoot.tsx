// Using React client component
'use client';

import React, { ReactNode, useEffect, useState, createContext, useContext } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorSuppressor } from '@/components/ErrorSuppressor';
import { AppWalletProvider } from '@/contexts/WalletContext';
import { initializeSuiClientWithConfig, isSuiClientInitialized } from '@/lib/sui-client';

interface ClientOnlyRootProps {
  children: ReactNode;
}

// Initialization context to track the overall app readiness
interface AppInitializationContextType {
  isClientReady: boolean;
  isSuiClientReady: boolean;
  isAppReady: boolean;
  initializationError: string | null;
}

const AppInitializationContext = createContext<AppInitializationContextType>({
  isClientReady: false,
  isSuiClientReady: false,
  isAppReady: false,
  initializationError: null,
});

export const useAppInitialization = () => {
  // ALWAYS call useContext - never conditionally!
  // This ensures hooks are called in the same order every render
  const context = useContext(AppInitializationContext);
  
  // Return context or default values - but always call the hook
  return context || {
    isClientReady: false,
    isSuiClientReady: false,
    isAppReady: false,
    initializationError: null,
  };
};

export default function ClientOnlyRoot({ children }: ClientOnlyRootProps) {
  // Initialize states to prevent hydration mismatch
  const [isClientReady, setIsClientReady] = useState(false);
  const [suiClientReady, setSuiClientReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Derived state for overall app readiness
  const isAppReady = isClientReady && suiClientReady && mounted;

  // Handle client-side hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize app after mounting
  useEffect(() => {
    if (!mounted) return;
    
    const initializeAll = async () => {
      try {
        // Step 1: Set client ready immediately
        setIsClientReady(true);
        
        // Step 2: Initialize Sui client with retries
        const MAX_RETRIES = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            // Check if already initialized from another source
            if (isSuiClientInitialized()) {
              setSuiClientReady(true);
              return;
            }
            
            await initializeSuiClientWithConfig();
            
            // Verify initialization worked
            if (isSuiClientInitialized()) {
              setSuiClientReady(true);
              return;
            } else {
              throw new Error('Sui client initialization completed but client not ready');
            }
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (attempt < MAX_RETRIES) {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        
        // If we get here, all retries failed
        setInitializationError(lastError?.message || 'Failed to initialize Sui client');
        
        // Still set ready to allow app to continue with degraded functionality
        setSuiClientReady(true);
        
      } catch (error) {
        setInitializationError(error instanceof Error ? error.message : 'Critical initialization error');
        // Still set ready to prevent infinite loading
        setIsClientReady(true);
        setSuiClientReady(true);
      }
    };
    
    initializeAll();
  }, [mounted]);

  // Loading content for consistent structure
  const loadingContent = (
    <main className='container mx-auto px-4 py-8'>
      <div className="text-center">
        <div className="mb-4">
          <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mx-auto"></div>
        </div>
        <div className="text-lg font-medium text-gray-700">
          {!mounted ? 'Loading...' : (!isClientReady ? 'Initializing client...' : 'Loading wallet and blockchain components...')}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          {!mounted ? 
            'Please wait...' :
            (!isClientReady ? 
              'Setting up the application environment' : 
              'This may take a few moments on first load'
            )
          }
        </div>
        {mounted && initializationError && (
          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
            <div className="font-medium">Initialization Warning:</div>
            <div>{initializationError}</div>
            <div className="mt-1 text-xs">The app will continue with limited blockchain functionality.</div>
          </div>
        )}
      </div>
    </main>
  );

  // Show loading content until fully ready, with hydration safety
  if (!mounted || !isAppReady) {
    return (
      <div suppressHydrationWarning>
        {loadingContent}
      </div>
    );
  }

  const initializationContextValue: AppInitializationContextType = {
    isClientReady,
    isSuiClientReady: suiClientReady,
    isAppReady,
    initializationError,
  };

  return (
    <div suppressHydrationWarning>
      <AppInitializationContext.Provider value={initializationContextValue}>
        <ErrorBoundary>
          <ErrorSuppressor />
          <AppWalletProvider>
            {children}
          </AppWalletProvider>
        </ErrorBoundary>
      </AppInitializationContext.Provider>
    </div>
  );
}