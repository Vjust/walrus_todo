'use client';

import React, { ReactNode } from 'react';
import { 
  createNetworkConfig,
  SuiClientProvider, 
  WalletProvider,
} from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Network Configuration for Sui
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  devnet: { url: getFullnodeUrl('devnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

// Query client configuration for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry failed requests 3 times
      retry: 3,
      // Consider data stale after 30 seconds
      staleTime: 30000,
      // Keep cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Refetch on window focus
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

interface SuiWalletProviderProps {
  children: ReactNode;
  defaultNetwork?: 'testnet' | 'devnet' | 'mainnet';
  autoConnect?: boolean;
}

/**
 * SuiWalletProvider - A clean wrapper for Sui wallet integration using @mysten/dapp-kit
 * 
 * This provider sets up:
 * - React Query for data fetching and caching
 * - Sui Client for blockchain interaction
 * - Wallet Provider for wallet connections
 * 
 * Usage:
 * ```tsx
 * <SuiWalletProvider>
 *   <YourApp />
 * </SuiWalletProvider>
 * ```
 */
export function SuiWalletProvider({ 
  children, 
  defaultNetwork = 'testnet',
  autoConnect = true 
}: SuiWalletProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider 
        networks={networkConfig} 
        defaultNetwork={defaultNetwork}
      >
        <WalletProvider 
          autoConnect={autoConnect}
          // Storage key for remembering the last connected wallet
          storageKey="sui-wallet-kit"
        >
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

/**
 * Example of how to use the wallet hooks in your components:
 * 
 * ```tsx
 * import { useCurrentAccount, useConnectWallet, useDisconnectWallet } from '@mysten/dapp-kit';
 * 
 * function MyComponent() {
 *   const account = useCurrentAccount();
 *   const { mutate: connect } = useConnectWallet();
 *   const { mutate: disconnect } = useDisconnectWallet();
 *   
 *   return (
 *     <div>
 *       {account ? (
 *         <>
 *           <p>Connected: {account.address}</p>
 *           <button onClick={() => disconnect()}>Disconnect</button>
 *         </>
 *       ) : (
 *         <button onClick={() => connect()}>Connect Wallet</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */