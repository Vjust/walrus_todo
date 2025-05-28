'use client';

import { useState, useEffect, useCallback } from 'react';
import { initializeSuiClient, getSuiClient } from '@/lib/sui-client';
import type { NetworkType } from '@/types/todo-nft';

export function useSuiClient(network: NetworkType = 'testnet') {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [componentMounted, setComponentMounted] = useState(false);

  const initialize = useCallback(async () => {
    if (!componentMounted || isInitializing || isInitialized) return;

    setIsInitializing(true);
    setError(null);

    try {
      await initializeSuiClient(network);
      if (componentMounted) {
        setIsInitialized(true);
        console.log(`[useSuiClient] Successfully initialized for ${network}`);
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
      return await getSuiClient();
    } catch (err) {
      console.warn('[useSuiClient] Client not available, attempting to initialize...');
      await initialize();
      return await getSuiClient();
    }
  }, [initialize, componentMounted]);

  // Component mount effect
  useEffect(() => {
    setComponentMounted(true);
    return () => {
      setComponentMounted(false);
    };
  }, []);

  // Initialize after mount
  useEffect(() => {
    if (componentMounted) {
      initialize();
    }
  }, [initialize, componentMounted]);

  return {
    isInitialized,
    isInitializing,
    error,
    initialize,
    getClient,
  };
}