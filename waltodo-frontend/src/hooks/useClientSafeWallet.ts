'use client';

import { useState, useEffect } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';

/**
 * A hook that provides wallet data in a hydration-safe way
 * Returns loading state until component is fully mounted on client
 */
export function useClientSafeWallet() {
  const [isClientReady, setIsClientReady] = useState(false);
  const walletContext = useWalletContext();

  useEffect(() => {
    // Small delay to ensure proper hydration
    const timer = setTimeout(() => {
      setIsClientReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // Return safe loading state during SSR/hydration
  if (!isClientReady) {
    return {
      connected: false,
      connecting: false,
      account: null,
      address: null,
      chainId: null,
      name: null,
      network: 'testnet',
      error: null,
      isLoading: true,
      // Provide safe no-op functions during loading
      connect: () => {},
      disconnect: () => {},
      signAndExecuteTransaction: async () => { throw new Error('Wallet not ready'); },
      clearError: () => {},
      openModal: () => {},
      closeModal: () => {},
      resetSession: () => {},
      resetActivityTimer: () => {},
      switchNetwork: () => {},
      addTransaction: () => {},
      trackTransaction: async () => { throw new Error('Wallet not ready'); },
      // Default values for other properties
      sessionExpired: false,
      lastActivity: 0,
      transactionHistory: [],
      currentNetwork: 'testnet',
      isModalOpen: false,
    };
  }

  // Return actual wallet context when client is ready
  return {
    ...walletContext,
    isLoading: false,
  };
}