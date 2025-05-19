# Account Commands Integration Tests

I've added comprehensive integration tests for the account commands (`switch` and `show`) to the existing `tests/integration/commands.test.ts` file.

## Added Test Coverage

### Account Show Command
1. **Successfully shows current active Sui address** - Tests the happy path where a wallet address is configured
2. **Handles missing wallet configuration** - Tests the error case when no wallet address is set
3. **Handles config file not found** - Tests error recovery when the config file doesn't exist

### Account Switch Command  
1. **Successfully switches to a different Sui address** - Tests the happy path with a valid address
2. **Rejects invalid address format** - Tests validation of address format
3. **Handles missing address argument** - Tests error case when no address is provided
4. **Handles Sui CLI errors during address switch** - Tests error when address not found in keystore
5. **Handles network timeout during address switch** - Tests network error scenarios

## Test Implementation Details

- All tests use proper mocking of `execSync` and `fs` modules
- Tests follow the existing pattern in the integration test file
- Each test scenario includes appropriate error messages and edge cases
- Tests verify both successful operations and error handling

The tests are now part of the main integration test suite and can be run with:
```bash
npm test -- tests/integration/commands.test.ts --testNamePattern="account commands"
```