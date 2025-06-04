'use client';

import React, { createContext, ReactNode, useContext, useEffect, useState, useCallback } from 'react';

// Initialization context to track the overall app readiness
interface AppInitializationContextType {
  isClientReady: boolean;
  isSuiClientReady: boolean;
  isAppReady: boolean;
  initializationError: string | null;
  retryInitialization: () => void;
  initializationProgress: number; // 0-100
}

// Default context value to ensure consistency across SSR and client renders
const defaultContextValue: AppInitializationContextType = {
  isClientReady: false,
  isSuiClientReady: false,
  isAppReady: false,
  initializationError: null,
  retryInitialization: () => {},
  initializationProgress: 0,
};

const AppInitializationContext = createContext<AppInitializationContextType>(defaultContextValue);

export const useAppInitialization = () => {
  const context = useContext(AppInitializationContext);
  return context || defaultContextValue;
};

interface AppInitializationProviderProps {
  children: ReactNode;
}

// Initialization steps with weights for progress calculation
const INIT_STEPS = {
  MOUNT: { weight: 20, label: 'Mounting application' },
  CLIENT_READY: { weight: 30, label: 'Initializing client' },
  SUI_CLIENT: { weight: 40, label: 'Connecting to blockchain' },
  FINAL_CHECK: { weight: 10, label: 'Final verification' },
};

export function AppInitializationProvider({ children }: AppInitializationProviderProps) {
  // Core initialization state
  const [mounted, setMounted] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [suiClientReady, setSuiClientReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [initAttempts, setInitAttempts] = useState(0);
  const [progress, setProgress] = useState(0);

  // Derived state for overall app readiness
  const isAppReady = mounted && isClientReady && suiClientReady && !initializationError;

  // Calculate initialization progress
  const updateProgress = useCallback(() => {
    let currentProgress = 0;
    
    if (mounted) currentProgress += INIT_STEPS.MOUNT.weight;
    if (isClientReady) currentProgress += INIT_STEPS.CLIENT_READY.weight;
    if (suiClientReady) currentProgress += INIT_STEPS.SUI_CLIENT.weight;
    if (isAppReady) currentProgress += INIT_STEPS.FINAL_CHECK.weight;
    
    setProgress(currentProgress);
  }, [mounted, isClientReady, suiClientReady, isAppReady]);

  // Update progress whenever state changes
  useEffect(() => {
    updateProgress();
  }, [updateProgress]);

  // Main initialization function
  const initializeApp = useCallback(async () => {
    try {
      // Step 1: Mount check
      setMounted(true);
      
      // Step 2: Client readiness (simulate async check)
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsClientReady(true);
      
      // Step 3: Sui client initialization
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        setSuiClientReady(true);
      } else {
        throw new Error('Not in browser environment');
      }
      
    } catch (error) {
      console.error('Initialization error:', error);
      setInitializationError(
        error instanceof Error ? error.message : 'Failed to initialize application'
      );
    }
  }, []);

  // Retry initialization function
  const retryInitialization = useCallback(() => {
    setInitializationError(null);
    setInitAttempts(prev => prev + 1);
    
    // Reset states and try again
    setMounted(false);
    setIsClientReady(false);
    setSuiClientReady(false);
    setProgress(0);
    
    // Trigger re-initialization
    setTimeout(() => {
      initializeApp();
    }, 100);
  }, [initializeApp]);

  // Initialize on mount
  useEffect(() => {
    // Prevent multiple initialization attempts
    if (initAttempts > 0) return;
    
    // Use requestIdleCallback for non-blocking initialization
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => initializeApp(), { timeout: 1000 });
    } else {
      // Fallback to setTimeout
      setTimeout(initializeApp, 0);
    }
  }, [initializeApp, initAttempts]);

  // Context value with all state and helpers
  const initializationContextValue: AppInitializationContextType = {
    isClientReady,
    isSuiClientReady: suiClientReady,
    isAppReady,
    initializationError,
    retryInitialization,
    initializationProgress: progress,
  };

  return (
    <AppInitializationContext.Provider value={initializationContextValue}>
      {children}
    </AppInitializationContext.Provider>
  );
}