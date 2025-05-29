# WalTodo

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage Status](https://img.shields.io/badge/coverage-85%25-green)
![Tests](https://img.shields.io/badge/tests-144%20passed-brightgreen)
[![codecov](https://codecov.io/gh/Vjust/walrus_todo/branch/main/graph/badge.svg)](https://codecov.io/gh/Vjust/walrus_todo)
![License](https://img.shields.io/badge/license-MIT-blue)

A powerful CLI for managing todos with Sui blockchain and Walrus decentralized storage.

## Overview

WalTodo is a feature-rich todo management system that combines traditional task management with decentralized technologies. The system features a powerful command-line interface (CLI) and a modern web frontend, all backed by a hybrid architecture that leverages the best of both centralized and decentralized approaches.

### Hybrid Architecture

WalTodo implements a unique hybrid architecture that balances performance, user experience, and decentralization:

- **API Server**: Centralized compute layer for business logic, AI operations, and coordination
- **Walrus Storage**: Decentralized storage for todo data and images
- **Sui Blockchain**: Decentralized ledger for ownership, verification, and NFT management
- **Local Storage**: Fast, offline-capable storage for immediate access

This approach provides the responsiveness of traditional applications while maintaining the benefits of decentralization where it matters most - data ownership and permanence.

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

#### Enhanced Multi-Todo Command Syntax

The CLI now supports an even more natural way to add multiple todos to a list:

```bash
# Add multiple todos to a list with different priorities
waltodo add "my-list" -t "High priority task" -p high -t "Low priority task" -p low

# Add multiple todos with different tags
waltodo add "work-list" -t "Task with tags" -g "work,urgent" -t "Another task" -g "home,relax"

# Add multiple todos with different due dates
waltodo add "personal" -t "Task with due date" -d 2023-05-15 -t "Later task" -d 2023-12-31

# NEW INTUITIVE SYNTAX - Store todos more naturally!
# Store all todos in a list (default behavior)
waltodo store my-list

# Store a specific todo by ID or title
waltodo store my-list task-123
waltodo store my-list "Buy groceries"

# Store with custom options
waltodo store my-list --epochs 10            # Custom storage duration
waltodo store my-list --batch-size 10        # Custom batch size for all todos
waltodo store my-list --network mainnet      # Use mainnet instead of testnet
waltodo store my-list --mock                 # Use mock mode for testing

# Legacy syntax (still supported)
waltodo store --todo task-123 --list my-list
waltodo store --all --list my-list

# Add multiple todos with mixed attributes
waltodo add "project" -t "Important meeting" -p high -d 2023-06-01 -g "work,meeting" -t "Follow-up email" -p medium -g "work,email"
```

In this syntax, the first argument is interpreted as the list name when multiple task flags (`-t`) are provided. Each task can have its own set of attributes (priority, due date, tags) specified with the corresponding flags.

If there are fewer attribute flags than tasks, the last attribute will be used for the remaining tasks:

```bash
# Both tasks will have high priority
waltodo add "my-list" -t "Task 1" -t "Task 2" -p high
```

#### User-Friendly Output Format

The CLI now provides clean, concise output that's easy to read and use:

```
✓ New List Created: First task in new list
  📋 List: brand-new-list | ⚡ Priority: HIGH | 💻 Storage: Local only
  Next: waltodo list brand-new-list - View all tasks | waltodo complete --id 173048 - Mark as completed
```

The output clearly indicates whether you're creating a new list or adding a task to an existing list, and provides all relevant information in a compact format with next steps.

#### Compact View by Default

The list command now uses a space-efficient compact view by default:

```
# Compact view (default)
waltodo list my-list

# Output:
┌────────────────────────────────────────┐
│ 📋 my-list
0/3 completed (0%)                       │
│ ░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────────────────┘

○ [173048] HIGH First task in new list
○ [250704] LOW Task with tags
○ [731010] LOW Another task
```

For more detailed information, you can use the `--detailed` flag:

```
# Detailed view
waltodo list my-list --detailed

# Output includes tags, due dates, and other details
```

For a comprehensive reference of all CLI commands, see [CLI-COMMANDS.md](CLI-COMMANDS.md).

## 🚀 Background Command Orchestrator

WalTodo features a powerful background command orchestrator that enables all CLI commands to run without blocking your terminal. This system provides automatic detection of long-running operations, unified progress tracking, and comprehensive job management.

### Features

- **Universal Background Execution**: Any command can run in background with `--background` or `--bg` flags
- **Auto-Detection**: Long-running operations automatically move to background when appropriate
- **Real-time Progress**: Live progress updates with visual progress bars
- **Job Management**: Full control over background jobs with listing, monitoring, and cancellation
- **Resource Management**: Automatic concurrency limits and resource monitoring
- **Smart Cleanup**: Automatic cleanup of old jobs and logs

### Basic Usage

```bash
# Run any command in background
waltodo store --background large-file.txt
waltodo sync --bg
waltodo deploy --background

# Force foreground execution
waltodo store --foreground small-file.txt

# Monitor background jobs
waltodo jobs                    # List all jobs
waltodo jobs --active          # Show only running jobs
waltodo jobs --watch           # Watch jobs in real-time
waltodo jobs status <job-id>   # Detailed job status
waltodo jobs cancel <job-id>   # Cancel a running job
waltodo jobs logs <job-id>     # View job logs
waltodo jobs report            # Comprehensive status report

# Cleanup and maintenance
waltodo jobs --cleanup         # Remove old completed jobs
waltodo jobs --json           # JSON output for scripting
```

### Auto-Background Detection

The orchestrator automatically detects commands that should run in background:

| Command | Auto-Background | Reason |
|---------|----------------|--------|
| `store` | ✅ | File upload operations |
| `store-list` | ✅ | Batch upload operations |
| `deploy` | ✅ | Blockchain deployment |
| `sync` | ✅ | Network synchronization |
| `image` | ✅ | Image generation/processing |
| `create-nft` | ✅ | NFT creation workflow |
| `list` | ❌ | Quick local operation |
| `add` | ❌ | Fast local operation |

### Progress Tracking

Background jobs provide real-time progress updates:

```bash
$ waltodo jobs status job_1234567890_abc123
🔍 Job Status: job_1234567890_abc123

Command: store my-list
Status: 🔄 RUNNING
Duration: 45.2s
Progress: [████████████████    ] 80%
Current Stage: Uploading to Walrus
Items Processed: 8/10
Process ID: 15432

💡 View logs with: waltodo jobs logs job_1234567890_abc123
```

### Advanced Features

#### Resource Management
The orchestrator monitors system resources and automatically adjusts concurrency:

```bash
$ waltodo jobs report
🔄 Background Command Orchestrator Status
──────────────────────────────────────────────────

📊 Resource Usage:
  Memory: 65.2%
  Active Jobs: 3/10
  Total Jobs: 25

🔄 Active Jobs:
  ⏳ job_1234567890_abc123 - store my-list
    Progress: [████████████████    ] 80%
    Duration: 45.2s
    Stage: Uploading to Walrus

✅ Recent Completions:
  ✅ sync (12.5s)
  ✅ deploy (2m 15s)

⚙️ Command Profiles:
  store: 2/3 active
  sync: 0/2 active
  deploy: 0/1 active
```

#### Job Dependencies
Commands with dependencies wait for prerequisites:

```bash
# Image creation waits for store to complete
waltodo store --background my-list
waltodo image --background my-todo    # Waits for store

# NFT creation waits for both image and deploy
waltodo create-nft --background my-todo  # Waits for dependencies
```

#### Scripting Support
Perfect for automation and CI/CD:

```bash
#!/bin/bash
# Start multiple background operations
JOB1=$(waltodo store --background list1 | grep -o 'job_[^[:space:]]*')
JOB2=$(waltodo store --background list2 | grep -o 'job_[^[:space:]]*')

# Wait for completion
while [[ $(waltodo jobs --active --json | jq length) -gt 0 ]]; do
  sleep 5
  echo "Waiting for jobs to complete..."
done

echo "All operations completed!"
```

For detailed documentation, see [Background Command Orchestrator Guide](docs/background-command-orchestrator.md).

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

# Build the project
pnpm run build

# Create symbolic links to make the CLI available locally
npm link
```

The local installation will make the `waltodo` command available in your system.

For detailed CLI usage instructions, see [CLI-USAGE.md](CLI-USAGE.md).

## Environment Configuration

The application uses a centralized environment configuration system that loads configuration from multiple sources:

1. Environment variables
2. `.env` files (including environment-specific ones like `.env.development`)
3. Configuration files (`.waltodo.json`)
4. Default hardcoded values

To get started with environment configuration:

```bash
# Copy the example env file
cp .env.example .env

# Edit with your settings
nano .env

# Or use environment-specific configurations
cp .env.development .env.local  # For local development
```

The configuration system provides:
- Type validation and conversion
- Default values with fallbacks
- Environment-specific configurations
- Required variable validation with clear error messages
- Custom validation rules for specific variables

You can view and manage your configuration using the built-in config command:

```bash
# Show current configuration
waltodo config

# Validate configuration values
waltodo config validate

# Show only AI configuration
waltodo config --section=ai

# Output in different formats
waltodo config --format=json
waltodo config --format=env
```

## Walrus Configuration

WalTodo integrates with Walrus decentralized storage for storing todos on the testnet. To enable this feature:

### 1. Install Walrus CLI

```bash
# Install Walrus CLI
curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh
```

### 2. Configure Walrus

Create the Walrus configuration file at `~/.walrus/client_config.yaml`:

```yaml
system_object: 0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af
staking_object: 0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3
epochs_ahead: 1
```

### 3. Get WAL Tokens

Get some testnet WAL tokens for storage operations:

```bash
# Request testnet WAL tokens
walrus --config ~/.walrus/client_config.yaml get-wal
```

### 4. Configure Environment

WalTodo uses environment variables to control storage behavior:

```bash
# Create .env.local for production settings
echo "WALRUS_USE_MOCK=false" > .env.local
```

- Set `WALRUS_USE_MOCK=false` for testnet storage (production)
- Set `WALRUS_USE_MOCK=true` for mock storage (development)
- If not set, defaults to testnet storage

### 5. Verify Configuration

Test your Walrus configuration:

```bash
# Check Walrus info
walrus --config ~/.walrus/client_config.yaml info

# Test storing a todo
waltodo add "Test todo" --storage walrus
```

Now all todos stored with the `--storage walrus` flag will be stored on the actual Walrus testnet!

For detailed documentation on all available environment variables and configuration options, see [Environment Configuration Guide](docs/environment-configuration-guide.md).

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

# Add multiple todos to a list at once
waltodo add "shopping" -t "Milk" -t "Eggs" -t "Bread"

# Add multiple todos with different priorities
waltodo add "work" -t "Urgent bug fix" -p high -t "Feature implementation" -p medium

# Add multiple todos with different attributes
waltodo add "project" -t "Team meeting" -g "work,meeting" -d 2023-06-01 -t "Documentation" -g "work,docs" -d 2023-06-15

# Mark a todo as complete (replace 123 with your todo ID)
waltodo complete --id 123

# Use AI to suggest related tasks (legacy command)
waltodo ai suggest --apply

# Use the new intelligent task suggestion system
waltodo suggest --type=next_step --minScore=70

# Get a summary of your todo list
waltodo ai summarize
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
   npm link
   ```

4. **Verify Installation**:
   ```bash
   # Option 1: Check version
   waltodo --version

   # Option 2: Run the verification script to check everything
   chmod +x verify-install.js && ./verify-install.js
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

- **Node.js**: v18.0.0 or higher (includes automatic compatibility polyfills for CI environments)
- **pnpm**: v8.0.0 or higher
- **Operating Systems**: macOS, Linux, or Windows with WSL

### Node.js Compatibility

WalTodo includes comprehensive compatibility polyfills that ensure it works reliably across different Node.js versions:

- **Automatic Detection**: The CLI automatically detects your Node.js version and provides helpful upgrade guidance if needed
- **Modern Feature Support**: Includes polyfills for `String.prototype.replaceAll`, `Array.prototype.at`, `Object.hasOwn`, and other features
- **CI/CD Friendly**: Prevents "replaceAll is not a function" and similar errors in GitHub Actions and other CI environments
- **Zero Performance Impact**: Polyfills only add methods that don't exist natively in your Node.js version

To test compatibility on your system:
```bash
./scripts/test-node-compatibility.sh
```

For detailed information, see [Node.js Compatibility Guide](docs/node-js-compatibility-fixes.md).

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

## AI-Powered Todo Management

WalTodo now features a robust multi-provider AI integration that works with XAI (Grok), OpenAI, and Anthropic language models. The system uses a provider abstraction layer for flexibility and includes blockchain verification for AI operations.

### Multi-Provider AI Architecture

The AI integration uses a flexible adapter pattern that supports multiple AI providers:

```bash
# Use default provider (XAI/Grok)
waltodo ai summarize

# Specify a different provider
waltodo ai summarize --provider openai

# Add blockchain verification
waltodo ai summarize --verify
```

### Blockchain-Verified AI Operations

All AI operations can be verified on the Sui blockchain for auditability and trust:

```bash
# Generate and verify a task suggestion
waltodo suggest --type=next_step --verify

# Check verification status
waltodo ai verify check --id VERIFICATION_ID

# List verifications for a todo
waltodo ai verify list --todo TODO_ID
```

### Available AI Operations

The AI command supports seven main operations:

#### 1. Summarize your todo lists

Get an overview of your todos, including completion rates, key themes, and high-priority items:

```bash
# Summarize the default list
waltodo ai summarize

# Summarize a specific list
waltodo ai summarize -l work
```

#### 2. Categorize todos with AI-suggested tags

Let AI suggest relevant tags based on task content:

```bash
# Get tag suggestions for a specific todo (by ID or title)
waltodo ai categorize -i "Prepare presentation slides"

# Apply the suggested tags automatically
waltodo ai categorize -i "Prepare presentation slides" --apply
```

#### 3. Prioritize todos intelligently

Get AI suggestions for appropriate priority levels:

```bash
# Get priority suggestion for a todo
waltodo ai prioritize -i "Fix critical security bug"

# Apply the suggested priority automatically
waltodo ai prioritize -i "Fix critical security bug" --apply
```

#### 4. Generate related task suggestions

Get AI recommendations for new related tasks:

```bash
# Get 3 task suggestions (default)
waltodo ai suggest

# Get 5 task suggestions for a specific list
waltodo ai suggest -l projects -c 5

# Add the suggested tasks automatically
waltodo ai suggest --apply
```

#### 5. Analyze productivity patterns

Get insights on your task completion patterns and productivity:

```bash
# Analyze the default list
waltodo ai analyze

# Analyze a specific list
waltodo ai analyze -l personal
```

#### 6. Manage AI provider credentials

Securely store and manage API keys for different AI providers:

```bash
# Store API key for a provider
waltodo ai credentials add openai --key YOUR_API_KEY

# List stored credentials
waltodo ai credentials list

# Verify credential on blockchain
waltodo ai credentials add anthropic --key YOUR_API_KEY --verify

# Remove stored credential
waltodo ai credentials remove xai
```

#### 7. Verify AI operations on blockchain

Manage and check blockchain verification records for AI operations:

```bash
# Check a verification record
waltodo ai verify check --id VERIFICATION_ID

# List verifications for a todo
waltodo ai verify list --todo TODO_ID

# Verify a specific operation on a todo
waltodo ai verify verify --todo TODO_ID --operation summarize
```

### Enhanced Todo Suggestion System

The `suggest` command provides intelligent task suggestions with advanced features:

```bash
# Get next-step recommendations
waltodo suggest --type=next_step

# Find dependent tasks
waltodo suggest --type=dependency --minScore=70

# Estimate effort for upcoming tasks
waltodo suggest --type=effort --count=5

# Generate suggestions with blockchain verification
waltodo suggest --type=related --verify
```

### AI-Enhanced Todo Creation

When adding new todos, you can use AI to suggest tags and priority:

```bash
# Add a todo with AI suggestions
waltodo add "Prepare quarterly report" --ai

# Specify provider
waltodo add "Review code PR" --ai --provider openai

# Add with verification
waltodo add "Implement new feature" --ai --verify
```

### AI Features and Benefits

- **Multi-Provider Support**: Use XAI/Grok, OpenAI, or Anthropic models with the same interface
- **Intelligent Tag Suggestions**: AI analyzes todo content to suggest relevant and consistent tags
- **Smart Priority Assignment**: Determines appropriate priority level based on task content and urgency
- **Task Analysis**: Provides productivity insights, completion patterns, and suggestions for improvement
- **Related Task Suggestions**: Recommends complementary tasks based on your current todos and project goals
- **Summarization**: Creates concise, structured summaries of your entire todo list for better understanding
- **Blockchain Verification**: Verify AI operations on the Sui blockchain for auditability and trust
- **Secure Credential Storage**: Encrypted storage of API keys with blockchain verification
- **Privacy Controls**: Control what data is shared with AI providers and what is stored on-chain
- **Performance Optimization**: Caching and batching for efficient AI operations
- **Dependency Detection**: Identify prerequisite and dependent tasks in your workflow
- **Effort Estimation**: Get intelligent estimates for task completion time and complexity

### Setting Up AI Features

To use the AI features, you'll need API keys for your preferred providers. There are multiple ways to manage credentials:

1. Using the credential management system (recommended for security):
   ```bash
   # Store credentials securely
   waltodo ai credentials add xai --key YOUR_XAI_API_KEY
   waltodo ai credentials add openai --key YOUR_OPENAI_API_KEY
   ```

2. Environment variables in your `.env` file:
   ```bash
   # .env file
   XAI_API_KEY=your-xai-api-key
   OPENAI_API_KEY=your-openai-api-key
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

3. Command-line flag with each command:
   ```bash
   waltodo ai summarize --apiKey your-api-key --provider xai
   ```

4. Blockchain-verified credentials (for enhanced security):
   ```bash
   # Store with blockchain verification
   waltodo ai credentials add xai --key YOUR_XAI_API_KEY --verify
   ```

### Command Options

The AI command supports these common options:

| Option | Description |
|--------|-------------|
| `--list`, `-l` | Specify the todo list (defaults to "default") |
| `--id`, `-i` | Todo ID or title for operations that work on a specific todo |
| `--count`, `-c` | Number of suggestions to generate (for `suggest` operation) |
| `--apply`, `-a` | Apply AI suggestions automatically |
| `--apiKey`, `-k` | API key (if not set in environment or credential store) |
| `--provider`, `-p` | AI provider to use (xai, openai, anthropic, custom) |
| `--verify`, `-v` | Verify operation on blockchain |
| `--privacy`, | Privacy level for blockchain verification (hash, full, none) |
| `--type` | Suggestion type for suggest command (next_step, related, dependency, effort) |
| `--minScore` | Minimum relevance score for suggestions (0-100) |

### Implementation Details

The AI features are implemented using:

- **Network Resilience**: [Robust timeout and retry handling](./docs/network-timeout-handling.md) for all API communications
- **Request Cancellation**: All network operations support cancellation with proper resource cleanup
- **Provider Abstraction Layer**: Adapter pattern for supporting multiple AI providers
- **LangChain**: Framework for building LLM applications with advanced prompt engineering
- **Multiple AI Providers**: Support for XAI (Grok), OpenAI, and Anthropic models
- **Blockchain Verification**: Integration with Sui blockchain for verifiable AI operations
- **Secure Credential Management**: Encrypted storage with optional blockchain verification
- **Structured Communication**: Using standardized message format for reliable API interaction
- **Response Parsing**: Robust parsing of JSON and text responses from AI providers
- **Performance Optimization**: Caching and batching for efficient AI operations
- **Privacy Controls**: Different verification levels to control on-chain data exposure

For detailed technical documentation, see:
- [AI Integration Guide](docs/ai-integration-guide.md)
- [Security Best Practices](docs/ai-security-guide.md)
- [Multi-Provider Setup](docs/ai-provider-guide.md)
- [Blockchain Verification](docs/ai-blockchain-verification.md)

### Troubleshooting

If you encounter issues:

- Ensure your API keys are valid and correctly set using `waltodo ai credentials list`
- Check your internet connection (required for API calls)
- Try using the `--verbose` flag for detailed output
- If a provider fails, try a different one with `--provider openai` or `--provider anthropic`
- For blockchain verification issues, check network connectivity with `waltodo storage --summary`
- Verify the todo or list exists before running AI operations on it
- Check credential permissions with `waltodo ai credentials check`
- For verification errors, use `waltodo ai verify check --id VERIFICATION_ID` to diagnose

Add multiple todos at once:

```bash
# Add multiple todos to a list (traditional method)
waltodo add -l shopping -t "Milk" -t "Eggs" -t "Bread"

# Add multiple todos to a list (new natural syntax)
waltodo add "shopping" -t "Milk" -t "Eggs" -t "Bread"

# Add multiple todos with different properties
waltodo add "work" -t "Urgent task" -p high -t "Normal task" -p medium -t "Low priority task" -p low

# Add todos with mixed attributes
waltodo add "project" -t "Meeting" -g "work,meeting" -d 2023-06-01 -t "Documentation" -g "work,docs" -d 2023-06-15
```

List all todo lists and view tasks:
```bash
# List all available lists
waltodo list

# View todos in a specific list (compact view by default)
waltodo list my-list

# View todos with detailed information
waltodo list my-list --detailed

# Filter todos by completion status
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

# Store a single todo on blockchain (replace TODO_ID with the actual ID)
waltodo store --todo TODO_ID --list blockchain-tasks

# Store all todos in a list (batch processing)
waltodo store --all --list blockchain-tasks

# Store with custom batch size (default is 5)
waltodo store --all --list blockchain-tasks --batch-size 10
```

This command:
1. Uploads the todo data to Walrus decentralized storage (with caching for identical content)
2. Creates an NFT on the Sui blockchain with a reference to the Walrus blob
3. Updates the local todo with the blockchain references
4. Displays progress for batch operations with detailed summary
5. Reports cache hits when uploading previously stored content

You can also store a todo with a custom image:

```bash
waltodo store --todo TODO_ID --list blockchain-tasks --image ./custom-image.png
```

Batch operations provide:
- Concurrent uploads for better performance
- Progress tracking with a visual progress bar
- Cache optimization to avoid redundant uploads
- Detailed summary showing successful uploads, failures, and cache hits

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

## Architecture

### System Architecture

WalTodo implements a hybrid architecture that combines the best aspects of centralized and decentralized systems:

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

### How It Works

1. **Client Layer**: Users interact through either the CLI or web frontend
2. **API Server**: Handles business logic, authentication, and coordinates between services
3. **Storage Layer**: Walrus provides decentralized, persistent storage for todo data
4. **Blockchain Layer**: Sui blockchain maintains ownership records and enables NFT functionality

### Benefits of the Hybrid Approach

#### Performance & User Experience
- **Instant Response**: API server provides immediate feedback without blockchain latency
- **Offline Capability**: Local caching enables work without internet connection
- **Rich Features**: Complex operations (AI, search, filtering) run on powerful servers
- **Scalability**: Centralized compute can scale independently of storage

#### Decentralization Benefits
- **Data Ownership**: Users truly own their data through blockchain NFTs
- **Censorship Resistance**: Data stored on Walrus cannot be deleted or modified
- **Interoperability**: NFTs can be transferred, traded, or integrated with other dApps
- **Verification**: All operations can be verified on the blockchain

#### Best of Both Worlds
- **Progressive Decentralization**: Start with familiar UX, opt-in to blockchain features
- **Cost Efficiency**: Only critical data goes on-chain, reducing transaction costs
- **Flexibility**: Choose between local, API, or blockchain storage per use case
- **Future-Proof**: Architecture supports gradual migration to full decentralization

### Storage Architecture

The application uses a multi-tier storage model:

#### Local Storage
- Plain JSON files in the `Todos` directory
- Instant access and offline capability
- Perfect for personal todo management
- Syncs with API server when online

#### API Storage
- Centralized database for fast queries
- Enables complex filtering and search
- Provides backup and sync across devices
- Temporary cache for blockchain data

#### Decentralized Storage
- **Todo Data**: Permanently stored on Walrus
- **NFT Reference**: Ownership records on Sui blockchain
- **Images**: Media files stored on Walrus with CDN access
- **Metadata**: Rich metadata stored both on-chain and in Walrus

### Storage Flow

1. **Creation**: 
   - Todo created locally or via API
   - Optionally stored to Walrus for permanence
   - NFT minted on Sui for ownership

2. **Retrieval**:
   - Fast access from local cache or API
   - Fallback to Walrus for decentralized data
   - NFT provides authoritative ownership info

3. **Updates**:
   - Changes propagate through all storage tiers
   - Blockchain records maintain audit trail
   - Conflict resolution favors blockchain state

4. **Transfer**:
   - NFT transfer changes ownership
   - New owner can retrieve from Walrus
   - API updates access permissions

### Deployment Options

#### Local Development
```bash
# Run everything locally
pnpm run dev:all
```

#### Cloud Deployment
- **API Server**: Deploy to any Node.js hosting (Vercel, Railway, Heroku)
- **Frontend**: Deploy to static hosting (Vercel, Netlify, Cloudflare Pages)
- **Storage**: Walrus testnet (mainnet coming soon)
- **Blockchain**: Sui testnet or mainnet

#### Self-Hosted
```bash
# Deploy your own instance
docker compose up -d
```

#### Fully Decentralized
- Use CLI directly with Walrus and Sui
- No API server required
- Complete data sovereignty

### Technical Implementation Details

#### API Server Responsibilities
- **Authentication & Authorization**: Manage user sessions and permissions
- **Business Logic**: Complex operations like AI task generation
- **Data Coordination**: Sync between local, API, and blockchain storage
- **Performance Optimization**: Caching, batching, and query optimization
- **Integration Hub**: Connect with external services (AI providers, analytics)

#### Walrus Integration
- **Blob Storage**: Each todo stored as an immutable blob
- **Content Addressing**: Deduplication through content hashing
- **Availability Proof**: Guaranteed data availability for specified epochs
- **Efficient Retrieval**: CDN-like access for fast global retrieval

#### Sui Blockchain Integration
- **NFT Smart Contracts**: Move contracts for todo NFTs
- **Ownership Transfer**: Secure transfer of todo ownership
- **Event Emission**: Real-time updates via blockchain events
- **Verification**: Cryptographic proof of operations

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

## Security Features

WalTodo implements comprehensive security features to protect user data, API credentials, and blockchain interactions:

### Security Architecture

1. **Secure Credential Management**
   - Encryption at rest for all API keys and credentials
   - Secure file permissions (0o600) for credential storage
   - Rotation and expiration controls for credentials
   - Support for blockchain verification of credentials
   - Protection against API key exposure in logs and errors

2. **Input Validation and Sanitization**
   - Comprehensive validation of all user inputs
   - Protection against XSS, SQL injection, and command injection
   - Input size limits to prevent DoS attacks
   - Structured validation with schema enforcement
   - Prompt injection detection for AI operations

3. **Permission System**
   - Fine-grained permission levels (READ_ONLY, STANDARD, ADVANCED, ADMIN)
   - Operation-specific permission enforcement
   - Cross-provider permission isolation
   - Blockchain verification of permissions
   - Prevention of privilege escalation

4. **Blockchain Verification**
   - Content integrity verification with cryptographic hashing
   - Digital signatures for all blockchain operations
   - Tamper detection for verified content
   - Time-based protection against replay attacks
   - Privacy controls with different verification levels

5. **API Security**
   - Enforced HTTPS for all external communications
   - Secure TLS configuration requirements
   - Rate limiting and abuse prevention
   - Secure header configuration
   - Prevention of SSRF attacks

6. **Audit Logging**
   - Tamper-evident logging with hash chaining
   - Sanitization of sensitive information in logs
   - Comprehensive event recording
   - Secure log storage with proper permissions
   - Support for log verification

7. **Data Privacy**
   - PII detection and anonymization
   - Differential privacy for aggregation operations
   - Data minimization principles
   - Support for data subject rights
   - Privacy-preserving blockchain verification

### Security Testing

The codebase includes a comprehensive security testing framework:

```bash
# Run all security tests
pnpm run test:security

# Run specific security test categories
pnpm run test:security:credential  # Credential security tests
pnpm run test:security:input       # Input validation tests
pnpm run test:security:permission  # Permission system tests
pnpm run test:security:audit       # Audit logging tests
pnpm run test:security:blockchain  # Blockchain verification tests
pnpm run test:security:api         # API security tests
pnpm run test:security:privacy     # Data privacy tests

# Run full security audit with coverage report
pnpm run security-audit:full
```

For detailed documentation, see:
- [Security Testing Guide](docs/security-testing-guide.md)
- [AI Security Guide](docs/ai-security-guide.md)
- [Blockchain Verification Guide](docs/ai-blockchain-verification.md)

## Direct CLI Usage Scripts

For environments where the standard CLI wrapper might have issues, we've provided standalone scripts that directly access the TodoService without using the OCLIF framework:

```bash
# Initialize todo lists (creates default, shopping, and work lists)
node initialize-lists.js

# List all todos with detailed output
node test-direct.js

# View todos with more detailed formatting
node test-list.js

# Add a new todo to a list
node test-add.js "Todo title" "Description" ["list-name"]

# Complete a todo
node test-complete.js "Todo title or ID" ["list-name"]

# Delete a todo
node test-delete.js "Todo title or ID" ["list-name"]

# Run a complete workflow test
node test-todos.js

# Verify installation and setup
node verify-install.js

# Run CLI commands with verbose output
node run-cli.js [command and arguments]
```

These scripts provide a reliable alternative when troubleshooting issues with the main CLI interface. The run-cli.js wrapper script is particularly useful for diagnosing CLI command issues, as it runs waltodo commands with the verbose flag and captures all output.

The workflow test script (test-todos.js) runs through all basic operations and validates them, making it an excellent way to verify that core functionality is working correctly.

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
   - Run `pnpm run build` to build the project
   - These errors are expected due to version mismatches between Sui and Walrus SDKs
   - The CLI will still work correctly despite these TypeScript errors
   - For details on the compatibility approach, see [TypeScript Compatibility Guide](TYPESCRIPT_COMPATIBILITY.md)

8. **Security-related issues**:
   - For credential issues, check permissions with `waltodo ai credentials check`
   - For blockchain verification errors, use `waltodo ai verify check --id VERIFICATION_ID`
   - Run `pnpm run test:security` to verify security functionality
   - Check audit logs for suspicious activity

### Getting Help

For more detailed troubleshooting:
- Check the [CLI-COMMANDS.md](CLI-COMMANDS.md) for command reference
- Run any command with `--help` for usage information
- Use the `--verbose` flag for more detailed output

## Development

### Quick Start with Development Orchestrator

WalTodo includes a development orchestrator that starts all services (CLI + API + Web) in a unified environment:

```bash
# Start all services in tmux panes (recommended)
pnpm run dev:all
# or
./pnpm-dev.sh

# Alternative for users without tmux
pnpm run dev:simple
# or  
./pnpm-dev-simple.sh
```

The orchestrator provides:
- **CLI**: Ready for testing in the left pane
- **API Server**: REST API on http://localhost:3001 (top right)
- **Web Frontend**: Next.js app on http://localhost:3000 (bottom right)

#### Tmux Controls
- `Ctrl+B` then arrow keys: Switch between panes
- `Ctrl+B` then `Q`: Quit session
- `Ctrl+B` then `D`: Detach (keeps running)
- `tmux attach -t waltodo-dev`: Reattach later

### Manual Setup

```bash
# Install dependencies
pnpm install

# Production build (with full type checking)
pnpm build

# Fast development build (skips type checking)
pnpm build:dev

# Install CLI locally
npm link

# Run tests
pnpm test

# Run specific tests
pnpm test -- -t "test name pattern"

# Run tests with coverage
pnpm test -- --coverage

# Start services individually
pnpm start:api        # API server on port 3001
cd waltodo-frontend && pnpm dev  # Web frontend on port 3000
```

### Frontend and Monorepo Structure

WalTodo uses a **monorepo structure** managed by pnpm workspaces. The project includes both a static HTML demo and a modern Next.js web frontend located in `packages/frontend-v2/`. This architecture provides:

- **Separation of Concerns**: CLI and web frontend are separate packages
- **Independent Development**: Each package has its own dependencies and build process  
- **Shared Dependencies**: Common dependencies are hoisted to save space
- **Scalability**: Easy to add new packages (mobile app, shared utilities, etc.)

#### Static Frontend Demo

```bash
# View the static HTML frontend demo
pnpm run web

# View the dashboard
pnpm run web:dashboard

# View the NFT todos page
pnpm run web:nft
```

The static demo is built with HTML, CSS, and JavaScript and showcases the oceanic theme with floating animations and glass-morphism components.

#### Modern Web Frontend (Next.js)

The main web frontend is located at `packages/frontend-v2/` and includes:

- **Next.js 13** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** with oceanic theme
- **Wallet Integration** for Sui and Phantom wallets
- **Real-time Todo Management**
- **NFT Dashboard** for blockchain todos

```bash
# Install frontend dependencies
pnpm run nextjs:install

# Start development server (http://localhost:3000)
pnpm run nextjs

# Build for production
pnpm run nextjs:build

# Start production server
pnpm run nextjs:start

# Build both CLI and frontend
pnpm run build:all
```

#### Quick Frontend Setup

```bash
# One-liner to get started with the Next.js frontend
cd packages/frontend-v2 && pnpm install && cd ../.. && pnpm run nextjs
```

For wallet integration details, see [packages/frontend-v2/WALLET_INTEGRATION.md](packages/frontend-v2/WALLET_INTEGRATION.md).

See [FRONTEND-SETUP.md](FRONTEND-SETUP.md) for more details about the static demo.

### Build System

The project features an enhanced build system with various options:

```bash
# Standard build (transpile-only for speed)
pnpm build

# Fast development build (skips type checks)
pnpm build:dev

# Production build with full type checking
pnpm build:prod

# Full clean production build
pnpm build:full

# Incremental build (only rebuilds changed files)
pnpm build:incremental

# Clean the dist directory
pnpm clean
```

For detailed information on the build system, see [Build Process Guide](docs/build-process.md).

> **Note about TypeScript Errors**: When building the project, you might encounter TypeScript errors related to SDK compatibility. These are expected due to version differences in Sui and Walrus SDKs but won't affect functionality. Use `pnpm build:dev` to bypass type checking.

### CLI Development

When making changes to the CLI, use the following scripts:

```bash
# Build the project with full type checking
pnpm run build

# Update the CLI after making changes
./update-cli.sh

# Test all CLI commands
./test-all-commands.sh
```

### Testing Infrastructure

WalTodo has a comprehensive testing infrastructure:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test interactions between components
- **Edge Case Tests**: Test boundary conditions and error handling
- **Fuzz Tests**: Test with random inputs to find unexpected issues
- **Command Tests**: Test CLI commands end-to-end

The test files are organized in the `tests/` directory, categorized by test type (unit, integration, etc.). We use Jest as our testing framework.

```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test -- --coverage

# Run specific test files
pnpm test -- tests/commands/add.test.ts

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
├── tests/                # Test files
│   ├── commands/         # Command tests
│   ├── edge-cases/       # Edge case tests
│   ├── fuzz/             # Fuzz testing
│   ├── helpers/          # Test helpers
│   ├── integration/      # Integration tests
│   ├── types/            # Type tests
│   ├── unit/             # Unit tests
│   └── utils/            # Utility tests
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

- `pnpm run build` - Standard build command that handles type compatibility issues
- `pnpm run typecheck` - Run TypeScript type checking without emitting JavaScript

The project enforces strict TypeScript compatibility to ensure code quality and reliability. All builds undergo full type checking, and TypeScript errors must be addressed rather than bypassed. This ensures that production code meets high quality standards and prevents potential runtime errors.

For a comprehensive guide on TypeScript compatibility, see [TypeScript Compatibility Guide](docs/typescript-compatibility.md).