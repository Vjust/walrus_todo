# NFT Testing Suite

Comprehensive automated testing for blockchain NFT functionality in the Walrus Todo application.

## Overview

This testing suite validates the complete NFT workflow from CLI commands through frontend UI to blockchain integration. It includes:

- **End-to-End Tests**: Full user workflow testing
- **Smart Contract Validation**: Move contract compilation and deployment
- **Wallet Integration**: Connection and transaction signing
- **Error Handling**: Failure scenarios and edge cases
- **Performance Testing**: Load and stress testing
- **Security Validation**: Access control and input sanitization

## Test Structure

```
tests/e2e/
├── blockchain-nft-workflow.e2e.test.ts    # Playwright E2E tests
├── puppeteer-nft-tests.e2e.test.ts        # Puppeteer browser automation
├── smart-contract-validation.e2e.test.ts  # Move contract validation
├── helpers/
│   └── nft-test-utils.ts                   # Reusable test utilities
└── NFT_TESTING_README.md                   # This file
```

## Quick Start

### Run All NFT Tests
```bash
npm run test:nft
```

### Run Specific Test Suites
```bash
# Playwright E2E tests
npm run test:nft:playwright

# Puppeteer browser tests
npm run test:nft:puppeteer

# Smart contract validation
npm run test:nft:contract

# Unit tests only
npm run test:nft:unit
```

### Advanced Test Execution
```bash
# Run comprehensive test suite with reporting
ts-node scripts/run-nft-tests.ts

# Run specific test categories
ts-node scripts/run-nft-tests.ts --suite core
ts-node scripts/run-nft-tests.ts --suite ui
ts-node scripts/run-nft-tests.ts --suite blockchain
```

## Test Scenarios

### 1. NFT Creation Workflow

**CLI Tests:**
- ✅ Create todo via CLI
- ✅ Convert todo to NFT
- ✅ Batch NFT creation
- ✅ Error handling for invalid todos

**Frontend Tests:**
- ✅ Wallet connection flow
- ✅ Todo creation form
- ✅ NFT conversion button
- ✅ Transaction status display

### 2. Wallet Integration

**Connection Tests:**
- ✅ Wallet connect/disconnect
- ✅ Address display
- ✅ Connection error handling
- ✅ Multiple wallet support

**Transaction Tests:**
- ✅ Transaction signing
- ✅ Gas estimation
- ✅ Transaction history
- ✅ Failed transaction recovery

### 3. Smart Contract Integration

**Contract Validation:**
- ✅ Move.toml configuration
- ✅ Contract compilation
- ✅ Function signatures
- ✅ Error code validation

**Contract Interaction:**
- ✅ NFT creation calls
- ✅ Completion updates
- ✅ Metadata updates
- ✅ Transfer operations

### 4. Error Scenarios

**Network Errors:**
- ✅ RPC connection failures
- ✅ Timeout handling
- ✅ Network disconnection
- ✅ Gas insufficient scenarios

**User Errors:**
- ✅ Invalid input validation
- ✅ Wallet rejection
- ✅ Duplicate operations
- ✅ Permission violations

### 5. Performance Testing

**Load Tests:**
- ✅ Batch NFT creation
- ✅ Concurrent transactions
- ✅ Large data handling
- ✅ Memory usage validation

**Responsiveness:**
- ✅ UI interaction speed
- ✅ Transaction processing time
- ✅ Page load performance
- ✅ Error recovery speed

## Test Environment Setup

### Prerequisites

1. **Node.js 16+**
2. **Sui CLI** (for contract compilation)
3. **Frontend Development Server** (for E2E tests)
4. **Test Wallet** (for blockchain tests)

### Environment Variables

```bash
# Test configuration
NODE_ENV=test
WALRUS_USE_MOCK=true

# Blockchain configuration (optional)
PACKAGE_ID=your_package_id
TEST_WALLET_PRIVATE_KEY=your_test_key
SUI_NETWORK=testnet

# Browser configuration
HEADLESS=false  # Set to true for CI
DEVTOOLS=false  # Set to true for debugging
```

### Mock Services

The test suite uses comprehensive mocking:

- **Mock Wallet**: Simulates Sui wallet interactions
- **Mock Transactions**: Simulates blockchain transactions
- **Mock Storage**: Simulates Walrus storage
- **Mock Network**: Simulates network conditions

## Test Utilities

### MockWalletManager

Provides realistic wallet simulation:

```typescript
const mockWallet = new MockWalletManager({
  address: '0x1234...', 
  failureRate: 0.1,  // 10% transaction failure
  gasBalance: 1000000
});
```

### CLITestRunner

Executes CLI commands in test environment:

```typescript
const cli = new CLITestRunner();
const result = await cli.runCommand('add', ['"Test Todo"']);
expect(result.exitCode).toBe(0);
```

### PageTestHelpers

Simplifies browser automation:

```typescript
const helper = new PageTestHelpers(page);
await helper.connectWallet();
await helper.createTodo('Test NFT Todo');
const success = await helper.convertToNFT();
```

### ContractTestHelpers

Validates smart contract operations:

```typescript
const contract = new ContractTestHelpers(cli);
const isValid = await contract.validateContractDeployment();
const gasCost = await contract.estimateGasCost('create');
```

## Test Reports

The test suite generates comprehensive reports:

### Console Output
- ✅ Real-time test progress
- ⚠️ Warning messages
- ❌ Error details with context
- 📊 Performance metrics

### File Reports
- **JSON Report**: `test-artifacts/nft-test-results.json`
- **HTML Report**: `test-artifacts/nft-test-report.html`
- **Log Files**: `test-logs/nft-tests-{timestamp}.log`
- **Screenshots**: `screenshots/` (on failures)

### Example Report

```
============================================================
             NFT TEST EXECUTION REPORT
============================================================

📊 Total Tests: 45
✅ Passed: 42
❌ Failed: 3
🚨 Critical Failures: 0
⏱️  Total Duration: 127.3s

📋 Test Results:
----------------------------------------
✅ NFT Unit Tests (12.5s)
✅ CLI NFT Integration (23.1s)
✅ Smart Contract Tests (45.2s)
✅ Playwright NFT E2E (67.8s)
❌ Puppeteer NFT E2E (15.4s)
   Error: Browser launch timeout
✅ NFT Error Scenarios (8.9s)
❌ NFT Performance Tests (22.1s)
   Error: Transaction timeout
✅ NFT Security Tests (18.3s)
❌ NFT Fuzz Tests (31.7s)
   Error: Random input validation

============================================================
```

## Debugging

### Enable Debug Mode

```bash
# Run with browser visible
HEADLESS=false npm run test:nft:playwright

# Enable browser console logging
LOG_BROWSER_CONSOLE=true npm run test:nft:puppeteer

# Enable verbose CLI output
DEBUG=* npm run test:nft:unit
```

### Screenshot Capture

Automatically captures screenshots on test failures:

```typescript
// Manual screenshot
await helper.takeScreenshotWithTimestamp('debug-state');

// Automatic on failure
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === 'failed') {
    await page.screenshot({ path: `failure-${testInfo.title}.png` });
  }
});
```

### Common Issues

**Frontend Server Not Starting:**
```bash
# Check if port 3000 is available
lsof -i :3000

# Start server manually
cd waltodo-frontend && pnpm run dev
```

**Wallet Connection Failures:**
```bash
# Verify wallet mock injection
# Check browser console for wallet object
console.log(window.suiWallet);
```

**Contract Compilation Errors:**
```bash
# Verify Sui CLI installation
sui --version

# Check Move.toml configuration
cat src/move/Move.toml
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: NFT Tests
on: [push, pull_request]

jobs:
  nft-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Install Playwright
        run: npx playwright install
      
      - name: Run NFT tests
        run: npm run test:nft
        env:
          HEADLESS: true
          NODE_ENV: test
          WALRUS_USE_MOCK: true
      
      - name: Upload test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: nft-test-reports
          path: |
            test-artifacts/
            test-logs/
            screenshots/
```

## Contributing

### Adding New Tests

1. **Unit Tests**: Add to existing test files or create new ones in `tests/unit/`
2. **E2E Tests**: Add scenarios to existing E2E test files
3. **Contract Tests**: Add validations to `smart-contract-validation.e2e.test.ts`
4. **Utilities**: Extend helpers in `tests/e2e/helpers/nft-test-utils.ts`

### Test Guidelines

- ✅ Use descriptive test names
- ✅ Include error scenarios
- ✅ Mock external dependencies
- ✅ Add performance assertions
- ✅ Document complex test logic
- ✅ Use proper cleanup in afterEach

### Example Test Addition

```typescript
test('should handle NFT metadata updates', async () => {
  // Setup
  const helper = new PageTestHelpers(page);
  await helper.connectWallet();
  await helper.createTodo('Metadata Test Todo');
  
  // Action
  const nftCreated = await helper.convertToNFT();
  expect(nftCreated).toBe(true);
  
  // Update metadata
  const updateSuccess = await helper.updateNFTMetadata({
    tags: ['important', 'updated'],
    priority: 'high'
  });
  
  // Verification
  expect(updateSuccess).toBe(true);
  
  // Cleanup handled by afterEach
});
```

## Support

For issues with the NFT testing suite:

1. Check the [troubleshooting section](#debugging)
2. Review test logs in `test-logs/`
3. Examine test artifacts in `test-artifacts/`
4. Create an issue with test failure details

---

**Happy Testing!** 🧪✨
