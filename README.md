# Waltodo

A decentralized TODO list manager using Walrus storage.

## Project Structure

The initial TypeScript module files have been created with the following structure:

### Core Modules

1. **src/index.ts** - Main entry point
   - Sets up the CLI commander
   - Imports and registers all commands
   - Handles global error catching
   - Shows version and description

2. **src/cli/commands.ts** - Command definitions
   - Exports functions for each command (add, list, done, delete, clear, export, import)
   - Uses commander's action handlers
   - Basic structure with TODO placeholders for implementation

3. **src/cli/ui.ts** - UI helper functions
   - Chalk-styled output functions (success, error, warning, info)
   - Table formatting for list output using cli-table3
   - Progress spinner wrapper using ora
   - Date formatting and status/priority coloring

4. **src/todos/todo.ts** - TODO model
   - TypeScript interfaces for Todo and TodoStore
   - Validation functions
   - ID generation using uuid
   - Filter and sort utilities

5. **src/storage/walrus.ts** - Walrus client wrapper
   - Basic class structure for Walrus API interaction
   - Methods for store, retrieve, delete, exists
   - Error handling and retry logic
   - Health check functionality

6. **src/config/manager.ts** - Configuration management
   - Load/save config functions
   - Default config values
   - Config validation
   - Support for environment variables

7. **src/utils/errors.ts** - Custom error classes
   - WalrusError class with status codes
   - ConfigError class
   - ValidationError class
   - Other specialized error types

8. **src/utils/logger.ts** - Logging utility
   - Debug logging based on DEBUG env var
   - Structured logging with different log levels
   - Support for JSON output format
   - Timer utility for performance logging

## Available Commands

### Basic TODO Management
```bash
waltodo add <description>    # Add a new TODO item
waltodo list                 # List all TODO items
waltodo done <id>           # Mark a TODO as done
waltodo delete <id>         # Delete a TODO
waltodo clear               # Clear all TODOs
waltodo export <file>       # Export TODOs to JSON
waltodo import <file>       # Import TODOs from JSON
```

### Publishing and Sharing (New!)
```bash
waltodo publish              # Publish TODOs to Walrus
waltodo share                # Share TODOs and get blob ID
waltodo import-blob <id>     # Import from Walrus blob
waltodo retrieve <id>        # Retrieve shared TODOs
waltodo list-blobs           # List published blobs
waltodo blob-info <id>       # Get blob information
waltodo estimate-cost <epochs> # Estimate publishing costs
```

## Quick Start with Publishing

### Basic Publishing Example
```bash
# Add some TODOs
waltodo add "Review documentation"
waltodo add "Test new features"

# Publish to Walrus for 100 epochs (~4 days on testnet)
waltodo publish --epochs 100

# Get output like:
# ✓ TODOs published to Walrus successfully!
# Blob ID: bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id
# Share this ID with others to import your TODOs
```

### Sharing Example
```bash
# Share your TODOs (includes completed ones)
waltodo share --include-done

# Someone else can import them:
waltodo import-blob bEiB5KWZkIhOr7Rx_Qp5VxQlJl7_example_blob_id
```

### Cost Management
```bash
# Estimate costs before publishing
waltodo estimate-cost 50
# Output: Estimated cost: 0.0005 SUI for 50 epochs

# Check your published blobs
waltodo list-blobs
# Shows all your blobs with expiration dates
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Format code
npm run format
```

## Configuration

Configuration is stored in `~/.waltodo/config.json` and includes:
- Walrus network endpoints (publisher/aggregator URLs)
- Storage options (encryption, compression)
- Publishing preferences (default epochs, cost limits)
- UI preferences
- Sync settings

### Walrus Decentralized Storage Benefits

- **Decentralized**: No single point of failure, distributed across multiple nodes
- **Cost-Effective**: Pay only for the storage duration you need (epochs)
- **Permanent**: Data stored for the duration you specify, with predictable costs
- **Accessible**: Retrieve data from any node in the Walrus network
- **Censorship Resistant**: Decentralized storage prevents data takedowns
- **Shareable**: Simple blob IDs enable easy sharing without complex permissions

## Next Steps

The basic structure is in place. The next steps would be to:
1. ✅ Implement the actual Walrus storage integration
2. ✅ Add publishing and sharing functionality via Walrus blobs
3. Add encryption support for private TODOs
4. Implement the remaining command logic (publish, share, import-blob, etc.)
5. Add comprehensive tests for publishing features
6. Set up CI/CD
7. Add blob lifecycle management (expiration notifications, renewal)
8. Implement cost optimization features