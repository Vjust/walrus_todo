'use client';

import { useEffect, useState } from 'react';
import { useWalletContext, WalletContextType } from '@/contexts/WalletContext';

/**
 * Hook that safely provides wallet context only after client-side hydration
 * This prevents SSR/hydration mismatches with wallet state
 */
export function useClientSafeWallet(): WalletContextType | null {
  const [isClient, setIsClient] = useState(false);
  const walletContext = useWalletContext();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Only return wallet context after client-side hydration
  return isClient ? walletContext : null;
}

/**
 * Component wrapper that only renders children after client-side hydration
 * with wallet context available. Shows loading state during SSR.
 */
interface ClientSafeWalletProps {
  children: (wallet: WalletContextType) => React.ReactNode;
  fallback?: React.ReactNode;
}

export function ClientSafeWallet({ children, fallback }: ClientSafeWalletProps) {
  const wallet = useClientSafeWallet();

  if (!wallet) {
    return (
      fallback || (
        <div className='p-4 ocean-card'>
          <div className='p-4 bg-ocean-deep/10 rounded-lg'>
            <p>Initializing wallet connection...</p>
          </div>
        </div>
      )
    );
  }

  return <>{children(wallet)}</>;
}