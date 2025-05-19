'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { 
  createNetworkConfig, 
  SuiClientProvider, 
  WalletProvider as SuiWalletProvider,
  useCurrentAccount,
  useConnectWallet,
  useWallets
} from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useConnection,
  useWallet as useSolanaWallet
} from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { 
  WalletError,
  WalletNotSelectedError,
  WalletNotInstalledError,
  categorizeWalletError 
} from './wallet-errors';

// Configure networks for Sui
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

// Define wallet types
type WalletType = 'sui' | 'phantom' | null;

interface WalletContextValue {
  // Common
  connected: boolean;
  connecting: boolean;
  disconnect: () => Promise<void>;
  publicKey: string | null;
  walletType: WalletType;
  error: Error | null;
  
  // Sui specific
  suiConnect: () => Promise<void>;
  suiAccount: any | null;
  
  // Phantom specific
  phantomConnect: () => Promise<void>;
  phantomPublicKey: PublicKey | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// Inner component to access both wallet contexts
function WalletContextInner({ children }: { children: ReactNode }) {
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Sui wallet hooks
  const suiAccount = useCurrentAccount();
  const { mutate: connectWallet } = useConnectWallet();
  const wallets = useWallets();
  
  // Get the first wallet (you might want to let users choose)
  const wallet = wallets[0];
  const suiConnected = !!suiAccount;

  // Solana wallet hooks  
  const { connect: solanaConnect, disconnect: solanaDisconnect, connected: solanaConnected, publicKey: solanaPublicKey } = useSolanaWallet();
  
  // Combined connected state
  const connected = walletType === 'sui' ? !!suiAccount : walletType === 'phantom' ? solanaConnected : false;
  
  // Combined public key
  const publicKey = walletType === 'sui' 
    ? suiAccount?.address || null
    : walletType === 'phantom' 
    ? solanaPublicKey?.toBase58() || null
    : null;

  // Auto-detect persisted connections
  useEffect(() => {
    // Only auto-detect if no error present
    if (!error) {
      if (suiConnected && walletType !== 'sui') setWalletType('sui');
      else if (solanaConnected && walletType !== 'phantom') setWalletType('phantom');
    }
  }, [suiConnected, solanaConnected, walletType, error]);

  // Consolidated connect logic with enhanced error handling
  const handleConnect = useCallback(async (type: WalletType) => {
    if (!type) {
      const error = new WalletNotSelectedError();
      setError(error);
      throw error;
    }
    
    setConnecting(true);
    setError(null);
    
    try {
      // Check for specific wallet type
      if (type === 'sui') {
        if (!wallet) {
          throw new WalletNotInstalledError('Sui');
        }
        await connectWallet({ wallet });
      } else if (type === 'phantom') {
        if (typeof window === 'undefined' || !window.solana?.isPhantom) {
          throw new WalletNotInstalledError('Phantom');
        }
        await solanaConnect();
      }
      
      setWalletType(type);
    } catch (error) {
      // Categorize and standardize wallet errors
      const walletError = categorizeWalletError(error);
      setError(walletError);
      console.error(`${type} wallet connection error:`, walletError);
      throw walletError;
    } finally {
      setConnecting(false);
    }
  }, [connectWallet, solanaConnect, wallet]);

  // Wallet-specific connect methods with error pre-checks
  const suiConnect = useCallback(async () => {
    try {
      // Check wallet availability first to provide better UX
      if (!wallet) {
        const error = new WalletNotInstalledError('Sui');
        setError(error);
        return Promise.reject(error);
      }
      
      return await handleConnect('sui');
    } catch (error) {
      // This catch ensures errors are properly categorized
      const walletError = categorizeWalletError(error);
      // If this is a WalletNotSelectedError, provide more context
      if (walletError instanceof WalletNotSelectedError) {
        const betterError = new WalletNotSelectedError();
        setError(betterError);
        return Promise.reject(betterError);
      }
      
      return Promise.reject(walletError);
    }
  }, [handleConnect, wallet]);
  
  const phantomConnect = useCallback(async () => {
    try {
      // Check wallet availability first to provide better UX
      if (typeof window === 'undefined' || !window.solana?.isPhantom) {
        const error = new WalletNotInstalledError('Phantom');
        setError(error);
        return Promise.reject(error);
      }
      
      return await handleConnect('phantom');
    } catch (error) {
      // Special handling for WalletNotSelectedError
      const walletError = categorizeWalletError(error);
      // If error is a selection error, provide more context
      if (walletError instanceof WalletNotSelectedError) {
        const betterError = new WalletNotSelectedError();
        setError(betterError);
        return Promise.reject(betterError);
      }
      
      return Promise.reject(walletError);
    }
  }, [handleConnect]);

  // Universal disconnect
  const disconnect = useCallback(async () => {
    setError(null);
    
    try {
      if (walletType === 'sui') {
        // Sui dapp-kit handles disconnection automatically
        // We just need to clear our state
      } else if (walletType === 'phantom') {
        await solanaDisconnect();
      }
      setWalletType(null);
    } catch (error) {
      const walletError = error instanceof Error ? error : new Error('Wallet disconnect failed');
      setError(walletError);
      console.error('Wallet disconnect error:', error);
      throw walletError;
    }
  }, [walletType, solanaDisconnect]);

  const contextValue = useMemo<WalletContextValue>(() => ({
    connected,
    connecting,
    disconnect,
    publicKey,
    walletType,
    error,
    suiConnect,
    suiAccount,
    phantomConnect,
    phantomPublicKey: solanaPublicKey,
  }), [
    connected, 
    connecting, 
    disconnect,
    publicKey, 
    walletType,
    error,
    suiConnect,
    suiAccount, 
    phantomConnect,
    solanaPublicKey
  ]);

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

// Main context provider
export function WalletContextProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  }));
  
  // Only create the Phantom adapter if it's not already registered
  // This prevents the "Phantom was registered as a Standard Wallet" warning
  const [phantomAdapter] = useState(() => {
    // Check if Phantom is already registered or not available
    if (typeof window === 'undefined' || !window.solana?.isPhantom) {
      // Create an adapter but don't initialize it to avoid registration conflicts
      return null;
    }
    
    // Only create adapter when Phantom is available and not already initialized
    return new PhantomWalletAdapter();
  });
  
  const solanaEndpoint = clusterApiUrl('devnet');
  
  // Create a safe wallets array that won't cause duplicate registrations
  const wallets = phantomAdapter ? [phantomAdapter] : [];

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <SuiWalletProvider>
          <ConnectionProvider endpoint={solanaEndpoint}>
            <SolanaWalletProvider wallets={wallets} autoConnect={false}>
              <WalletContextInner>
                {children}
              </WalletContextInner>
            </SolanaWalletProvider>
          </ConnectionProvider>
        </SuiWalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

// Hook to use wallet context
export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within WalletContextProvider');
  }
  return context;
}

// Export types
export type { WalletType, WalletContextValue };