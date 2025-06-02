'use client';

import React, { ReactNode } from 'react';
import { 
  createNetworkConfig,
  SuiClientProvider, 
  WalletProvider,
} from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getEffectiveNetworkConfig, type NetworkName } from '@/config';
import { LoadingFallback } from '@/components/LoadingFallback';

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
  defaultNetwork?: NetworkName;
  autoConnect?: boolean;
  enableNetworkSwitching?: boolean;
  enableSlushWallet?: boolean;
}

// Get current network configuration with enhanced settings
function getCurrentNetworkSettings() {
  try {
    const config = getEffectiveNetworkConfig();
    return {
      slushWallet: config.slushWallet,
      connectivity: config.connectivity,
      networkSwitching: config.networkSwitching,
    };
  } catch (error) {
    console.warn('Failed to load network configuration, using defaults:', error);
    return {
      slushWallet: {
        enabled: true,
        autoConnect: true,
        networkSwitchingEnabled: true,
        features: ['transaction_signing', 'account_management', 'network_switching'],
        supportedNetworks: ['testnet', 'devnet'],
      },
      connectivity: {
        timeout: 10000,
        retryAttempts: 3,
      },
      networkSwitching: {
        enabled: true,
      },
    };
  }
}

/**
 * SuiWalletProvider - Enhanced wrapper for Sui wallet integration using @mysten/dapp-kit
 * 
 * This provider sets up:
 * - React Query for data fetching and caching
 * - Sui Client for blockchain interaction
 * - Enhanced Wallet Provider with Slush wallet prioritization
 * - Wallet filtering for supported Sui wallets only
 * - Preferred wallet ordering with Slush wallet first
 * 
 * Features:
 * - Automatic Slush wallet detection and prioritization
 * - Enhanced slushWallet configuration with features and icon
 * - Filtered wallet list showing only Sui-compatible wallets
 * - Optimized query client settings for better performance
 * 
 * Usage:
 * ```tsx
 * <SuiWalletProvider defaultNetwork="testnet" autoConnect={true}>
 *   <YourApp />
 * </SuiWalletProvider>
 * ```
 */
export function SuiWalletProvider({ 
  children, 
  defaultNetwork = 'testnet',
  autoConnect = true,
  enableNetworkSwitching = true,
  enableSlushWallet = true,
}: SuiWalletProviderProps) {
  const [mounted, setMounted] = React.useState(false);
  const networkSettings = getCurrentNetworkSettings();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render wallet provider during SSR to prevent hydration issues
  if (!mounted) {
    return <LoadingFallback message="Initializing wallet..." size="md" fullScreen />;
  }

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
          // Preferred wallets - prioritize Slush wallet
          preferredWallets={['Slush Wallet']}
          // Enhanced Slush wallet configuration - temporarily disabled due to type compatibility
          // TODO: Re-enable when SlushWalletConfig interface is properly defined
          // Filter to show only supported Sui wallets
          walletFilter={(wallet) => {
            const supportedWallets = [
              'Slush Wallet', 
              'Sui Wallet', 
              'Martian', 
              'Suiet', 
              'Ethos',
              'Glass'
            ];
            return supportedWallets.some(supported => 
              wallet.name.toLowerCase().includes(supported.toLowerCase())
            );
          }}
        >
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

/**
 * Enhanced examples with current dapp-kit hooks and Slush wallet support:
 * 
 * ```tsx
 * import { 
 *   useCurrentAccount, 
 *   useConnectWallet, 
 *   useDisconnectWallet,
 *   useCurrentWallet,
 *   useSuiClient
 * } from '@mysten/dapp-kit';
 * 
 * function WalletComponent() {
 *   const account = useCurrentAccount();
 *   const currentWallet = useCurrentWallet();
 *   const suiClient = useSuiClient();
 *   const { mutate: connect } = useConnectWallet();
 *   const { mutate: disconnect } = useDisconnectWallet();
 *   
 *   // Connect specifically to Slush wallet
 *   const handleSlushConnect = () => {
 *     connect({ walletName: 'Slush Wallet' });
 *   };
 *   
 *   return (
 *     <div>
 *       {account ? (
 *         <div>
 *           <p>Connected with: {currentWallet?.name}</p>
 *           <p>Address: {account.address}</p>
 *           <p>Network: {suiClient.getNetwork()}</p>
 *           <button onClick={() => disconnect()}>Disconnect</button>
 *         </div>
 *       ) : (
 *         <div>
 *           <button onClick={() => connect()}>Connect Any Wallet</button>
 *           <button onClick={handleSlushConnect}>Connect Slush Wallet</button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * 
 * // Network switching example with proper error handling
 * function NetworkSwitcher() {
 *   const suiClient = useSuiClient();
 *   const currentWallet = useCurrentWallet();
 *   
 *   const handleNetworkSwitch = async (network: string) => {
 *     try {
 *       if (currentWallet?.features?.includes('sui:switchNetwork')) {
 *         // Use wallet's network switching if supported
 *         await currentWallet.features['sui:switchNetwork']({ network });
 *       } else {
 *         console.warn('Network switching not supported by current wallet');
 *       }
 *     } catch (error) {
 *       console.error('Failed to switch network:', error);
 *     }
 *   };
 *   
 *   return (
 *     <select onChange={(e) => handleNetworkSwitch(e.target.value)}>
 *       <option value="testnet">Testnet</option>
 *       <option value="devnet">Devnet</option>
 *       <option value="mainnet">Mainnet</option>
 *     </select>
 *   );
 * }
 * ```
 */