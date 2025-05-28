# @waltodo/sui-client

A unified Sui client package for WalTodo that provides both vanilla JavaScript functions for CLI usage and React hooks for frontend usage. This package wraps @mysten/dapp-kit functionality with WalTodo-specific enhancements and automatic version compatibility.

## Features

- **Universal Compatibility**: Works in both Node.js (CLI) and browser (React) environments
- **Dynamic Configuration**: Integrates with @waltodo/config-loader for runtime configuration
- **Version Compatibility**: Automatic compatibility wrappers for different @mysten/sui versions
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **React Integration**: Complete dApp Kit wrapper with enhanced hooks
- **Error Handling**: Robust error handling and recovery mechanisms
- **Testing**: Comprehensive test suite for both environments

## Installation

```bash
npm install @waltodo/sui-client
# or
pnpm add @waltodo/sui-client
```

### Peer Dependencies

For React usage:
```bash
npm install react react-dom @mysten/sui @mysten/dapp-kit @tanstack/react-query
```

For Node.js/CLI usage:
```bash
npm install @mysten/sui
```

## Usage

### Vanilla JavaScript (Node.js/CLI)

```typescript
import { createVanillaSuiClient, type CreateTodoParams } from '@waltodo/sui-client';

// Create and initialize client
const client = createVanillaSuiClient({
  rpcTimeout: 30000,
  websocketTimeout: 30000,
});

await client.initialize('testnet');

// Create keypair
const keypair = client.createKeypairFromPrivateKey('your-private-key');

// Create todo transaction
const createParams: CreateTodoParams = {
  title: 'My Todo',
  description: 'Todo description',
  imageUrl: 'https://example.com/image.jpg',
  metadata: '{}',
  isPrivate: false,
};

const tx = client.createTodoNFTTransaction(createParams, keypair.getPublicKey().toSuiAddress());

// Execute transaction
const result = await client.executeTransaction(tx, keypair);
console.log('Transaction digest:', result.digest);

// Get todos from blockchain
const todos = await client.getTodosFromBlockchain(address);
```

### React Integration

```tsx
import React from 'react';
import {
  WalTodoWalletProvider,
  useCurrentAccount,
  useExecuteTxn,
  useTodoNFTOperations,
  useWalletConnection,
  useTransactionExecution,
} from '@waltodo/sui-client';

// Wrap your app with the provider
function App() {
  return (
    <WalTodoWalletProvider defaultNetwork="testnet" autoConnect={true}>
      <TodoApp />
    </WalTodoWalletProvider>
  );
}

// Use hooks in components
function TodoApp() {
  const account = useCurrentAccount();
  const { connected, connect, disconnect } = useWalletConnection();
  const { createTodoNFT, getTodosFromBlockchain } = useTodoNFTOperations();
  const { executeTransaction, isExecuting } = useTransactionExecution();

  const handleCreateTodo = async () => {
    if (!connected) {
      connect();
      return;
    }

    try {
      const result = await createTodoNFT({
        title: 'New Todo',
        description: 'Todo description',
        imageUrl: 'https://example.com/image.jpg',
      });
      console.log('Todo created:', result.digest);
    } catch (error) {
      console.error('Failed to create todo:', error);
    }
  };

  return (
    <div>
      <p>Account: {account?.address || 'Not connected'}</p>
      <button onClick={connected ? disconnect : connect}>
        {connected ? 'Disconnect' : 'Connect'}
      </button>
      <button onClick={handleCreateTodo} disabled={isExecuting}>
        {isExecuting ? 'Creating...' : 'Create Todo'}
      </button>
    </div>
  );
}
```

### Configuration Loading

The package automatically loads configuration using the following priority:

1. **@waltodo/config-loader** (if available)
2. **Generated config files** (browser: `/config/{network}.json`)
3. **CLI config files** (Node.js: various paths)
4. **Fallback configurations** (built-in defaults)

You can also load configuration manually:

```typescript
import { loadAppConfig, getNetworkConfig } from '@waltodo/sui-client';

// Load app configuration
const config = await loadAppConfig('testnet');
console.log('Network URL:', config.network.url);

// Get specific network configuration
const networkConfig = getNetworkConfig('testnet');
console.log('Explorer URL:', networkConfig.explorerUrl);
```

## API Reference

### VanillaSuiClient

Main class for Node.js/CLI usage:

```typescript
class VanillaSuiClient {
  async initialize(network?: NetworkType): Promise<void>
  getClient(): SuiClient
  getConfig(): AppConfig
  getCurrentNetwork(): NetworkType
  
  createKeypairFromPrivateKey(privateKey: string): Ed25519Keypair
  async getAccount(address: string): Promise<WalletAccount>
  
  async executeTransaction(transaction: Transaction, keypair: Ed25519Keypair): Promise<TransactionResult>
  
  createTodoNFTTransaction(params: CreateTodoParams, senderAddress: string): Transaction
  updateTodoNFTTransaction(params: UpdateTodoParams, senderAddress: string): Transaction
  completeTodoNFTTransaction(objectId: string, senderAddress: string): Transaction
  deleteTodoNFTTransaction(objectId: string, senderAddress: string): Transaction
  
  async getTodosFromBlockchain(ownerAddress: string): Promise<Todo[]>
  async getTodoByObjectId(objectId: string): Promise<Todo | null>
  async getTransactionStatus(digest: string): Promise<TransactionStatus>
}
```

### React Hooks

Available hooks for React integration:

```typescript
// Core hooks
useCurrentAccount(): WalletAccount | null
useExecuteTxn(): (transaction: Transaction) => Promise<TransactionResult>
useWalletConnection(): { connected, connecting, connect, disconnect, error, clearError }

// Enhanced hooks
useTransactionExecution(): {
  executeTransaction: (tx: Transaction) => Promise<TransactionResult>
  isExecuting: boolean
  lastResult: TransactionResult | null
  lastError: string | null
  clearError: () => void
}

useTodoNFTOperations(): {
  createTodoNFT: (params: CreateTodoParams) => Promise<TransactionResult>
  updateTodoNFT: (params: UpdateTodoParams) => Promise<TransactionResult>
  completeTodoNFT: (objectId: string) => Promise<TransactionResult>
  deleteTodoNFT: (objectId: string) => Promise<TransactionResult>
  getTodosFromBlockchain: () => Promise<Todo[]>
}

useAppConfig(): {
  config: AppConfig | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}
```

## Version Compatibility

The package includes automatic compatibility wrappers for different versions of @mysten/sui and @mysten/dapp-kit:

- **Minimum supported @mysten/sui**: 1.28.0
- **Minimum supported @mysten/dapp-kit**: 0.14.0
- **Recommended @mysten/sui**: 1.30.1+
- **Recommended @mysten/dapp-kit**: 0.14.32+

Compatibility features:
- Automatic option normalization for SuiClient
- Result property fallbacks for missing fields
- Hook error handling for API changes
- Environment detection and feature polyfills

## Error Handling

The package provides comprehensive error handling:

```typescript
import {
  SuiClientError,
  WalletNotConnectedError,
  TransactionError,
  NetworkError,
} from '@waltodo/sui-client';

try {
  await client.executeTransaction(tx, keypair);
} catch (error) {
  if (error instanceof WalletNotConnectedError) {
    console.log('Please connect your wallet');
  } else if (error instanceof TransactionError) {
    console.log('Transaction failed:', error.transactionDigest);
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.networkName);
  }
}
```

## Testing

The package includes comprehensive tests for both environments:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

Test categories:
- **Unit tests**: Individual functions and classes
- **Integration tests**: Full workflow testing
- **React tests**: Component and hook testing
- **Compatibility tests**: Version compatibility verification

## Development

### Building

```bash
# Development build (fast)
npm run build:dev

# Production build (with type checking)
npm run build

# Clean build
npm run clean && npm run build
```

### Type Checking

```bash
npm run typecheck
```

## License

ISC - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Support

For issues and questions:
1. Check the [WalTodo documentation](../../../docs/)
2. Search existing [GitHub issues](https://github.com/your-org/waltodo/issues)
3. Create a new issue with reproduction steps