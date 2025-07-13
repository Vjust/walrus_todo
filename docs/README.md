# Waltodo Documentation

Welcome to the Waltodo documentation! This guide will help you understand and use Waltodo, a CLI tool for managing TODOs on Walrus decentralized storage.

## Documentation Overview

- [Quick Start Guide](./QUICKSTART.md) - Get up and running in 5 minutes
- [Architecture Overview](./ARCHITECTURE.md) - Technical details and system design

## Project Overview

Waltodo is a command-line interface (CLI) tool that leverages Walrus decentralized storage to manage your TODO lists. Unlike traditional TODO applications that store data locally or on centralized servers, Waltodo ensures your tasks are stored on a decentralized network, providing persistence, availability, and ownership of your data.

## Key Features

- **Decentralized Storage**: Your TODOs are stored on the Walrus network, ensuring data persistence and availability
- **Publishing & Sharing**: Publish your TODO lists to Walrus and share them via blob IDs
- **Command-Line Interface**: Fast and efficient task management directly from your terminal
- **Secure**: Leverages Sui blockchain technology for secure data management
- **Cross-Platform**: Works on any system with Node.js support
- **Simple Commands**: Intuitive commands for creating, listing, updating, and deleting TODOs
- **Colorful Output**: Enhanced terminal experience with colored output using chalk
- **Blob Management**: Import and retrieve TODOs from published Walrus blobs

## Installation

### Prerequisites

- Node.js 18.0 or higher
- pnpm package manager
- A Sui wallet for interacting with the Walrus network

### Install from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/waltodo.git
cd waltodo

# Install dependencies
pnpm install

# Set up the project
pnpm run setup

# Build the project
pnpm run build
```

### Walrus CLI Setup

For publishing features, you'll need the Walrus CLI:

```bash
# Install Walrus CLI (follow official Walrus documentation)
# Configure your Sui wallet and network settings
walrus --version
```

## Basic Usage

### Creating a TODO

```bash
waltodo add "Complete project documentation"
```

### Listing all TODOs

```bash
waltodo list
```

### Marking a TODO as complete

```bash
waltodo complete <todo-id>
```

### Deleting a TODO

```bash
waltodo delete <todo-id>
```

### Publishing TODOs to Walrus

```bash
# Publish your current TODO list to Walrus
waltodo publish

# Publish with custom epochs (storage duration)
waltodo publish --epochs 100

# Get the blob ID for sharing
waltodo publish --output-blob-id
```

### Importing from Published TODOs

```bash
# Import TODOs from a Walrus blob
waltodo import-blob <blob-id>

# Merge with existing TODOs instead of replacing
waltodo import-blob <blob-id> --merge
```

### Sharing TODOs

```bash
# Share your TODOs by publishing and getting a shareable blob ID
waltodo share

# Retrieve shared TODOs from someone else
waltodo retrieve <blob-id>
```

## Configuration

Waltodo stores its configuration in your home directory. You can configure:

- Walrus network endpoints (aggregator and publisher URLs)
- Default storage settings (epochs, blob management)
- Display preferences
- Publishing preferences (default epochs, auto-publish settings)

### Walrus Network Configuration

```bash
# Configure Walrus endpoints
waltodo config set walrus.publisherUrl https://publisher.walrus-testnet.walrus.space
waltodo config set walrus.aggregatorUrl https://aggregator.walrus-testnet.walrus.space

# Set default publishing epochs (storage duration)
waltodo config set walrus.defaultEpochs 100
```

## Publishing Commands Reference

### Publish Commands

| Command | Description | Options |
|---------|-------------|---------|
| `waltodo publish` | Publish current TODOs to Walrus | `--epochs <number>`, `--output-blob-id` |
| `waltodo share` | Publish and get shareable blob ID | `--epochs <number>`, `--include-done` |
| `waltodo import-blob <blob-id>` | Import TODOs from Walrus blob | `--merge`, `--dry-run` |
| `waltodo retrieve <blob-id>` | Retrieve and display shared TODOs | `--save`, `--merge` |
| `waltodo list-blobs` | List your published blob IDs | `--show-metadata` |

### Publishing Examples

```bash
# Publish your TODOs for 100 epochs (approximately 1 day on testnet)
waltodo publish --epochs 100

# Share your TODOs and get a blob ID for sharing
waltodo share --include-done

# Import TODOs from a shared blob ID
waltodo import-blob bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id

# Retrieve shared TODOs without importing
waltodo retrieve bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id --save todos-shared.json

# List all your published blobs
waltodo list-blobs --show-metadata
```

### Understanding Epochs and Storage Costs

Walrus storage is paid per epoch. Each epoch lasts approximately:
- **Testnet**: ~1 hour per epoch
- **Mainnet**: TBD (check current epoch duration)

Storage costs are calculated based on:
- Data size (in bytes)
- Number of epochs
- Current network pricing

Use `waltodo estimate-cost <epochs>` to estimate publishing costs before publishing.

## Troubleshooting Walrus Connectivity

### Common Issues

**Problem**: "Failed to connect to Walrus publisher"
```bash
# Check network connectivity
curl -s https://publisher.walrus-testnet.walrus.space/status

# Verify Walrus CLI installation
walrus --version

# Reset Walrus configuration
waltodo config reset walrus
```

**Problem**: "Blob not found" when retrieving
```bash
# Check if blob ID is correct (64-character base64 string)
# Verify the blob hasn't expired (check epoch)
waltodo blob-info <blob-id>

# Try alternative aggregator
waltodo config set walrus.aggregatorUrl https://aggregator-alt.walrus-testnet.walrus.space
```

**Problem**: "Insufficient funds for publishing"
```bash
# Check your Sui wallet balance
sui client balance

# Request testnet tokens (testnet only)
sui client faucet

# Estimate costs before publishing
waltodo estimate-cost 50
```

**Problem**: "Network timeout"
```bash
# Increase timeout settings
waltodo config set walrus.timeout 30000

# Check Walrus network status
curl -s https://walrus-testnet.walrus.space/api/status

# Try publishing with fewer epochs
waltodo publish --epochs 10
```

## Contributing

We welcome contributions! Please see our contributing guidelines for more information.

## Support

If you encounter any issues or have questions:

1. Check the [Quick Start Guide](./QUICKSTART.md)
2. Review the [Architecture Documentation](./ARCHITECTURE.md)
3. Open an issue on GitHub

## License

Waltodo is released under the MIT License.