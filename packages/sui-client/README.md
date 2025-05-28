# @waltodo/sui-client

A unified Sui blockchain client package that wraps @mysten/dapp-kit functionality for use in both React frontend applications and Node.js CLI environments.

## Features

- **Universal**: Works in both browser (React) and Node.js (CLI) environments
- **Type-safe**: Full TypeScript support with comprehensive type definitions
- **Configuration-driven**: Dynamic configuration loading for different networks
- **Wallet integration**: Complete wallet connection and transaction signing
- **TodoNFT operations**: Built-in support for WalTodo-specific smart contract operations
- **Error handling**: Comprehensive error types and handling

## Installation

```bash
npm install @waltodo/sui-client
# or
pnpm add @waltodo/sui-client
```

## Usage

### React Frontend

```tsx
import React from 'react';
import {
  WalTodoWalletProvider,
  useWalTodoWallet,
  useCurrentAccount,
  useTodoNFTOperations
} from '@waltodo/sui-client/react';

// Wrap your app with the provider
function App() {
  return (
    <WalTodoWalletProvider defaultNetwork="testnet" autoConnect={true}>
      <MyComponent />
    </WalTodoWalletProvider>
  );
}

// Use the hooks in your components
function MyComponent() {
  const { connected, connect, disconnect } = useWalTodoWallet();
  const account = useCurrentAccount();
  const { createTodoNFT, getTodosFromBlockchain } = useTodoNFTOperations();

  const handleCreateTodo = async () => {
    if (!connected) return;
    
    try {
      const result = await createTodoNFT({
        title: 'My Todo',
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
      {connected ? (
        <div>
          <p>Connected: {account?.address}</p>
          <button onClick={handleCreateTodo}>Create Todo</button>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      ) : (
        <button onClick={connect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### Node.js CLI

```typescript
import {
  createVanillaSuiClient,
  loadAppConfig,
  Ed25519Keypair,
  CreateTodoParams
} from '@waltodo/sui-client/vanilla';

async function main() {
  // Create and initialize the client
  const client = createVanillaSuiClient();
  await client.initialize('testnet');

  // Create a keypair (in real usage, load from secure storage)
  const keypair = Ed25519Keypair.generate();
  const address = keypair.getPublicKey().toSuiAddress();

  // Create a todo
  const todoParams: CreateTodoParams = {
    title: 'CLI Todo',
    description: 'Created from CLI',
    imageUrl: 'https://example.com/image.jpg',
  };

  // Create transaction
  const tx = client.createTodoNFTTransaction(todoParams, address);

  // Execute transaction
  const result = await client.executeTransaction(tx, keypair);
  console.log('Todo created:', result.digest);

  // Fetch todos
  const todos = await client.getTodosFromBlockchain(address);
  console.log('All todos:', todos);
}

main().catch(console.error);
```

## Configuration

The package supports dynamic configuration loading:

### Browser Environment
- Loads configuration from `/config/${network}.json`
- Falls back to built-in configurations if files not found

### Node.js Environment  
- Loads configuration from various possible paths:
  - `./config/${network}.json`
  - `../.waltodo-cache/config/${network}.json`
  - And other common locations
- Falls back to built-in configurations if files not found

### Manual Configuration

```typescript
import { loadAppConfig, getNetworkConfig } from '@waltodo/sui-client';

// Load full app configuration
const config = await loadAppConfig('testnet');

// Get just network configuration
const networkConfig = getNetworkConfig('testnet');
```

## API Reference

### React Hooks

#### `useWalTodoWallet()`
Main hook providing comprehensive wallet functionality.

#### `useCurrentAccount()`
Returns the currently connected account information.

#### `useExecuteTxn()`
Hook for executing transactions with automatic error handling.

#### `useTodoNFTOperations()`
Hook providing TodoNFT-specific operations.

#### `useAppConfig()`
Hook for loading and accessing configuration.

### Vanilla Client

#### `VanillaSuiClient`
Main client class for Node.js environments.

```typescript
class VanillaSuiClient {
  async initialize(network?: NetworkType): Promise<void>
  getClient(): SuiClient
  getConfig(): AppConfig
  async executeTransaction(tx: Transaction, keypair: Ed25519Keypair): Promise<TransactionResult>
  createTodoNFTTransaction(params: CreateTodoParams, senderAddress: string): Transaction
  async getTodosFromBlockchain(ownerAddress: string): Promise<Todo[]>
  // ... more methods
}
```

### Types

The package exports comprehensive TypeScript types:

```typescript
export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  // ... more fields
}

export interface CreateTodoParams {
  title: string;
  description: string;
  imageUrl: string;
  metadata?: string;
  isPrivate?: boolean;
}

export interface TransactionResult {
  digest: string;
  effects?: any;
  events?: any[];
  objectChanges?: any[];
  balanceChanges?: any[];
}

// ... many more types
```

## Error Handling

The package provides specific error types:

```typescript
import {
  SuiClientError,
  WalletNotConnectedError,
  TransactionError,
  NetworkError
} from '@waltodo/sui-client';

try {
  await someOperation();
} catch (error) {
  if (error instanceof WalletNotConnectedError) {
    // Handle wallet not connected
  } else if (error instanceof TransactionError) {
    // Handle transaction failure
    console.log('Transaction digest:', error.transactionDigest);
  } else if (error instanceof NetworkError) {
    // Handle network issues
    console.log('Network:', error.networkName);
  }
}
```

## Development

### Building

```bash
pnpm build      # Build for production
pnpm build:dev  # Build for development (faster)
pnpm clean      # Clean build artifacts
```

### Testing

```bash
pnpm test       # Run tests
pnpm test:watch # Run tests in watch mode
```

### Type Checking

```bash
pnpm typecheck  # Type check without emitting
```

## License

ISC

## Contributing

This package is part of the WalTodo project. See the main repository for contribution guidelines.