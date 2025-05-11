# WalTodo Code Documentation Guide

**Date:** May 10, 2025

## Overview

This document provides an overview of the WalTodo codebase, its architecture, and key components to help new developers get up to speed quickly. The codebase has been extensively documented with JSDoc-style comments to make it easier to understand.

## Project Architecture

WalTodo is a CLI application for managing todos with blockchain integration, built with the following architecture:

### Core Components

1. **CLI Commands** (`src/commands/`)
   - Command classes that handle user interactions
   - Built on OCLIF framework
   - Each command extends `BaseCommand` which provides common functionality

2. **Storage System** (`src/utils/`)
   - Hybrid storage model with local and blockchain options
   - `walrus-storage.ts` - Interface with Walrus decentralized storage
   - `sui-nft-storage.ts` - Manages NFT storage on Sui blockchain
   - `storage-reuse-analyzer.ts` - Optimizes storage usage for efficiency

3. **Todo Management** (`src/services/`)
   - Core todo management logic
   - `todoService.ts` - Business logic for todo operations
   - `config-service.ts` - Handles app configuration

4. **AI Integration** (`src/services/ai/`)
   - AI-powered features using LangChain and XAI (Grok)
   - `aiService.ts` - Core AI capabilities
   - Five main operations: summarize, categorize, prioritize, suggest, analyze

5. **Blockchain Integration**
   - Smart contracts in Move language (`src/move/sources/`)
   - Adapters for Sui and Walrus blockchain interaction

### Key Design Patterns

1. **Adapter Pattern** (`src/types/adapters/`)
   - Interfaces between the application and blockchain SDKs
   - Handles version and interface compatibility issues

2. **Service Pattern** (`src/services/`)
   - Core business logic separated from presentation layer
   - Modular services with specific responsibilities

3. **Storage Optimization**
   - Best-fit algorithm for storage reuse
   - Precise size calculation for todos
   - Token savings analysis for efficient storage

## Key Files and Directories

### Command Structure (`src/commands/`)

The `src/commands/` directory contains all CLI commands. Key files include:

- `add.ts`: Handles adding new todo items to lists
- `list.ts`: Displays todo items or available lists
- `complete.ts`: Marks todos as completed
- `store.ts`: Stores todos on blockchain
- `ai.ts`: AI-powered todo operations

All commands extend the `BaseCommand` class which provides:
- Common flags (help, json, etc.)
- Consistent UI elements (spinners, formatted output)
- Error handling
- Authentication

### Service Layer (`src/services/`)

The service layer contains core business logic:

- `todoService.ts`: Handles todo CRUD operations and list management
- `config-service.ts`: Manages application configuration
- `authentication-service.ts`: Handles user authentication

The `src/services/ai/` subdirectory contains AI-specific services:
- `aiService.ts`: Core AI operations implementation
- `AIProviderFactory.ts`: Factory for creating AI providers
- `TaskSuggestionService.ts`: AI-powered task suggestions

### Utility Layer (`src/utils/`)

The `src/utils/` directory contains utility classes and functions:

- `walrus-storage.ts`: Interface to Walrus decentralized storage
- `storage-reuse-analyzer.ts`: Blockchain storage optimization
- `CommandValidationMiddleware.ts`: Command input validation

### Type Definitions (`src/types/`)

The `src/types/` directory contains type definitions:

- `todo.ts`: Todo and TodoList interfaces
- `error.ts`: Error handling interfaces
- `permissions.ts`: Permission model definitions

The `src/types/adapters/` subdirectory contains adapter interfaces:
- `BaseAdapter.ts`: Base adapter interface
- `AIModelAdapter.ts`: AI model provider interface
- `WalrusClientAdapter.ts`: Walrus blockchain client interface

### Testing Infrastructure

- `tests/helpers/`: Test helper functions and utilities
- `src/__mocks__/`: Mock implementations for testing

## Core Workflows

### Adding a Todo

The process for adding a todo involves:

1. **Command Parsing:** `add.ts` parses CLI arguments and flags
2. **Validation:** Input is validated using `CommandValidationMiddleware`
3. **Todo Creation:** `todoService.addTodo()` creates the todo
4. **Storage:** Todo is stored locally or on blockchain
5. **Output:** Command formats and displays a success message

### Blockchain Storage

Storing todos on the blockchain involves:

1. **Connection:** `walrus-storage.ts` connects to Walrus storage
2. **Optimization:** `storage-reuse-analyzer.ts` finds optimal storage
3. **Upload:** Todo data is uploaded to Walrus
4. **NFT Creation:** NFT is created on Sui blockchain
5. **References:** Local copy is updated with blockchain references

### AI Operations

AI operations follow this pattern:

1. **Provider Selection:** `AIProviderFactory` selects appropriate provider
2. **Operation Execution:** `aiService` executes the requested operation
3. **Response Processing:** AI response is parsed and formatted
4. **Verification:** Optional blockchain verification of AI operations
5. **Output:** Results are presented to the user

## Common Patterns

### Error Handling

Error handling follows a consistent pattern:

```typescript
try {
  // Operation code
} catch (error) {
  // Specific error handling if needed
  if (error instanceof CLIError) {
    throw error;
  }
  
  // Convert to standard CLI error format
  throw new CLIError(
    `Operation failed: ${error instanceof Error ? error.message : String(error)}`,
    'ERROR_CODE'
  );
}
```

### Command Structure

Commands follow a consistent structure:

```typescript
export default class SomeCommand extends BaseCommand {
  static description = 'Command description';
  static examples = [ /* Usage examples */ ];
  static flags = { /* Command flags */ };
  static args = { /* Command arguments */ };
  
  async run(): Promise<void> {
    // Parse arguments and flags
    const { args, flags } = await this.parse(SomeCommand);
    
    // Handle JSON output if requested
    if (await this.isJson()) {
      return this.handleJsonOutput(args, flags);
    }
    
    // Command implementation
    // ...
    
    // Display success
    this.success('Operation completed successfully');
  }
}
```

### Validation Middleware

Commands use validation middleware to ensure inputs are valid:

```typescript
static hooks = {
  prerun: [commandValidation],
} as const;
```

### Adapters

Adapters provide a consistent interface to external systems:

```typescript
export interface SomeAdapter extends BaseAdapter {
  operationA(param1: string): Promise<Result>;
  operationB(param2: number): Promise<void>;
}

// Implementation with version-specific logic
export class SomeAdapterImpl implements SomeAdapter {
  // Implementation details
}
```

## Key Design Decisions

1. **Hybrid Storage Model**
   - Local JSON storage for quick access
   - Blockchain storage for decentralization
   - NFT representation for ownership and transfer

2. **Multi-Provider AI Integration**
   - Support for XAI/Grok, OpenAI, and Anthropic
   - Adapter pattern for provider abstraction
   - Blockchain verification for AI operations

3. **Command/Service Separation**
   - Commands handle user interaction
   - Services contain business logic
   - Clear separation of concerns

4. **Storage Optimization**
   - Best-fit algorithm for storage allocation
   - Reuse strategy to minimize token usage
   - Cost savings calculation for efficiency

## Getting Started for Developers

1. **Understand the Command Flow**
   - Start by examining the core commands in `src/commands/`
   - See how they leverage services for business logic
   - Note the consistent patterns for user interaction

2. **Explore the Service Layer**
   - Review `todoService.ts` to understand todo management
   - Look at `aiService.ts` to see AI integration
   - Study the adapter implementations for external services

3. **Review the Type System**
   - Examine `todo.ts` for the core data model
   - Look at adapter interfaces to understand integration points
   - Review error types for consistent error handling

4. **Test Infrastructure**
   - Check `tests/helpers/` for testing utilities
   - Review `src/__mocks__/` for mock implementations
   - See example tests for testing patterns

## Best Practices

When extending or modifying the codebase:

1. **Follow Existing Patterns**
   - Use existing adapters rather than direct SDK usage
   - Maintain command/service separation
   - Leverage the BaseCommand class for new commands

2. **Maintain Documentation**
   - Keep JSDoc comments up to date
   - Document complex algorithms and workflows
   - Include usage examples in interface documentation

3. **Write Comprehensive Tests**
   - Use the test helpers for consistent mocking
   - Test happy paths and error scenarios
   - Use the factory pattern for test setup

4. **Error Handling**
   - Use CLIError for user-facing errors
   - Include error codes for programmatic handling
   - Provide helpful error messages with suggestions

## Conclusion

The WalTodo codebase follows a modular, well-structured architecture with clear separation of concerns. By leveraging the adapter pattern and service abstractions, it provides a flexible foundation for future enhancements while maintaining compatibility with external services and SDKs.

For any questions or clarifications, refer to the extensive documentation in the codebase or reach out to the development team.