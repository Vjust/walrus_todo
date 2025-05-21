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
// Import SolflareWalletAdapter conditionally with error handling
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

// Dynamically import Solflare wallet adapter to handle potential import failures
let SolflareWalletAdapter: any = null;
try {
  // Only attempt to load in client-side environment
  if (typeof window !== 'undefined') {
    SolflareWalletAdapter = require('@solana/wallet-adapter-solflare').SolflareWalletAdapter;
  }
} catch (err) {
  console.warn('Failed to load Solflare wallet adapter:', err);
}
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
import { WalletType, BackpackAccount } from '@/types/wallet';

interface WalletContextValue {
  // Common
  connected: boolean;
  connecting: boolean;
  disconnect: () => Promise<void>;
  publicKey: string | null;
  walletType: WalletType;
  error: Error | null;
  setError: (error: Error | null) => void;
  
  // Network
  currentNetwork: string | null;
  switchNetwork: (network: 'mainnet' | 'testnet' | 'devnet') => Promise<void>;
  isSwitchingNetwork: boolean;
  
  // Sui specific
  suiConnect: () => Promise<void>;
  suiAccount: any | null;
  
  // Phantom specific
  phantomConnect: () => Promise<void>;
  phantomPublicKey: PublicKey | null;
  
  // Slush specific
  slushConnect: () => Promise<void>;
  slushAccount: SlushAccount | null;
  
  // Backpack specific
  backpackConnect: () => Promise<void>;
  backpackAccount: BackpackAccount | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// Helper function to check if Backpack wallet is installed
function isBackpackWalletInstalled(): boolean {
  return typeof window !== 'undefined' && (
    !!window.xnft || 
    !!window.backpack || 
    !!(window.solana && window.solana.isBackpack)
  );
}

// Inner component to access both wallet contexts
function WalletContextInner({ children }: { children: ReactNode }) {
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [slushAccount, setSlushAccount] = useState<SlushAccount | null>(null);
  const [slushAdapter, setSlushAdapter] = useState<any | null>(null);
  const [backpackAccount, setBackpackAccount] = useState<BackpackAccount | null>(null);
  const [currentNetwork, setCurrentNetwork] = useState<string | null>('testnet'); // Default to testnet
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Track when component is mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
    if (typeof window !== 'undefined' && !slushAdapter && mounted) {
      try {
        // Removed StashedWalletAdapter initialization as it's no longer available
        // Consider using WalletProvider configuration for wallet integration
        console.log('Slush wallet adapter initialization skipped - needs new implementation');
      } catch (error) {
        console.error('Failed to initialize Slush wallet adapter:', error);
      }
    }
  }, [slushAdapter, mounted]);
  
  // Combined connected state
  const connected = 
    walletType === 'sui' ? !!suiAccount : 
    walletType === 'phantom' ? solanaConnected : 
    walletType === 'slush' ? !!slushAccount : 
    walletType === 'backpack' ? !!backpackAccount : 
    false;
  
  // Combined public key
  const publicKey = 
    walletType === 'sui' ? suiAccount?.address || null :
    walletType === 'phantom' ? solanaPublicKey?.toBase58() || null :
    walletType === 'slush' ? slushAccount?.address || null :
    walletType === 'backpack' ? backpackAccount?.address || null :
    null;

  // Auto-detect persisted connections
  useEffect(() => {
    // Only run this on the client side and only if no error present
    if (typeof window === 'undefined' || !mounted) return;
    
    if (!error) {
      if (suiConnected && walletType !== 'sui') setWalletType('sui');
      else if (solanaConnected && walletType !== 'phantom') setWalletType('phantom');
      else if (slushAccount && walletType !== 'slush') setWalletType('slush');
      else if (backpackAccount && walletType !== 'backpack') setWalletType('backpack');
    }
  }, [suiConnected, solanaConnected, slushAccount, backpackAccount, walletType, error, mounted]);

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
        if (!wallet) {
          const error = new WalletNotInstalledError('Slush');
          setError(error);
          return Promise.reject(error);
        }
        
        try {
          await connectWallet({ wallet });
          setWalletType('slush');
        } catch (connErr) {
          const walletError = categorizeWalletError(connErr);
          setError(walletError);
          console.error(`Slush wallet connection error:`, walletError);
          return Promise.reject(walletError);
        }
      } else if (type === 'backpack') {
        // Check if Backpack is available
        // Backpack uses the Solana wallet standard
        if (!isBackpackWalletInstalled()) {
          const error = new WalletNotInstalledError('Backpack');
          setError(error);
          return Promise.reject(error);
        }
        
        try {
          // Use Solana wallet adapter which should detect Backpack if it's using the wallet standard
          await solanaConnect();
          
          // Set backpack account if connection successful
          if (solanaPublicKey) {
            const address = solanaPublicKey.toBase58();
            setBackpackAccount({
              address,
              publicKey: solanaPublicKey,
              chains: ['solana']
            });
          }
          
          setWalletType('backpack');
        } catch (connErr) {
          const walletError = categorizeWalletError(connErr);
          setError(walletError);
          console.error(`Backpack wallet connection error:`, walletError);
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
  }, [connectWallet, solanaConnect, slushAdapter, wallet, solanaPublicKey]);

  // Wallet-specific connect methods with error pre-checks
  const suiConnect = useCallback(async () => {
    // Return early if not mounted to avoid SSR issues
    if (typeof window === 'undefined' || !mounted) {
      return Promise.reject(new Error('Cannot connect wallet during server rendering'));
    }
    
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
  }, [handleConnect, wallet, setError]);
  
  const phantomConnect = useCallback(async () => {
    // Return early if not mounted to avoid SSR issues
    if (typeof window === 'undefined' || !mounted) {
      return Promise.reject(new Error('Cannot connect wallet during server rendering'));
    }
    
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
  }, [solanaConnect, setError, setWalletType]);

  // Slush wallet connect method
  const slushConnect = useCallback(async () => {
    // Return early if not mounted to avoid SSR issues
    if (typeof window === 'undefined' || !mounted) {
      return Promise.reject(new Error('Cannot connect wallet during server rendering'));
    }
    
    try {
      // Check if Slush wallet is installed
      // We'll use the Sui wallet kit's connectWallet function which should handle Slush
      // The Slush wallet is the official Sui wallet
      if (!wallet) {
        const error = new WalletNotInstalledError('Slush');
        setError(error);
        return Promise.reject(error);
      }
      
      try {
        // Use the Sui wallet kit's connect method which will work with Slush
        await connectWallet({ wallet });
        setWalletType('slush');
        return Promise.resolve();
      } catch (err) {
        const walletError = categorizeWalletError(err);
        setError(walletError);
        console.error('Slush wallet connection error:', walletError);
        return Promise.reject(walletError);
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
  }, [connectWallet, wallet, setError, setWalletType]);
  
  // Backpack wallet connect method
  const backpackConnect = useCallback(async () => {
    // Return early if not mounted to avoid SSR issues
    if (typeof window === 'undefined' || !mounted) {
      return Promise.reject(new Error('Cannot connect wallet during server rendering'));
    }
    
    try {
      // Check if Backpack wallet is installed
      // Backpack now uses the Solana wallet adapter standard
      // Check for Backpack's specific extensions
      if (!isBackpackWalletInstalled()) {
        const error = new WalletNotInstalledError('Backpack');
        setError(error);
        return Promise.reject(error);
      }
      
      try {
        // Use Solana wallet adapter to connect to Backpack
        await solanaConnect();
        
        // Set backpack account if connection successful
        if (solanaPublicKey) {
          const address = solanaPublicKey.toBase58();
          setBackpackAccount({
            address,
            publicKey: solanaPublicKey,
            chains: ['solana']
          });
          setWalletType('backpack');
        } else {
          throw new Error('Failed to get Backpack public key after connection');
        }
        
        return Promise.resolve();
      } catch (err) {
        const walletError = categorizeWalletError(err);
        setError(walletError);
        console.error('Backpack wallet connection error:', walletError);
        return Promise.reject(walletError);
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
  }, [solanaConnect, solanaPublicKey, setError, setBackpackAccount, setWalletType]);

  // Universal disconnect
  const disconnect = useCallback(async () => {
    setError(null);
    
    // Return early if not mounted to avoid SSR issues
    if (typeof window === 'undefined' || !mounted) {
      return Promise.reject(new Error('Cannot disconnect wallet during server rendering'));
    }
    
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
        // Slush wallet disconnection is handled automatically by the Sui wallet kit
        // We just need to clear our local state
        setSlushAccount(null);
      } else if (walletType === 'backpack') {
        // Disconnect from Backpack using Solana wallet adapter
        try {
          await solanaDisconnect();
        } catch (discErr) {
          console.error('Error disconnecting Backpack wallet:', discErr);
          // We'll still clear the wallet type even if disconnect fails
        }
        // Clear local state
        setBackpackAccount(null);
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
  }, [walletType, solanaDisconnect, setWalletType, setSlushAccount, setBackpackAccount, setError]);

  // Enhanced network switching functionality
  const switchNetwork = useCallback(async (network: 'mainnet' | 'testnet' | 'devnet') => {
    // Return early if not mounted to avoid SSR issues
    if (typeof window === 'undefined' || !mounted) {
      return Promise.reject(new Error('Cannot switch networks during server rendering'));
    }
    
    if (!connected) {
      const err = new WalletError('Not connected to any wallet');
      setError(err);
      throw err;
    }
    
    setIsSwitchingNetwork(true);
    setError(null);
    
    try {
      // Handle network switching based on wallet type
      if (walletType === 'sui') {
        // Sui wallet switching
        try {
          // For dapp-kit, we need to use the SuiClientProvider's network state
          // We'll dispatch a custom event to notify any listeners
          if (typeof window !== 'undefined') {
            const networkSwitchEvent = new CustomEvent('suiNetworkSwitch', { 
              detail: { network } 
            });
            window.dispatchEvent(networkSwitchEvent);
          }
          
          // Update local state
          setCurrentNetwork(network);
        } catch (err) {
          console.error('Error during Sui wallet network switch:', err);
          const walletError = categorizeWalletError(err);
          setError(walletError);
          throw walletError;
        }
      } 
      else if (walletType === 'phantom' || walletType === 'backpack') {
        // Phantom/Backpack wallet network switching
        try {
          // Convert network name to Solana cluster name
          const clusterName = network === 'mainnet' ? 'mainnet-beta' : 
                             network === 'testnet' ? 'testnet' : 'devnet';
          
          // Dispatch event for Solana connection provider
          if (typeof window !== 'undefined') {
            const networkSwitchEvent = new CustomEvent('solanaNetworkSwitch', { 
              detail: { network: clusterName } 
            });
            window.dispatchEvent(networkSwitchEvent);
          }
          
          // Update local state
          setCurrentNetwork(network);
          
          // If Backpack wallet, update the account with the new network
          if (walletType === 'backpack' && backpackAccount) {
            setBackpackAccount({
              ...backpackAccount,
              network: network
            });
          }
        } catch (err) {
          console.error(`Error during ${walletType} wallet network switch:`, err);
          const walletError = categorizeWalletError(err);
          setError(walletError);
          throw walletError;
        }
      }
      else if (walletType === 'slush') {
        // Slush wallet network switching (similar to Sui)
        try {
          // Dispatch a custom event
          if (typeof window !== 'undefined') {
            const networkSwitchEvent = new CustomEvent('slushNetworkSwitch', { 
              detail: { network } 
            });
            window.dispatchEvent(networkSwitchEvent);
          }
          
          // Update local state
          setCurrentNetwork(network);
        } catch (err) {
          console.error('Error during Slush wallet network switch:', err);
          const walletError = categorizeWalletError(err);
          setError(walletError);
          throw walletError;
        }
      }
      else {
        throw new Error(`Network switching not supported for wallet type: ${walletType}`);
      }
      
      return Promise.resolve();
    } catch (err) {
      const walletError = categorizeWalletError(err);
      setError(walletError);
      console.error(`Network switch error:`, walletError);
      throw walletError;
    } finally {
      setIsSwitchingNetwork(false);
    }
  }, [connected, walletType, backpackAccount, setBackpackAccount, setError]);

  const contextValue = useMemo<WalletContextValue>(() => ({
    connected,
    connecting,
    disconnect,
    publicKey,
    walletType,
    error,
    setError,
    
    // Network
    currentNetwork,
    switchNetwork,
    isSwitchingNetwork,
    
    suiConnect,
    suiAccount,
    phantomConnect,
    phantomPublicKey: solanaPublicKey,
    slushConnect,
    slushAccount,
    backpackConnect,
    backpackAccount,
  }), [
    connected, 
    connecting, 
    disconnect,
    publicKey, 
    walletType,
    error,
    setError,
    
    // Network
    currentNetwork,
    switchNetwork,
    isSwitchingNetwork,
    
    suiConnect,
    suiAccount, 
    phantomConnect,
    solanaPublicKey,
    slushConnect,
    slushAccount,
    backpackConnect,
    backpackAccount
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

  // State for network configuration
  const [solanaEndpoint, setSolanaEndpoint] = useState(clusterApiUrl('devnet'));
  
  // Event listeners for network switching
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Setup network switching event listeners
    const handleSolanaNetworkSwitch = (event: any) => {
      const network = event.detail?.network;
      if (network) {
        // Update Solana connection
        const newEndpoint = 
          network === 'mainnet-beta' ? clusterApiUrl('mainnet-beta') :
          network === 'testnet' ? clusterApiUrl('testnet') :
          clusterApiUrl('devnet');
        
        setSolanaEndpoint(newEndpoint);
      }
    };
    
    // Add event listeners
    window.addEventListener('solanaNetworkSwitch', handleSolanaNetworkSwitch);
    
    // Clean up
    return () => {
      window.removeEventListener('solanaNetworkSwitch', handleSolanaNetworkSwitch);
    };
  }, []);

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  }));
  
  // Create the wallet adapters with error prevention
  const [solanaWallets] = useState(() => {
    try {
      const network = WalletAdapterNetwork.Devnet;
      
      // Create a list of wallet adapters directly
      const adapters = [];
      
      // Add Phantom adapter if available
      try {
        if (typeof window !== 'undefined' && window.solana?.isPhantom) {
          adapters.push(new PhantomWalletAdapter());
        }
      } catch (err) {
        console.error('Error creating PhantomWalletAdapter:', err);
      }
      
      // Add Solflare adapter if available
      try {
        if (SolflareWalletAdapter) {
          adapters.push(new SolflareWalletAdapter({ network }));
        } else {
          console.warn('SolflareWalletAdapter is not available. Skipping Solflare wallet integration.');
        }
      } catch (err) {
        console.error('Error creating SolflareWalletAdapter:', err);
      }
      
      // Add Backpack adapter via Solana adapter if available
      // Backpack should be detected automatically through the Solana wallet adapter
      // if it's implementing the Solana wallet standard
      try {
        if (isBackpackWalletInstalled()) {
          console.log('Backpack detected, it should be available through Solana adapters');
          // Note: We don't need to explicitly add an adapter as Backpack
          // implements the Solana wallet standard and should be detected automatically
        }
      } catch (err) {
        console.error('Error checking for Backpack wallet:', err);
      }
      
      return adapters;
    } catch (error) {
      console.error('Error creating wallet adapters:', error);
      return [];
    }
  });
  
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <SuiWalletProvider>
          <ConnectionProvider endpoint={solanaEndpoint}>
            <SolanaWalletProvider wallets={solanaWallets} autoConnect={false}>
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