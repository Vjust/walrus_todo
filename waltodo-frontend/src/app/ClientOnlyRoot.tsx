'use client';

import React, { ReactNode, useEffect, useState, createContext, useContext, Suspense } from 'react';
import { AppWalletProvider } from '@/contexts/WalletContext';

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

// Default context value to ensure consistency across SSR and client renders
const defaultContextValue: AppInitializationContextType = {
  isClientReady: false,
  isSuiClientReady: false,
  isAppReady: false,
  initializationError: null,
};

const AppInitializationContext = createContext<AppInitializationContextType>(defaultContextValue);

export const useAppInitialization = () => {
  const context = useContext(AppInitializationContext);
  return context || defaultContextValue;
};

export default function ClientOnlyRoot({ children }: ClientOnlyRootProps) {
  // Simple state management to prevent hydration issues
  const [isClientReady, setIsClientReady] = useState(false);
  const [suiClientReady, setSuiClientReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Derived state for overall app readiness
  const isAppReady = isClientReady && suiClientReady && mounted;

  // Initialize after mounting - fix hydration issues
  useEffect(() => {
    // Use a timeout to ensure proper client-side initialization
    const timeout = setTimeout(() => {
      setMounted(true);
      setIsClientReady(true);
      setSuiClientReady(true);
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  const initializationContextValue: AppInitializationContextType = {
    isClientReady,
    isSuiClientReady: suiClientReady,
    isAppReady,
    initializationError,
  };

  // Don't render anything until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div style={{ display: 'none' }}>
        {/* Hidden during SSR to prevent hydration mismatch */}
      </div>
    );
  }

  return (
    <div suppressHydrationWarning>
      <AppInitializationContext.Provider value={initializationContextValue}>
        <AppWalletProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <div>
              {children}
            </div>
          </Suspense>
        </AppWalletProvider>
      </AppInitializationContext.Provider>
    </div>
  );
}