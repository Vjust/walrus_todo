'use client';

import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { initializeSuiClient, isSuiClientInitialized } from '@/lib/sui-client';

interface AppInitializationContextType {
  isAppReady: boolean;
  isSuiClientReady: boolean;
  initializationError: string | null;
}

// Safe default context value for SSR and initialization
const createSafeDefaultAppContext = (): AppInitializationContextType => ({
  isAppReady: false,
  isSuiClientReady: false,
  initializationError: null,
});

const AppInitializationContext = createContext<AppInitializationContextType>(createSafeDefaultAppContext());

// Hook to use app initialization context
export const useAppInitialization = () => {
  const context = useContext(AppInitializationContext);
  if (!context) {
    // Return safe defaults instead of throwing during SSR/initialization phase
    return createSafeDefaultAppContext();
  }
  return context;
};

interface ClientOnlyRootProps {
  children: ReactNode;
}

// Client-only initialization provider
export default function ClientOnlyRoot({ children }: ClientOnlyRootProps) {
  const [isClient, setIsClient] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isSuiClientReady, setIsSuiClientReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // Client-side initialization effect
  useEffect(() => {
    setIsClient(true);
    setIsAppReady(true);
    
    // Initialize Sui client
    const initializeApp = async () => {
      try {
        if (!isSuiClientInitialized()) {
          await initializeSuiClient('testnet');
        }
        setIsSuiClientReady(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Sui client';
        setInitializationError(errorMessage);
        console.warn('[ClientOnlyRoot] Sui client initialization failed:', error);
      }
    };

    // Delay initialization to ensure proper hydration
    const timeoutId = setTimeout(initializeApp, 500);
    
    return () => clearTimeout(timeoutId);
  }, []);

  const contextValue: AppInitializationContextType = {
    isAppReady: isClient ? isAppReady : false,
    isSuiClientReady: isClient ? isSuiClientReady : false,
    initializationError: isClient ? initializationError : null,
  };

  if (!isClient) {
    // Render with safe default context during SSR
    return (
      <AppInitializationContext.Provider value={createSafeDefaultAppContext()}>
        {children}
      </AppInitializationContext.Provider>
    );
  }

  return (
    <AppInitializationContext.Provider value={contextValue}>
      {children}
    </AppInitializationContext.Provider>
  );
}