'use client';

import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

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

interface AppInitializationProviderProps {
  children: ReactNode;
}

export function AppInitializationProvider({ children }: AppInitializationProviderProps) {
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

  return (
    <AppInitializationContext.Provider value={initializationContextValue}>
      {children}
    </AppInitializationContext.Provider>
  );
}