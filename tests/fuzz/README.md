# Fuzzing Tests for Walrus Todo

This directory contains fuzzing tests to validate the robustness of the application under various randomized conditions.

## Network Retry Fuzzer (`network-retry-fuzzer.test.ts`)

Tests the retry logic with random network failures and conditions to ensure the system gracefully handles:

- Random network errors (timeouts, connection refused, etc.)
- Various HTTP status codes (408, 429, 500-504)
- Walrus-specific errors (insufficient storage, blob not found, etc.)
- Concurrent operations with different failure patterns
- Adaptive retry behavior based on network health
- Circuit breaker functionality
- Load balancing strategies

### Running the Network Retry Fuzzer

```bash
# Run the network retry fuzzer specifically
pnpm run test:fuzz:network-retry

# Or run it with Jest directly
npx jest tests/fuzz/network-retry-fuzzer.test.ts --verbose
```

### Test Scenarios

1. **Random Retry Configurations**: Tests various retry manager configurations with different settings for delays, timeouts, and strategies.

2. **Concurrent Operations**: Executes multiple operations simultaneously with varying network conditions (fast, slow, flaky, broken).

3. **Adaptive Network Health**: Simulates degrading network conditions across multiple nodes to test health-based routing.

4. **Extreme Edge Cases**: Tests handling of extreme conditions like all nodes failing, very slow responses, insufficient healthy nodes, and non-retryable errors.

5. **Rapid Health Fluctuations**: Simulates rapid changes in node health to test the system's ability to adapt quickly.

### Configuration Options Tested

- `initialDelay`: 100-2000ms
- `maxDelay`: 5000-60000ms
- `maxRetries`: 1-10 attempts
- `maxDuration`: 10000-300000ms
- `timeout`: 1000-30000ms
- `adaptiveDelay`: true/false
- `loadBalancing`: health/round-robin/priority
- `minNodes`: 1-n (based on available nodes)
- `healthThreshold`: 0.1-0.9
- `circuitBreaker`: Various failure thresholds and reset timeouts

### Interpreting Results

The fuzzer generates detailed output showing:
- Successful vs failed operations
- Node health scores over time
- Circuit breaker states
- Error categorization
- Retry patterns and delays

Failed tests indicate the retry manager couldn't handle certain edge cases gracefully. Each failure includes detailed context about the configuration and conditions that caused it.

## Transaction Fuzzer (`transaction-fuzzer.test.ts`)

Tests blockchain transaction handling with:
- Rapid sequential operations
- Malformed input data
- Concurrent NFT operations
- Network latency simulation

### Running the Transaction Fuzzer

```bash
# Run with Jest
npx jest tests/fuzz/transaction-fuzzer.test.ts --verbose
```

## Adding New Fuzzers

To add a new fuzzer:

1. Create a new test file in this directory
2. Use the `FuzzGenerator` helper for randomized data
3. Focus on edge cases and error conditions
4. Include documentation in this README
5. Add a convenience script to package.json

Example structure:
```typescript
import { FuzzGenerator } from '../helpers/fuzz-generator';

describe('New Feature Fuzzing Tests', () => {
  const fuzzer = new FuzzGenerator();
  
  it('should handle random inputs', async () => {
    const randomData = fuzzer.array(() => ({
      // Generate random test data
    }), { minLength: 10, maxLength: 100 });
    
    // Test with random data
  });
});
```

## Best Practices

1. **Reproducibility**: Consider using seeded random generation for reproducible tests
2. **Coverage**: Aim to cover all error paths and edge cases
3. **Performance**: Balance thoroughness with test execution time
4. **Documentation**: Document what each fuzzer tests and why
5. **Assertion Quality**: Ensure assertions validate actual behavior, not just lack of crashes