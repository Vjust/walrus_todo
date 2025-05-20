# Slush Wallet Integration Guide

*Date: May 19, 2024*

This document provides information about the Slush wallet integration with the WalTodo frontend application.

## Overview

The WalTodo frontend now supports connecting with Slush wallet (formerly known as Stashed wallet), in addition to the existing Sui and Phantom wallet integrations. This multi-wallet support enables users to interact with the application using their preferred wallet.

## Integration Features

- **Wallet Detection**: Automatic detection of Slush wallet presence in the browser
- **Connection Flow**: Streamlined connection and authorization flow
- **Address Display**: Truncated wallet address display with copy functionality
- **Blockchain Storage**: Todo storage on the Sui blockchain through Slush wallet
- **Error Handling**: Comprehensive error handling for various wallet scenarios
- **Connection Persistence**: Maintained wallet connection across page navigation

## Implementation Details

### Wallet Context

The Slush wallet integration is implemented through the centralized `WalletContext` that manages all wallet interactions. The context provides:

- `slushConnect()`: Function to initiate connection to Slush wallet
- `slushAccount`: Object containing the connected Slush wallet account details
- `walletType`: Indicates if 'slush' is the currently active wallet type
- `connected`: Boolean indicating connection status
- `publicKey`: The wallet address, available for all wallet types

### Wallet Detection

Slush wallet is detected by checking for any of the following window properties:
- `window.slushProvider`
- `window.stashedProvider` (legacy name)
- `window.stashed`

Detection is performed on initial page load and after a short delay to catch wallets that may inject late.

### Account Type

The Slush wallet account conforms to the following interface:

```typescript
export interface SlushAccount {
  address: string;
  publicKey: Uint8Array;
  chains: string[];
  features: string[];
}
```

### Connection Flow

1. User clicks "Connect Slush Wallet" button
2. Application checks for wallet availability
3. If available, requests connection via `slushAdapter.connect()`
4. Upon successful connection, `slushAccount` is set in the wallet context
5. UI updates to show connected state with wallet address

### Error Handling

Specific error types are used to handle various wallet-related errors:

- `WalletNotInstalledError`: Slush wallet extension is not installed
- `WalletConnectionRejectedError`: User rejected the connection request
- `WalletNotSelectedError`: No wallet was selected for connection
- `WalletError`: Generic wallet error for other issues

All errors are displayed in a user-friendly error modal with appropriate suggestions.

## Usage Example

```tsx
import { useWalletContext } from '@/lib/walletContext';

function MyComponent() {
  const { 
    connected, 
    walletType, 
    slushConnect, 
    slushAccount, 
    publicKey 
  } = useWalletContext();

  // Connect to Slush wallet
  const handleConnect = async () => {
    try {
      await slushConnect();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  // Display wallet info if connected
  if (connected && walletType === 'slush') {
    return (
      <div>
        <p>Connected to Slush Wallet</p>
        <p>Address: {publicKey}</p>
        <p>Chains: {slushAccount?.chains.join(', ')}</p>
      </div>
    );
  }

  // Show connect button if not connected
  return (
    <button onClick={handleConnect}>
      Connect Slush Wallet
    </button>
  );
}
```

## Testing

The Slush wallet integration has comprehensive test coverage including:

- Detection tests
- Connection success tests
- Connection rejection tests
- Disconnection tests
- Cross-page navigation tests
- Address format tests
- Copy to clipboard tests
- Error handling tests

Tests use the custom mock helpers defined in `tests/e2e/helpers/slush-wallet-mock.ts` for consistent wallet simulation.

## Troubleshooting

### Common Issues

1. **Wallet Not Detected**
   - Ensure Slush wallet extension is installed
   - Check if the wallet is registered with the `window` object
   - Verify that the wallet extension is enabled

2. **Connection Rejected**
   - The user may have denied the connection request
   - Check wallet extension permissions
   - Try reconnecting after verifying extension settings

3. **Address Not Showing**
   - Verify that the wallet has at least one account configured
   - Check browser console for errors
   - Ensure the wallet is properly connected with `connected: true`

### Debug Tips

- Use browser developer tools to check for the presence of `window.slushProvider`
- Monitor console for wallet-related errors during connection attempts
- Verify wallet state by checking localStorage for persistence settings

## Resources

- [Slush Wallet Documentation](https://docs.slushwallet.io/)
- [Sui Wallet Standard](https://docs.sui.io/standards/wallet-standard)
- [Dapp-Kit Integration Docs](https://docs.sui.io/guides/developer/first-app/use-dapp-kit)