# Sui Testnet Setup - Quick Usage Guide

## Installation

```bash
# Navigate to setup directory
cd tests/testnet/setup

# Install dependencies
pnpm install

# Build the module (optional)
pnpm build
```

## Quick Start

### 1. Command Line Usage

```bash
# Run quick setup (creates wallet and funds it)
pnpm run setup

# Or use ts-node directly
ts-node sui-setup.ts
```

### 2. In Your Tests

```typescript
// Import the setup utilities
import { quickSetup } from './tests/testnet/setup';

// In your test file
describe('My Sui Tests', () => {
  let wallet;

  beforeAll(async () => {
    const setup = await quickSetup();
    wallet = setup.wallet;
  });

  test('wallet should be funded', () => {
    expect(BigInt(wallet.balance)).toBeGreaterThan(0n);
  });
});
```

### 3. Custom Configuration

```typescript
import { setupTestnet } from './tests/testnet/setup';

const setup = await setupTestnet({
  network: 'testnet',
  walletType: 'ed25519',
  enableFaucet: true,
  faucetAmount: '3000000000', // 3 SUI
  backupWallet: true,
});

console.log('Wallet address:', setup.wallet.address);
```

### 4. Environment Variables

After setup, use the generated `.env.testnet` file:

```bash
# Load environment variables
source .env.testnet

# Now you can use:
echo $WALLET_ADDRESS
echo $SUI_RPC_URL
```

### 5. Multiple Wallets

```typescript
// Create multiple test wallets
const wallets = await Promise.all([
  setupTestnet({ keystorePath: './wallet1.keystore' }),
  setupTestnet({ keystorePath: './wallet2.keystore' }),
]);

console.log('Wallet 1:', wallets[0].wallet.address);
console.log('Wallet 2:', wallets[1].wallet.address);
```

## Common Issues

### Faucet Rate Limiting

If you get rate limited by the faucet:
- Wait 5-10 minutes before retrying
- Use existing funded wallet from backup
- Request smaller amounts

### Network Connection

If network connection fails:
- Check your internet connection
- Verify RPC endpoint is accessible
- Try alternative RPC endpoints

### Permission Errors

If you get permission errors:
- Ensure write access to keystore directory
- Check disk space
- Run with appropriate permissions

## Examples

Check the `examples/` directory for more usage patterns:

- `basic-setup.ts` - Simple wallet creation
- `custom-setup.ts` - Advanced configuration
- `test-integration.ts` - Test framework integration

Run examples:

```bash
ts-node examples/basic-setup.ts
ts-node examples/custom-setup.ts
ts-node examples/test-integration.ts
```