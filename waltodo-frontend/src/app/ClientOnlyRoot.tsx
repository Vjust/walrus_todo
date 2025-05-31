'use client';

import React, { ReactNode, useEffect, useState, createContext, useContext } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorSuppressor } from '@/components/ErrorSuppressor';
import { ToastProvider } from '@/components/ToastProvider';
import { AppWalletProvider } from '@/contexts/WalletContext';
import { WalrusHealthCheck } from '@/components/WalrusHealthCheck';

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

  // Derived state for overall app readiness
  const isAppReady = isClientReady && suiClientReady;

  // Initialize after mounting
  useEffect(() => {
    // Set ready states immediately to prevent blocking
    setIsClientReady(true);
    setSuiClientReady(true);
  }, []);

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
          <ToastProvider />
          <AppWalletProvider>
            {children}
            {isAppReady && <WalrusHealthCheck />}
          </AppWalletProvider>
        </ErrorBoundary>
      </AppInitializationContext.Provider>
    </div>
  );
}