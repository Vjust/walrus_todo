# Wallet Integration Documentation

## Overview

The WalTodo frontend supports wallet integration for **Sui**, **Phantom**, and **Slush** (formerly Stashed) wallets, enabling users to connect their Web3 wallets and interact with the blockchain features of the application.

## Architecture

### 1. WalletContext (`src/lib/walletContext.tsx`)

The core of our wallet integration, providing a unified interface for both Sui and Solana wallets.

**Key Features:**
- Multi-wallet support (Sui, Phantom, and Slush)
- Unified API for different wallet types
- Automatic connection persistence
- Error handling and state management
- Provider hierarchy setup
- Flexible adapter pattern for wallet integrations

**Main Components:**
- `WalletContextProvider`: Wraps the app with necessary providers
- `WalletContextInner`: Manages wallet state and connection logic
- `useWalletContext`: Hook for accessing wallet functionality

**Context Value Interface:**
```typescript
interface WalletContextValue {
  // Common properties
  connected: boolean;
  connecting: boolean;
  disconnect: () => Promise<void>;
  publicKey: string | null;
  walletType: WalletType;
  error: Error | null;
  setError: (error: Error | null) => void;
  
  // Sui specific
  suiConnect: () => Promise<void>;
  suiAccount: SuiAccount | null;
  
  // Phantom specific
  phantomConnect: () => Promise<void>;
  phantomPublicKey: PublicKey | null;
  
  // Slush specific
  slushConnect: () => Promise<void>;
  slushAccount: SlushAccount | null;
}
```

### 2. WalletConnectButton (`src/components/WalletConnectButton.tsx`)

UI component for wallet connection functionality.

**Features:**
- Auto-detects installed wallet extensions
- Shows different states (connecting, connected, disconnected)
- Displays truncated wallet address when connected
- Separate buttons for Sui, Phantom, and Slush wallets
- Error display with recovery options
- Copy address functionality
- Responsive design with oceanic theme

### 3. Integration Points

- **Root Layout** (`app/layout.tsx`): Wraps the entire app with `WalletContextProvider`
- **Navbar** (`components/navbar.tsx`): Includes the `WalletConnectButton` component
- **Blockchain Page** (`app/blockchain/page.tsx`): Uses wallet connection for NFT functionality
- **Example Usage** (`app/examples/wallet-usage.tsx`): Shows how to use wallet integration

## Dependencies

### Required Dependencies

The following packages need to be installed in `packages/frontend-v2/`:

```json
{
  "dependencies": {
    "@mysten/dapp-kit": "latest",
    "@mysten/sui": "latest",
    "@tanstack/react-query": "latest",
    "@solana/wallet-adapter-react": "latest",
    "@solana/wallet-adapter-phantom": "latest",
    "@solana/web3.js": "latest"
  }
}
```

### Installation Command

```bash
cd waltodo-frontend
pnpm add @mysten/dapp-kit @mysten/sui @tanstack/react-query @solana/wallet-adapter-react @solana/wallet-adapter-phantom @solana/web3.js
```

## Setup and Commands

### Initial Setup

1. **Install Frontend Dependencies**
   ```bash
   cd packages/frontend-v2
   pnpm install
   ```

2. **Install Wallet Dependencies** (if not already present)
   ```bash
   pnpm add @mysten/dapp-kit @mysten/sui @tanstack/react-query @solana/wallet-adapter-react @solana/wallet-adapter-phantom @solana/web3.js
   ```

3. **Return to Root Directory**
   ```bash
   cd ../..
   ```

### Development Commands

From the root directory of the project:

```bash
# Install frontend dependencies
pnpm run nextjs:install

# Start development server (runs on port 3000)
pnpm run nextjs

# Build for production
pnpm run nextjs:build

# Start production server
pnpm run nextjs:start

# Build both backend and frontend
pnpm run build:all
```

### Quick Start

```bash
# One-liner to get started
cd packages/frontend-v2 && pnpm install && cd ../.. && pnpm run nextjs
```

## Usage

### Basic Usage in Components

```typescript
import { useWalletContext } from '@/lib/walletContext';
import { TransactionHistory } from '@/components/TransactionHistory';

export function MyComponent() {
  const {
    connected,
    connecting,
    publicKey,
    walletType,
    currentNetwork,
    isSwitchingNetwork,
    switchNetwork,
    suiConnect,
    phantomConnect,
    slushConnect,
    backpackConnect,
    disconnect,
    error,
    transactions
  } = useWalletContext();

  // Use wallet functionality
  if (!connected) {
    return (
      <div>
        <button onClick={suiConnect}>Connect Sui Wallet</button>
        <button onClick={phantomConnect}>Connect Phantom</button>
        <button onClick={slushConnect}>Connect Slush Wallet</button>
        <button onClick={backpackConnect}>Connect Backpack</button>
      </div>
    );
  }

  // Network switching component
  const handleNetworkChange = (network: 'mainnet' | 'testnet' | 'devnet') => {
    if (isSwitchingNetwork) return;
    switchNetwork(network);
  };

  return (
    <div>
      <p>Connected with {walletType}: {publicKey}</p>
      
      {/* Network selection */}
      <div>
        <p>Current Network: {currentNetwork}</p>
        <div className="network-selector">
          <button 
            onClick={() => handleNetworkChange('mainnet')}
            disabled={isSwitchingNetwork || currentNetwork === 'mainnet'}
            className={currentNetwork === 'mainnet' ? 'active' : ''}
          >
            Mainnet
          </button>
          <button 
            onClick={() => handleNetworkChange('testnet')}
            disabled={isSwitchingNetwork || currentNetwork === 'testnet'}
            className={currentNetwork === 'testnet' ? 'active' : ''}
          >
            Testnet
          </button>
          <button 
            onClick={() => handleNetworkChange('devnet')}
            disabled={isSwitchingNetwork || currentNetwork === 'devnet'}
            className={currentNetwork === 'devnet' ? 'active' : ''}
          >
            Devnet
          </button>
        </div>
      </div>
      
      {/* Transaction history */}
      <div className="transaction-history">
        <h3>Recent Transactions</h3>
        <TransactionHistory maxItems={5} />
      </div>
      
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

### Blockchain Interactions

```typescript
import { useWalletContext } from '@/lib/walletContext';
import { storeTodoOnBlockchain } from '@/lib/todo-service';
import { TransactionHistory } from '@/components/TransactionHistory';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';

export function BlockchainTodo() {
  const { 
    connected, 
    walletType, 
    currentNetwork,
    suiAccount, 
    phantomPublicKey, 
    slushAccount,
    backpackAccount,
    trackTransaction
  } = useWalletContext();

  const handleStore = async (listName: string, todoId: string) => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    // Create signer based on wallet type
    let signer;
    if (walletType === 'sui') {
      signer = { address: suiAccount?.address, network: currentNetwork, /* ... */ };
    } else if (walletType === 'phantom') {
      signer = { publicKey: phantomPublicKey, network: currentNetwork, /* ... */ };
    } else if (walletType === 'slush') {
      signer = { address: slushAccount?.address, network: currentNetwork, /* ... */ };
    } else if (walletType === 'backpack') {
      signer = { address: backpackAccount?.address, network: currentNetwork, /* ... */ };
    }

    try {
      // Track the transaction using the trackTransaction utility
      const transactionPromise = storeTodoOnBlockchain(listName, todoId, signer);
      const result = await trackTransaction(transactionPromise, 'Store Todo');
      
      console.log('Stored with ID:', result.objectId);
      return result;
    } catch (error) {
      console.error('Failed to store todo:', error);
      throw error;
    }
  };

  return (
    <div>
      {/* Component implementation */}
      
      {/* Always include the timeout warning for wallet sessions */}
      <SessionTimeoutWarning />
      
      {/* Show transaction history */}
      <div className="blockchain-transactions">
        <h3>Transaction History</h3>
        <TransactionHistory maxItems={10} />
      </div>
    </div>
  );
}
```

## Testing

### Prerequisites

- Install a Sui wallet (Sui Wallet, Suiet, or Martian)
- Install Phantom wallet for Solana/cross-chain functionality
- Install Slush wallet (formerly Stashed) for additional Sui wallet support
- Ensure you have testnet tokens

### Test Steps

1. Start the development server: `pnpm run nextjs`
2. Navigate to `http://localhost:3000`
3. Look for the wallet connect button in the navbar
4. Click to connect your preferred wallet
5. Visit the blockchain page (`/blockchain`) to view NFT todos
6. Test disconnection functionality

## Supported Wallets

### Sui Wallets
- Sui Wallet (official)
- Suiet
- Martian (Sui mode)
- Slush (formerly Stashed)

### Solana Wallets
- Phantom
- Solflare
- Backpack (multi-chain)

## Features

### Current Features
- ✅ Multi-wallet support (Sui, Phantom, Slush, and Backpack)
- ✅ Auto-detection of installed wallets
- ✅ Connection persistence
- ✅ Wallet switching
- ✅ Error handling with recovery options
- ✅ Responsive UI
- ✅ Truncated address display with copy functionality
- ✅ Connection status indicators
- ✅ DApp Kit integration
- ✅ Network switching (mainnet/testnet/devnet)
- ✅ Session timeout warnings
- ✅ Transaction history tracking
- ✅ Enhanced type definitions for all supported wallets

### Planned Features
- [ ] Additional wallet support (MetaMask via Sui compatibility)
- [ ] Transaction signing UI
- [ ] Balance display
- [ ] Wallet connect modal with QR code
- [ ] Mobile wallet support
- [ ] Multi-chain asset display
- [ ] Transaction history export

## Troubleshooting

### Common Issues

1. **Dependencies not found**
   - Run: `cd packages/frontend-v2 && pnpm install`
   - Install missing wallet packages

2. **Wallet not detected**
   - Ensure wallet extension is installed
   - Refresh the page
   - Check browser console for errors

3. **Connection fails**
   - Check network connectivity
   - Ensure wallet is unlocked
   - Try disconnecting and reconnecting

4. **Build errors**
   - Clear Next.js cache: `rm -rf .next`
   - Reinstall dependencies: `rm -rf node_modules && pnpm install`

### Debug Mode

Add to your component to debug wallet state:
```typescript
const walletContext = useWalletContext();
console.log('Wallet context:', walletContext);
```

## Architecture Decisions

### Why Multiple Wallet Support?

We support Sui, Phantom, and Slush wallets to:
- Provide flexibility for users with different wallet preferences
- Enable cross-chain functionality (future feature)
- Increase adoption by supporting popular wallets
- Improve user experience with choice of interfaces
- Support various security models preferred by different user segments

### Provider Hierarchy

The provider structure ensures:
1. QueryClient for React Query (data fetching)
2. SuiClient for Sui blockchain interaction
3. Connection Provider for Solana RPC
4. Wallet Providers for actual wallet connections
5. Our unified WalletContext on top

This hierarchy ensures all necessary providers are available throughout the app.

## Contributing

When adding new wallet integrations:

1. Add the wallet adapter to dependencies
2. Update `WalletContextProvider` with new provider
3. Add connection logic in `WalletContextInner`
4. Update `WalletConnectButton` with new wallet option
5. Add TypeScript types for new wallet
6. Update this documentation

## Resources

- [Sui Wallet Documentation](https://docs.mysten.io/dapp-kit)
- [Phantom Wallet Docs](https://docs.phantom.app)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Mysten DApp Kit](https://docs.sui.io/guides/developer/integration-guides/dapp-kit)
- [Stashed/Slush Wallet](https://www.slushwallet.xyz/)
- [Next.js Documentation](https://nextjs.org/docs)