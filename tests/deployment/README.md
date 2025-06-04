# Walrus Sites Deployment Test Suite

A comprehensive testing framework for validating Walrus Sites deployment fixes and ensuring reliable deployment processes.

## Overview

This test suite provides extensive coverage for the Walrus Sites deployment pipeline, validating everything from network connectivity to error recovery mechanisms. It's designed to catch deployment issues early and ensure robust deployment processes.

## Test Categories

### 🔌 Network Connectivity Tests
**File**: `walrus-sites-deployment.test.ts`

Tests network-related failure scenarios and recovery mechanisms:
- DNS resolution failures during site-builder execution
- Connection timeouts with exponential backoff
- Partial network connectivity scenarios
- Rate limiting with proper backoff strategies
- Network endpoint validation

### ⚙️ Configuration Validation Tests
**File**: `configuration-validation.test.ts`

Validates configuration files and environment setup:
- YAML syntax and structure validation
- Required field verification
- Network-specific configuration testing
- Environment variable validation
- Security configuration verification

### 🔧 Site-Builder Execution Tests
**File**: `site-builder-execution.test.ts`

Tests site-builder command execution and parameter handling:
- Installation and version compatibility checks
- Parameter validation and command construction
- Output parsing for success and error scenarios
- Different deployment scenarios (fresh, update, dry-run)
- Progress monitoring and concurrent operations

### 🛠️ Recovery Mechanism Tests
**File**: `deployment-recovery.test.ts`

Tests error recovery and state management:
- Error classification and strategy selection
- Automatic retry logic with intelligent backoff
- State preservation and partial deployment recovery
- Cleanup and rollback operations
- Comprehensive error reporting and diagnostics

### 🔄 Integration Tests
**File**: `walrus-deployment-integration.test.ts`

End-to-end testing of the complete deployment pipeline:
- Complete deployment workflow validation
- Network resilience testing
- Build process integration
- Configuration management
- Post-deployment verification

## Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm package manager
- Jest testing framework

### Installation

```bash
# Install dependencies
pnpm install

# Install test-specific dependencies
cd tests/deployment
pnpm install
```

### Running Tests

#### Run All Tests
```bash
# Run complete test suite
./tests/deployment/run-deployment-tests.sh

# Run with verbose output
./tests/deployment/run-deployment-tests.sh --verbose
```

#### Run Specific Test Categories
```bash
# Unit tests only
./tests/deployment/run-deployment-tests.sh --unit-only

# Integration tests only
./tests/deployment/run-deployment-tests.sh --integration-only

# Recovery mechanism tests only
./tests/deployment/run-deployment-tests.sh --recovery-only
```

#### Run Specific Tests
```bash
# Run tests matching a pattern
./tests/deployment/run-deployment-tests.sh --test "network"

# Run configuration validation tests
./tests/deployment/run-deployment-tests.sh --test "configuration"
```

#### Development Mode
```bash
# Run in watch mode
./tests/deployment/run-deployment-tests.sh --watch

# Skip coverage for faster feedback
./tests/deployment/run-deployment-tests.sh --no-coverage
```

### Using Jest Directly

```bash
# Run with Jest directly using deployment config
npx jest --config=tests/deployment/jest.config.js

# Run specific test file
npx jest --config=tests/deployment/jest.config.js walrus-sites-deployment.test.ts

# Run with coverage
npx jest --config=tests/deployment/jest.config.js --coverage
```

## Test Structure

### Mock Framework
The test suite uses a comprehensive mocking framework:

- **`deployment-mocks.ts`**: Network simulation and deployment environment mocks
- **`deployment-validator.ts`**: Validation helpers for configuration and build output
- **`deployment-recovery.ts`**: Recovery mechanism testing utilities

### Test Configuration
- **`jest.config.js`**: Jest configuration optimized for deployment testing
- **`setup.ts`**: Test environment setup and custom matchers
- **`global-setup.ts`**: One-time setup before all tests
- **`global-teardown.ts`**: Cleanup after all tests

## Test Scenarios

### Network Failure Scenarios
- DNS resolution failures
- Connection timeouts
- Partial service availability
- Rate limiting responses
- Network congestion

### Configuration Scenarios
- Valid YAML configurations
- Missing required fields
- Invalid network specifications
- Environment variable issues
- Security header validation

### Build Output Scenarios
- Complete Next.js builds
- Missing essential files
- Large build sizes
- Asset optimization needs
- HTML structure validation

### Deployment Scenarios
- Fresh site deployment
- Site updates
- Dry-run deployments
- Custom domain configuration
- Redirect setup

### Error Recovery Scenarios
- Network timeout recovery
- Partial deployment resumption
- Wallet connectivity fallback
- Configuration error handling
- Cleanup and rollback operations

## Coverage Reports

The test suite generates comprehensive coverage reports:

### HTML Report
Open `tests/deployment/coverage/lcov-report/index.html` for detailed coverage information.

### Coverage Thresholds
- **Statements**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Lines**: 80%

### Coverage Badge
A coverage badge is automatically generated at `tests/deployment/reports/coverage-badge.svg`.

## Test Reports

### Test Summary
Detailed test results are available in:
- `tests/deployment/reports/deployment-test-report.html` - HTML report
- `tests/deployment/reports/test-summary.md` - Markdown summary
- `tests/deployment/reports/deployment-junit.xml` - JUnit XML for CI

### Performance Metrics
Memory usage and performance metrics are included in test reports.

## Environment Variables

### Test Configuration
- `NODE_ENV=test` - Sets test environment
- `WALRUS_TEST_MODE=true` - Enables test-specific behavior
- `JEST_TIMEOUT=30000` - Sets default test timeout

### Mock Configuration
- `SITE_BUILDER_PATH` - Path to site-builder executable
- `WALRUS_CONFIG_PATH` - Path to Walrus configuration
- `WALRUS_WALLET_PATH` - Path to wallet file

## Debugging Tests

### Verbose Output
```bash
./tests/deployment/run-deployment-tests.sh --verbose
```

### Debug Specific Tests
```bash
# Debug configuration tests
./tests/deployment/run-deployment-tests.sh --test "configuration" --verbose

# Debug with Jest debugging
node --inspect-brk ./node_modules/.bin/jest --config=tests/deployment/jest.config.js --runInBand
```

### Mock Debugging
Set environment variable for mock debugging:
```bash
MOCK_DEBUG=true ./tests/deployment/run-deployment-tests.sh
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Deployment Tests
  run: |
    ./tests/deployment/run-deployment-tests.sh --no-watch
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./tests/deployment/coverage/lcov.info
```

### Jenkins
```groovy
stage('Deployment Tests') {
    steps {
        sh './tests/deployment/run-deployment-tests.sh'
        publishHTML([
            allowMissing: false,
            alwaysLinkToLastBuild: true,
            keepAll: true,
            reportDir: 'tests/deployment/reports',
            reportFiles: 'deployment-test-report.html',
            reportName: 'Deployment Test Report'
        ])
    }
}
```

## Custom Matchers

The test suite includes custom Jest matchers:

```typescript
// URL validation
expect('https://example.walrus.site').toBeValidWalrusUrl();

// Deployment result validation
expect(deploymentResult).toContainDeploymentInfo();

// Generic URL validation
expect('https://example.com').toBeValidUrl();
```

## Extending Tests

### Adding New Test Scenarios
1. Create test file in appropriate category
2. Import required mocks and helpers
3. Follow existing test patterns
4. Update coverage thresholds if needed

### Adding New Mocks
1. Add mock implementation to `deployment-mocks.ts`
2. Export appropriate interfaces
3. Update mock factory functions
4. Document mock behavior

### Adding New Validators
1. Add validation logic to `deployment-validator.ts`
2. Include comprehensive error messages
3. Add corresponding tests
4. Update type definitions

## Troubleshooting

### Common Issues

#### Tests Timing Out
- Increase timeout in Jest configuration
- Check for hanging promises in mocks
- Verify cleanup in afterEach hooks

#### Mock Issues
- Ensure mocks are cleared between tests
- Check mock implementation matches real APIs
- Verify mock data is realistic

#### Coverage Issues
- Check file paths in Jest configuration
- Ensure all relevant files are included
- Verify coverage thresholds are reasonable

### Getting Help

1. Check test output for specific error messages
2. Run with `--verbose` flag for detailed output
3. Review mock implementations for accuracy
4. Verify test environment setup

## Contributing

### Test Guidelines
1. Write descriptive test names
2. Use arrange-act-assert pattern
3. Mock external dependencies appropriately
4. Include both positive and negative test cases
5. Maintain good test coverage

### Code Style
- Follow existing TypeScript patterns
- Use meaningful variable names
- Add comprehensive comments
- Follow Jest best practices

### Pull Request Process
1. Run full test suite before submitting
2. Include coverage reports
3. Update documentation if needed
4. Add tests for new functionality

---

**Generated by Walrus Sites Deployment Test Suite**