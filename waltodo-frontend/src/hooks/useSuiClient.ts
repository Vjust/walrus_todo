'use client';

import { useState, useEffect, useCallback } from 'react';
import { initializeSuiClient, getSuiClient } from '@/lib/sui-client';
import type { NetworkType } from '@/types/todo-nft';

export function useSuiClient(network: NetworkType = 'testnet') {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (isInitializing || isInitialized) return;

    setIsInitializing(true);
    setError(null);

    try {
      await initializeSuiClient(network);
      setIsInitialized(true);
      console.log(`[useSuiClient] Successfully initialized for ${network}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Sui client';
      setError(errorMessage);
      console.error('[useSuiClient] Initialization failed:', err);
    } finally {
      setIsInitializing(false);
    }
  }, [network, isInitializing, isInitialized]);

  const getClient = useCallback(() => {
    try {
      return getSuiClient();
    } catch (err) {
      console.warn('[useSuiClient] Client not available, attempting to initialize...');
      initialize();
      return null;
    }
  }, [initialize]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    isInitialized,
    isInitializing,
    error,
    initialize,
    getClient,
  };
}