# Waltodo Quick Start Guide

Get up and running with Waltodo in 5 minutes!

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18.0+** installed ([Download Node.js](https://nodejs.org/))
- **pnpm** package manager (`npm install -g pnpm`)
- A **Sui wallet** for interacting with Walrus storage

## Quick Installation

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/waltodo.git
cd waltodo

# Install dependencies
pnpm install

# Run setup script
pnpm run setup

# Build the project
pnpm run build
```

### 2. Configure Your Wallet and Walrus

On first run, Waltodo will prompt you to configure your Sui wallet connection:

```bash
waltodo init
```

Follow the prompts to:
- Connect your Sui wallet
- Select the network (testnet/mainnet)
- Configure Walrus endpoints
- Set up publishing preferences
- Confirm storage settings

### 3. Verify Walrus Setup

Ensure Walrus CLI is properly installed and configured:

```bash
# Check Walrus CLI installation
walrus --version

# Test connectivity to Walrus network
waltodo walrus-status

# Configure Walrus endpoints if needed
waltodo config set walrus.publisherUrl https://publisher.walrus-testnet.walrus.space
waltodo config set walrus.aggregatorUrl https://aggregator.walrus-testnet.walrus.space
```

## Creating Your First TODO

### Add a Simple TODO

```bash
waltodo add "Buy groceries"
```

Output:
```
✓ TODO created successfully!
ID: 1234abcd
Title: Buy groceries
Status: pending
```

### Add a TODO with Description

```bash
waltodo add "Plan vacation" --description "Research flights and hotels for summer trip"
```

### Add a TODO with Due Date

```bash
waltodo add "Submit report" --due "2024-12-31"
```

## Basic Commands Walkthrough

### List All TODOs

```bash
waltodo list
```

Output:
```
Your TODOs:

[1] ○ Buy groceries
    ID: 1234abcd
    Created: 2024-01-15

[2] ○ Plan vacation
    ID: 5678efgh
    Description: Research flights and hotels for summer trip
    Created: 2024-01-15

[3] ○ Submit report
    ID: 9012ijkl
    Due: 2024-12-31
    Created: 2024-01-15
```

### Mark TODO as Complete

```bash
waltodo complete 1234abcd
```

Output:
```
✓ TODO marked as complete!
```

### Update a TODO

```bash
waltodo update 5678efgh --title "Plan summer vacation"
```

### Delete a TODO

```bash
waltodo delete 9012ijkl
```

### Filter TODOs

```bash
# Show only pending TODOs
waltodo list --status pending

# Show only completed TODOs
waltodo list --status completed

# Show TODOs due this week
waltodo list --due-soon
```

## Publishing and Sharing TODOs

### Publishing Your TODOs to Walrus

Share your TODO lists with others by publishing them to the Walrus decentralized storage network:

```bash
# Publish your current TODOs
waltodo publish
```

Output:
```
✓ TODOs published to Walrus successfully!
Blob ID: bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id
Epochs: 100 (approximately 4 days on testnet)
Cost: 0.001 SUI
```

### Sharing TODOs with Others

```bash
# Get a shareable blob ID for your TODOs
waltodo share --include-done
```

Output:
```
✓ TODOs shared successfully!
Share this blob ID with others: bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id

To import these TODOs, use:
waltodo import-blob bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id
```

### Importing Shared TODOs

```bash
# Import TODOs from someone else's blob
waltodo import-blob bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id
```

Output:
```
✓ Imported 5 TODOs from Walrus blob
✓ Your local TODOs have been replaced with the imported ones
```

### Merging Shared TODOs

```bash
# Merge shared TODOs with your existing ones
waltodo import-blob bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id --merge
```

Output:
```
✓ Merged 3 new TODOs from Walrus blob
✓ Skipped 2 duplicate TODOs
✓ Total TODOs: 8 (5 existing + 3 new)
```

## Understanding Epochs and Storage Duration

Walrus storage is paid for in epochs. Each epoch represents a time period:

- **Testnet**: ~1 hour per epoch
- **Mainnet**: Check current epoch duration

### Publishing with Custom Epochs

```bash
# Publish for 24 epochs (approximately 1 day on testnet)
waltodo publish --epochs 24

# Publish for 168 epochs (approximately 1 week on testnet)
waltodo publish --epochs 168

# Estimate cost before publishing
waltodo estimate-cost 100
```

### Checking Your Published Blobs

```bash
# List all your published blobs
waltodo list-blobs

# Get detailed information about a specific blob
waltodo blob-info bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id
```

Output:
```
Your Published Blobs:

1. bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id
   Created: 2024-01-15 10:30:00
   Expires: 2024-01-19 10:30:00 (in 3.5 days)
   Size: 2.4 KB
   TODOs: 5 items

2. bEiC8NXZmJkPr9Sx_Rp7VxQlKm8_another_blob_id
   Created: 2024-01-14 15:45:00
   Expires: 2024-01-16 15:45:00 (expired)
   Size: 1.8 KB
   TODOs: 3 items
```

## Interactive Mode

For a guided experience, use interactive mode:

```bash
waltodo interactive
```

This will present a menu-driven interface for managing your TODOs.

## Next Steps

Now that you've mastered the basics:

1. **Explore Advanced Features**
   - Tags and categories
   - Bulk operations
   - Export/import functionality

2. **Customize Your Experience**
   - Configure display settings
   - Set up aliases for common commands
   - Integrate with your shell

3. **Learn More**
   - Read the full [documentation](./README.md)
   - Understand the [architecture](./ARCHITECTURE.md)
   - Join our community

## Troubleshooting

### Common Issues

**Problem**: "Wallet connection failed"
```bash
# Ensure your wallet is running
# Re-initialize the connection
waltodo init --reset
```

**Problem**: "Network timeout"
```bash
# Check your internet connection
# Try a different network endpoint
waltodo config set network testnet
```

**Problem**: "Build failed"
```bash
# Clean and rebuild
rm -rf node_modules
pnpm install
pnpm run build
```

**Problem**: "Failed to publish to Walrus"
```bash
# Check Walrus CLI installation
walrus --version

# Test network connectivity
waltodo walrus-status

# Check your SUI balance
sui client balance

# Try with fewer epochs
waltodo publish --epochs 10
```

**Problem**: "Blob not found when importing"
```bash
# Verify the blob ID is correct
waltodo blob-info <blob-id>

# Check if blob has expired
waltodo list-blobs

# Try a different aggregator endpoint
waltodo config set walrus.aggregatorUrl https://aggregator-alt.walrus-testnet.walrus.space
```

**Problem**: "Publishing costs too much"
```bash
# Estimate costs first
waltodo estimate-cost 50

# Use fewer epochs for shorter storage
waltodo publish --epochs 24

# Request testnet tokens (testnet only)
sui client faucet
```

## Getting Help

- Run `waltodo help` for command reference
- Run `waltodo <command> --help` for specific command help
- Check our [GitHub Issues](https://github.com/yourusername/waltodo/issues)

Happy TODO managing with Waltodo! 🚀