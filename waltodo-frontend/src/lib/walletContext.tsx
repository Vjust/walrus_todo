'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { 
  createNetworkConfig, 
  SuiClientProvider, 
  WalletProvider as SuiWalletProvider,
  useCurrentAccount,
  useConnectWallet,
  useWallets,
  StashedWalletAdapter
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
import { SlushAccount } from '@/types/wallet';

// Configure networks for Sui
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

// Import WalletType from types/wallet.ts
import { WalletType } from '@/types/wallet';

interface WalletContextValue {
  // Common
  connected: boolean;
  connecting: boolean;
  disconnect: () => Promise<void>;
  publicKey: string | null;
  walletType: WalletType;
  error: Error | null;
  setError: (error: Error | null) => void;
  
  // Sui specific
  suiConnect: () => Promise<void>;
  suiAccount: any | null;
  
  // Phantom specific
  phantomConnect: () => Promise<void>;
  phantomPublicKey: PublicKey | null;
  
  // Slush specific
  slushConnect: () => Promise<void>;
  slushAccount: SlushAccount | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// Inner component to access both wallet contexts
function WalletContextInner({ children }: { children: ReactNode }) {
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [slushAccount, setSlushAccount] = useState<SlushAccount | null>(null);
  const [slushAdapter, setSlushAdapter] = useState<StashedWalletAdapter | null>(null);

  // Sui wallet hooks
  const suiAccount = useCurrentAccount();
  const { mutate: connectWallet } = useConnectWallet();
  const wallets = useWallets();
  
  // Get the first wallet (you might want to let users choose)
  const wallet = wallets[0];
  const suiConnected = !!suiAccount;

  // Solana wallet hooks  
  const { connect: solanaConnect, disconnect: solanaDisconnect, connected: solanaConnected, publicKey: solanaPublicKey } = useSolanaWallet();
  
  // Initialize Slush adapter if needed
  useEffect(() => {
    if (typeof window !== 'undefined' && !slushAdapter) {
      try {
        setSlushAdapter(new StashedWalletAdapter());
      } catch (error) {
        console.error('Failed to initialize Slush wallet adapter:', error);
      }
    }
  }, [slushAdapter]);
  
  // Combined connected state
  const connected = 
    walletType === 'sui' ? !!suiAccount : 
    walletType === 'phantom' ? solanaConnected : 
    walletType === 'slush' ? !!slushAccount : 
    false;
  
  // Combined public key
  const publicKey = 
    walletType === 'sui' ? suiAccount?.address || null :
    walletType === 'phantom' ? solanaPublicKey?.toBase58() || null :
    walletType === 'slush' ? slushAccount?.address || null :
    null;

  // Auto-detect persisted connections
  useEffect(() => {
    // Only auto-detect if no error present
    if (!error) {
      if (suiConnected && walletType !== 'sui') setWalletType('sui');
      else if (solanaConnected && walletType !== 'phantom') setWalletType('phantom');
      else if (slushAccount && walletType !== 'slush') setWalletType('slush');
    }
  }, [suiConnected, solanaConnected, slushAccount, walletType, error]);

  // Consolidated connect logic with enhanced error handling
  const handleConnect = useCallback(async (type: WalletType) => {
    if (!type) {
      const error = new WalletNotSelectedError();
      setError(error);
      return Promise.reject(error);
    }
    
    setConnecting(true);
    setError(null);
    
    try {
      // Check for specific wallet type
      if (type === 'sui') {
        if (!wallet) {
          const error = new WalletNotInstalledError('Sui');
          setError(error);
          return Promise.reject(error);
        }
        
        try {
          await connectWallet({ wallet });
        } catch (connErr) {
          const walletError = categorizeWalletError(connErr);
          setError(walletError);
          console.error(`Sui wallet connection error:`, walletError);
          return Promise.reject(walletError);
        }
      } else if (type === 'phantom') {
        if (typeof window === 'undefined' || !window.solana?.isPhantom) {
          const error = new WalletNotInstalledError('Phantom');
          setError(error);
          return Promise.reject(error);
        }
        
        try {
          await solanaConnect();
        } catch (connErr) {
          const walletError = categorizeWalletError(connErr);
          setError(walletError);
          console.error(`Phantom wallet connection error:`, walletError);
          return Promise.reject(walletError);
        }
      } else if (type === 'slush') {
        if (!slushAdapter) {
          const error = new WalletNotInstalledError('Slush');
          setError(error);
          return Promise.reject(error);
        }
        
        try {
          const account = await slushAdapter.connect();
          setSlushAccount(account as SlushAccount);
        } catch (connErr) {
          const walletError = categorizeWalletError(connErr);
          setError(walletError);
          console.error(`Slush wallet connection error:`, walletError);
          return Promise.reject(walletError);
        }
      }
      
      setWalletType(type);
      return Promise.resolve();
    } catch (error) {
      // Categorize and standardize wallet errors
      const walletError = categorizeWalletError(error);
      setError(walletError);
      console.error(`${type} wallet connection error:`, walletError);
      return Promise.reject(walletError);
    } finally {
      setConnecting(false);
    }
  }, [connectWallet, solanaConnect, slushAdapter, wallet]);

  // Wallet-specific connect methods with error pre-checks
  const suiConnect = useCallback(async () => {
    try {
      // Check wallet availability first to provide better UX
      if (!wallet) {
        const error = new WalletNotInstalledError('Sui');
        setError(error);
        return Promise.reject(error);
      }
      
      try {
        return await handleConnect('sui');
      } catch (err) {
        // handleConnect already handles errors, this just ensures we don't throw
        return Promise.reject(err);
      }
    } catch (error) {
      // This catch ensures errors are properly categorized
      const walletError = categorizeWalletError(error);
      // If this is a WalletNotSelectedError, provide more context
      if (walletError instanceof WalletNotSelectedError) {
        const betterError = new WalletNotSelectedError();
        setError(betterError);
        return Promise.reject(betterError);
      }
      
      // Always return a rejection rather than letting it propagate
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
      
      // Direct implementation using solanaConnect instead of handleConnect for Phantom
      try {
        await solanaConnect();
        setWalletType('phantom');
        return Promise.resolve();
      } catch (connErr) {
        const walletError = categorizeWalletError(connErr);
        setError(walletError);
        console.error(`Phantom wallet connection error:`, walletError);
        return Promise.reject(walletError);
      }
    } catch (error) {
      // Special handling for WalletNotSelectedError
      const walletError = categorizeWalletError(error);
      // If error is a selection error, provide more context
      if (walletError instanceof WalletNotSelectedError) {
        const betterError = new WalletNotSelectedError();
        setError(betterError);
        return Promise.reject(betterError);
      }
      
      // Always return a rejection rather than letting it propagate
      return Promise.reject(walletError);
    }
  }, [solanaConnect, setError]);

  // Slush wallet connect method
  const slushConnect = useCallback(async () => {
    try {
      // Check wallet availability first
      if (!slushAdapter) {
        const error = new WalletNotInstalledError('Slush');
        setError(error);
        return Promise.reject(error);
      }
      
      try {
        return await handleConnect('slush');
      } catch (err) {
        // handleConnect already handles errors, this just ensures we don't throw
        return Promise.reject(err);
      }
    } catch (error) {
      // Special handling for WalletNotSelectedError
      const walletError = categorizeWalletError(error);
      if (walletError instanceof WalletNotSelectedError) {
        const betterError = new WalletNotSelectedError();
        setError(betterError);
        return Promise.reject(betterError);
      }
      
      // Always return a rejection rather than letting it propagate
      return Promise.reject(walletError);
    }
  }, [handleConnect, slushAdapter]);

  // Universal disconnect
  const disconnect = useCallback(async () => {
    setError(null);
    
    try {
      if (walletType === 'sui') {
        // Sui dapp-kit handles disconnection automatically
        // We just need to clear our state
      } else if (walletType === 'phantom') {
        try {
          await solanaDisconnect();
        } catch (discErr) {
          console.error('Error disconnecting Phantom wallet:', discErr);
          // We'll still clear the wallet type even if disconnect fails
        }
      } else if (walletType === 'slush') {
        try {
          if (slushAdapter) {
            await slushAdapter.disconnect();
          }
          setSlushAccount(null);
        } catch (discErr) {
          console.error('Error disconnecting Slush wallet:', discErr);
          // We'll still clear the wallet type even if disconnect fails
        }
      }
      setWalletType(null);
      return Promise.resolve();
    } catch (error) {
      const walletError = error instanceof Error ? error : new Error('Wallet disconnect failed');
      setError(walletError);
      console.error('Wallet disconnect error:', error);
      // Return rejection instead of throwing directly
      return Promise.reject(walletError);
    }
  }, [walletType, solanaDisconnect, slushAdapter]);

  const contextValue = useMemo<WalletContextValue>(() => ({
    connected,
    connecting,
    disconnect,
    publicKey,
    walletType,
    error,
    setError,
    suiConnect,
    suiAccount,
    phantomConnect,
    phantomPublicKey: solanaPublicKey,
    slushConnect,
    slushAccount,
  }), [
    connected, 
    connecting, 
    disconnect,
    publicKey, 
    walletType,
    error,
    setError,
    suiConnect,
    suiAccount, 
    phantomConnect,
    solanaPublicKey,
    slushConnect,
    slushAccount
  ]);

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

// Main context provider
// Global error handler for unhandled promise rejections
const setupGlobalErrorHandlers = () => {
  if (typeof window !== 'undefined') {
    // This will help us debug unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('UNHANDLED PROMISE REJECTION:', event.reason);
      
      // Prevent the default browser handling of the error
      event.preventDefault();
    });
  }
};

export function WalletContextProvider({ children }: { children: ReactNode }) {
  // Set up global error handlers when the context mounts
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  }));
  
  // Create the Phantom adapter with error prevention
  const [phantomAdapter] = useState(() => {
    try {
      // Check if Phantom is already registered or not available
      if (typeof window === 'undefined' || !window.solana?.isPhantom) {
        // Skip adapter creation if Phantom isn't available
        return null;
      }
      
      // Create the adapter with error handling
      return new PhantomWalletAdapter();
    } catch (error) {
      console.error('Error creating PhantomWalletAdapter:', error);
      return null;
    }
  });
  
  const solanaEndpoint = clusterApiUrl('devnet');
  
  // Create a safe wallets array that won't cause duplicate registrations
  // Always provide an array, even if empty, to avoid errors
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