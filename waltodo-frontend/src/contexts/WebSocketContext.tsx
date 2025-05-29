'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { websocketManager, useWebSocket } from '../lib/websocket';
import { useClientSafeWallet } from '../hooks/useClientSafeWallet';

interface WebSocketContextValue {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  joinWallet: (wallet: string) => void;
  leaveWallet: (wallet: string) => void;
  socketId?: string;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected: walletConnected } = useClientSafeWallet();
  const { connect, disconnect, joinWallet, leaveWallet, connected, socketId } = useWebSocket();
  const [isConnected, setIsConnected] = useState(false);
  const currentWalletRef = useRef<string | null>(null);
  const hasConnectedRef = useRef(false);

  // Track connection state
  useEffect(() => {
    const checkConnection = setInterval(() => {
      setIsConnected(websocketManager.connected);
    }, 1000);

    return () => clearInterval(checkConnection);
  }, []);

  // Connect WebSocket when component mounts
  useEffect(() => {
    if (!hasConnectedRef.current) {
      console.log('📡 Initializing WebSocket connection...');
      connect();
      hasConnectedRef.current = true;
    }

    return () => {
      if (hasConnectedRef.current) {
        console.log('📡 Cleaning up WebSocket connection...');
        disconnect();
        hasConnectedRef.current = false;
      }
    };
  }, [connect, disconnect]);

  // Auto-join wallet room when wallet connects
  useEffect(() => {
    if (walletConnected && address && connected) {
      // Leave previous wallet if different
      if (currentWalletRef.current && currentWalletRef.current !== address) {
        console.log('🔄 Switching wallet rooms...');
        leaveWallet(currentWalletRef.current);
      }

      // Join new wallet room
      if (currentWalletRef.current !== address) {
        console.log('🏠 Joining wallet room:', address);
        joinWallet(address);
        currentWalletRef.current = address;
      }
    } else if (!walletConnected && currentWalletRef.current) {
      // Leave wallet room when wallet disconnects
      console.log('🚪 Leaving wallet room due to wallet disconnect');
      leaveWallet(currentWalletRef.current);
      currentWalletRef.current = null;
    }
  }, [walletConnected, address, connected, joinWallet, leaveWallet]);

  const contextValue: WebSocketContextValue = {
    isConnected,
    connect,
    disconnect,
    joinWallet: useCallback((wallet: string) => {
      if (currentWalletRef.current !== wallet) {
        if (currentWalletRef.current) {
          leaveWallet(currentWalletRef.current);
        }
        joinWallet(wallet);
        currentWalletRef.current = wallet;
      }
    }, [joinWallet, leaveWallet]),
    leaveWallet: useCallback((wallet: string) => {
      leaveWallet(wallet);
      if (currentWalletRef.current === wallet) {
        currentWalletRef.current = null;
      }
    }, [leaveWallet]),
    socketId,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}

// Hook to display WebSocket status
export function useWebSocketStatus() {
  const { isConnected, socketId } = useWebSocketContext();
  
  return {
    isConnected,
    socketId,
    statusText: isConnected ? 'Connected' : 'Disconnected',
    statusColor: isConnected ? 'text-green-500' : 'text-red-500',
  };
}