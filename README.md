# waltodo

A CLI for managing todos with Sui blockchain and Walrus decentralized storage.

## Features

- Local todo management with file system storage
- Store todos on Walrus decentralized storage
- Create NFTs representing todos on the Sui blockchain 
- Automatic todo image generation
- Multi-list support
- Sync todos between CLI, blockchain and decentralized storage

## Installation

```bash
npm install -g waltodo
```

## Configuration 

First create a config file:

```bash
waltodo configure
```

You'll need to provide:
- Sui address 
- Walrus API key (for decentralized storage)
- Network (devnet, testnet, mainnet) 
- Package ID of deployed smart contract

Or setup with environment variables:
```
NETWORK=testnet
PACKAGE_ID=<package-id>
WALRUS_API_KEY=<key>
```

## Usage

### Local Todos

Create a new todo list:
```bash
waltodo create my-list
```

Add a todo:
```bash 
waltodo add my-list -t "Buy groceries" -p high
```

List todos:
```bash
waltodo list my-list
```

Complete a todo:
```bash
waltodo complete my-list -i todo-123
```

### Blockchain Integration

Store a todo on blockchain with NFT:
```bash
waltodo store --todo todo-123 --list my-list --create-nft
```

Retrieve todo by NFT ID:
```bash
waltodo retrieve --by-nft 0x123...
```

Complete a todo on blockchain:
```bash
waltodo complete-blockchain -i 0x123...
```

### Network Commands 

Switch network:
```bash
waltodo network testnet
```

Show account info:
```bash 
waltodo account show
```

Deploy smart contract:
```bash
waltodo deploy testnet
```

## Storage Architecture

The application uses a hybrid storage model:

### Local Storage
- Plain JSON files in the `Todos` directory
- Simple local file-based storage with no blockchain integration
- Ideal for quick local todo management

### Decentralized Storage
- **Todo Data**: Stored on Walrus decentralized storage
- **NFT Reference**: Created on Sui blockchain pointing to Walrus blob
- **Features**:
  - Walrus provides efficient, decentralized storage for todo content
  - Sui blockchain provides ownership verification via NFTs
  - NFTs can be transferred between users
  - Unique blockchain identifiers for each todo

### Storage Flow
1. **Creation**: Todo is stored in Walrus, then an NFT is minted
2. **Retrieval**: NFT provides blob ID to fetch data from Walrus
3. **Updates**: Changes sync to both Walrus and blockchain
4. **Transfer**: Transfer NFT to move ownership

## Development

### Setup

```bash
# Install dependencies 
npm install

# Build
npm run build

# Run tests
npm test

# Run in dev mode
npm run dev
```

### Project Structure

- `src/commands/`: CLI command implementations
- `src/services/`: Core services
  - `todo-service.ts`: Local todo management
  - `todo-blockchain-service.ts`: Blockchain integration
  - `walrus-service.ts`: Decentralized storage
- `src/utils/`: Utility functions
- `src/move/`: Smart contracts
  - `sources/todo_nft.move`: Todo NFT contract

### Smart Contract

The [Todo NFT contract](src/move/sources/todo_nft.move) handles:
- NFT creation
- Metadata updates
- Completion status
- Transfer logic

## Walrus Image Storage

This project includes a module for storing images on Sui's Walrus storage protocol. The `WalrusImageStorage` class provides functionality to:

1. Connect to the Sui blockchain and Walrus storage
2. Upload images and get a permanent URL for them
3. Support mock mode for development without WAL tokens

### Usage

```typescript
import { SuiClient } from '@mysten/sui/client';
import { createWalrusImageStorage } from './src/utils/walrus-image-storage';

// Create SuiClient
const suiClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });

// Create Walrus storage client (mock mode for development)
const walrusStorage = createWalrusImageStorage(suiClient, true);

// Connect 
await walrusStorage.connect();

// Upload an image
const imageUrl = await walrusStorage.uploadImage('/path/to/image.jpg');
console.log('Image URL:', imageUrl);

// Or use the default image
const defaultImageUrl = await walrusStorage.uploadDefaultImage();
```

### Real Walrus Storage Usage

To use real Walrus storage (not mock mode):

1. You need WAL tokens in your wallet
2. Set `mockMode=false` when creating the storage client
3. Make sure you're on the Sui testnet
4. Ensure you have a valid Sui address and keypair

```typescript
// Create with mock mode disabled
const walrusStorage = createWalrusImageStorage(suiClient, false);
```

This implementation uses the `@mysten/walrus` SDK to interact with Walrus storage.
