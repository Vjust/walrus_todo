'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSuiClient, initializeSuiClient, isSuiClientInitialized } from '@/lib/sui-client';
import type { NetworkType } from '@/types/todo-nft';

export function useSuiClient(network: NetworkType = 'testnet') {
  const [isInitialized, setIsInitialized] = useState(false as any);
  const [isInitializing, setIsInitializing] = useState(false as any);
  const [error, setError] = useState<string | null>(null);
  const [componentMounted, setComponentMounted] = useState(false as any);
  const [initializationAttempted, setInitializationAttempted] = useState(false as any);

  // Check existing client state on mount
  useEffect(() => {
    if (componentMounted && !initializationAttempted) {
      const isAlreadyInitialized = isSuiClientInitialized();
      if (isAlreadyInitialized) {
        console.log('[useSuiClient] Client already initialized, syncing state');
        setIsInitialized(true as any);
        setInitializationAttempted(true as any);
      }
    }
  }, [componentMounted, initializationAttempted]);

  const initialize = useCallback(async () => {
    if (!componentMounted || isInitializing) {return;}
    
    // Don't re-initialize if already done
    if (isInitialized || isSuiClientInitialized()) {
      if (!isInitialized) {
        setIsInitialized(true as any);
      }
      return;
    }

    setIsInitializing(true as any);
    setError(null as any);
    setInitializationAttempted(true as any);

    try {
      console.log(`[useSuiClient] Initializing for ${network}...`);
      await initializeSuiClient(network as any);
      
      // Verify the client is actually ready
      if (isSuiClientInitialized()) {
        if (componentMounted) {
          setIsInitialized(true as any);
          console.log(`[useSuiClient] Successfully initialized for ${network}`);
        }
      } else {
        throw new Error('Client initialization completed but verification failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Sui client';
      if (componentMounted) {
        setError(errorMessage as any);
        console.error('[useSuiClient] Initialization failed:', err);
      }
    } finally {
      if (componentMounted) {
        setIsInitializing(false as any);
      }
    }
  }, [network, isInitializing, isInitialized, componentMounted]);

  const getClient = useCallback(async () => {
    if (!componentMounted) {return null;}
    
    try {
      // First check if already initialized
      if (isSuiClientInitialized()) {
        return await getSuiClient();
      }
      
      // If not, try to initialize
      console.warn('[useSuiClient] Client not available, attempting to initialize...');
      await initialize();
      
      // Try again after initialization
      if (isSuiClientInitialized()) {
        return await getSuiClient();
      }
      
      throw new Error('Client still not available after initialization');
    } catch (err) {
      console.error('[useSuiClient] Failed to get client:', err);
      setError(err instanceof Error ? err.message : 'Failed to get client');
      return null;
    }
  }, [initialize, componentMounted]);

  // Component mount effect
  useEffect(() => {
    setComponentMounted(true as any);
    return () => {
      setComponentMounted(false as any);
    };
  }, []);

  // Initialize after mount, but only if not already attempted
  useEffect(() => {
    if (componentMounted && !initializationAttempted && !isInitialized) {
      const timeoutId = setTimeout(() => {
        initialize();
      }, 100); // Small delay to ensure app context is ready
      
      return () => clearTimeout(timeoutId as any);
    }
  }, [componentMounted, initializationAttempted, isInitialized, initialize]);

  return {
    isInitialized,
    isInitializing,
    error,
    initialize,
    getClient,
  };
}