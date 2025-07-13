# Waltodo Architecture

This document provides a technical overview of Waltodo's architecture, module design, and extension points.

## Architecture Overview

Waltodo follows a modular architecture designed for maintainability and extensibility:

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Interface                         │
│                  (Commander.js)                          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                  Command Handlers                        │
│         (add, list, complete, delete, etc.)             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────────┐
│                TODO Service Layer                        │
│          (Business Logic & Validation)                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────────┐
│              Storage Abstraction                         │
│                 (Storage API)                            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────────┐
│             Walrus Storage Adapter                       │
│           (Sui.js Integration)                           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│            Walrus Decentralized Network                  │
└─────────────────────────────────────────────────────────┘
```

## Module Architecture

### Core Modules

#### 1. CLI Module (`/src/cli`)
- **Purpose**: Handle command-line interface and user interactions
- **Key Components**:
  - `index.ts` - Main CLI entry point
  - `commands/` - Individual command implementations
  - `prompts/` - Interactive prompts using Inquirer.js
- **Dependencies**: Commander.js, Inquirer.js, Chalk

#### 2. TODO Module (`/src/todos`)
- **Purpose**: Core business logic for TODO operations
- **Key Components**:
  - `todo.service.ts` - TODO service layer
  - `todo.model.ts` - TODO data models and types
  - `todo.validator.ts` - Input validation
- **Responsibilities**:
  - TODO CRUD operations
  - Business rule enforcement
  - Data transformation

#### 3. Storage Module (`/src/storage`)
- **Purpose**: Abstract storage operations
- **Key Components**:
  - `storage.interface.ts` - Storage abstraction interface
  - `walrus.adapter.ts` - Walrus-specific implementation
  - `cache.ts` - Local caching layer
- **Features**:
  - Pluggable storage backends
  - Caching for performance
  - Error handling and retries

#### 4. Config Module (`/src/config`)
- **Purpose**: Manage application configuration
- **Key Components**:
  - `config.service.ts` - Configuration management
  - `config.schema.ts` - Configuration validation
  - `defaults.ts` - Default configuration values
- **Configuration Areas**:
  - Network settings
  - User preferences
  - Storage parameters

#### 5. Utils Module (`/src/utils`)
- **Purpose**: Shared utilities and helpers
- **Key Components**:
  - `logger.ts` - Logging utilities
  - `formatter.ts` - Output formatting
  - `crypto.ts` - Cryptographic helpers
  - `errors.ts` - Custom error types

## Data Flow

### Creating a TODO

```
User Input → CLI Command → Validation → TODO Service → Storage Adapter → Walrus Network
     ↓                                                                            ↓
Terminal ← Format Output ← Success Response ← Transaction Result ← Storage Confirmation
```

### Retrieving TODOs

```
CLI Command → TODO Service → Cache Check → Storage Adapter → Walrus Query
                               ↓ (hit)              ↓              ↓
                            Return Cached     Fetch from Network   ↓
                                 ↓                   ↓              ↓
Terminal ← Format & Display ← Merge Results ← Update Cache ← Network Response
```

## Storage Patterns

### Data Model

TODOs are stored as JSON objects with the following structure:

```typescript
interface Todo {
  id: string;           // Unique identifier
  title: string;        // TODO title
  description?: string; // Optional description
  status: 'pending' | 'completed';
  createdAt: string;    // ISO 8601 timestamp
  updatedAt: string;    // ISO 8601 timestamp
  completedAt?: string; // When completed
  dueDate?: string;     // Optional due date
  tags?: string[];      // Optional tags
  metadata?: {          // Extensible metadata
    [key: string]: any;
  };
}
```

### Storage Operations

1. **Create**: Generates unique ID, validates data, stores on Walrus
2. **Read**: Queries Walrus, applies filters, returns formatted data
3. **Update**: Fetches current state, applies changes, stores updated version
4. **Delete**: Marks as deleted (soft delete) or removes from storage (hard delete)

### Caching Strategy

- **Write-through**: Updates go to both cache and storage
- **Read-through**: Cache misses trigger storage reads
- **TTL-based expiry**: Cached items expire after configurable duration
- **Invalidation**: Cache cleared on updates/deletes

## Module Responsibilities

### CLI Module
- Parse command-line arguments
- Handle user input validation
- Present formatted output
- Manage interactive sessions

### TODO Service
- Implement business logic
- Enforce data constraints
- Handle complex operations (bulk updates, etc.)
- Coordinate between modules

### Storage Adapter
- Abstract Walrus API complexity
- Handle network errors and retries
- Manage data serialization
- Implement storage-specific optimizations

### Configuration
- Load and validate settings
- Provide defaults
- Handle environment-specific configs
- Persist user preferences

## Extension Points

### 1. Custom Storage Backends

Implement the `IStorageAdapter` interface:

```typescript
interface IStorageAdapter {
  create(todo: Todo): Promise<string>;
  read(id: string): Promise<Todo | null>;
  update(id: string, updates: Partial<Todo>): Promise<Todo>;
  delete(id: string): Promise<void>;
  list(filters?: TodoFilters): Promise<Todo[]>;
}
```

### 2. Custom Commands

Add new commands by:

1. Creating a command file in `/src/cli/commands/`
2. Implementing the command handler
3. Registering with the CLI router

Example:
```typescript
export const archiveCommand = {
  name: 'archive',
  description: 'Archive completed TODOs',
  options: [
    { flag: '-d, --days <number>', description: 'Archive TODOs older than N days' }
  ],
  action: async (options) => {
    // Implementation
  }
};
```

### 3. Middleware/Plugins

Add functionality through middleware:

```typescript
interface Middleware {
  before?: (context: CommandContext) => Promise<void>;
  after?: (context: CommandContext, result: any) => Promise<void>;
  error?: (context: CommandContext, error: Error) => Promise<void>;
}
```

### 4. Custom Formatters

Implement custom output formats:

```typescript
interface IFormatter {
  format(todos: Todo[]): string;
  formatSingle(todo: Todo): string;
}
```

## Security Considerations

1. **Wallet Security**: Private keys never stored, only wallet connection
2. **Data Encryption**: Optional client-side encryption before storage
3. **Access Control**: Wallet-based ownership verification
4. **Input Sanitization**: All user inputs validated and sanitized

## Performance Optimizations

1. **Batch Operations**: Group multiple operations into single transactions
2. **Lazy Loading**: Load data on-demand
3. **Compression**: Compress data before storage
4. **Connection Pooling**: Reuse network connections
5. **Parallel Queries**: Execute independent queries concurrently

## Development Guidelines

1. **Type Safety**: Use TypeScript strict mode
2. **Error Handling**: Graceful degradation with user-friendly messages
3. **Testing**: Unit tests for services, integration tests for adapters
4. **Logging**: Structured logging with configurable levels
5. **Documentation**: JSDoc comments for public APIs

## Future Enhancements

- Multi-user collaboration
- Real-time synchronization
- Mobile companion app
- Web interface
- Advanced search and filtering
- Recurring TODOs
- Attachments and rich media
- Integration with external services