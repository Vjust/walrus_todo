# AI Operations Stress Testing Framework

This directory contains the stress testing framework for AI operations in the walrus_todo project. The framework allows testing AI services under load, measuring performance, and ensuring stability in high-concurrency scenarios.

## Features

- **Concurrent Request Testing**: Simulate many simultaneous users making AI requests
- **Rate Limit Testing**: Test behavior when hitting API rate limits
- **Timeout and Retry Testing**: Ensure correct retry behavior for failed requests
- **API Fallback Testing**: Test switching between different AI providers
- **Caching System Testing**: Verify performance benefits of the caching system
- **Performance Benchmarking**: Compare performance of different AI operations
- **Resource Usage Monitoring**: Track CPU and memory usage during tests
- **Circuit Breaker**: Protect services during cascading failures
- **Comprehensive Reports**: Generate HTML, text, and CSV reports of test results

## Directory Structure

- `AIStressTestFramework.ts` - Core stress testing engine
- `ai-operations.stress.test.ts` - Jest test suite for stress testing
- `StressTestReportGenerator.ts` - Report generation utilities
- `run-stress-tests.ts` - CLI tool for running stress tests outside Jest

## Usage

### Running Jest Stress Tests

```bash
# Run all stress tests (simulated mode by default)
pnpm jest tests/stress/ai-operations.stress.test.ts

# Run with real API calls (BE CAREFUL - this will use your API credits)
STRESS_TEST_MODE=real XAI_API_KEY=your_api_key pnpm jest tests/stress/ai-operations.stress.test.ts
```

### Using the CLI Tool

The framework includes a CLI tool for running stress tests with custom parameters:

```bash
# Install ts-node if not already installed
npm install -g ts-node

# Run a basic simulated stress test
ts-node tests/stress/run-stress-tests.ts

# Run with custom parameters
ts-node tests/stress/run-stress-tests.ts \
  --mode simulated \
  --concurrent 10 \
  --requests 100 \
  --operations summarize,categorize \
  --timeout 5000 \
  --retries 3 \
  --error-rate 0.2 \
  --latency 100-3000 \
  --report-dir ./stress-reports

# Run a real API test (BE CAREFUL - this will use your API credits)
ts-node tests/stress/run-stress-tests.ts \
  --mode real \
  --api-key your_api_key \
  --provider xai \
  --concurrent 3 \
  --requests 20 \
  --operations summarize \
  --report-dir ./stress-reports
```

See all available options:

```bash
ts-node tests/stress/run-stress-tests.ts --help
```

## Test Modes

The framework supports three testing modes:

1. **Simulated** (default): Uses mock AI providers to simulate responses, errors, and latency without making real API calls
2. **Real**: Makes actual API calls to specified provider (careful with API usage)
3. **Hybrid**: Makes real API calls but implements protective circuit breakers

## Safety Mechanisms

To prevent excessive API usage and protect against runaway tests:

- **Circuit Breaker**: Automatically stops testing if error rates exceed configured thresholds
- **Maximum Duration**: Tests will abort after hitting configured max duration
- **Concurrency Limits**: Controls maximum parallel requests
- **Request Count Limits**: Limits total number of requests per test
- **CI Safeguards**: Automatically runs in simulated mode when in CI environments

## Running in CI

When running in CI environments, the tests automatically:

1. Use simulated mode regardless of settings (to prevent accidental API charges)
2. Skip report generation (unless explicitly enabled with `SAVE_STRESS_TEST_REPORTS=1`)
3. Run with reduced concurrency and request counts

## Advanced Customization

For advanced testing scenarios, you can extend the `AIStressTestFramework` class with custom behavior:

```typescript
// Example: Custom framework with specialized error handling
class CustomStressTestFramework extends AIStressTestFramework {
  constructor(service, options) {
    super(service, options);
    
    // Add custom error handler
    this.on('error', this.customErrorHandler.bind(this));
  }
  
  customErrorHandler({ operation, error }) {
    // Custom error handling logic
  }
}
```

## Report Customization

The `StressTestReportGenerator` can be customized by extending the class:

```typescript
class CustomReportGenerator extends StressTestReportGenerator {
  static generateCustomReport(metrics) {
    // Custom report format
  }
}
```

## Best Practices

1. **Always start with simulated mode** for initial testing
2. **Use minimal request counts** when testing with real APIs
3. **Include guards** on concurrency values for real API tests
4. **Be careful with rate limits** of your AI provider
5. **Keep test durations short** to avoid excessive resource usage
6. **Regularly check report outputs** to identify performance regressions