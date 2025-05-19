# Sui Testnet Setup

This directory contains utilities for automating Sui testnet wallet setup and configuration for testing the WalTodo CLI.

## Features

- **Automated Wallet Creation**: Generate new Ed25519 or Secp256k1 wallets
- **Testnet Faucet Integration**: Automatically fund new wallets with SUI tokens
- **Configuration Management**: Generate Sui client config and environment files
- **Wallet Backup/Restore**: Secure backup and restoration of wallet keys
- **Network Health Checks**: Verify connectivity to Sui RPC endpoints
- **CLI Installation**: Check and install Sui CLI if needed

## Quick Start

```bash
# Run quick setup with defaults
ts-node tests/testnet/setup/sui-setup.ts

# Use in test scripts
import { quickSetup } from './sui-setup';

const result = await quickSetup();
console.log('Wallet address:', result.wallet.address);
```

## Usage Examples

### Basic Setup

```typescript
import { setupTestnet } from './sui-setup';

// Setup with default configuration
const result = await setupTestnet();
```

### Custom Configuration

```typescript
import { setupTestnet } from './sui-setup';

const result = await setupTestnet({
  network: 'testnet',
  walletType: 'ed25519',
  enableFaucet: true,
  faucetAmount: '5000000000', // 5 SUI
  backupWallet: true,
});
```

### Restore from Backup

```typescript
import { restoreFromBackup } from './sui-setup';

const wallet = await restoreFromBackup('/path/to/backup');
console.log('Restored wallet:', wallet.address);
```

### Check Sui CLI Installation

```typescript
import { SuiTestnetSetup } from './sui-setup';

if (!SuiTestnetSetup.checkSuiCliInstallation()) {
  await SuiTestnetSetup.installSuiCli();
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `network` | `'testnet' \| 'devnet' \| 'mainnet'` | `'testnet'` | Sui network to connect to |
| `walletType` | `'ed25519' \| 'secp256k1'` | `'ed25519'` | Cryptographic key type |
| `keystorePath` | `string` | `~/.sui/sui_config/sui.keystore` | Path to store wallet keys |
| `configPath` | `string` | `~/.sui/client.yaml` | Path to Sui client config |
| `enableFaucet` | `boolean` | `true` | Request funds from testnet faucet |
| `faucetAmount` | `string` | `'1000000000'` | Amount to request (in MIST) |
| `backupWallet` | `boolean` | `true` | Create wallet backup |
| `backupPath` | `string` | `~/.sui/backups/wallet_[timestamp]` | Backup location |

## Generated Files

After successful setup, the following files are created:

1. **Keystore File**: Contains encrypted wallet private keys
   - Location: `~/.sui/sui_config/sui.keystore`

2. **Client Config**: Sui client configuration
   - Location: `~/.sui/client.yaml`

3. **Environment File**: Easy-to-use environment variables
   - Location: `.env.testnet` (in current directory)

4. **Wallet Backup**: Optional backup of wallet data
   - Location: `~/.sui/backups/wallet_[timestamp]/`

## Environment Variables

The setup generates a `.env.testnet` file with:

```env
NETWORK=testnet
WALLET_ADDRESS=0x...
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_KEY_SCHEME=ED25519
```

## Error Handling

The setup includes comprehensive error handling for common issues:

- Network connectivity problems
- Faucet request failures
- Invalid configurations
- File system permissions
- Wallet restoration errors

## Testing

Use this setup in your test suites:

```typescript
import { setupTestnet } from './tests/testnet/setup/sui-setup';

describe('WalTodo Sui Integration', () => {
  let testWallet;

  beforeAll(async () => {
    const setup = await setupTestnet({
      enableFaucet: true,
      faucetAmount: '2000000000', // 2 SUI for testing
    });
    testWallet = setup.wallet;
  });

  test('should have funded wallet', () => {
    expect(BigInt(testWallet.balance)).toBeGreaterThan(0n);
  });
});
```

## Security Considerations

1. **Private Keys**: Never commit private keys or keystores to version control
2. **Backups**: Store wallet backups securely and encrypt if necessary
3. **Testnet Only**: This tool is designed for testnet use only
4. **Environment Files**: Add `.env.testnet` to `.gitignore`

## Troubleshooting

### Faucet Request Fails
- Check if you've hit rate limits (wait a few minutes)
- Verify network connectivity to testnet
- Ensure address format is correct

### Wallet Creation Fails
- Check file system permissions
- Ensure sufficient disk space
- Verify Rust/Node.js installation

### Network Connection Issues
- Check firewall settings
- Verify RPC endpoint is accessible
- Try alternative RPC endpoints

## Advanced Usage

### Custom RPC Endpoints

```typescript
const result = await setupTestnet({
  network: 'testnet',
  // Custom RPC endpoint will be used based on network
});
```

### Multiple Wallets

```typescript
// Create multiple test wallets
const wallets = await Promise.all([
  setupTestnet({ keystorePath: './wallet1.keystore' }),
  setupTestnet({ keystorePath: './wallet2.keystore' }),
  setupTestnet({ keystorePath: './wallet3.keystore' }),
]);
```

### Integration with CI/CD

```yaml
# GitHub Actions example
- name: Setup Sui Testnet
  run: |
    npm install
    npx ts-node tests/testnet/setup/sui-setup.ts
  env:
    NETWORK: testnet
```