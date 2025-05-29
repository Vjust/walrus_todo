'use client';

import { useState, useEffect, useCallback } from 'react';
import { initializeSuiClient, getSuiClient, isSuiClientInitialized } from '@/lib/sui-client';
import type { NetworkType } from '@/types/todo-nft';

export function useSuiClient(network: NetworkType = 'testnet') {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [componentMounted, setComponentMounted] = useState(false);
  const [initializationAttempted, setInitializationAttempted] = useState(false);

  // Check existing client state on mount
  useEffect(() => {
    if (componentMounted && !initializationAttempted) {
      const isAlreadyInitialized = isSuiClientInitialized();
      if (isAlreadyInitialized) {
        console.log('[useSuiClient] Client already initialized, syncing state');
        setIsInitialized(true);
        setInitializationAttempted(true);
      }
    }
  }, [componentMounted, initializationAttempted]);

  const initialize = useCallback(async () => {
    if (!componentMounted || isInitializing) return;
    
    // Don't re-initialize if already done
    if (isInitialized || isSuiClientInitialized()) {
      if (!isInitialized) {
        setIsInitialized(true);
      }
      return;
    }

    setIsInitializing(true);
    setError(null);
    setInitializationAttempted(true);

    try {
      console.log(`[useSuiClient] Initializing for ${network}...`);
      await initializeSuiClient(network);
      
      // Verify the client is actually ready
      if (isSuiClientInitialized()) {
        if (componentMounted) {
          setIsInitialized(true);
          console.log(`[useSuiClient] Successfully initialized for ${network}`);
        }
      } else {
        throw new Error('Client initialization completed but verification failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Sui client';
      if (componentMounted) {
        setError(errorMessage);
        console.error('[useSuiClient] Initialization failed:', err);
      }
    } finally {
      if (componentMounted) {
        setIsInitializing(false);
      }
    }
  }, [network, isInitializing, isInitialized, componentMounted]);

  const getClient = useCallback(async () => {
    if (!componentMounted) return null;
    
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
    setComponentMounted(true);
    return () => {
      setComponentMounted(false);
    };
  }, []);

  // Initialize after mount, but only if not already attempted
  useEffect(() => {
    if (componentMounted && !initializationAttempted && !isInitialized) {
      const timeoutId = setTimeout(() => {
        initialize();
      }, 100); // Small delay to ensure app context is ready
      
      return () => clearTimeout(timeoutId);
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