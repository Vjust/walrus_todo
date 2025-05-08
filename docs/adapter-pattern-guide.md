# Adapter Pattern Implementation Guide

This document provides guidelines on how to use the adapter pattern implemented to fix TypeScript interface compatibility issues in the Walrus Todo project.

## Overview

The adapter pattern has been implemented to solve interface compatibility issues between various components:

1. **TransactionBlockAdapter**: Standardizes interaction with Sui transaction blocks
2. **SignerAdapter**: Provides a unified interface for cryptography signing operations
3. **WalrusClientAdapter**: Reconciles differences between WalrusClient and WalrusClientExt interfaces

## How to Use the Adapters

### TransactionBlock Adapter

The `TransactionBlockAdapter` provides a consistent interface for working with Sui transaction blocks.

```typescript
import { 
  TransactionBlockAdapter, 
  createTransactionBlockAdapter 
} from '../utils/adapters/transaction-adapter';
import { TransactionBlock } from '@mysten/sui.js/transactions';

// Create a new adapter with a new transaction block
const txAdapter = createTransactionBlockAdapter();

// Or wrap an existing transaction block
const existingTx = new TransactionBlock();
const txAdapter2 = createTransactionBlockAdapter(existingTx);

// Use the adapter methods
txAdapter.setGasBudget(1000);
txAdapter.moveCall({
  target: '0x2::storage::create_storage',
  arguments: [
    txAdapter.splitCoins(txAdapter.gas(), [txAdapter.pure(100)]),
    txAdapter.pure('1000'),
    txAdapter.pure('52')
  ]
});

// When needed, get the underlying transaction block
const rawTxBlock = txAdapter.getUnderlyingBlock();
```

### Signer Adapter

The `SignerAdapter` provides a consistent interface for working with cryptographic signers.

```typescript
import { 
  SignerAdapter, 
  createSignerAdapter 
} from '../utils/adapters/signer-adapter';
import { SuiClient } from '@mysten/sui.js/client';
import { KeystoreSigner } from '../utils/sui-keystore';

// Create a signer (e.g., from keystore)
const rawSigner = await KeystoreSigner.fromPath('default');

// Wrap it in the adapter
const signerAdapter = createSignerAdapter(rawSigner);

// Connect to a client
const suiClient = new SuiClient({ url: 'https://sui-testnet-rpc.example.com' });
signerAdapter.connect(suiClient);

// Use the adapter for signing
const txAdapter = createTransactionBlockAdapter();
const signature = await signerAdapter.signTransaction(txAdapter);

// Execute transactions with the adapter
const response = await signerAdapter.signAndExecuteTransactionBlock(txAdapter, {
  showEffects: true,
  showEvents: true
});

// Access the underlying signer when needed
const rawSignerRef = signerAdapter.getUnderlyingSigner();
```

### WalrusClient Adapter

The `WalrusClientAdapter` provides a consistent interface for working with both WalrusClient and WalrusClientExt interfaces.

```typescript
import { 
  WalrusClientAdapter, 
  createWalrusClientAdapter 
} from '../utils/adapters/walrus-client-adapter';
import { WalrusClient } from '@mysten/walrus';
import { MockWalrusClient } from '../utils/MockWalrusClient';

// Wrap a real client
const realClient = new WalrusClient({ 
  network: 'testnet',
  suiRpcUrl: 'https://sui-testnet-rpc.example.com'
});
const clientAdapter = createWalrusClientAdapter(realClient);

// Or use the mock client that's already an adapter
const mockClient = new MockWalrusClient();

// Use consistent methods across both implementations
const config = await clientAdapter.getConfig();
const balance = await clientAdapter.getWalBalance();

// For methods that accept transaction blocks or signers, you can use adapters
const txAdapter = createTransactionBlockAdapter();
const signerAdapter = createSignerAdapter(/* ... */);

const result = await clientAdapter.writeBlob({
  blob: new Uint8Array([/* ... */]),
  signer: signerAdapter,
  transaction: txAdapter,
  deletable: true,
  epochs: 52
});

// Access the underlying client when needed
const rawClient = clientAdapter.getUnderlyingClient();
```

## Updating Existing Code

When updating existing code to use the adapter pattern:

1. Replace direct usage of `TransactionBlock` with `createTransactionBlockAdapter()`
2. Wrap existing signers with `createSignerAdapter()`
3. Wrap WalrusClient instances with `createWalrusClientAdapter()`
4. Update method signatures to accept adapter types

Example for updating a function:

```typescript
// Before
async function createStorage(
  client: WalrusClient, 
  signer: Signer,
  size: number
): Promise<string> {
  const tx = new TransactionBlock();
  // ...implementation
}

// After
async function createStorage(
  client: WalrusClientAdapter, 
  signer: SignerAdapter | Signer,
  size: number
): Promise<string> {
  const tx = createTransactionBlockAdapter();
  // ...implementation remains mostly the same
}
```

## Mock Implementation

The mock implementations in `src/__mocks__/@mysten/` have been updated to implement the adapter interfaces directly, which means:

1. They provide proper types without using `@ts-ignore`
2. They can be used interchangeably with real implementations
3. They handle different interface variants correctly

## Best Practices

1. **Accept both adapter and raw types** in function parameters when possible
2. **Use factory functions** (`createXAdapter`) rather than constructing adapters directly
3. **Only get the underlying raw object** when absolutely necessary
4. **Prefer adapter interfaces** in type declarations for better compatibility
5. **Document when a method expects raw objects** rather than adapters

## Testing

When writing tests, prefer using the adapter interfaces directly:

```typescript
import { MockWalrusClient } from '../utils/MockWalrusClient';
import { createTransactionBlockAdapter } from '../utils/adapters/transaction-adapter';

describe('WalrusStorage', () => {
  it('should store a todo', async () => {
    const mockClient = new MockWalrusClient();
    const txAdapter = createTransactionBlockAdapter();
    
    // Test with the adapters directly
    const result = await mockClient.writeBlob({
      blob: new Uint8Array([1, 2, 3]),
      signer: mockSigner,
      transaction: txAdapter
    });
    
    expect(result.blobObject.blob_id).toBeDefined();
  });
});
```

By following these guidelines, you can ensure consistent interfaces throughout the codebase, eliminate TypeScript errors, and avoid the need for type assertions or `@ts-ignore` comments.