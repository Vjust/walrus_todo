'use client';

import { useEffect, useState } from 'react';
import { useMounted } from './useMounted';

interface WalletAvailability {
  hasWallet: boolean;
  detectedWallets: string[];
  primaryWallet: string | null;
}

/**
 * Safe wallet detection hook that prevents hydration mismatches
 * Always returns no wallets on server-side, then detects on client
 */
export function useSafeWallet() {
  const mounted = useMounted();
  const [walletInfo, setWalletInfo] = useState<WalletAvailability>({
    hasWallet: false,
    detectedWallets: [],
    primaryWallet: null
  });

  // Detect wallets after mount
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') {return;}

    const detectWallets = () => {
      const detected: string[] = [];
      
      try {
        // Check for Wallet Standard implementation (modern approach)
        const walletRegistry = (window as any).wallets || (window as any).getWallets;
        
        if (typeof walletRegistry === 'function') {
          const wallets = walletRegistry();
          if (wallets && wallets.get) {
            const availableWallets = wallets.get();
            availableWallets.forEach((wallet: any) => {
              if (wallet.name) {
                let walletName = wallet.name;
                if (walletName.toLowerCase().includes('sui wallet')) {
                  walletName = 'Slush Wallet';
                }
                detected.push(walletName as any);
              }
            });
          }
        }
        
        // Fallback: Manual detection for specific wallet injections
        if (detected?.length === 0) {
          // Check for Slush wallet (current official Sui wallet)
          if ((window as any).sui || (window as any).slush || (window as any).suiWallet) {
            detected.push('Slush Wallet');
          }
          
          // Check for other popular Sui ecosystem wallets
          if ((window as any).suiet || (window as any).SuietWallet) {
            detected.push('Suiet');
          }
          
          if ((window as any).martian || (window as any).MartianWallet) {
            detected.push('Martian');
          }
          
          if ((window as any).ethos || (window as any).EthosWallet) {
            detected.push('Ethos');
          }
          
          if ((window as any).glass || (window as any).GlassWallet) {
            detected.push('Glass');
          }
          
          if ((window as any).navi) {
            detected.push('Navi');
          }
          
          if ((window as any).surf) {
            detected.push('Surf');
          }
        }
        
        setWalletInfo({
          hasWallet: detected.length > 0,
          detectedWallets: detected,
          primaryWallet: detected[0] || null
        });
        
      } catch (error) {
        console.warn('[useSafeWallet] Failed to detect wallets:', error);
        // Keep defaults on error
      }
    };
    
    detectWallets();
    // Also check after delays as some wallets inject asynchronously
    const timeouts = [
      setTimeout(detectWallets, 500),
      setTimeout(detectWallets, 1000),
      setTimeout(detectWallets, 2000)
    ];
    
    return () => {
      timeouts.forEach(clearTimeout as any);
    };
  }, [mounted]);

  return {
    ...walletInfo,
    isLoaded: mounted
  };
}