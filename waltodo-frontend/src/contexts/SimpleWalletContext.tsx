'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Simple wallet interface that avoids complex dependencies
interface SimpleWalletContextValue {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  name: string | null;
  chainId: string | null;
  error: Error | null;
  setError: (error: Error | null) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: (network: string) => Promise<void>;
}

// Create context with default values
const SimpleWalletContext = createContext<SimpleWalletContextValue | null>(null);

// Mock wallet data for development
const MOCK_ADDRESS = '0x7a40eb2bb8dcf8abe508e3f0dc49bade2935bd8c';
const MOCK_WALLET_NAME = 'Development Wallet';

// Create a provider component
export function SimpleWalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>('testnet');
  const [error, setError] = useState<Error | null>(null);

  // Safe local storage access
  const getStorage = (key: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('Storage access failed:', e);
      return null;
    }
  };

  const setStorage = (key: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('Storage write failed:', e);
    }
  };

  // Auto-connect based on stored data
  useEffect(() => {
    const autoConnect = async () => {
      try {
        const savedState = getStorage('wallet_connected');
        if (savedState === 'true' && !connected && !connecting) {
          try {
            // Simulate connection process
            const savedAddress = getStorage('wallet_address');
            const savedName = getStorage('wallet_name');
            const savedChain = getStorage('wallet_chain');
            
            if (savedAddress) {
              setAddress(savedAddress);
              setName(savedName || MOCK_WALLET_NAME);
              setChainId(savedChain || 'testnet');
              setConnected(true);
            }
          } catch (e) {
            console.warn('Auto-connect failed:', e);
            // Clean up storage
            try {
              localStorage.removeItem('wallet_connected');
              localStorage.removeItem('wallet_address');
              localStorage.removeItem('wallet_name');
              localStorage.removeItem('wallet_chain');
            } catch (error) {
              // Ignore storage errors
            }
          }
        }
      } catch (error) {
        console.warn('Error during auto-connect check:', error);
      }
    };
    
    if (typeof window !== 'undefined') {
      autoConnect();
    }
  }, [connected, connecting]);

  // Connect function
  const connect = async (): Promise<void> => {
    if (connected) return;
    
    setConnecting(true);
    setError(null);
    
    try {
      // Simulate connecting to a wallet with a short delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Set connected state
      setAddress(MOCK_ADDRESS);
      setName(MOCK_WALLET_NAME);
      setChainId('testnet');
      setConnected(true);
      
      // Store connection state
      setStorage('wallet_connected', 'true');
      setStorage('wallet_address', MOCK_ADDRESS);
      setStorage('wallet_name', MOCK_WALLET_NAME);
      setStorage('wallet_chain', 'testnet');
      
      return Promise.resolve();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Connection failed');
      setError(error);
      console.error('Wallet connection error:', error);
      return Promise.reject(error);
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect function
  const disconnect = async (): Promise<void> => {
    if (!connected) return;
    
    setError(null);
    
    try {
      // Simulate disconnecting from wallet with a short delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Clear state
      setConnected(false);
      setAddress(null);
      setName(null);
      
      // Clear stored data
      try {
        localStorage.removeItem('wallet_connected');
        localStorage.removeItem('wallet_address');
        localStorage.removeItem('wallet_name');
        localStorage.removeItem('wallet_chain');
      } catch (e) {
        // Ignore storage errors
      }
      
      return Promise.resolve();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Disconnect failed');
      setError(error);
      console.error('Wallet disconnect error:', error);
      return Promise.reject(error);
    }
  };

  // Enhanced switch network function
  const switchNetwork = async (network: string): Promise<void> => {
    if (!connected) {
      const error = new Error('Not connected to any wallet');
      setError(error);
      return Promise.reject(error);
    }
    
    try {
      // Show switching UI
      setError(null);
      
      // Simulate network switching with a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Validate network value
      const validNetworks = ['mainnet', 'testnet', 'devnet'];
      if (!validNetworks.includes(network)) {
        throw new Error(`Invalid network: ${network}. Must be one of: ${validNetworks.join(', ')}`);
      }
      
      // Update chain ID
      setChainId(network);
      setStorage('wallet_chain', network);
      
      // Dispatch network change event for any listeners
      if (typeof window !== 'undefined') {
        const networkSwitchEvent = new CustomEvent('simpleWalletNetworkSwitch', { 
          detail: { network } 
        });
        window.dispatchEvent(networkSwitchEvent);
      }
      
      console.log(`Switched to ${network} network`);
      return Promise.resolve();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Network switch failed');
      setError(error);
      console.error('Network switch error:', error);
      return Promise.reject(error);
    }
  };

  // Create context value
  const contextValue: SimpleWalletContextValue = {
    connected,
    connecting,
    address,
    name,
    chainId,
    error,
    setError,
    connect,
    disconnect,
    switchNetwork,
  };

  return (
    <SimpleWalletContext.Provider value={contextValue}>
      {children}
    </SimpleWalletContext.Provider>
  );
}

// Custom hook to use wallet context
export function useWalletContext() {
  const context = useContext(SimpleWalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within SimpleWalletProvider');
  }
  return context;
}