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

export const ConnectModal = ({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) => {
  if (!open) return null;
  return (
    <div data-testid="connect-modal">
      <div>Connect Modal</div>
      <button onClick={() => onOpenChange?.(false)}>Close</button>
    </div>
  );
};

export const useConnectWallet = () => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn().mockResolvedValue({}),
  isLoading: false,
  isError: false,
  error: null,
});

export const useSignAndExecuteTransaction = () => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn().mockResolvedValue({
    digest: 'mock-digest',
    effects: {},
    objectChanges: [],
  }),
  isLoading: false,
  isError: false,
  error: null,
});

export const useWallets = () => ([
  {
    name: 'Mock Wallet',
    accounts: [],
    features: {},
    chains: [],
    version: '1.0.0',
    icon: 'data:image/svg+xml;base64,',
  },
]);