# Integration Tests

This directory contains integration tests that verify the interaction between the CLI, API server, and frontend components of the WalTodo application.

## Test Structure

### Core Integration Tests
- **`cli-frontend-integration.test.ts`** - Main integration test suite covering:
  - API server health checks and endpoints
  - Todo CRUD operations via API
  - WebSocket real-time updates
  - Authentication flows
  - Sync operations (Walrus/blockchain)
  - AI-powered features
  - CLI-API interaction
  - Performance under load

### E2E Test Suites
Located in `tests/e2e/`:

- **`todo-lifecycle.e2e.test.ts`** - Complete todo lifecycle testing:
  - Create via CLI, verify via API
  - Update via API, verify via CLI
  - Batch operations
  - Error scenarios
  
- **`websocket-realtime.e2e.test.ts`** - WebSocket functionality:
  - Real-time event broadcasting
  - Multiple client connections
  - Connection resilience
  - Performance under load

- **`api-cli-sync.e2e.test.ts`** - Data synchronization:
  - CLI-API consistency
  - Concurrent operations
  - Pagination and filtering
  - Error recovery

## Running Integration Tests

### Basic Commands

```bash
# Run all integration tests
pnpm test:integration

# Run with coverage
pnpm test:integration:coverage

# Run in watch mode
pnpm test:integration:watch

# Run specific test file
pnpm test tests/integration/cli-frontend-integration.test.ts
```

### CI/CD Commands

```bash
# Run integration tests in CI mode
pnpm test:integration:ci

# Run with GitHub Actions
# See .github/workflows/integration-tests.yml
```

## Test Environment Setup

### Prerequisites
1. Node.js 18.x or higher
2. pnpm 8.x or higher
3. Built CLI and API projects

### Environment Variables
Create a `.env.test` file:

```bash
NODE_ENV=test
API_KEY=test-api-key
JWT_SECRET=test-jwt-secret
ENABLE_WEBSOCKET=true
ENABLE_AUTH=false
PORT=3001
LOG_LEVEL=error
```

### Directory Structure
The tests will create these directories:
- `Todos/` - Local todo storage
- `logs/` - Test logs
- `.waltodo-cache/` - Cache directories
- `test-artifacts/` - Test output files

## Writing New Integration Tests

### Test Template

```typescript
describe('Feature Integration Tests', () => {
  let apiServer: ApiServer;
  let apiClient: AxiosInstance;
  
  beforeAll(async () => {
    // Start API server
    apiServer = new ApiServer();
    await apiServer.start(3001);
    
    // Setup API client
    apiClient = axios.create({
      baseURL: 'http://localhost:3001/api/v1',
      headers: { 'X-API-Key': 'test-key' }
    });
  });
  
  afterAll(async () => {
    await apiServer.stop();
  });
  
  test('should integrate feature X', async () => {
    // Test implementation
  });
});
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up created resources
3. **Timeouts**: Use appropriate timeouts for async operations
4. **Error Handling**: Test both success and failure cases
5. **Assertions**: Be specific about expected outcomes

## Debugging Integration Tests

### Enable Verbose Logging

```bash
# Run with debug output
LOG_LEVEL=debug pnpm test:integration

# Run specific test with full output
pnpm test tests/integration/cli-frontend-integration.test.ts --verbose
```

### Common Issues

1. **Port conflicts**: Ensure ports 3001-3005 are available
2. **Build issues**: Run `pnpm build:dev` before tests
3. **Permission errors**: Check file permissions in test directories
4. **Timeout errors**: Increase test timeout in jest config

## GitHub Actions Integration

The `.github/workflows/integration-tests.yml` workflow runs:

1. **Integration tests** on multiple Node versions
2. **API contract tests** to validate API schema
3. **Performance tests** for load testing
4. **Security tests** for vulnerability scanning

### Workflow Triggers
- Push to `main` or `develop` branches
- Pull requests to `main`
- Manual workflow dispatch

## Performance Considerations

### Test Optimization
- Tests run with `maxWorkers=1` to prevent conflicts
- Memory limit set to 3072MB for stability
- Sequential execution for server-dependent tests

### Benchmarks
Expected test execution times:
- Full suite: 2-3 minutes
- Individual test file: 30-60 seconds
- WebSocket tests: 10-20 seconds per suite

## Maintenance

### Regular Tasks
1. Update test dependencies monthly
2. Review and update test timeouts
3. Clean up test artifacts
4. Monitor test execution times

### Adding New Features
When adding new features:
1. Add integration tests for API endpoints
2. Test CLI commands that use the feature
3. Verify WebSocket events if applicable
4. Test error scenarios and edge cases