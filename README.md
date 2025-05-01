# Walrus Todo CLI

A decentralized todo list application that combines the power of Sui blockchain and Walrus decentralized storage.

## Overview

Walrus Todo CLI is a TypeScript-based command-line application that allows you to manage todo lists with blockchain-backed storage. It leverages Sui blockchain for state management and Walrus decentralized storage for content, providing a unique combination of verifiable state and efficient data storage.

**Key Features**:

- **Decentralized Storage**: Todo content stored on Walrus protocol
- **Blockchain Verification**: References and state managed on Sui blockchain
- **Flexible Privacy Options**: Store todos locally, on-chain, or encrypted
- **Collaboration Support**: Share todo lists with other addresses
- **Multi-Network Support**: Works with testnet and mainnet

## Installation

### Prerequisites

- Node.js 16 or higher
- npm or yarn
- Sui CLI (for blockchain interactions)
- A Sui wallet with testnet/mainnet SUI tokens

### Setup

```bash

# Install dependencies
npm install

# Build the application
npm run build

# Create a global symlink
npm link
```

## Usage

```bash
# Configure your settings (first-time setup)
waltodo configure (not needed in current implementation)

# Add a new todo
waltodo add "shopping" -t "Buy milk" -p high -d 2023-12-31 --tags groceries,important

# List todos
waltodo list "shopping"

# Mark a todo as complete
waltodo check "shopping" --id abc123

# Update a todo
waltodo update "shopping" --id abc123 -t "Buy almond milk" -p medium

# Delete a todo
waltodo delete "shopping" --id abc123

# Publish to blockchain
waltodo publish "shopping"

# Sync with blockchain
waltodo sync -l "shopping"
```

## Command Reference

### Blockchain Integration Commands

For all blockchain commands, the Walrus Todo CLI uses the Sui CLI for secure key management. Make sure you have the Sui CLI installed and configured with your wallet before using these commands.

### `deploy`

Deploy the Todo NFT smart contract to the Sui blockchain. This command will automatically save the deployment information (including the package ID) to a JSON file.

```bash
waltodo deploy --network <network>
```

Options:
- `-n, --network <network>`: Network to deploy to (localnet, devnet, testnet, mainnet)
- `-a, --address <address>`: Sui address to use (defaults to active address in Sui CLI)
- `-o, --output <path>`: Path to save deployment info (defaults to `todo_nft_deployment.json`)

### `store`

Store a todo on Walrus decentralized storage and create an NFT reference on Sui.

```bash
waltodo store --title "My Todo" --description "Details" --network <network>
```

Options:
- `-t, --title <title>`: Title of the todo (required)
- `-d, --description <description>`: Description of the todo
- `-n, --network <network>`: Network to use (devnet, testnet, mainnet)
- `-a, --address <address>`: Sui address to use (defaults to active address in Sui CLI)
- `-m, --module-address <moduleAddress>`: Todo NFT module address

### `retrieve`

Retrieve todos from Walrus and Sui blockchain.

```bash
waltodo retrieve --id <objectId> --network <network>
waltodo retrieve --all --network <network>
```

Options:
- `-i, --id <objectId>`: Sui Object ID of the Todo NFT
- `-a, --all`: Retrieve all todos owned by the current wallet
- `-n, --network <network>`: Network to use (devnet, testnet, mainnet)
- `-m, --module-address <moduleAddress>`: Todo NFT module address

### `complete-blockchain`

Mark a todo as completed on both Walrus and Sui blockchain.

```bash
waltodo complete-blockchain --id <objectId> --network <network>
```

Options:
- `-i, --id <objectId>`: Sui Object ID of the Todo NFT (required)
- `-n, --network <network>`: Network to use (devnet, testnet, mainnet)
- `-m, --module-address <moduleAddress>`: Todo NFT module address

### `image`

Upload a todo image to Walrus and optionally create an NFT.

```bash
waltodo image --todo <todoId> [options]
```

Options:
- `-t, --todo <todoId>`: ID of the todo to create an image for (required)
- `-l, --list <listName>`: Name of the todo list
- `-i, --image <filePath>`: Path to a custom image file
- `--nft`: Create an NFT that references the image
- `--show-url`: Display only the image URL

### Local Commands

### `configure`

Configure wallet and blockchain settings.

```bash
waltodo configure
waltodo configure --reset
```

### `add`

Add new todo(s).

```bash
waltodo add <list-name> -t <task> [options]
waltodo add -l <list-name> -t <task> [options]
```

Options:
- `-t, --task <task>`: Task description (required)
- `-p, --priority <level>`: Priority level (high, medium, low)
- `-d, --due <date>`: Due date in YYYY-MM-DD format
- `--tags <tag>`: Tags (can be multiple)
- `--private`: Mark todo as private (stored locally only)
- `--test`: Mark todo as test (stored locally only)

### `list`

List todos or todo lists.

```bash
waltodo list
waltodo list <list-name>
```

Options:
- `-c, --completed`: Show only completed items
- `-o, --open`: Show only open items
- `-p, --priority <level>`: Filter by priority
- `-t, --tag <tag>`: Filter by tag

### `check` / `uncheck`

Mark a todo as complete/incomplete.

```bash
waltodo check <list-name> --id <id>
waltodo uncheck <list-name> --id <id>
```

### `update`

Update a todo.

```bash
waltodo update <list-name> --id <id> [options]
```

With same options as `add` command.

### `delete`

Delete a todo or list.

```bash
waltodo delete <list-name> --id <id>
waltodo delete <list-name> --all
```

### `publish`

Publish list to blockchain.

```bash
waltodo publish <list-name>
```

### `sync`

Sync with blockchain state.

```bash
waltodo sync -l <list-name>
```

## Storage

The CLI supports two storage models:

#### 1. Traditional Model
- **Local Storage Only**: JSON files in the `Todos` directory
- Simple local file-based storage with no blockchain integration
- Ideal for quick local todo management without Web3 dependencies

#### 2. NFT-Reference Model
- **Todo Data**: Stored on Walrus decentralized storage
- **NFT Reference**: Created on Sui blockchain pointing to Walrus blob
- **Features**:
  - Walrus provides efficient, decentralized storage for todo content
  - Sui blockchain provides ownership verification via NFTs
  - NFTs can be transferred between users to delegate tasks
  - Unique blockchain identifiers for each todo
  
### How Walrus Storage and Sui NFTs Work Together

The integration between Walrus decentralized storage and Sui blockchain NFTs provides a powerful and efficient way to manage todos:

1. **Data Storage on Walrus**:
   - Todo data is serialized and stored as binary blobs on Walrus
   - Todo images are stored on Walrus with public URLs for NFT display
   - Each todo gets a unique blob ID in Walrus storage
   - Walrus provides decentralized, efficient storage for both content and images

2. **Ownership via Sui NFTs**:
   - An NFT is created on the Sui blockchain for each todo
   - The NFT contains a reference to the Walrus blob ID
   - The NFT tracks ownership and basic metadata (title, completion status)
   - Users can view and transfer todos via their NFTs

3. **Todo Lifecycle**:
   - **Creation**: Todo is stored in Walrus, then an NFT is minted with the blob reference
   - **Retrieval**: NFT provides the blob ID, which is used to fetch the full data from Walrus
   - **Completion**: Updates are made to both the Walrus blob and the NFT status
   - **Transfer**: Ownership changes when the NFT is transferred to another address

4. **Benefits**:
   - **Cost Efficiency**: Storing just the reference on-chain keeps gas costs low
   - **Data Integrity**: The full todo data is securely stored in decentralized storage
   - **Ownership**: Clear blockchain-verified ownership of todos
   - **Interoperability**: NFTs can be viewed in any Sui wallet or marketplace
   - **Rich Media**: Todo NFTs include images stored on Walrus with public URLs

## Development

### Project Structure

- `src/commands/`: CLI command handlers
- `src/services/`: Service classes for blockchain and storage
  - `todo-blockchain-service.ts`: Service that integrates Walrus storage with Sui NFTs
  - `walrus-service.ts`: Service for interacting with Walrus decentralized storage
  - `sui-service.ts`: Service for Sui blockchain operations
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions
  - `walrus-storage.ts`: Utility for storing and retrieving todo data on Walrus
  - `sui-nft-storage.ts`: Utility for managing Todo NFTs on the Sui blockchain
  - `image-generator.ts`: Utility for generating NFT images for todos
  - `walrus-image-storage.ts`: Utility for storing and retrieving todo images on Walrus
- `src/move/`: Smart contract code for Sui blockchain
  - `sources/todo_nft.move`: Move smart contract for Todo NFTs
- `src/constants.ts`: Configuration constants
- `src/index.ts`: Main CLI entry point

### Architecture

The application follows a layered architecture:

1. **Command Layer**: CLI commands that handle user input and display output
2. **Service Layer**: Business logic services that coordinate operations
3. **Utility Layer**: Lower-level utilities for specific tasks
4. **Smart Contract Layer**: Move code for on-chain operations

The flow for blockchain operations:
```
CLI Command → TodoBlockchainService → WalrusStorageUtil/SuiNftStorage → Walrus/Sui
```

### Building from Source

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Link for local development
npm link
```
