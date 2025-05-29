# WalTodo

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage Status](https://img.shields.io/badge/coverage-85%25-green)
![Tests](https://img.shields.io/badge/tests-144%20passed-brightgreen)
[![codecov](https://codecov.io/gh/Vjust/walrus_todo/branch/main/graph/badge.svg)](https://codecov.io/gh/Vjust/walrus_todo)
![License](https://img.shields.io/badge/license-MIT-blue)

A powerful CLI for managing todos with Sui blockchain and Walrus decentralized storage.

## Quick Start

Get started with WalTodo in minutes using our automated setup script:

```bash
# Clone the repository
git clone https://github.com/Vjust/walrus_todo.git
cd walrus_todo

# Run the setup script
./scripts/setup-dev-env.sh

# Start all services (CLI + API + Frontend)
pnpm dev:all
```

The setup script will:
- Copy all necessary `.env` files from examples
- Install dependencies with pnpm
- Build the CLI and shared packages
- Generate frontend configuration
- Create required directories
- Provide clear next-step instructions

## Overview

WalTodo is a feature-rich todo management system that combines traditional task management with decentralized technologies. The system features a powerful command-line interface (CLI) and a modern web frontend, all backed by a hybrid architecture that leverages the best of both centralized and decentralized approaches.

### Hybrid Architecture

WalTodo implements a unique hybrid architecture that balances performance, user experience, and decentralization:

- **API Server**: Centralized compute layer for business logic, AI operations, and coordination
- **Walrus Storage**: Decentralized storage for todo data and images
- **Sui Blockchain**: Decentralized ledger for ownership, verification, and NFT management
- **Local Storage**: Fast, offline-capable storage for immediate access

This approach provides the responsiveness of traditional applications while maintaining the benefits of decentralization where it matters most - data ownership and permanence.

### System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Web Frontend  │────▶│   API Server    │────▶│     Walrus      │
│   (Next.js)     │     │   (Compute)     │     │   (Storage)     │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │                        │
┌─────────────────┐              │                        │
│                 │              │                        ▼
│   CLI Client    │──────────────┘              ┌─────────────────┐
│   (OCLIF)       │                             │                 │
│                 │◀────────────────────────────│  Sui Blockchain │
└─────────────────┘                             │   (Ownership)   │
                                                │                 │
                                                └─────────────────┘
```

## Features

- **Intuitive CLI**: Natural language command syntax for adding todos with spaces
- **Local Storage**: Quick todo management with file system storage
- **Blockchain Integration**: Store todos on the Sui blockchain as NFTs
- **Decentralized Storage**: Use Walrus for efficient, decentralized data storage via CLI integration
- **Robust Network Handling**:
  - Configurable timeouts with AbortController for cancellation
  - Automatic retries with exponential backoff
  - Proper resource cleanup for all operations
  - Detailed error categorization and handling
- **Comprehensive Input Validation**: Schema-based validation and sanitization for all commands
- **Enhanced AI Features**:
  - Multi-provider support (XAI/Grok, OpenAI, Anthropic)
  - Summarize todo lists with key insights
  - Get intelligent tag and priority suggestions
  - Analyze productivity patterns
  - Advanced task suggestion system with dependency detection
  - Blockchain-verified AI operations
  - Secure credential management
  - Privacy-preserving AI interactions
  - Performance-optimized with caching and batching
  - Cancellable AI operations with timeout management
- **Multi-list Support**: Organize todos in different lists
- **Automatic Image Generation**: Generate images for todo NFTs
- **🚀 Background Command Orchestrator**: 
  - Universal background execution for all CLI commands
  - Automatic detection of long-running operations
  - Unified progress tracking with real-time updates
  - Global resource management and concurrency controls
  - Comprehensive job management and monitoring
  - Background process isolation and cleanup
- **Seamless Sync**: Sync todos between CLI, blockchain and decentralized storage
- **Priority & Tags**: Add priority levels and tags to your todos
- **Flexible Filtering**: Filter todos by status, priority, or tags
- **Ownership & Transfer**: Transfer todo NFTs between users
- **Secure Storage**: Todos stored on blockchain cannot be lost or corrupted
- **Production Testnet Storage**: Stores on Walrus testnet by default, mock only during development

## CLI Commands Overview

The WalTodo CLI provides a comprehensive set of commands for managing todos:

- **`add`**: Add new todo items to a list (creates the list if it doesn't exist)
  - Add AI capabilities with `--ai` flag for smart tag and priority suggestions
- **`list`**: List todos or todo lists
- **`account`**: Manage Sui account for todos
- **`configure`**: Configure CLI settings
- **`store`**: Store todos on Walrus and reference them on Sui blockchain by blob ID
- **`retrieve`**: Retrieve todos from blockchain or Walrus storage
- **`deploy`**: Deploy the Todo NFT smart contract to the Sui blockchain
- **`storage`**: Manage and analyze Walrus storage efficiency and token usage
- **`ai`**: AI-powered todo operations:
  - `summarize`: Get concise todo list overviews
  - `categorize`: Suggest tags for todos
  - `prioritize`: Suggest priority levels
  - `suggest`: Generate related task suggestions
  - `analyze`: Analyze productivity patterns
  - `credentials`: Manage AI provider credentials securely
  - `verify`: Verify AI operations on blockchain
- **`suggest`**: Enhanced intelligent task suggestion system:
  - Smart next-step recommendations
  - Context-aware related tasks
  - Dependency detection and analysis
  - Effort estimation with reasoning
  - Relevance scoring with confidence
  - Blockchain verification integration
  - Multi-provider support with fallback

### Intuitive Command Syntax

The CLI is designed to be intuitive and user-friendly:

```bash
# Add a todo with a natural language syntax
waltodo add "Buy groceries for dinner"

# The command automatically handles spaces in todo titles
waltodo add "Call John about the project" -p high

# Use AI to enhance your todos
waltodo add "Prepare presentation for client meeting" --ai

# Get AI insights about your todos
waltodo ai summarize

# Run long operations in background
waltodo store --background my-list
waltodo deploy --bg
waltodo sync --background

# Monitor background jobs
waltodo jobs
waltodo jobs status <job-id>
waltodo jobs --watch
```

For a comprehensive reference of all CLI commands, see [CLI-COMMANDS.md](CLI-COMMANDS.md).

## Development Environment Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **pnpm**: v8.0.0 or higher
- **Operating Systems**: macOS, Linux, or Windows with WSL

### Automated Setup

The fastest way to get started is using our setup script:

```bash
# After cloning the repository
cd walrus_todo

# Run the automated setup
./scripts/setup-dev-env.sh
```

This will:
1. Copy all `.env.example` files to `.env`
2. Install all dependencies
3. Build shared packages and the CLI
4. Generate frontend configuration
5. Create necessary directories
6. Display next steps

### Manual Setup

If you prefer manual setup:

```bash
# Install dependencies
pnpm install

# Copy environment files
cp .env.example .env
cp apps/cli/.env.example apps/cli/.env
cp apps/api/.env.example apps/api/.env
cp waltodo-frontend/.env.example waltodo-frontend/.env.local

# Build the project
pnpm build:dev

# Install CLI globally
pnpm run global-install
```

## Starting All Services

WalTodo includes multiple services that work together:

### Option 1: Development Orchestrator (Recommended)

```bash
# Start all services in tmux panes
pnpm dev:all
# or
./pnpm-dev.sh
```

This starts:
- **CLI**: Ready for testing in the left pane
- **API Server**: REST API on http://localhost:3001 (top right)
- **Web Frontend**: Next.js app on http://localhost:3000 (bottom right)

#### Tmux Controls
- `Ctrl+B` then arrow keys: Switch between panes
- `Ctrl+B` then `Q`: Quit session
- `Ctrl+B` then `D`: Detach (keeps running)
- `tmux attach -t waltodo-dev`: Reattach later

### Option 2: Individual Services

```bash
# Terminal 1: Start the API server
cd apps/api
pnpm dev

# Terminal 2: Start the frontend
cd waltodo-frontend
pnpm dev

# Terminal 3: Use the CLI
waltodo --help
```

## Environment Configuration

WalTodo requires configuration for different services:

### 1. Sui Wallet Configuration

```bash
# Create a new wallet
sui client new-address ed25519

# Get testnet tokens from the faucet
sui client faucet

# Configure WalTodo with your address
waltodo configure
```

### 2. Walrus Storage Configuration

Create `~/.walrus/client_config.yaml`:

```yaml
system_object: 0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af
staking_object: 0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3
epochs_ahead: 1
```

Get testnet WAL tokens:

```bash
walrus --config ~/.walrus/client_config.yaml get-wal
```

### 3. AI Provider Configuration (Optional)

For AI features, add your API keys to `.env`:

```bash
XAI_API_KEY=your-xai-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Or use the credential management system:

```bash
waltodo ai credentials add xai --key YOUR_XAI_API_KEY
```

## Troubleshooting

### Common Issues

1. **"Contract not deployed" error**:
   ```bash
   waltodo deploy --network testnet
   ```

2. **"Insufficient gas" error**:
   ```bash
   sui client faucet
   ```

3. **"CLI command not found"**:
   ```bash
   pnpm run global-install
   ```

4. **TypeScript build errors**:
   Use `pnpm build:dev` to skip type checking during development

5. **Port already in use**:
   Check for running processes on ports 3000 and 3001

### Getting Help

- Run any command with `--help` for usage information
- Use the `--verbose` flag for detailed output
- Check logs in the `logs/` directory
- See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development guidance

## Next Steps

After setup, try these commands:

```bash
# Add your first todo
waltodo add "My first todo task"

# List your todos
waltodo list

# Add a todo with AI suggestions
waltodo add "Important task" --ai

# Deploy smart contract (one-time)
waltodo deploy --network testnet

# Store a todo on blockchain
waltodo store --todo 123 --list default
```

## Documentation

- [CLI Commands Reference](CLI-COMMANDS.md)
- [Development Guide](DEVELOPMENT.md)
- [Architecture Overview](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Frontend Guide](waltodo-frontend/README.md)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.