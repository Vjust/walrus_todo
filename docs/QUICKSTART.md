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

### 2. Configure Your Wallet

On first run, Waltodo will prompt you to configure your Sui wallet connection:

```bash
waltodo init
```

Follow the prompts to:
- Connect your Sui wallet
- Select the network (testnet/mainnet)
- Confirm storage settings

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

## Getting Help

- Run `waltodo help` for command reference
- Run `waltodo <command> --help` for specific command help
- Check our [GitHub Issues](https://github.com/yourusername/waltodo/issues)

Happy TODO managing with Waltodo! 🚀