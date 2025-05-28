# NFT Creation Workflow Guide

## Overview

This guide covers the complete workflow for creating NFT todos in the WalTodo application, from initial setup to blockchain storage and management.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Wallet Configuration](#wallet-configuration)
4. [Smart Contract Deployment](#smart-contract-deployment)
5. [Creating NFT Todos](#creating-nft-todos)
6. [Managing NFT Todos](#managing-nft-todos)
7. [Advanced Operations](#advanced-operations)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- Node.js v18.0.0 or higher
- pnpm v8.0.0 or higher
- Sui CLI installed and configured
- WAL tokens for Walrus storage

### Required Tools
```bash
# Install Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui

# Install Walrus CLI
curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh

# Verify installations
sui --version
walrus --version
```

## Environment Setup

### 1. Install WalTodo
```bash
# Clone and install
git clone https://github.com/Vjust/walrus_todo.git
cd walrus_todo
pnpm install
pnpm run global-install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:

```bash
# Network configuration
NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Walrus configuration
WALRUS_USE_MOCK=false
WALRUS_CONFIG_PATH=~/.walrus/client_config.yaml

# AI configuration (optional)
XAI_API_KEY=your-xai-api-key
OPENAI_API_KEY=your-openai-api-key
```

### 3. Walrus Configuration
Create Walrus config at `~/.walrus/client_config.yaml`:

```yaml
system_object: 0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af
staking_object: 0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3
epochs_ahead: 1
```

## Wallet Configuration

### 1. Create or Import Sui Wallet
```bash
# Create new wallet
sui client new-address ed25519

# Or import existing wallet
sui client import <private-key> ed25519

# Get testnet tokens
sui client faucet

# Check balance
sui client gas
```

### 2. Get WAL Tokens
```bash
# Request testnet WAL tokens
walrus --config ~/.walrus/client_config.yaml get-wal

# Verify WAL balance
walrus --config ~/.walrus/client_config.yaml info
```

### 3. Configure WalTodo
```bash
# Run configuration wizard
waltodo configure

# Provide:
# - Your Sui address
# - Network (testnet/mainnet)
# - Wallet path (if needed)
```

## Smart Contract Deployment

### 1. Deploy Todo NFT Contract
```bash
# Deploy to testnet
waltodo deploy --network testnet

# Output will show:
# ✓ Package deployed successfully
# Package ID: 0x1234...
# Configuration updated
```

### 2. Verify Deployment
```bash
# Check deployment status
waltodo config

# Should show:
# PACKAGE_ID: 0x1234...
# NETWORK: testnet
```

## Creating NFT Todos

### 1. Basic NFT Todo Creation

#### Create Local Todo First
```bash
# Create a simple todo
waltodo add "Complete project documentation"

# Create with metadata
waltodo add "Design new feature" -p high -g "work,design" -d 2024-06-01
```

#### Store on Blockchain
```bash
# List todos to get ID
waltodo list

# Store single todo as NFT
waltodo store --todo 123456 --list default

# Output:
# ✓ Uploading todo to Walrus...
# ✓ Blob stored: blob_id_abc123
# ✓ Creating NFT on Sui blockchain...
# ✓ NFT created: 0x789def...
```

### 2. Batch NFT Creation
```bash
# Store all todos in a list
waltodo store --all --list default

# Store with custom batch size
waltodo store --all --list work --batch-size 10

# Store with custom image
waltodo store --todo 123456 --list default --image ./custom-todo.png
```

### 3. Advanced NFT Creation

#### With AI Enhancement
```bash
# Create AI-enhanced todo and store as NFT
waltodo add "Implement authentication system" --ai
waltodo store --todo $(waltodo list --format json | jq -r '.[-1].id') --list default
```

#### With Custom Metadata
```bash
# Create todo with rich metadata
waltodo add "Security audit" -p critical -g "security,audit" -d 2024-05-30
waltodo store --todo 123456 --list security --epochs 100
```

## Managing NFT Todos

### 1. Viewing NFT Todos
```bash
# List all todos (including NFT status)
waltodo list

# View blockchain-specific information
waltodo retrieve --list default

# Check specific NFT
waltodo retrieve --object-id 0x789def...
```

### 2. Completing NFT Todos
```bash
# Complete todo (updates both local and blockchain)
waltodo complete --id 123456

# Complete with verification
waltodo complete --id 123456 --verify
```

### 3. Updating NFT Todos
```bash
# Update todo content (creates new NFT version)
waltodo update --id 123456 --title "Updated title" --description "New description"

# Update with AI suggestions
waltodo update --id 123456 --ai
```

### 4. Transferring NFT Todos
```bash
# Transfer NFT to another address
sui client transfer --object-id 0x789def... --to 0x456789... --gas-budget 10000000

# Verify transfer
sui client object 0x789def...
```

## Advanced Operations

### 1. Storage Optimization
```bash
# Analyze storage usage
waltodo storage --analyze

# View storage summary
waltodo storage --summary

# Optimize storage allocation
waltodo storage --optimize
```

### 2. Bulk Operations
```bash
# Batch create multiple todos
waltodo add "work" -t "Task 1" -t "Task 2" -t "Task 3"

# Batch store as NFTs
waltodo store --all --list work --batch-size 5

# Batch complete
waltodo complete --list work --pattern "Task*"
```

### 3. NFT Verification
```bash
# Verify NFT integrity
waltodo verify --object-id 0x789def...

# Verify all NFTs in a list
waltodo verify --list default --all

# Check blockchain events
sui client events --package 0x1234... --module todo_nft
```

### 4. Cross-Platform Management

#### Using Web Frontend
```bash
# Start frontend development server
cd waltodo-frontend
pnpm dev

# Access at http://localhost:3000
# Connect wallet and manage NFT todos
```

#### Using API
```bash
# Start API server
pnpm run api:start

# API endpoints available at http://localhost:8080
# - GET /api/todos
# - POST /api/todos
# - PUT /api/todos/:id
# - DELETE /api/todos/:id
```

## Workflow Examples

### Example 1: Project Management Workflow
```bash
# 1. Create project todos
waltodo add "project" -t "Design mockups" -p high -g "design"
waltodo add "project" -t "Implement backend" -p medium -g "backend"
waltodo add "project" -t "Write tests" -p medium -g "testing"

# 2. Store all as NFTs
waltodo store --all --list project

# 3. Work on todos and mark complete
waltodo complete --id 123456

# 4. Transfer completed NFTs to client
sui client transfer --object-id 0x789def... --to 0xclient...
```

### Example 2: AI-Enhanced Workflow
```bash
# 1. Create AI-suggested todos
waltodo suggest --type next_step --apply

# 2. Enhance with AI analysis
waltodo ai analyze

# 3. Store prioritized todos as NFTs
waltodo store --all --list default --priority high

# 4. Verify operations on blockchain
waltodo ai verify list --todo 123456
```

### Example 3: Collaborative Workflow
```bash
# 1. Create shared todo list
waltodo add "shared" -t "Team meeting prep" -t "Review documents"

# 2. Store as NFTs with long duration
waltodo store --all --list shared --epochs 200

# 3. Share with team members
sui client transfer --object-id 0x789def... --to 0xteam1...
sui client transfer --object-id 0xabc123... --to 0xteam2...

# 4. Monitor progress
waltodo retrieve --list shared --all
```

## Troubleshooting

### Common Issues

#### 1. Contract Not Deployed
```bash
# Error: Contract not deployed
# Solution:
waltodo deploy --network testnet
```

#### 2. Insufficient Gas
```bash
# Error: Insufficient gas
# Solution:
sui client faucet
sui client gas
```

#### 3. Walrus Storage Issues
```bash
# Error: Failed to upload to Walrus
# Solutions:
walrus --config ~/.walrus/client_config.yaml get-wal
waltodo storage --analyze
```

#### 4. NFT Not Found
```bash
# Error: NFT object not found
# Solutions:
sui client object 0x789def...
waltodo retrieve --object-id 0x789def... --force-refresh
```

### Advanced Troubleshooting

#### Debug Mode
```bash
# Enable verbose logging
waltodo store --todo 123456 --list default --verbose

# Check system status
waltodo config --validate
```

#### Recovery Operations
```bash
# Recover from failed transactions
waltodo recover --transaction 0xabc123...

# Rebuild local index
waltodo rebuild --from-blockchain
```

## Best Practices

### 1. Storage Management
- Use batch operations for multiple todos
- Optimize storage epochs based on importance
- Regularly analyze storage usage
- Reuse storage allocations when possible

### 2. Security
- Keep wallet private keys secure
- Verify all transactions before signing
- Use test networks for development
- Regular backup of important NFTs

### 3. Performance
- Use appropriate batch sizes (5-10 items)
- Monitor gas costs
- Cache frequently accessed data
- Use CDN for image assets

### 4. Collaboration
- Use descriptive todo titles and descriptions
- Add relevant tags and metadata
- Set appropriate privacy levels
- Document transfer reasons

## Next Steps

1. Explore advanced AI features
2. Set up monitoring and alerts
3. Integrate with external tools
4. Develop custom smart contracts
5. Build custom frontend applications

For more information, see:
- [API Documentation](api-documentation.md)
- [Smart Contract Guide](smart-contract-documentation.md)
- [Frontend Integration](frontend-usage-guide.md)
- [Advanced Features](advanced-features-guide.md)