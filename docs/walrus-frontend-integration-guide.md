# Walrus Protocol Frontend Integration Guide

## Overview

This guide provides comprehensive documentation for integrating Walrus Protocol decentralized storage into the frontend of the Walrus Todo application. The implementation includes blob storage, retrieval, and proper error handling using the @mysten/walrus SDK.

## Architecture

### Two-Step Process

1. **Walrus Upload**: Store todo content on Walrus decentralized storage
2. **Sui NFT Creation**: Create an NFT on Sui blockchain with blob reference for ownership

### Key Components

- **`WalrusClient`**: Low-level Walrus SDK wrapper
- **`WalrusTodoManager`**: High-level todo management with Walrus integration
- **`useWalrusStorage`**: React hook for state management
- **`WalrusStorageManager`**: UI component for storage operations

## Installation

### 1. Add Dependencies

The frontend already includes the necessary dependencies:

```json
{
  "@mysten/walrus": "0.0.21",
  "@mysten/sui": "^1.29.1",
  "@mysten/dapp-kit": "^0.16.3"
}
```

### 2. Configure Environment

Add to your `.env.local`:

```env
NEXT_PUBLIC_WALRUS_NETWORK=testnet
NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher-devnet.walrus.space
```

## Core Implementation

### 1. Walrus Client (`src/lib/walrus-client.ts`)

Provides core Walrus Protocol integration:

```typescript
// Initialize client
const walrusClient = new FrontendWalrusClient('testnet');

// Upload blob
const result = await walrusClient.writeBlob({
  blob: ContentEncoder.encodeJSON(todoData),
  signer: walletSigner,
  deletable: true,
  epochs: 5
});

// Download blob
const data = await walrusClient.readBlob({
  blobId: 'YOUR_BLOB_ID'
});
```

Key features:
- **Content encoding/decoding** (JSON ↔ Uint8Array)
- **Comprehensive error handling** with RetryableWalrusClientError support
- **Progress tracking** for uploads/downloads
- **Cost estimation** before operations
- **Automatic retry logic** with exponential backoff

### 2. Todo Integration (`src/lib/walrus-todo-integration.ts`)

High-level todo management with Walrus storage:

```typescript
// Create todo with Walrus storage + optional NFT
const result = await walrusTodoManager.createTodo(
  todoData,
  signer,
  signAndExecuteTransaction,
  {
    epochs: 5,
    deletable: true,
    createNFT: true,
    onProgress: (step, progress) => console.log(step, progress)
  }
);

// Retrieve todo from storage
const todo = await walrusTodoManager.retrieveTodo(blobId);
```

Features:
- **Two-step process**: Walrus upload → Sui NFT creation
- **Batch operations** for multiple todos
- **Storage cost estimation**
- **Metadata management**

### 3. React Hook (`src/hooks/useWalrusStorage.ts`)

React state management for Walrus operations:

```typescript
const {
  loading,
  uploading,
  progress,
  error,
  createTodo,
  retrieveTodo,
  walBalance,
  storageUsage
} = useWalrusStorage({
  network: 'testnet',
  autoRefreshBalance: true
});
```

Features:
- **Loading states** for all operations
- **Progress tracking** with detailed messages
- **Error handling** with recovery suggestions
- **Automatic balance/usage refresh**
- **Batch operations** support

### 4. UI Component (`src/components/WalrusStorageManager.tsx`)

Complete UI for Walrus storage operations:

- Todo creation form with validation
- Progress indicators for uploads
- Error display with recovery actions
- Storage statistics (balance, usage)
- Todo retrieval interface

## Content Encoding/Decoding

The `ContentEncoder` class handles data transformation:

```typescript
// Encode todo data
const blob = ContentEncoder.encodeJSON(todoObject);

// Decode retrieved data
const todo = ContentEncoder.decodeJSON(blobData);

// Handle files
const fileBlob = await ContentEncoder.encodeFile(file);
```

## Error Handling

### Error Categories

The integration includes comprehensive error handling:

- **Network errors**: Connection issues, timeouts
- **Authentication errors**: Wallet signing failures
- **Storage errors**: Blob not found, storage failures
- **Validation errors**: Invalid data, size limits
- **Quota errors**: Insufficient WAL tokens

### Error Recovery

```typescript
// Automatic error analysis
const errorInfo = WalrusErrorAnalyzer.analyzeError(error);

// Get recovery actions
const actions = WalrusErrorRecovery.getRecoveryActions(error, {
  refreshWallet,
  refreshBalance,
  retryOperation
});

// Auto-recovery for minor issues
const recovered = await WalrusErrorRecovery.attemptAutoRecovery(error, context);
```

## Network Configuration

### Supported Networks

```typescript
const WALRUS_NETWORKS = {
  testnet: 'https://publisher-devnet.walrus.space',
  devnet: 'https://publisher-devnet.walrus.space',
  mainnet: 'https://publisher.walrus.space'
};
```

### Network Switching

```typescript
const walrusClient = new FrontendWalrusClient('testnet');
// Client automatically uses correct network endpoints
```

## Storage Operations

### Upload Process

1. **Validate input**: Check blob size and format
2. **Estimate cost**: Calculate WAL token cost
3. **Upload to Walrus**: Store blob with metadata
4. **Create NFT** (optional): Reference blob in Sui NFT
5. **Return metadata**: Provide blob ID and storage info

### Retrieval Process

1. **Validate blob ID**: Check format and availability
2. **Download from Walrus**: Retrieve blob content
3. **Decode content**: Convert back to JSON
4. **Return todo object**: Validated todo data

### Cost Management

```typescript
// Estimate costs before upload
const costInfo = await walrusClient.calculateStorageCost(blobSize, epochs);

// Check WAL balance
const balance = await walrusClient.getWalBalance();

// Monitor storage usage
const usage = await walrusClient.getStorageUsage();
```

## Integration with Sui Blockchain

### NFT Creation

When `createNFT: true` is specified:

1. Todo content uploaded to Walrus
2. NFT created on Sui with blob reference
3. NFT metadata includes:
   - Walrus blob ID
   - Todo metadata
   - Storage information
   - Creation timestamp

### Wallet Integration

Uses existing wallet context for:
- **Signing transactions** for Walrus uploads
- **Executing NFT creation** on Sui
- **Managing WAL token payments**

## Testing and Development

### Mock Mode

For development and testing:

```typescript
// Set environment variable
WALRUS_USE_MOCK=true

// Or pass to constructor
const client = new FrontendWalrusClient('testnet', { useMock: true });
```

### Error Simulation

```typescript
// Test error handling
const client = new FrontendWalrusClient('testnet');
try {
  await client.readBlob({ blobId: 'invalid-id' });
} catch (error) {
  const errorInfo = handleWalrusError(error);
  console.log(errorInfo.suggestion);
}
```

## Usage Examples

### Basic Todo Creation

```typescript
import { useWalrusStorage } from '@/hooks/useWalrusStorage';

function TodoForm() {
  const { createTodo, uploading, progress } = useWalrusStorage();

  const handleSubmit = async (todoData) => {
    try {
      const result = await createTodo(todoData, {
        epochs: 5,
        deletable: true,
        createNFT: true
      });
      
      console.log('Todo created:', result.todo.walrusBlobId);
    } catch (error) {
      console.error('Failed to create todo:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {uploading && <ProgressBar progress={progress} />}
      {/* Form fields */}
    </form>
  );
}
```

### Todo Retrieval

```typescript
function TodoViewer({ blobId }) {
  const { retrieveTodo, downloading } = useWalrusStorage();
  const [todo, setTodo] = useState(null);

  useEffect(() => {
    async function loadTodo() {
      try {
        const todoData = await retrieveTodo(blobId);
        setTodo(todoData);
      } catch (error) {
        console.error('Failed to load todo:', error);
      }
    }

    if (blobId) {
      loadTodo();
    }
  }, [blobId, retrieveTodo]);

  if (downloading) return <Loading />;
  if (!todo) return <NotFound />;

  return <TodoDisplay todo={todo} />;
}
```

### Batch Operations

```typescript
function BatchUpload({ todos }) {
  const { createMultipleTodos, uploading, progress } = useWalrusStorage();

  const handleBatchUpload = async () => {
    try {
      const results = await createMultipleTodos(todos, {
        epochs: 5,
        onProgress: (step, progress) => {
          console.log(`${step}: ${progress}%`);
        }
      });
      
      console.log(`Uploaded ${results.length} todos`);
    } catch (error) {
      console.error('Batch upload failed:', error);
    }
  };

  return (
    <button onClick={handleBatchUpload} disabled={uploading}>
      {uploading ? `Uploading... ${progress}%` : 'Upload All'}
    </button>
  );
}
```

## Security Considerations

### Data Validation

- **Size limits**: Maximum 13MB per blob
- **Content validation**: JSON schema validation
- **Sanitization**: Input sanitization before encoding

### Access Control

- **Wallet authentication**: Required for all operations
- **Private todos**: Encrypted content for sensitive data
- **Deletable blobs**: Option to delete content later

### Error Information

- **Minimal exposure**: Don't expose sensitive error details
- **User-friendly messages**: Clear guidance for users
- **Technical details**: Available in development mode

## Performance Optimization

### Caching Strategy

- **Client-side caching**: Cache frequently accessed todos
- **Progress persistence**: Maintain upload progress across refreshes
- **Background refresh**: Auto-update balances and usage

### Retry Logic

- **Exponential backoff**: Progressive retry delays
- **Error categorization**: Different retry strategies by error type
- **Circuit breaker**: Stop retrying after repeated failures

## Troubleshooting

### Common Issues

1. **"Insufficient WAL tokens"**
   - Solution: Get testnet tokens from faucet
   - URL: https://docs.walrus.site/usage/web-api#testnet-wal-faucet

2. **"Network connection error"**
   - Solution: Check internet connection
   - Verify Walrus network status

3. **"Blob not found"**
   - Solution: Verify blob ID
   - Check if blob has expired

4. **"Wallet not connected"**
   - Solution: Connect wallet first
   - Ensure wallet has WAL tokens

### Debug Mode

Enable debug logging:

```typescript
// Set in environment
NODE_ENV=development

// Or in console
localStorage.setItem('walrus-debug', 'true');
```

## Future Enhancements

### Planned Features

- **Content encryption**: End-to-end encryption for private todos
- **Compression**: Automatic compression for large todos
- **Streaming uploads**: Support for large file uploads
- **Offline mode**: Queue operations when offline

### Integration Opportunities

- **IPFS bridge**: Dual storage on IPFS and Walrus
- **Arweave integration**: Permanent storage option
- **Cross-chain NFTs**: Support for other blockchain NFTs

## Resources

### Documentation

- [Walrus Protocol Docs](https://docs.walrus.site/)
- [Sui Blockchain Docs](https://docs.sui.io/)
- [Frontend Architecture](./frontend-implementation.md)

### Code Examples

- [Complete Integration](../waltodo-frontend/src/lib/walrus-client.ts)
- [React Hook](../waltodo-frontend/src/hooks/useWalrusStorage.ts)
- [UI Component](../waltodo-frontend/src/components/WalrusStorageManager.tsx)

### Support

- GitHub Issues: [Project Repository](https://github.com/your-repo)
- Discord: [Walrus Protocol Community](https://discord.gg/walrus)
- Documentation: [Integration Guides](./)