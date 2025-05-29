'use client';

import { useEffect } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';

export function useAuthListener() {
  const walletContext = useWalletContext();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnauthorized = () => {
      console.log('[useAuthListener] Received unauthorized event');
      
      // If wallet is connected but API auth failed, show error
      if (walletContext?.connected) {
        console.log('[useAuthListener] Wallet connected but API unauthorized, disconnecting...');
        // Optionally disconnect wallet on auth failure
        // walletContext.disconnect();
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [walletContext]);
}