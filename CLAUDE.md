# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build System
```bash
# Standard development build (fastest, recommended)
pnpm build:dev

# Production build with full type checking
pnpm build

# Clean rebuild
pnpm clean && pnpm build

# Install CLI globally after changes
pnpm run global-install
```

### Testing
```bash
# Run all tests
pnpm test

# Run specific test categories
pnpm test:unit                    # Unit tests only
pnpm test:integration            # Integration tests
pnpm test:security               # Security test suite
pnpm test -- -t "pattern"        # Run tests matching pattern
pnpm test -- --coverage          # Generate coverage report

# Run single test file
pnpm test tests/commands/add.test.ts
```

### Linting and Type Checking
```bash
pnpm lint                        # ESLint + fix
pnpm typecheck                   # TypeScript type checking
```

### CLI Development
```bash
# Test CLI commands after changes
./update-cli.sh                  # Rebuild and reinstall CLI
waltodo --help                   # Verify CLI works
```

### Network Validation
```bash
pnpm validate:rpc                # Validate all RPC endpoints for Sui testnet/mainnet
```

## Architecture Overview

### Command-Service-Adapter Pattern

WalTodo uses a sophisticated **Command-Service-Adapter (CSA)** architecture:

1. **Commands** (`src/commands/`): OCLIF-based CLI commands that extend `BaseCommand`
2. **Services** (`src/services/`): Business logic layer with dependency injection
3. **Adapters** (`src/types/adapters/`, `src/utils/adapters/`): Version compatibility abstractions

All commands inherit from `BaseCommand` which provides:
- Unified error handling with structured error types (`src/types/errors/consolidated/`)
- Progress indicators and background job orchestration
- Configuration management and retry logic
- Multi-format output support

### Storage Architecture

Multi-tier storage system:
- **Local**: JSON files in `Todos/` directory (immediate access)
- **Walrus**: Decentralized storage for todo data and images
- **Sui Blockchain**: NFT ownership records and smart contracts (`src/move/`)
- **API**: Centralized coordination layer

Storage operations use the adapter pattern (`src/utils/storage/`) to abstract backend differences.

### Background Operations System

Critical architecture component (`src/utils/BackgroundCommandOrchestrator.ts`):
- Any command can run in background with `--background` flag
- Automatic detection of long-running operations
- Job queuing, progress tracking, and resource management
- Commands check for background execution in `BaseCommand`

### TypeScript Compatibility Strategy

The codebase uses a **gradual migration approach** to TypeScript strictness:
- `strict: false` with selective strict checks enabled
- Adapter pattern handles version mismatches between `@mysten/sui` and `@mysten/walrus`
- Mock implementations in `src/__mocks__/` provide compatible interfaces
- Build system supports both development (fast) and production (strict) modes

## Key Development Patterns

### Adding New Commands

1. Extend `BaseCommand` from `src/base-command.ts`
2. Implement in `src/commands/` with proper flag definitions
3. Add to `src/commands/index.ts` for exports
4. Create corresponding test in `tests/commands/`
5. Mock external dependencies using patterns from `src/__mocks__/`

### Service Integration

Services follow dependency injection pattern:
```typescript
// Example service instantiation
const todoService = new TodoService(configService, storageAdapter);
```

### Error Handling

Use consolidated error types from `src/types/errors/consolidated/`:
- `ValidationError` for input validation
- `NetworkError` for connectivity issues  
- `BlockchainError` for Sui/Walrus operations
- `StorageError` for storage operations

### Testing Patterns

- **Unit tests**: Test individual functions/classes with mocks
- **Integration tests**: Test service interactions with real dependencies
- **E2E tests**: Full workflow testing with CLI execution
- Use `createMockTodo()` and similar helpers from test utilities
- Mock external services using comprehensive mocks in `src/__mocks__/`

### AI Integration

Multi-provider AI system (`src/services/ai/`):
- Factory pattern for provider instantiation
- Adapter pattern for API normalization
- Blockchain verification for AI operations
- Secure credential management with encryption

### Frontend Integration

- CLI generates config for frontend: `pnpm config:generate`
- Shared types between CLI and frontend
- Frontend located in `waltodo-frontend/`

## Important Configuration Files

- `tsconfig.json`: Balanced TypeScript configuration for gradual migration
- `jest.config.js`: Comprehensive test setup with ESM and TypeScript support
- `package.json`: Unified scripts for development workflow
- `.env.example`: Environment variable template
- `src/move/Move.toml`: Smart contract configuration

## Development Notes

### TypeScript Compatibility
- Some `@ts-ignore` comments are intentional for version compatibility
- Use `pnpm build:dev` to skip type checking during development
- Adapter pattern handles interface mismatches between dependency versions

### Blockchain Development
- Smart contracts in `src/move/sources/` use Move language
- Deploy with `waltodo deploy --network testnet` 
- Use testnet for development, mainnet for production

### Background Operations
- Long-running commands automatically move to background
- Monitor with `waltodo jobs` command
- Background system handles resource management and cleanup

### Storage Optimization
- Use `waltodo storage --analyze` to optimize WAL token usage
- Storage reuse system reduces costs through intelligent allocation
- Precise size calculation prevents over-provisioning