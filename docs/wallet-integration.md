# Wallet Integration Guide

**Last Updated:** May 19, 2025

## Overview

This document describes the wallet integration implementation for the Walrus Todo application. The implementation uses the [Suiet Wallet Kit](https://kit.suiet.app/) to provide a consistent interface for connecting to and interacting with Sui blockchain wallets.

## Features

The wallet integration includes the following features:

- **Unified Wallet Support**: Support for all major Sui wallets including Sui Wallet, Ethos, Martian, Suiet, and Phantom (Sui)
- **Network Switching**: Ability to switch between mainnet, testnet, and devnet
- **Transaction Tracking**: Comprehensive transaction history and status tracking
- **Security Enhancements**: Session timeout with auto-disconnect after 30 minutes of inactivity
- **Persistence**: Local storage of wallet connection state for improved UX on reload

## Implementation Architecture

### Core Components

1. **WalletContext** - Wrapper around Suiet Wallet Kit providing application-specific functionality
   - Located at: `src/contexts/WalletContext.tsx`
   - Exposes wallet connection state and methods
   - Manages transaction history and session timeout

2. **WalletConnectButton** - UI component for wallet connection and status display
   - Located at: `src/components/WalletConnectButton.tsx`
   - Shows connected wallet information
   - Provides network switching functionality
   - Supports address copying with clipboard fallbacks

3. **TransactionHistory** - Component to display transaction history
   - Located at: `src/components/TransactionHistory.tsx`
   - Shows transaction status, type, and timestamp
   - Supports expanding to view full history

4. **SessionTimeoutWarning** - Security component that warns of impending session timeout
   - Located at: `src/components/SessionTimeoutWarning.tsx`
   - Appears when user is approaching inactivity timeout
   - Allows user to extend session

### Usage Examples

A comprehensive example of how to use the wallet integration is available at:
`src/app/examples/wallet-usage.tsx`

## QuickStart Guide

### Basic Connection

```tsx
import { useWalletContext } from '@/contexts/WalletContext';

function MyComponent() {
  const { connected, connect, disconnect, address } = useWalletContext();
  
  return (
    <div>
      {!connected ? (
        <button onClick={connect}>Connect Wallet</button>
      ) : (
        <div>
          <p>Connected: {address}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      )}
    </div>
  );
}
```

### Network Switching

```tsx
import { useWalletContext } from '@/contexts/WalletContext';

function NetworkSwitcher() {
  const { chainId, switchNetwork } = useWalletContext();
  
  return (
    <div>
      <p>Current network: {chainId}</p>
      <button onClick={() => switchNetwork('mainnet')}>Switch to Mainnet</button>
      <button onClick={() => switchNetwork('testnet')}>Switch to Testnet</button>
      <button onClick={() => switchNetwork('devnet')}>Switch to Devnet</button>
    </div>
  );
}
```

### Transaction Tracking

```tsx
import { useWalletContext } from '@/contexts/WalletContext';

function TransactionExample() {
  const { connected, trackTransaction } = useWalletContext();
  
  const handleTransaction = async () => {
    if (!connected) return;
    
    try {
      // Track your transaction and get result
      const result = await trackTransaction(
        myTransactionFunction(), // Your transaction promise
        'MyTransactionType'      // Transaction type identifier
      );
      
      console.log('Transaction complete:', result);
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };
  
  return (
    <button onClick={handleTransaction}>
      Execute Transaction
    </button>
  );
}
```

## Security Considerations

1. **Automatic Session Timeout**: Wallet sessions automatically timeout after 30 minutes of inactivity
2. **Localized Data**: No sensitive wallet data is transmitted to servers or third parties
3. **Optional Persistence**: Users can control whether wallet connection state is persisted
4. **Error Isolation**: Wallet errors are properly caught and handled without affecting other parts of the application

## Testing

When testing wallet functionality in a local development environment:

1. Use the Sui testnet for development and testing
2. Install the wallet browser extensions you need to test with
3. Create testnet accounts with the [Sui Faucet](https://docs.sui.io/build/faucet)
4. Mock wallet functionality in unit tests using the test utilities in the test folder

## Resources

- [Suiet Wallet Kit Documentation](https://kit.suiet.app/docs/getting-started)
- [Sui Developer Portal](https://docs.sui.io/)
- [Sui Wallet Standard](https://github.com/MystenLabs/sui/tree/main/sdk/wallet-adapter/packages/wallet-standard)