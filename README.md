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
- Sui CLI (for blockchain interactions) (Currently Mocked)
- A Sui wallet with testnet/mainnet SUI tokens (Currently Mocked)

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

Todo lists are stored in multiple locations:

- **Local Storage**: JSON files in the `Todos` directory
- **Walrus Protocol**: Decentralized storage for todo content
- **Sui Blockchain**: References and state information

Storage behavior depends on the todo type:
- **Regular todos**: Synchronized with both Walrus storage and Sui blockchain
- **Private todos**: Stored only locally
- **Test todos**: Stored only locally
- **Encrypted todos**: Stored encrypted in Walrus storage

## Development

### Project Structure

- `src/commands/`: CLI command handlers
- `src/services/`: Service classes for blockchain and storage
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions
- `src/constants.ts`: Configuration constants
- `src/index.ts`: Main CLI entry point

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