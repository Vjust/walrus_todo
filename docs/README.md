# Waltodo Documentation

Welcome to the Waltodo documentation! This guide will help you understand and use Waltodo, a CLI tool for managing TODOs on Walrus decentralized storage.

## Documentation Overview

- [Quick Start Guide](./QUICKSTART.md) - Get up and running in 5 minutes
- [Architecture Overview](./ARCHITECTURE.md) - Technical details and system design

## Project Overview

Waltodo is a command-line interface (CLI) tool that leverages Walrus decentralized storage to manage your TODO lists. Unlike traditional TODO applications that store data locally or on centralized servers, Waltodo ensures your tasks are stored on a decentralized network, providing persistence, availability, and ownership of your data.

## Key Features

- **Decentralized Storage**: Your TODOs are stored on the Walrus network, ensuring data persistence and availability
- **Command-Line Interface**: Fast and efficient task management directly from your terminal
- **Secure**: Leverages Sui blockchain technology for secure data management
- **Cross-Platform**: Works on any system with Node.js support
- **Simple Commands**: Intuitive commands for creating, listing, updating, and deleting TODOs
- **Colorful Output**: Enhanced terminal experience with colored output using chalk

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

## Configuration

Waltodo stores its configuration in your home directory. You can configure:

- Walrus network endpoints
- Default storage settings
- Display preferences

## Contributing

We welcome contributions! Please see our contributing guidelines for more information.

## Support

If you encounter any issues or have questions:

1. Check the [Quick Start Guide](./QUICKSTART.md)
2. Review the [Architecture Documentation](./ARCHITECTURE.md)
3. Open an issue on GitHub

## License

Waltodo is released under the MIT License.