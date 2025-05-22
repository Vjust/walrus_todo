# Automated Configuration Management System

## Overview

The automated configuration management system ensures both CLI and frontend always use consistent contract addresses and network settings by automatically generating frontend configuration files after deployment.

## System Architecture

### Components

1. **Frontend Config Generator** (`src/utils/frontend-config-generator.ts`)
   - Generates TypeScript and JSON configuration files
   - Supports multiple networks (mainnet, testnet, devnet, localnet)
   - Includes network URLs, Walrus endpoints, and contract addresses

2. **Enhanced Deploy Command** (`src/commands/deploy.ts`)
   - Automatically generates frontend config after successful deployment
   - Can be skipped with `--skip-frontend-config` flag

3. **Standalone Config Command** (`src/commands/generate-frontend-config.ts`)
   - Generate frontend config without deploying
   - Use existing deployment information from configuration

4. **Frontend Config Loader** (`waltodo-frontend/src/lib/config-loader.ts`)
   - Dynamically loads configuration based on environment
   - Provides fallback configurations for development
   - Caches configuration for performance

5. **Integration Scripts**
   - Setup script (`waltodo-frontend/setup-config.js`) copies configs to public folder
   - Automatic execution during build/dev processes

## Usage

### 1. Deploy and Generate Config

Deploy smart contracts and automatically generate frontend configuration:

```bash
# Deploy to testnet and generate frontend config
waltodo deploy --network testnet

# Deploy without generating frontend config
waltodo deploy --network testnet --skip-frontend-config
```

### 2. Generate Config from Existing Deployment

Generate frontend configuration without deploying:

```bash
# Use current deployment settings
waltodo generate-frontend-config

# Specify network and package ID
waltodo generate-frontend-config --network testnet --package-id 0x123456...

# Override configuration settings
waltodo generate-frontend-config --network devnet --ai-enabled --blockchain-verification
```

### 3. Frontend Integration

The frontend automatically loads configuration based on the `NEXT_PUBLIC_NETWORK` environment variable:

```typescript
// Load configuration in React components
import { useAppConfig } from '@/lib/config-loader';

function MyComponent() {
  const { config, loading, error } = useAppConfig();
  
  if (loading) return <div>Loading configuration...</div>;
  if (error) return <div>Configuration error: {error}</div>;
  
  return (
    <div>
      <p>Network: {config.network.name}</p>
      <p>Package ID: {config.deployment.packageId}</p>
    </div>
  );
}
```

```typescript
// Load configuration programmatically
import { loadAppConfig } from '@/lib/config-loader';

async function initializeApp() {
  const config = await loadAppConfig();
  console.log('Using network:', config.network.name);
  console.log('Package ID:', config.deployment.packageId);
}
```

## Generated Configuration Structure

### TypeScript Configuration (`network.ts`)

```typescript
export const TESTNET_CONFIG = {
  network: {
    name: 'testnet',
    url: 'https://fullnode.testnet.sui.io:443',
    faucetUrl: 'https://faucet.testnet.sui.io',
    explorerUrl: 'https://testnet.suiexplorer.com',
  },
  
  walrus: {
    networkUrl: 'https://wal.testnet.sui.io',
    publisherUrl: 'https://publisher-testnet.walrus.site',
    aggregatorUrl: 'https://aggregator-testnet.walrus.site',
    apiPrefix: 'https://api-testnet.walrus.tech/1.0',
  },
  
  deployment: {
    packageId: '0x...',
    digest: 'ABC123...',
    timestamp: '2024-12-19T10:30:00.000Z',
    deployerAddress: '0x...',
  },
  
  contracts: {
    todoNft: {
      packageId: '0x...',
      moduleName: 'todo_nft',
      structName: 'TodoNFT',
    },
  },
  
  features: {
    aiEnabled: true,
    blockchainVerification: true,
    encryptedStorage: false,
  },
} as const;
```

### JSON Configuration (`network.json`)

```json
{
  "network": {
    "name": "testnet",
    "url": "https://fullnode.testnet.sui.io:443",
    "faucetUrl": "https://faucet.testnet.sui.io",
    "explorerUrl": "https://testnet.suiexplorer.com"
  },
  "walrus": {
    "networkUrl": "https://wal.testnet.sui.io",
    "publisherUrl": "https://publisher-testnet.walrus.site",
    "aggregatorUrl": "https://aggregator-testnet.walrus.site",
    "apiPrefix": "https://api-testnet.walrus.tech/1.0"
  },
  "deployment": {
    "packageId": "0x...",
    "digest": "ABC123...",
    "timestamp": "2024-12-19T10:30:00.000Z",
    "deployerAddress": "0x..."
  },
  "contracts": {
    "todoNft": {
      "packageId": "0x...",
      "moduleName": "todo_nft",
      "structName": "TodoNFT"
    }
  },
  "features": {
    "aiEnabled": true,
    "blockchainVerification": true,
    "encryptedStorage": false
  }
}
```

## Environment Configuration

### CLI Environment Variables

```bash
# Network configuration
export NETWORK=testnet
export WALLET_ADDRESS=0x...

# Package deployment
export TODO_PACKAGE_ID=0x...
export REGISTRY_ID=0x...

# Configuration directory
export WALRUS_TODO_CONFIG_DIR=/path/to/config
```

### Frontend Environment Variables

```bash
# Network selection
export NEXT_PUBLIC_NETWORK=testnet

# Feature flags (optional)
export NEXT_PUBLIC_AI_ENABLED=true
export NEXT_PUBLIC_BLOCKCHAIN_VERIFICATION=true
```

## File Locations

### CLI Generated Files

```
waltodo-frontend/src/config/
├── index.ts              # Configuration index with exports
├── testnet.ts           # TypeScript config for testnet
├── testnet.json         # JSON config for testnet
├── devnet.ts            # TypeScript config for devnet
├── devnet.json          # JSON config for devnet
└── ...                  # Other network configurations
```

### Frontend Public Files (Runtime Access)

```
waltodo-frontend/public/config/
├── testnet.json         # Runtime-accessible testnet config
├── devnet.json          # Runtime-accessible devnet config
└── ...                  # Other network configurations
```

## Configuration Flow

1. **Deploy Phase**
   ```bash
   waltodo deploy --network testnet
   ```
   - Deploys smart contracts to Sui blockchain
   - Extracts package ID and deployment information
   - Generates `waltodo-frontend/src/config/testnet.ts` and `testnet.json`
   - Updates configuration index file

2. **Frontend Build Phase**
   ```bash
   cd waltodo-frontend && pnpm run build
   ```
   - Runs `setup-config.js` to copy JSON configs to `public/config/`
   - Makes configurations accessible at runtime via HTTP requests

3. **Frontend Runtime**
   ```typescript
   const config = await loadAppConfig(); // Loads based on NEXT_PUBLIC_NETWORK
   ```
   - Loads configuration based on `NEXT_PUBLIC_NETWORK`
   - Falls back to default configuration if auto-generated config not found

## Network-Specific Configurations

### Mainnet
- Full security enabled
- Production Walrus endpoints
- Real transaction fees

### Testnet
- Development-friendly settings
- Testnet faucet integration
- Free transaction testing

### Devnet
- Latest features
- Development endpoints
- Unstable but cutting-edge

### Localnet
- Local development
- Mock services
- No external dependencies

## Troubleshooting

### Configuration Not Found

**Problem**: Frontend shows "Configuration not found for network"

**Solutions**:
1. Run `waltodo deploy --network <network>` to generate config
2. Use `waltodo generate-frontend-config --network <network>` for existing deployments
3. Check `NEXT_PUBLIC_NETWORK` environment variable

### Package ID Mismatch

**Problem**: Frontend uses wrong contract addresses

**Solutions**:
1. Regenerate configuration: `waltodo generate-frontend-config --force`
2. Verify deployment: `waltodo list` to check current settings
3. Redeploy if necessary: `waltodo deploy --network <network>`

### Frontend Build Failures

**Problem**: Build fails due to missing configurations

**Solutions**:
1. Ensure configurations exist: `ls waltodo-frontend/src/config/`
2. Run setup manually: `cd waltodo-frontend && node setup-config.js`
3. Check TypeScript compilation: `pnpm run lint`

## Best Practices

### Development Workflow

1. **Deploy First**: Always deploy contracts before frontend development
2. **Environment Consistency**: Use same network across CLI and frontend
3. **Configuration Validation**: Check generated configs before committing

### Production Deployment

1. **Mainnet Deployment**: Use `--network mainnet` for production
2. **Configuration Backup**: Store generated configs in version control
3. **Environment Variables**: Set `NEXT_PUBLIC_NETWORK=mainnet` in production

### Multi-Network Support

1. **Generate All Networks**: Create configs for all target networks
2. **Environment-Based Loading**: Use environment variables to switch networks
3. **Fallback Strategy**: Implement graceful degradation for missing configs

## Integration Examples

### CLI Integration

```bash
# Deploy and generate config in one command
waltodo deploy --network testnet

# Generate config for multiple networks
for network in devnet testnet mainnet; do
  waltodo generate-frontend-config --network $network --force
done
```

### Frontend Integration

```typescript
// Context provider for configuration
import { createContext, useContext, useEffect, useState } from 'react';
import { loadAppConfig, type AppConfig } from '@/lib/config-loader';

const ConfigContext = createContext<AppConfig | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  useEffect(() => {
    loadAppConfig().then(setConfig);
  }, []);
  
  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
```

This automated configuration management system eliminates manual configuration copying and ensures both CLI and frontend always use consistent settings, making development and deployment more reliable and efficient.