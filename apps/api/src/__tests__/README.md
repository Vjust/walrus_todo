# API Service Tests

This directory contains comprehensive tests for the WalTodo API services, focusing on WebSocket functionality, logging, and todo business logic.

## Test Structure

### Core Test Files

- **`basic.test.ts`** - Basic Jest setup validation and test factory verification
- **`setup.ts`** - Global Jest configuration and mocks

### Service Tests

#### WebSocket Service (`websocket.simple.test.ts`)
Tests the core WebSocket functionality including:
- Wallet address validation (Sui format compliance)
- Room management for wallet-based channels
- Socket tracking and cleanup logic
- Event broadcasting for todo operations
- Statistics generation for monitoring
- CORS and socket configuration validation

Key features tested:
- ✅ Validates 64-character hex Sui wallet addresses
- ✅ Manages socket rooms by wallet address
- ✅ Tracks multiple sockets per wallet
- ✅ Handles socket disconnection cleanup
- ✅ Formats todo events (created, updated, deleted, completed)
- ✅ Generates connection statistics

#### Todo Service (`todo.simple.test.ts`)
Tests the business logic for todo operations:
- Data format parsing (array and object formats)
- Filtering by wallet, category, and completion status
- Pagination logic
- Todo creation with proper defaults
- Todo updates preserving unchanged fields
- Statistics generation by priority and category
- Category and tag extraction

Key features tested:
- ✅ Parses multiple data formats (array, object with todos/items)
- ✅ Applies proper filtering and pagination
- ✅ Creates todos with correct structure and defaults
- ✅ Updates todos while preserving immutable fields
- ✅ Generates statistics for completion, priority, and category
- ✅ Extracts unique categories and tags

#### Logger Service (`logger.simple.test.ts`)
Tests the logging configuration and format handling:
- Log level validation and normalization
- Message formatting with metadata
- Environment-based transport configuration
- Error handling for invalid configurations

Key features tested:
- ✅ Validates and normalizes log levels
- ✅ Formats log messages with metadata
- ✅ Handles empty metadata gracefully
- ✅ Configures transports based on environment

## Test Configuration

### Jest Setup
- **Environment**: Node.js
- **Test Timeout**: 10 seconds
- **Workers**: Single worker for consistency
- **Coverage**: Configured for src/ directory
- **TypeScript**: Full ts-jest support

### Mocking Strategy
The tests use a simplified mocking approach to avoid module loading issues:
- File system operations are mocked at the global level
- Path operations use simple string joining
- Tests focus on business logic rather than I/O operations

### Type Safety
All tests maintain full TypeScript type safety with proper interfaces for:
- Todo entities with all required fields
- WebSocket events and configurations
- Logger metadata and formatting

## Running Tests

```bash
# Run all simplified tests
npm test -- --testPathPattern="simple|basic"

# Run specific test file
npm test -- basic.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Coverage Goals

The test suite aims to cover:
- ✅ Core business logic (100%)
- ✅ Data validation and formatting (100%)
- ✅ Error handling paths (90%+)
- ✅ Configuration validation (100%)
- ⚠️ File I/O operations (limited due to mocking complexity)

## Future Enhancements

1. **Integration Tests**: Add tests that use real HTTP servers and WebSocket connections
2. **Performance Tests**: Add load testing for WebSocket connections
3. **Error Scenario Tests**: Add more comprehensive error handling tests
4. **Database Integration**: Add tests for persistent storage backends
5. **Authentication Tests**: Add tests for JWT and API key validation

## Notes

- Tests are designed to be fast and reliable
- Mocking is kept minimal to focus on business logic
- Type safety is maintained throughout all test scenarios
- Tests avoid external dependencies where possible