import React from 'react';

export const createNetworkConfig = () => ({
  networkConfig: {},
});

export const SuiClientProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export const ConnectButton = () => {
  return <button>Connect Wallet</button>;
};

export const useCurrentWallet = () => ({
  wallet: null,
  connectionStatus: 'disconnected',
  isConnecting: false,
  isConnected: false,
});

export const useDisconnectWallet = () => ({
  mutate: jest.fn(),
});

export const useCurrentAccount = () => ({
  account: null,
  currentAccount: null,
  isConnected: false,
});