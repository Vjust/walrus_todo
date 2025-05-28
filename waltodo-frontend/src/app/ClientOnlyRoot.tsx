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
  const context = useContext(AppInitializationContext);
  if (!context) {
    throw new Error('useAppInitialization must be used within ClientOnlyRoot');
  }
  return context;
};

export default function ClientOnlyRoot({ children }: ClientOnlyRootProps) {
  const [isClient, setIsClient] = useState(false);
  const [suiClientReady, setSuiClientReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [initializationAttempted, setInitializationAttempted] = useState(false);

  // Derived state for overall app readiness
  const isAppReady = isClient && suiClientReady;

  useEffect(() => {
    console.log('🚀 ClientOnlyRoot useEffect FIRED!');
    
    const initializeAll = async () => {
      try {
        // Step 1: Ensure we're on the client side
        if (typeof window === 'undefined') {
          console.log('⏳ Still on server side, waiting...');
          return;
        }

        // Step 2: Set client ready with small delay for hydration
        await new Promise(resolve => setTimeout(resolve, 50));
        setIsClient(true);
        console.log('✅ ClientOnlyRoot isClient set to true');
        
        // Step 3: Initialize Sui client with retries
        const MAX_RETRIES = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            console.log(`🔗 Initializing Sui client (attempt ${attempt}/${MAX_RETRIES})...`);
            
            // Check if already initialized from another source
            if (isSuiClientInitialized()) {
              console.log('✅ Sui client already initialized, skipping');
              setSuiClientReady(true);
              return;
            }
            
            await initializeSuiClientWithConfig();
            
            // Verify initialization worked
            if (isSuiClientInitialized()) {
              setSuiClientReady(true);
              console.log('✅ Sui client initialized successfully');
              return;
            } else {
              throw new Error('Sui client initialization completed but client not ready');
            }
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`⚠️ Sui client initialization attempt ${attempt} failed:`, lastError.message);
            
            if (attempt < MAX_RETRIES) {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        
        // If we get here, all retries failed
        console.error('❌ All Sui client initialization attempts failed:', lastError?.message);
        setInitializationError(lastError?.message || 'Failed to initialize Sui client');
        
        // Still set ready to allow app to continue with degraded functionality
        setSuiClientReady(true);
        
      } catch (error) {
        console.error('❌ Critical initialization error:', error);
        setInitializationError(error instanceof Error ? error.message : 'Critical initialization error');
        // Still set ready to prevent infinite loading
        setIsClient(true);
        setSuiClientReady(true);
      } finally {
        setInitializationAttempted(true);
      }
    };
    
    if (!initializationAttempted) {
      initializeAll();
    }
  }, [initializationAttempted]);

  console.log('🔄 ClientOnlyRoot render state:', {
    isClient,
    suiClientReady,
    isAppReady,
    windowExists: typeof window !== 'undefined',
    initializationError
  });

  // Render loading state during initialization
  if (!isAppReady) {
    return (
      <main className='container mx-auto px-4 py-8'>
        <div className="text-center">
          <div className="mb-4">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mx-auto"></div>
          </div>
          <div className="text-lg font-medium text-gray-700">
            {!isClient ? 'Initializing client...' : 'Connecting to Sui blockchain...'}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {!isClient ? 
              'Setting up the application environment' : 
              'This may take a few moments on first load'
            }
          </div>
          {initializationError && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
              <div className="font-medium">Initialization Warning:</div>
              <div>{initializationError}</div>
              <div className="mt-1 text-xs">The app will continue with limited blockchain functionality.</div>
            </div>
          )}
        </div>
      </main>
    );
  }

  console.log('🎯 ClientOnlyRoot rendering full app with wallet provider');

  const initializationContextValue: AppInitializationContextType = {
    isClientReady: isClient,
    isSuiClientReady: suiClientReady,
    isAppReady,
    initializationError,
  };

  return (
    <AppInitializationContext.Provider value={initializationContextValue}>
      <ErrorBoundary>
        <ErrorSuppressor />
        <AppWalletProvider>
          {children}
        </AppWalletProvider>
      </ErrorBoundary>
    </AppInitializationContext.Provider>
  );
}
