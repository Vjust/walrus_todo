# @waltodo/config-loader

Runtime network configuration loader for WalTodo applications. This package replaces build-time imports with dynamic loading of network configurations from JSON files.

## Features

- 🚀 **Runtime Loading**: Load network configs dynamically at runtime
- 🗂️ **Multiple Networks**: Support for testnet, devnet, localnet, and mainnet
- 💾 **Smart Caching**: Configurable caching with automatic invalidation
- 🔄 **Fallback Support**: Graceful fallback to default configurations
- 🌐 **Universal**: Works in both browser and Node.js environments
- 📝 **TypeScript**: Full TypeScript support with comprehensive types

## Installation

```bash
npm install @waltodo/config-loader
# or
pnpm add @waltodo/config-loader
# or
yarn add @waltodo/config-loader
```

## Basic Usage

### Loading Network Configuration

```typescript
import { loadNetworkConfig } from '@waltodo/config-loader';

// Load testnet configuration
const result = await loadNetworkConfig('testnet');
console.log(result.config.network.url); // https://fullnode.testnet.sui.io
console.log(result.fromCache); // false (first load)
console.log(result.isFallback); // false (if config file found)

// Load with options
const result2 = await loadNetworkConfig('localnet', {
  configPath: '/custom-config',
  enableCache: false,
  fallbackToLocalnet: true
});
```

### Using Current Environment

```typescript
import { loadCurrentNetworkConfig } from '@waltodo/config-loader';

// Automatically uses NETWORK or NEXT_PUBLIC_NETWORK env var
const result = await loadCurrentNetworkConfig();
```

### Working with Configuration

```typescript
import { 
  loadNetworkConfig, 
  isConfigurationComplete,
  getExplorerUrl,
  getWalrusBlobUrl 
} from '@waltodo/config-loader';

const { config } = await loadNetworkConfig('testnet');

// Check if deployment info is available
if (isConfigurationComplete(config)) {
  console.log('Ready for blockchain operations');
} else {
  console.log('Run deployment first');
}

// Get explorer URLs
const objectUrl = getExplorerUrl(config, '0x123...', 'object');
const txnUrl = getExplorerUrl(config, '0x456...', 'txn');

// Get Walrus URLs
const blobUrl = getWalrusBlobUrl(config, 'blob-id-123');
```

## Configuration File Format

Place configuration files in `public/config/` directory:

```json
// public/config/testnet.json
{
  "network": "testnet",
  "rpcUrl": "https://fullnode.testnet.sui.io",
  "walrus": {
    "publisherUrl": "https://publisher.walrus-testnet.walrus.space",
    "aggregatorUrl": "https://aggregator.walrus-testnet.walrus.space"
  },
  "deployment": {
    "packageId": "0xd6f97fc85796ee23adf60504a620631a0eea6947f85c4ca51e02245e9a4b57d7",
    "deployerAddress": "0xca793690985183dc8e2180fd059d76f3b0644f5c2ecd3b01cdebe7d40b0cca39",
    "timestamp": "2025-05-27T02:53:00Z"
  },
  "features": {
    "aiIntegration": false,
    "batchOperations": true,
    "storageOptimization": true,
    "realTimeUpdates": true
  },
  "environment": {
    "mode": "production",
    "debug": false
  }
}
```

## API Reference

### Core Functions

#### `loadNetworkConfig(network, options?)`

Loads configuration for a specific network.

- **network**: `string` - Network name (testnet, devnet, localnet, mainnet)
- **options**: `ConfigLoaderOptions` - Configuration options
- **Returns**: `Promise<ConfigLoadResult>`

#### `loadCurrentNetworkConfig(options?)`

Loads configuration for the current environment network.

- **options**: `ConfigLoaderOptions` - Configuration options
- **Returns**: `Promise<ConfigLoadResult>`

#### `clearConfigCache()`

Clears the configuration cache.

### Utility Functions

#### `isConfigurationComplete(config)`

Checks if configuration has deployment information.

#### `getExplorerUrl(config, objectId, type?)`

Gets blockchain explorer URL for objects or transactions.

#### `getFaucetUrl(config)`

Gets faucet URL for the network (if available).

#### `getWalrusBlobUrl(config, blobId)`

Gets Walrus blob URL for reading data.

#### `getWalrusPublisherUrl(config)`

Gets Walrus publisher URL for uploading data.

### Fallback Functions

#### `getFallbackConfig(network)`

Gets default fallback configuration for a network.

#### `isSupportedNetwork(network)`

Checks if a network is supported.

#### `getSupportedNetworks()`

Gets list of all supported networks.

## Configuration Options

```typescript
interface ConfigLoaderOptions {
  /** Base path for config files (default: '/config') */
  configPath?: string;
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Cache timeout in milliseconds (default: 5 minutes) */
  cacheTimeout?: number;
  /** Fallback to localnet if config not found (default: true) */
  fallbackToLocalnet?: boolean;
}
```

## Error Handling

```typescript
import { 
  loadNetworkConfig, 
  ConfigLoadError, 
  ConfigValidationError 
} from '@waltodo/config-loader';

try {
  const result = await loadNetworkConfig('testnet');
} catch (error) {
  if (error instanceof ConfigLoadError) {
    console.error('Failed to load config:', error.message);
  } else if (error instanceof ConfigValidationError) {
    console.error('Invalid config:', error.message, 'Field:', error.field);
  }
}
```

## Environment Variables

The package respects these environment variables:

- `NETWORK` - Network name
- `NEXT_PUBLIC_NETWORK` - Next.js public network name
- `SUI_NETWORK` - Sui-specific network name

Priority: `NETWORK` > `NEXT_PUBLIC_NETWORK` > `SUI_NETWORK` > `'localnet'`

## Browser vs Node.js

The package automatically detects the environment:

- **Browser**: Uses `fetch()` to load config files from `/config/` path
- **Node.js**: Uses `fs/promises` to load files from `public/config/` directory

## Caching

Configurations are cached in memory with configurable timeout:

- Default cache timeout: 5 minutes
- Cache key includes network name and config path
- Cache can be disabled via options
- Use `clearConfigCache()` to manually clear cache

## Integration Examples

### Next.js App

```typescript
// lib/config.ts
import { loadCurrentNetworkConfig } from '@waltodo/config-loader';

export async function getAppConfig() {
  const result = await loadCurrentNetworkConfig({
    configPath: '/config', // Files in public/config/
    enableCache: true
  });
  
  return result.config;
}

// components/WalletProvider.tsx
import { useEffect, useState } from 'react';
import { getAppConfig } from '../lib/config';

export function WalletProvider({ children }) {
  const [config, setConfig] = useState(null);
  
  useEffect(() => {
    getAppConfig().then(setConfig);
  }, []);
  
  if (!config) return <div>Loading...</div>;
  
  return (
    <WalletContext.Provider value={{ config }}>
      {children}
    </WalletContext.Provider>
  );
}
```

### CLI Application

```typescript
// cli/config.ts
import { loadNetworkConfig } from '@waltodo/config-loader';

export async function getNetworkConfig(network: string) {
  const result = await loadNetworkConfig(network, {
    configPath: './config', // Files in ./config/
    fallbackToLocalnet: true
  });
  
  if (result.isFallback) {
    console.warn(`Using fallback config for ${network}`);
  }
  
  return result.config;
}
```

## License

MIT