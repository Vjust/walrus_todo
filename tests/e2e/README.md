# End-to-End Tests

This directory contains end-to-end tests for the Walrus Todo CLI commands, focusing on real user interactions and input/output behavior.

## Structure

```
e2e/
├── commands/           # E2E tests for individual commands
│   └── interactive.e2e.test.ts   # Tests for interactive mode with stdin mocking
├── jest.config.js     # Jest configuration for e2e tests
├── setup.ts          # Test environment setup
└── README.md         # This file
```

## Running E2E Tests

Run all e2e tests:
```bash
npm run test:e2e
```

Run a specific e2e test:
```bash
npm run test:e2e -- interactive.e2e.test.ts
```

## Writing E2E Tests

E2E tests focus on the complete user experience, including:
- Command-line input and output
- Interactive mode behavior
- Error handling and recovery
- Multi-command workflows

### Example: Testing Interactive Mode

The `interactive.e2e.test.ts` file demonstrates how to:
1. Mock stdin/stdout for testing interactive commands
2. Simulate user input sequences
3. Verify command execution and output
4. Test error scenarios

```typescript
// Simulate user typing commands
setTimeout(async () => {
  await lineHandlers.line('help');
  await lineHandlers.line('sl mylist');
  await lineHandlers.line('a Buy milk');
  await lineHandlers.line('exit');
}, 100);
```

### Key Testing Patterns

1. **Stdin Mocking**: Use readline mocks to simulate user input
2. **Output Capture**: Capture console.log/error for verification
3. **Child Process Mocking**: Mock spawn for command execution
4. **Async Handling**: Use timeouts and promises for async operations
5. **State Verification**: Check internal state and external effects

### Test Utilities

- `sinon` for mocking and stubbing
- `readline` mocks for interactive input
- `child_process` mocks for command execution
- Custom setup for test environment

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Mock External Dependencies**: Mock file system, network, etc.
3. **Test Happy Path and Errors**: Cover both success and failure scenarios
4. **Verify User Experience**: Focus on what users see and experience
5. **Clean Up**: Restore all mocks after tests

## Troubleshooting

If tests are failing:
1. Check that all dependencies are installed
2. Ensure mocks are properly restored
3. Verify async operations complete
4. Check for timing issues with setTimeout