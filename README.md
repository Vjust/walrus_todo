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

```bash
waltodo add <description>    # Add a new TODO item
waltodo list                 # List all TODO items
waltodo done <id>           # Mark a TODO as done
waltodo delete <id>         # Delete a TODO
waltodo clear               # Clear all TODOs
waltodo export <file>       # Export TODOs to JSON
waltodo import <file>       # Import TODOs from JSON
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
- Walrus network endpoints
- Storage options (encryption, compression)
- UI preferences
- Sync settings

## Next Steps

The basic structure is in place. The next steps would be to:
1. Implement the actual Walrus storage integration
2. Add encryption support for private TODOs
3. Implement the command logic
4. Add tests
5. Set up CI/CD