# Wallet Integration Setup Instructions

## Quick Start

The Walrus Todo frontend now includes comprehensive wallet integration for Sui blockchain wallets. Follow these steps to get started:

### 1. Installation Complete

All necessary dependencies are already installed in `package.json`:
- `@mysten/dapp-kit` - Primary Sui wallet integration
- `@suiet/wallet-kit` - Additional wallet compatibility
- `@tanstack/react-query` - State management for wallet data

### 2. Provider Configuration

The `AppWalletProvider` is already configured in `src/app/layout.tsx` and provides:
- Multi-wallet support (Sui, Slush, etc.)
- Network switching (mainnet, testnet, devnet)
- Transaction capabilities
- Error handling and security features

### 3. Components Available

#### WalletConnectButton
```tsx
import { WalletConnectButton } from '@/components/WalletConnectButton';

// In your component
<WalletConnectButton />
```

Features:
- Connect/disconnect functionality
- Address display with copy option
- Network switching dropdown
- Real-time status updates

#### WalletStatus
```tsx
import { WalletStatus } from '@/components/WalletStatus';

// Shows connection status indicator
<WalletStatus />
```

#### TransactionSigner
```tsx
import { TransactionSigner } from '@/components/TransactionSigner';

// For signing Sui transactions
<TransactionSigner
  transactionData={yourTransactionData}
  onSuccess={(result) => handleSuccess(result)}
  onError={(error) => handleError(error)}
/>
```

### 4. Using the Wallet Context

```tsx
import { useWalletContext } from '@/contexts/WalletContext';

function YourComponent() {
  const {
    connected,
    address,
    network,
    connect,
    disconnect,
    switchNetwork,
    signTransaction,
    error
  } = useWalletContext();

  // Your component logic
}
```

## Integration with Existing Pages

### Dashboard Page

Add wallet functionality to your dashboard:

```tsx
// src/app/dashboard/page.tsx
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { WalletStatus } from '@/components/WalletStatus';

export default function Dashboard() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Dashboard</h1>
        <div className="flex items-center gap-4">
          <WalletStatus />
          <WalletConnectButton />
        </div>
      </div>
      {/* Rest of your dashboard */}
    </div>
  );
}
```

### Blockchain/NFT Page

For blockchain interactions:

```tsx
// src/app/blockchain/page.tsx
import { useWalletContext } from '@/contexts/WalletContext';
import { TransactionSigner } from '@/components/TransactionSigner';

export default function BlockchainPage() {
  const { connected, address } = useWalletContext();

  if (!connected) {
    return (
      <div className="text-center py-12">
        <p>Please connect your wallet to interact with blockchain features.</p>
        <WalletConnectButton />
      </div>
    );
  }

  return (
    <div>
      <h1>Blockchain Todos</h1>
      {/* Your NFT/blockchain content */}
    </div>
  );
}
```

## Supported Wallets

The integration supports all major Sui ecosystem wallets:

1. **Sui Wallet** - Official Sui wallet
2. **Slush Wallet** - Alternative Sui wallet
3. **Any Sui-compatible wallet** that implements the wallet standard

### Wallet Detection

The system automatically detects installed wallets and provides:
- Installation guidance for missing wallets
- Clear error messages for connection issues
- Fallback options when wallets aren't available

## Network Configuration

### Default Networks

- **Testnet** (default) - For development and testing
- **Mainnet** - For production use
- **Devnet** - For experimental features

### Switching Networks

Users can switch networks through:
1. The network dropdown in WalletConnectButton
2. Programmatically via `switchNetwork('testnet')`

## Transaction Capabilities

### Available Methods

```tsx
const {
  signTransaction,
  signAndExecuteTransaction,
  signMessage,
  trackTransaction
} = useWalletContext();

// Sign a transaction
const signature = await signTransaction(transactionData);

// Sign and execute
const result = await signAndExecuteTransaction(transactionData);

// Sign a message
const messageSignature = await signMessage(messageBytes);

// Track transaction status
const trackedResult = await trackTransaction(txPromise, 'Todo Creation');
```

### Transaction History

All transactions are automatically tracked and stored in the context:

```tsx
const { transactions } = useWalletContext();

// transactions is an array of TransactionRecord objects
transactions.forEach(tx => {
  console.log(`${tx.type}: ${tx.status} at ${tx.timestamp}`);
});
```

## Error Handling

### Built-in Error Types

- **WalletNotInstalledError** - Wallet extension not found
- **WalletConnectionRejectedError** - User declined connection
- **WalletNotSelectedError** - No wallet chosen
- **WalletError** - Generic wallet errors

### Error Display

Errors are automatically shown in:
1. WalletErrorModal for connection issues
2. Context error state for programmatic access
3. Component-level error displays

## Security Features

### Automatic Session Management

- **30-minute timeout** - Automatic disconnect after inactivity
- **Activity tracking** - Monitors user interaction
- **Secure storage** - Safe localStorage usage with fallbacks

### Best Practices

1. Always check `connected` state before wallet operations
2. Handle errors gracefully with user feedback
3. Provide loading states for better UX
4. Validate transaction data before signing

## Development Tips

### Testing Wallet Integration

1. **Install Sui Wallet extension** in your browser
2. **Switch to testnet** for development
3. **Get testnet SUI tokens** from the faucet
4. **Test all connection flows** including errors

### Debugging

Enable debug mode by checking browser console for:
- Wallet detection logs
- Connection attempt results
- Transaction signing status
- Error details

### Common Issues

1. **Wallet not detected**
   - Ensure extension is installed and unlocked
   - Check browser developer tools for errors
   - Verify wallet is compatible

2. **Connection rejected**
   - User declined in wallet popup
   - Check if wallet is already connected to another dApp
   - Try refreshing the page

3. **Transaction failures**
   - Insufficient SUI for gas fees
   - Invalid transaction data format
   - Network connectivity issues

## Environment Variables

No additional environment variables are required. The wallet integration uses:
- Default RPC endpoints from `@mysten/sui`
- Browser-provided wallet extensions
- Local storage for session persistence

## Production Considerations

1. **Test thoroughly** with real wallets on testnet
2. **Monitor error rates** and user feedback
3. **Update wallet dependencies** regularly
4. **Provide user documentation** for wallet setup
5. **Consider fallback options** for users without wallets

## Next Steps

1. **Implement blockchain interactions** using the wallet context
2. **Add transaction confirmations** for better UX
3. **Integrate with Sui Move contracts** for todo NFTs
4. **Monitor wallet usage** and optimize based on user behavior

The wallet integration is now complete and ready for use across your application!