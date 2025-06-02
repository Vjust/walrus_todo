# WalTodo 🌊

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage Status](https://img.shields.io/badge/coverage-85%25-green)
![Tests](https://img.shields.io/badge/tests-144%20passed-brightgreen)
[![codecov](https://codecov.io/gh/Vjust/walrus_todo/branch/main/graph/badge.svg)](https://codecov.io/gh/Vjust/walrus_todo)

**The First Web3-Native Productivity Platform**

**Transform Your Todos Into Valuable NFTs • Store Forever on Walrus • Own Your Data on Sui Blockchain**

WalTodo is a groundbreaking Web3 productivity platform where your tasks become digital assets. Every todo is minted as an NFT on Sui blockchain with permanent storage on Walrus network, giving you true ownership, verifiable achievements, and censorship-resistant productivity data.

## 🚀 Quick Start - Launch Your Web3 Productivity Platform

Deploy your personal NFT todo system in minutes:

```bash
# Clone the Web3 productivity platform
git clone https://github.com/Vjust/walrus_todo.git
cd walrus_todo

# Initialize blockchain infrastructure
./scripts/setup-dev-env.sh

# Launch your NFT todo platform (Web + CLI + API)
pnpm dev:all
```

The setup process configures:
- 🌊 Walrus decentralized storage connections
- ⚡ Sui blockchain network configuration  
- 🎯 NFT smart contract deployment scripts
- 🖥️ Professional CLI tools for blockchain operations
- 📱 Web3 frontend for NFT collection management
- 🤖 Optional AI enhancement integrations

## Overview

WalTodo represents the future of productivity applications - a Web3-native platform where your tasks become digital assets with real value and permanent ownership. Built on Sui blockchain with Walrus decentralized storage, WalTodo solves the fundamental problems of data ownership, platform dependency, and impermanence that plague traditional productivity apps.

### 🚀 Core Web3 Value Propositions

- **🎯 True Digital Asset Ownership**: Your todos are NFTs you actually own, trade, or transfer
- **🌊 Permanent Walrus Storage**: Your productivity data stored forever on decentralized network
- **⚡ Sui Blockchain Security**: Immutable smart contracts ensure your achievements are verifiable
- **🌍 Platform Independence**: Access your data from any interface, no vendor lock-in
- **💎 Productivity NFTs**: Turn completed tasks into collectible achievement tokens
- **🔄 Decentralized Sync**: Blockchain events sync data across all platforms automatically

### ⚡ Enhanced Features

- **🖥️ CLI Interface**: Advanced command-line tools for power users and automation
- **🤖 AI Integration**: Smart suggestions, categorization, and productivity insights
- **🖼️ Auto-Generated Art**: Unique NFT artwork created for each todo
- **📱 Web Application**: Modern frontend for browsing your NFT todo collection

### 🔗 Web3 Technology Stack

WalTodo leverages cutting-edge blockchain infrastructure to revolutionize productivity:

**Core Blockchain Layer:**
- **🌊 Walrus Network**: Decentralized storage protocol ensuring permanent data availability
- **⚡ Sui Blockchain**: High-performance L1 blockchain for NFT ownership and smart contracts  
- **🎯 Move Language**: Secure smart contracts for todo NFT management and transfers

**User Interface Layer:**
- **📱 Web3 Frontend**: Modern React app for browsing NFT collections and blockchain interactions
- **🖥️ CLI Tools**: Professional-grade command interface for advanced blockchain operations
- **🤖 AI Enhancements**: Optional intelligent features for productivity optimization

**Key Benefits:**
- ✅ **Zero Platform Risk**: Your data exists independently of any company
- ✅ **Permanent Access**: Walrus storage ensures data survives forever  
- ✅ **True Ownership**: NFTs give you provable ownership of your achievements
- ✅ **Interoperability**: Use any compatible wallet or interface to access your todos

### Web3 Productivity Stack

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Web Frontend  │────▶│   API Server    │────▶│  Walrus Network │
│  (NFT Gallery)  │     │ (AI & Compute)  │     │ (Todo Storage)  │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │                        │
┌─────────────────┐              │                        │
│                 │              │                        ▼
│   CLI Client    │──────────────┘              ┌─────────────────┐
│ (Todo Creator)  │                             │                 │
│                 │◀────────────────────────────│  Sui Blockchain │
└─────────────────┘                             │   (NFT Todos)   │
                                                │                 │
                                                └─────────────────┘
```

**Data Flow:**
1. **Create**: CLI/Web creates todos → API processes → Store on Walrus
2. **Mint**: API mints NFT on Sui blockchain → References Walrus blob ID
3. **Sync**: Changes propagated across all platforms via blockchain events
4. **Own**: You hold the NFT → You own the todo data permanently

## 🚀 Key Features

### 🎯 NFT-Powered Todo Management
- **Todo NFTs**: Each task becomes a unique, tradeable NFT on Sui blockchain
- **True Ownership**: Your todos are yours forever - no platform lock-in
- **NFT Galleries**: Browse and showcase your productivity achievements
- **Transfer & Trade**: Send todo NFTs to others or trade completed achievements

### 🌊 Walrus Decentralized Storage
- **Permanent Storage**: Your todo data stored forever on Walrus network
- **Censorship Resistant**: No central authority can delete or modify your data
- **Global Access**: Access your todos from anywhere in the world
- **Content Addressing**: Each todo has a unique, verifiable content hash

### ⚡ Sui Blockchain Backend
- **Fast Transactions**: Near-instant todo creation and updates
- **Low Costs**: Minimal gas fees for blockchain operations
- **Smart Contracts**: Automated NFT minting and ownership management
- **Event Streaming**: Real-time sync across all your devices

## ⚡ Additional Enhanced Features

### 🤖 Optional AI Integration
WalTodo includes powerful AI features to enhance your Web3 productivity experience:
- **Smart Todo Creation**: AI-generated tags, priorities, and descriptions
- **Productivity Analytics**: Analyze your NFT todo patterns and achievements
- **Multi-Provider Support**: XAI/Grok, OpenAI, and Anthropic integration
- **Blockchain-Verified AI**: All AI operations transparently recorded on Sui
- **Auto-Generated NFT Art**: Unique artwork created for each todo NFT
- **Intelligent Suggestions**: Smart next-step recommendations with dependency detection

### 🖥️ Professional CLI Interface
For power users and automation, WalTodo provides advanced command-line tools:
- **Blockchain Operations**: Direct interaction with Sui contracts and Walrus storage
- **Batch Processing**: Efficient bulk operations for large todo collections
- **Background Jobs**: Long-running blockchain operations with progress tracking
- **Developer APIs**: REST endpoints for custom Web3 integrations
- **Local Development**: Full offline development environment for testing
- **Cross-Platform Sync**: Seamless synchronization between interfaces

## 🖥️ Command-Line Interface (Additional Feature)

For advanced users and developers, WalTodo provides a comprehensive CLI for direct blockchain interaction:

### 🎯 Core NFT Todo Operations
- **`add`**: Create new todos that become NFTs on Sui blockchain
  - Use `--ai` flag for smart tag and priority suggestions
  - Automatically stores data on Walrus and mints NFT
- **`list`**: Browse your NFT todo collection
- **`complete`**: Mark todos as done and update NFT metadata
- **`transfer`**: Send todo NFTs to other users

### 🌊 Walrus Storage & Blockchain Operations
- **`store`**: Store todos on Walrus and mint corresponding NFTs on Sui
- **`retrieve`**: Fetch todos from Walrus storage using blob IDs
- **`deploy`**: Deploy the Todo NFT smart contract to Sui blockchain
- **`storage`**: Analyze Walrus storage usage and optimize WAL token costs
- **`sync`**: Synchronize local todos with blockchain and Walrus storage

### ⚙️ Configuration & Account Management
- **`account`**: Manage your Sui wallet and NFT permissions
- **`configure`**: Set up blockchain networks, storage endpoints, and preferences

### 🤖 AI-Powered Features
- **`ai`**: AI-enhanced todo operations with blockchain verification
  - `summarize`: Get productivity insights and todo list overviews
  - `categorize`: Smart tag suggestions for better organization
  - `prioritize`: Intelligent priority recommendations
  - `suggest`: Generate related tasks with dependency detection
  - `analyze`: Analyze productivity patterns and habits
  - `credentials`: Securely manage AI provider API keys
  - `verify`: Verify AI operations recorded on Sui blockchain

### 🎯 Example Commands

Experience the power of blockchain-native productivity:

```bash
# Create your first NFT todo
waltodo add "Complete project milestone" --ai
# ✨ AI enhances with tags, priority, and generates unique NFT artwork

# Browse your NFT todo collection  
waltodo list --nft
# 🖼️ Shows todos as NFTs with images, metadata, and blockchain IDs

# Store todos permanently on Walrus
waltodo store my-important-list
# 🌊 Data stored forever on decentralized Walrus network

# Deploy your personal Todo NFT contract
waltodo deploy --network testnet
# ⚡ Smart contract deployed to Sui blockchain

# Transfer a todo NFT to someone else
waltodo transfer --todo <nft-id> --to <sui-address>
# 🎁 True ownership - send your achievement NFTs to others

# Get AI insights with blockchain verification
waltodo ai analyze --verify
# 🤖 AI analysis recorded on blockchain for transparency

# Sync across all platforms
waltodo sync --background
# 🔄 Blockchain events keep CLI, web, and mobile in sync
```

For a comprehensive reference of all CLI commands, see [CLI-COMMANDS.md](CLI-COMMANDS.md).

## 🛠️ Platform Setup & Configuration

### Prerequisites for Web3 Platform

**System Requirements:**
- **Node.js**: v18.0.0 or higher (for Web3 interface development)
- **pnpm**: v8.0.0 or higher (package management)
- **Operating Systems**: macOS, Linux, or Windows with WSL

**Blockchain Requirements:**
- **Sui Wallet**: For NFT ownership and blockchain transactions
- **Walrus Access**: For decentralized storage operations  
- **SUI Tokens**: For gas fees on Sui blockchain (testnet faucet available)

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

## 🔧 Blockchain & Storage Setup

WalTodo connects to Sui blockchain and Walrus network for NFT and storage operations:

### 1. 🌊 Sui Wallet Setup (Required for NFTs)

```bash
# Install Sui CLI
curl -fLJO https://github.com/MystenLabs/sui/releases/latest/download/sui-devnet-macos-arm64.tgz
tar -xf sui-devnet-macos-arm64.tgz

# Create your NFT wallet
sui client new-address ed25519

# Get testnet SUI tokens (for minting NFT todos)
sui client faucet

# Configure WalTodo with your blockchain address
waltodo configure
```

### 2. 🌊 Walrus Decentralized Storage Setup

Create your Walrus configuration at `~/.walrus/client_config.yaml`:

```yaml
# Walrus testnet configuration for permanent todo storage
system_object: 0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af
staking_object: 0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3
epochs_ahead: 1
```

Get WAL tokens for Walrus storage:

```bash
# Get testnet WAL tokens to store your todo data
walrus --config ~/.walrus/client_config.yaml get-wal
```

### 3. 🤖 AI Enhancement Setup (Optional)

Enhance your todos with AI-generated content and insights:

```bash
# Secure credential storage for AI providers
waltodo ai credentials add xai --key YOUR_XAI_API_KEY
waltodo ai credentials add openai --key YOUR_OPENAI_API_KEY
waltodo ai credentials add anthropic --key YOUR_ANTHROPIC_API_KEY

# Verify AI operations are recorded on blockchain
waltodo ai verify
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

## 🚀 Getting Started with NFT Todos

After setup, experience the future of productivity:

```bash
# 1. Deploy your personal Todo NFT smart contract
waltodo deploy --network testnet

# 2. Create your first NFT todo with AI enhancement
waltodo add "Launch my first blockchain todo" --ai

# 3. View your NFT todo collection
waltodo list --nft

# 4. Store todos permanently on Walrus
waltodo store my-productivity-list

# 5. Generate AI insights (recorded on blockchain)
waltodo ai summarize --verify

# 6. Transfer a completed todo NFT to celebrate with others
waltodo complete <todo-id>
waltodo transfer --todo <nft-id> --to <friend-address>
```

🎉 **Congratulations!** You're now managing todos as NFTs with permanent Walrus storage and Sui blockchain verification.

## Documentation

- [CLI Commands Reference](CLI-COMMANDS.md)
- [Development Guide](DEVELOPMENT.md)
- [Architecture Overview](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Frontend Guide](waltodo-frontend/README.md)

---

**WalTodo** - Where productivity meets Web3 ownership. Transform your tasks into valuable digital assets with permanent Walrus storage and Sui blockchain verification.

*Built for the decentralized future of personal productivity.*