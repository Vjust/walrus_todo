# WalTodo

A powerful CLI for managing todos with Sui blockchain and Walrus decentralized storage.

## Overview

WalTodo is a feature-rich command-line interface (CLI) application that combines traditional todo list management with blockchain technology. It allows you to create, manage, and organize your todos locally, while also providing the option to store them on the Sui blockchain as NFTs and in Walrus decentralized storage.

## Features

- **Intuitive CLI**: Natural language command syntax for adding todos with spaces
- **Local Storage**: Quick todo management with file system storage
- **Blockchain Integration**: Store todos on the Sui blockchain as NFTs
- **Decentralized Storage**: Use Walrus for efficient, decentralized data storage
- **Multi-list Support**: Organize todos in different lists
- **Automatic Image Generation**: Generate images for todo NFTs
- **Seamless Sync**: Sync todos between CLI, blockchain and decentralized storage
- **Priority & Tags**: Add priority levels and tags to your todos
- **Flexible Filtering**: Filter todos by status, priority, or tags
- **Ownership & Transfer**: Transfer todo NFTs between users
- **Secure Storage**: Todos stored on blockchain cannot be lost or corrupted

## CLI Commands Overview

The WalTodo CLI provides a comprehensive set of commands for managing todos:

- **`add`**: Add new todo items to a list (creates the list if it doesn't exist)
- **`list`**: List todos or todo lists
- **`account`**: Manage Sui account for todos
- **`configure`**: Configure CLI settings
- **`store`**: Store todos on blockchain and Walrus
- **`retrieve`**: Retrieve todos from blockchain or Walrus storage
- **`deploy`**: Deploy the Todo NFT smart contract to the Sui blockchain
- **`storage`**: Manage and analyze Walrus storage efficiency and token usage

### Intuitive Command Syntax

The CLI is designed to be intuitive and user-friendly:

```bash
# Add a todo with a natural language syntax
waltodo add "Buy groceries for dinner"

# The command automatically handles spaces in todo titles
waltodo add "Call John about the project" -p high
```

For a comprehensive reference of all CLI commands, see [CLI-COMMANDS.md](CLI-COMMANDS.md).

## Installation

### Option 1: Global Installation

```bash
# Clone the repository
git clone https://github.com/Vjust/walrus_todo.git
cd walrus_todo

# Install dependencies
pnpm install

# Install CLI globally
pnpm run global-install
```

After installation, you can use the `waltodo` command from anywhere without needing to modify your PATH.

### Option 2: Local Installation

```bash
# Clone the repository
git clone https://github.com/Vjust/walrus_todo.git
cd walrus_todo

# Install dependencies
pnpm install

# Install CLI locally
./fix-cli.sh
```

The local installation will make the `waltodo` command available in your `~/.local/bin` directory.

For detailed CLI usage instructions, see [CLI-USAGE.md](CLI-USAGE.md).

## Quick Start

Get up and running with WalTodo in minutes:

```bash
# Install the CLI
pnpm run global-install

# Add your first todo
waltodo add "My first todo task"

# List your todos
waltodo list

# Add a todo with priority and tags
waltodo add "Important task" -p high -g "work,urgent"

# Create a new list and add a todo to it
waltodo add "Shopping item" -l shopping

# Mark a todo as complete (replace 123 with your todo ID)
waltodo complete --id 123
```

For blockchain integration:

```bash
# Configure with your Sui address
waltodo configure

# Deploy the smart contract (one-time setup)
waltodo deploy --network testnet

# Store a todo on the blockchain (replace 123 with your todo ID)
waltodo store --todo 123 --list default
```

## Getting Started

### Setting Up Your Environment

1. **Install Dependencies**:
   Make sure you have Node.js v18+ and pnpm v8+ installed:
   ```bash
   node --version
   pnpm --version
   ```
   If you don't have pnpm installed, you can install it with:
   ```bash
   npm install -g pnpm
   ```

2. **Clone and Install**:
   ```bash
   git clone https://github.com/Vjust/walrus_todo.git
   cd walrus_todo
   pnpm install
   ```

3. **Install the CLI**:
   ```bash
   # Option 1: Global installation
   pnpm run global-install

   # Option 2: Local installation
   ./fix-cli.sh
   ```

4. **Verify Installation**:
   ```bash
   waltodo --version
   ```

### Basic Todo Management

1. **Create Your First Todo**:
   ```bash
   waltodo add "Complete project documentation"
   ```

2. **View Your Todos**:
   ```bash
   waltodo list
   ```

3. **Create a New List**:
   ```bash
   waltodo add "Buy groceries" -l shopping
   ```

4. **Add Todos with Priority and Tags**:
   ```bash
   waltodo add "Call client" -p high -g "work,urgent"
   ```

5. **Mark a Todo as Complete**:
   ```bash
   # First, list todos to get the ID
   waltodo list

   # Then complete the todo (replace 123 with your todo ID)
   waltodo complete --id 123
   ```

### Advanced: Blockchain Integration

1. **Configure Blockchain Settings**:
   ```bash
   waltodo configure
   ```
   You'll need to provide your Sui wallet address and select a network.

2. **Deploy the Smart Contract** (one-time setup):
   ```bash
   waltodo deploy --network testnet
   ```

3. **Store a Todo on the Blockchain**:
   ```bash
   # First, list todos to get the ID
   waltodo list

   # Then store the todo (replace 123 with your todo ID)
   waltodo store --todo 123 --list default
   ```

4. **Retrieve a Todo from the Blockchain**:
   ```bash
   # Retrieve by NFT object ID
   waltodo retrieve --object-id 0x123...
   ```

## Prerequisites

### System Requirements

- **Node.js**: v18.0.0 or higher
- **pnpm**: v8.0.0 or higher
- **Operating Systems**: macOS, Linux, or Windows with WSL

### For Local Usage Only

- No additional requirements for basic local todo management

### For Blockchain Integration

Before using the blockchain features, you need to set up:

1. **Sui CLI**: Install the Sui CLI for interacting with the Sui blockchain
   ```bash
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui
   ```

2. **Sui Wallet**: Create a wallet and get testnet tokens
   ```bash
   # Create a new wallet
   sui client new-address ed25519

   # Get testnet tokens from the faucet
   sui client faucet
   ```

3. **WAL Tokens**: For Walrus storage, you need WAL tokens on the testnet
   ```bash
   # Check your balance
   sui client gas
   ```

4. **Internet Connection**: Required for blockchain and Walrus interactions

## Configuration

First create a config file:

```bash
waltodo configure
```

You'll need to provide:
- Sui address (from your Sui wallet)
- Network (devnet, testnet, mainnet)
- Package ID of deployed smart contract (after running `waltodo deploy`)

Or setup with environment variables:
```
NETWORK=testnet
PACKAGE_ID=<package-id>
```

## Basic Todo Management

The CLI supports a natural, intuitive syntax for adding todos:

```bash
# Simply add a todo to the default list
waltodo add "Buy groceries for dinner"
```

Lists are created automatically if they don't exist:

```bash
# Create a list and add a todo in one command
waltodo add "Buy milk" -l shopping
```

Add a todo with due date, priority, and tags:

```bash
# Add a todo with all options
waltodo add "Important meeting" -l work -p high -d 2024-05-15 -g "work,urgent"
```

Add multiple todos at once:

```bash
# Add multiple todos to a list
waltodo add -l shopping -t "Milk" -t "Eggs" -t "Bread"
```

List all todo lists:
```bash
waltodo list
```

List todos in a specific list:
```bash
waltodo list my-list
```

List only completed or pending todos:
```bash
waltodo list my-list --completed
waltodo list my-list --pending
```

## Blockchain Integration with Sui and Walrus

WalTodo uses a hybrid storage model where todo data is stored on Walrus decentralized storage, and NFT references are created on the Sui blockchain. This provides both efficient storage and secure ownership verification.

### Step 1: Deploy the Smart Contract

Before storing todos on the blockchain, you need to deploy the Todo NFT smart contract:

```bash
# Deploy to testnet (recommended for testing)
waltodo deploy --network testnet

# Or deploy to mainnet (for production use)
waltodo deploy --network mainnet
```

This will:
- Create a new Move package with the Todo NFT smart contract
- Publish it to the Sui blockchain
- Save the deployment information to your configuration
- Display the package ID that will be used for subsequent commands

### Step 2: Store a Todo on the Blockchain

Once you have a todo in your local storage, you can store it on the blockchain:

```bash
# First, create a local todo
waltodo add "Complete blockchain integration" -l blockchain-tasks

# List todos to get the ID
waltodo list blockchain-tasks

# Store the todo on blockchain (replace TODO_ID with the actual ID)
waltodo store --todo TODO_ID --list blockchain-tasks
```

This command:
1. Uploads the todo data to Walrus decentralized storage
2. Creates an NFT on the Sui blockchain with a reference to the Walrus blob
3. Updates the local todo with the blockchain references
4. Displays the transaction ID and links to view the NFT

You can also store a todo with a custom image:

```bash
waltodo store --todo TODO_ID --list blockchain-tasks --image ./custom-image.png
```

### Step 3: Analyze and Optimize Storage

```bash
# View storage summary and allocation statistics
waltodo storage --summary

# Identify opportunities for storage reuse and WAL token savings
waltodo storage --analyze

# Get detailed information about all storage allocations
waltodo storage --detail
```

### Step 4: Retrieve and Manage Todos

```bash
# Retrieve a todo by its NFT object ID
waltodo retrieve --object-id 0x123...

# Complete a todo
waltodo complete --list blockchain-tasks --id TODO_ID

# Verify completion
waltodo list blockchain-tasks
```

### Step 5: Share Todos with Others

```bash
# Transfer a todo NFT to another address
sui client transfer --object-id 0x123... --to 0x456... --gas-budget 10000000
```

This transfers ownership of the todo to another user, who can then retrieve and manage it.

## Walrus Storage Integration

WalTodo uses Walrus for decentralized storage of todo data and images. This provides efficient, secure, and censorship-resistant storage.

### How Walrus Storage Works

1. **Blob Storage**: Each todo is stored as a blob on Walrus
2. **Blob ID**: A unique identifier is generated for each blob
3. **Availability**: Data is stored for a specified number of epochs (time periods)
4. **Retrieval**: Data can be retrieved using the blob ID

### Image Storage on Walrus

Todo NFTs can include images, which are also stored on Walrus:

```bash
# Store a todo with a custom image
waltodo store --todo TODO_ID --list my-list --image ./custom-image.png
```

The image is uploaded to Walrus and linked to the NFT on the Sui blockchain.

### Technical Details

- Images are stored for approximately 6 months (52 epochs)
- The default image is used if no custom image is provided
- Images are accessible via a URL in the format: `https://testnet.wal.app/blob/BLOB_ID`

## Complete Blockchain Todo Workflow

Here's a complete workflow for managing todos on the blockchain:

### 1. Setup and Configuration

```bash
# Install the CLI
pnpm run global-install

# Configure with your Sui address
waltodo configure

# Deploy the smart contract
waltodo deploy --network testnet
```

### 2. Create and Store Todos

```bash
# Create a local todo
waltodo add "Complete blockchain integration" -l blockchain-tasks

# List todos to get the ID
waltodo list blockchain-tasks

# Store on blockchain
waltodo store --todo TODO_ID --list blockchain-tasks
```

### 3. Analyze and Optimize Storage

```bash
# View storage summary and allocation statistics
waltodo storage --summary

# Identify opportunities for storage reuse and WAL token savings
waltodo storage --analyze

# Get detailed information about all storage allocations
waltodo storage --detail
```

### 4. Retrieve and Manage Todos

```bash
# Retrieve a todo by NFT ID
waltodo retrieve --object-id 0x123...

# Complete a todo
waltodo complete --list blockchain-tasks --id TODO_ID

# Verify completion
waltodo list blockchain-tasks
```

### 5. Share Todos with Others

```bash
# Transfer a todo NFT to another address
sui client transfer --object-id 0x123... --to 0x456... --gas-budget 10000000
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
1. **Creation**: Todo is stored in Walrus, and an NFT is automatically minted on Sui
2. **Retrieval**: NFT provides blob ID to fetch data from Walrus
3. **Updates**: Changes sync to both Walrus and blockchain
4. **Transfer**: Transfer NFT to move ownership
5. **Images**: Todo images are stored on Walrus with references in the NFT

### Storage Optimization
The CLI now includes advanced storage optimization features to maximize efficiency and reduce costs:

1. **Precise Size Calculation**: The `TodoSizeCalculator` precisely measures the exact storage requirements for todos, preventing over-allocation.
2. **Storage Reuse**: The `StorageReuseAnalyzer` implements a best-fit algorithm to find and reuse existing storage allocations, maximizing WAL token efficiency.
3. **Smart Allocation**: Automatically calculates the most cost-effective storage approach between creating new storage or reusing existing capacity.
4. **Token Savings Analysis**: Provides detailed analytics on WAL token savings when reusing storage vs. creating new allocations.
5. **Storage Management**: The new `storage` command provides comprehensive monitoring and analytics for Walrus storage usage.

```bash
# Show storage summary (active allocations and total capacity)
waltodo storage --summary

# Show detailed storage information (size, epochs, blob counts)
waltodo storage --detail

# Analyze storage efficiency and token savings
waltodo storage --analyze
```

The storage optimization system considers:
- Current storage utilization and capacity
- Remaining epochs for each storage allocation
- Cost comparison between new and reused storage
- Minimum buffer requirements for future expansion
- Optimal allocation size based on todo requirements

For comprehensive documentation, see:
- [Storage Optimization Guide](docs/storage-optimization.md)
- [Storage Command Usage](docs/storage-command-usage.md)

## Smart Contract Details

The Todo NFT smart contract is implemented in Move and handles:

- NFT creation with references to Walrus blobs
- Metadata updates and completion status
- Transfer logic for sharing todos
- Events for tracking todo creation and completion

Key features of the contract:
- Todos are represented as NFTs with unique IDs
- Each NFT contains a reference to the Walrus blob ID
- The contract emits events when todos are created or completed
- NFTs can be transferred between users

## Troubleshooting

### Common Issues

1. **"Contract not deployed" error**:
   - Run `waltodo deploy --network testnet` first
   - Check your configuration with `waltodo configure`

2. **"Insufficient gas" error**:
   - Get more testnet SUI tokens from the faucet: `sui client faucet`

3. **"Todo not found" error**:
   - Verify the todo ID with `waltodo list <list-name>`
   - Make sure you're using the correct list name

4. **"Failed to upload image" error**:
   - Check that the image file exists and is a valid JPG or PNG
   - Ensure you have WAL tokens for storage

5. **"Insufficient storage" or "Storage allocation failed" error**:
   - Run `waltodo storage --analyze` to check available storage
   - Ensure you have enough WAL tokens for new storage allocation
   - Consider optimizing by reusing existing storage with sufficient capacity
   - Reduce the size of todo data if possible

6. **CLI command not found**:
   - Reinstall the CLI: `pnpm run global-install`
   - Or run directly: `~/.local/bin/waltodo`

7. **TypeScript build errors**:
   - Run `./fix-typescript-errors.sh` to resolve SDK compatibility issues
   - Or use `pnpm run build-compatible` to bypass type checking
   - These errors are expected due to version mismatches between Sui and Walrus SDKs
   - The CLI will still work correctly despite these TypeScript errors
   - If path issues occur, ensure the PROJECT_ROOT in bin/waltodo and bin/waltodo-bash is correctly set to your actual project path

### Getting Help

For more detailed troubleshooting:
- Check the [CLI-COMMANDS.md](CLI-COMMANDS.md) for command reference
- Run any command with `--help` for usage information
- Use the `--verbose` flag for more detailed output

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Build (with TypeScript fixes)
./fix-typescript-errors.sh

# Or standard build (may produce TypeScript errors)
pnpm run build

# Fix and install CLI locally
./fix-cli.sh

# Run tests
pnpm test

# Run specific tests
pnpm test -- -t "test name pattern"

# Run tests with coverage
pnpm test -- --coverage

# Run in dev mode
pnpm run dev
```

> **Note about TypeScript Errors**: When building the project, you might encounter TypeScript errors related to SDK compatibility. These are expected due to version differences in Sui and Walrus SDKs. Use `./fix-typescript-errors.sh` to build successfully with transpile-only mode that bypasses these errors.

### CLI Development

When making changes to the CLI, use the following scripts:

```bash
# Fix TypeScript build issues
./fix-typescript-errors.sh

# Update the CLI after making changes
./update-cli.sh

# Test all CLI commands
./test-all-commands.sh
```

**Important Note on Project Paths:**
The CLI scripts in `bin/waltodo` and `bin/waltodo-bash` contain a hardcoded `PROJECT_ROOT` variable. If you're encountering path-related errors, ensure this path is correctly set to your actual project location. After cloning the repository to a different location, you may need to update this path manually or run `./update-cli.sh` to fix it.

### Testing Infrastructure

WalTodo has a comprehensive testing infrastructure:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test interactions between components
- **Edge Case Tests**: Test boundary conditions and error handling
- **Fuzz Tests**: Test with random inputs to find unexpected issues
- **Command Tests**: Test CLI commands end-to-end

The test files are organized in the `src/__tests__/` directory, mirroring the structure of the source code. We use Jest as our testing framework.

```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test -- --coverage

# Run specific test files
pnpm test -- src/__tests__/commands/add.test.ts

# Run tests matching a pattern
pnpm test -- -t "should add a todo"

# Run tests in watch mode (re-run on file changes)
pnpm test -- --watch
```

Mock implementations for external dependencies are provided in the `src/__mocks__/` directory, allowing tests to run without external services like Sui blockchain or Walrus storage.

### Project Structure

```
walrus_todo/
├── assets/               # Static assets and images
├── bin/                  # CLI executable scripts
│   ├── run               # OCLIF runner
│   ├── run.js            # Node.js entry point
│   ├── waltodo           # Main CLI executable
│   ├── waltodo-bash      # Bash wrapper for CLI
│   ├── waltodo-debug     # Debug version of CLI
│   ├── waltodo-direct    # Direct CLI executable
│   ├── waltodo-new       # New CLI implementation
│   ├── waltodo-standalone # Standalone CLI version
│   └── waltodo-wrapper   # Wrapper script for CLI
├── docs/                 # Documentation
│   ├── cli-plan.md           # CLI development plan
│   ├── cli_examples.md       # Examples of CLI usage
│   ├── implementation-status.md # Current implementation status
│   ├── mocking.md            # Mocking strategy for tests
│   ├── tests.md              # Testing documentation
│   ├── storage-optimization.md # Storage optimization guide
│   ├── storage-command-usage.md # Storage command usage
│   └── walrusintegration.md  # Walrus integration details
├── examples/             # Example code and usage patterns
├── scripts/              # Utility scripts
├── src/
│   ├── __mocks__/        # Mock implementations for testing
│   ├── __tests__/        # Test files
│   │   ├── commands/     # Command tests
│   │   ├── edge-cases/   # Edge case tests
│   │   ├── fuzz/         # Fuzz testing
│   │   ├── helpers/      # Test helpers
│   │   ├── integration/  # Integration tests
│   │   ├── types/        # Type tests
│   │   └── utils/        # Utility tests
│   ├── commands/         # Command implementations
│   │   ├── account/      # Account management commands
│   │   │   ├── show.ts   # Show account details
│   │   │   └── switch.ts # Switch between accounts
│   │   ├── image/        # Image-related commands
│   │   │   ├── create-nft.ts # Create NFT with image
│   │   │   └── upload.ts # Upload image to Walrus
│   │   ├── add.ts        # Add todo command
│   │   ├── check.ts      # Check todo status
│   │   ├── complete.ts   # Complete todo command
│   │   ├── configure.ts  # Configuration command
│   │   ├── create.ts     # Create todo list
│   │   ├── delete.ts     # Delete todo or list
│   │   ├── deploy.ts     # Deploy smart contract
│   │   ├── fetch.ts      # Fetch todos
│   │   ├── image.ts      # Image command group
│   │   ├── index.ts      # Command exports
│   │   ├── list.ts       # List todos command
│   │   ├── retrieve.ts   # Retrieve from blockchain
│   │   ├── share.ts      # Share todos
│   │   ├── simple.ts     # Simple mode commands
│   │   ├── storage.ts    # Storage management
│   │   ├── store.ts      # Store on blockchain
│   │   ├── template.ts   # Template for new commands
│   │   └── update.ts     # Update todo
│   ├── hooks/            # OCLIF hooks
│   │   └── init.ts       # Initialization hook
│   ├── move/             # Smart contracts
│   │   ├── build/        # Compiled contracts
│   │   └── sources/      # Contract source code
│   ├── services/         # Core services
│   │   ├── config-service.ts     # Configuration management
│   │   ├── index.ts              # Service exports
│   │   ├── SuiTestService.ts     # Test service for Sui
│   │   ├── todo-service.ts       # Todo management
│   │   ├── todoService.ts        # Alternative todo service
│   │   └── WalrusTestService.ts  # Test service for Walrus
│   ├── types/            # TypeScript type definitions
│   │   ├── blob.ts       # Blob storage types
│   │   ├── client.ts     # Client types
│   │   ├── error.ts      # Error types
│   │   ├── errors.ts     # Error definitions
│   │   ├── index.ts      # Type exports
│   │   ├── network.ts    # Network types
│   │   ├── signer.ts     # Signer types
│   │   ├── todo.d.ts     # Todo type declarations
│   │   ├── todo.ts       # Todo type implementations
│   │   ├── transaction.ts # Transaction types
│   │   ├── walrus.d.ts   # Walrus type declarations
│   │   └── walrus.ts     # Walrus type implementations
│   ├── utils/            # Utility functions
│   │   ├── blob-verification.ts  # Verify blobs
│   │   ├── error-handler.ts      # Error handling
│   │   ├── ExpiryMonitor.ts      # Monitor expirations
│   │   ├── FileValidator.ts      # Validate files
│   │   ├── id-generator.ts       # Generate IDs
│   │   ├── image-generator.ts    # Generate images
│   │   ├── index.ts              # Utility exports
│   │   ├── Logger.ts             # Logging
│   │   ├── MockWalrusClient.ts   # Mock Walrus client
│   │   ├── NetworkValidator.ts   # Validate networks
│   │   ├── path-utils.ts         # Path utilities
│   │   ├── retry-manager.ts      # Retry logic
│   │   ├── storage-manager.ts    # Storage management
│   │   ├── storage-reuse-analyzer.js # Analyze and optimize storage usage
│   │   ├── StorageManager.ts     # Storage manager class
│   │   ├── sui-keystore.ts       # Sui keystore
│   │   ├── sui-nft-storage.ts    # NFT storage on Sui
│   │   ├── todo-serializer.ts    # Serialize todos
│   │   ├── todo-size-calculator.ts # Calculate exact todo storage requirements
│   │   ├── TransactionHelper.ts  # Transaction helpers
│   │   ├── VaultManager.ts       # Manage secure storage
│   │   ├── wallet-extension.ts   # Wallet extensions
│   │   ├── walrus-image-storage.ts # Image storage on Walrus
│   │   ├── walrus-storage.ts     # Walrus storage
│   │   └── WalrusUrlManager.ts   # Manage Walrus URLs
│   ├── base-command.ts   # Base command class
│   ├── constants.ts      # Configuration constants
│   ├── create-todo.ts    # Todo creation logic
│   ├── delete-todo.ts    # Todo deletion logic
│   ├── index.ts          # Main CLI entry point
│   ├── manage-lists.ts   # List management
│   ├── manage-todos.ts   # Todo management
│   └── update-todo.ts    # Todo update logic
├── todos/                # Local todo storage directory
├── CLI-COMMANDS.md       # Command reference
├── CLI-USAGE.md          # Usage guide
├── fix-cli.sh            # CLI installation script
├── install-global.sh     # Global installation script
├── jest.config.js        # Jest configuration
├── package.json          # Package configuration
├── pnpm-workspace.yaml   # PNPM workspace config
├── test-all-commands.sh  # Test script
├── tsconfig.json         # TypeScript configuration
├── update-cli.sh         # CLI update script
└── README.md             # This file
```

## Walrus Image Storage

This project includes a module for storing images on Sui's Walrus storage protocol. The `WalrusImageStorage` class provides functionality to:

1. Connect to the Sui blockchain and Walrus storage
2. Upload images and get a permanent URL for them
3. Support mock mode for development without WAL tokens

### Usage

```typescript
import { SuiClient } from '@mysten/sui.js/client';
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

## TypeScript Compatibility

The codebase has been updated for TypeScript compatibility with the following considerations:

1. Interface alignment between different versions of the `@mysten/sui` and `@mysten/walrus` libraries
2. Method signature compatibility between mock implementations and library interfaces
3. Handling different return types from WalrusClient implementations
4. Support for method overloading in key client implementations

When maintaining the codebase, be aware of the following compatibility considerations:

- The `src/__mocks__/@mysten/sui/signer.ts` file provides a compatible mock implementation of the Signer interface
- The `src/__mocks__/@mysten/sui/transactions.ts` file includes proper TransactionBlock method signatures
- The `src/__mocks__/@mysten/walrus/client.ts` and `src/utils/MockWalrusClient.ts` handle both the original and extended client interfaces
- Image and blob handling in `src/utils/walrus-image-storage.ts` and `src/utils/walrus-storage.ts` handle different client response formats

### Known TypeScript Compatibility Issues

The codebase currently has some TypeScript compatibility issues that are addressed with `@ts-ignore` comments in specific locations. These are intentional and necessary to allow the codebase to build while reconciling different versions of dependencies:

1. **Signer Interface Differences**: The Signer interface from `@mysten/sui.js/cryptography` has different method signatures than our implementation
2. **TransactionBlock Implementation**: Methods like `add`, `moveCall`, and others have compatibility issues with the base TransactionBlock interface
3. **WalrusClient Interface**: The WalrusClient interface has method signature differences between interface versions
4. **Response Type Handling**: Different response types are handled with type assertions and conditional checks

### Build Commands

- `pnpm run build` - Standard build with type checking (will skip emitting on errors)
- `pnpm run build-force` - Build with type checking but emit files even with errors
- `pnpm run build-compatible` - Build with transpile-only mode to skip type checking entirely
- `pnpm run typecheck` - Run TypeScript type checking without emitting JavaScript
- `./fix-typescript-errors.sh` - Automatically fix TypeScript build issues with the optimal approach

The project includes a special helper script `fix-typescript-errors.sh` that resolves TypeScript compatibility issues with Sui and Walrus SDK dependencies. Use this script to get a successful build even when TypeScript reports errors related to blockchain SDK interfaces.

When updating dependencies or refactoring code, prefer to use `pnpm run build-force` to see all type errors while still generating the output files. For deployment or testing where you just need a working build, use `pnpm run build-compatible` to bypass type checking completely with transpile-only mode.

For a comprehensive guide on TypeScript compatibility, see [TypeScript Compatibility Guide](docs/typescript-compatibility.md).