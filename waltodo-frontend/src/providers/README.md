# Sui Wallet Provider Integration

This directory contains the Sui wallet provider setup for the Walrus Todo application.

## Overview

The `SuiWalletProvider.tsx` provides a clean, reusable wrapper around `@mysten/dapp-kit` that sets up:

1. **React Query** - For data fetching and caching
2. **Sui Client** - For blockchain interactions
3. **Wallet Provider** - For wallet connections

## Current Architecture

The application currently uses a sophisticated wallet integration through:
- `src/contexts/WalletContext.tsx` - Comprehensive wallet context with session management
- `src/app/ClientOnlyRoot.tsx` - Client-side initialization wrapper
- `src/app/layout.tsx` - Main application layout

## Using SuiWalletProvider

If you want to use the simpler `SuiWalletProvider` instead:

### 1. Update your layout file:

```tsx
// src/app/layout.tsx
import { SuiWalletProvider } from '@/providers/SuiWalletProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SuiWalletProvider defaultNetwork="testnet">
          {children}
        </SuiWalletProvider>
      </body>
    </html>
  );
}
```

### 2. Use wallet hooks in your components:

```tsx
import { 
  useCurrentAccount, 
  useConnectWallet, 
  useDisconnectWallet,
  ConnectButton 
} from '@mysten/dapp-kit';

function MyComponent() {
  const account = useCurrentAccount();
  
  return (
    <div>
      <ConnectButton /> {/* Built-in connect button */}
      {account && <p>Connected: {account.address}</p>}
    </div>
  );
}
```

## Available Hooks from @mysten/dapp-kit

- `useCurrentAccount()` - Get current connected account
- `useConnectWallet()` - Connect wallet mutation
- `useDisconnectWallet()` - Disconnect wallet mutation
- `useSignAndExecuteTransaction()` - Sign and execute transactions
- `useSuiClient()` - Access the Sui client
- `useWallets()` - Get available wallets
- `useSuiClientQuery()` - Query blockchain data
- `useSuiClientMutation()` - Mutate blockchain state

## Network Configuration

The provider is configured to support:
- **Testnet** (default)
- **Devnet**
- **Mainnet**

To change the default network, update the `defaultNetwork` prop:

```tsx
<SuiWalletProvider defaultNetwork="mainnet">
  {children}
</SuiWalletProvider>
```

## Features

- ✅ Auto-connect to last used wallet
- ✅ Support for all major Sui wallets
- ✅ Transaction signing and execution
- ✅ Network switching
- ✅ TypeScript support
- ✅ React Query integration
- ✅ Error handling
- ✅ Loading states

## Example Usage

See `src/components/WalletExample.tsx` for a complete example of how to use the wallet provider.

## Troubleshooting

### Hydration Errors
Make sure to wrap wallet-dependent components with `'use client'` directive.

### Wallet Not Connecting
1. Ensure you have a Sui wallet installed (e.g., Sui Wallet, Suiet, etc.)
2. Check that you're on the correct network
3. Clear localStorage if you're having persistent issues

### Transaction Failures
1. Ensure sufficient SUI balance for gas fees
2. Check network status
3. Verify transaction structure