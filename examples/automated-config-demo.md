# Automated Configuration Management Demo

This example demonstrates the complete automated configuration management workflow.

## Prerequisites

1. Install dependencies:
   ```bash
   pnpm install
   cd waltodo-frontend && pnpm install
   ```

2. Build the CLI:
   ```bash
   pnpm run build
   ```

## Complete Workflow Demo

### Step 1: Deploy Smart Contract

Deploy the smart contract and automatically generate frontend configuration:

```bash
# Deploy to testnet and generate frontend config
./bin/waltodo deploy --network testnet
```

This will:
- Deploy smart contracts to Sui testnet
- Extract package ID and deployment information
- Generate `waltodo-frontend/src/config/testnet.ts` and `testnet.json`
- Update the configuration index file

Expected output:
```
✓ Smart contract deployed successfully!
Deployment Info:
  Package ID: 0x1234567890abcdef...
  Digest: ABC123DEF456...
  Network: testnet
  Address: 0x9876543210fedcba...

Generating frontend configuration...
✓ Frontend configuration generated successfully!
  Config location: ./waltodo-frontend/src/config
  You can now run the frontend with: pnpm run nextjs
```

### Step 2: Validate Configuration

Check that CLI and frontend configurations are consistent:

```bash
# Basic validation
./bin/waltodo validate-config

# Detailed validation with full report
./bin/waltodo validate-config --detailed

# Save validation report to file
./bin/waltodo validate-config --report-file config-validation-report.md
```

Expected output for successful validation:
```
🔍 Validating configuration...

✅ Configuration is valid!

💡 Suggestions:
  • Set NEXT_PUBLIC_NETWORK environment variable for frontend

📋 Detailed Information:
Available frontend configurations:
  • testnet
```

### Step 3: Start Frontend Development

The frontend will automatically use the generated configuration:

```bash
# Set the network environment variable
export NEXT_PUBLIC_NETWORK=testnet

# Start the frontend (this will automatically copy configs to public folder)
pnpm run nextjs
```

The frontend will now use the correct contract addresses and network settings.

### Step 4: Generate Configuration for Multiple Networks

Deploy and generate configurations for multiple networks:

```bash
# Deploy to devnet
./bin/waltodo deploy --network devnet

# Deploy to localnet (for local development)
./bin/waltodo deploy --network localnet

# Validate all configurations
./bin/waltodo validate-config --detailed
```

### Step 5: Update Existing Configuration

If you need to regenerate configuration without deploying:

```bash
# Use existing deployment data
./bin/waltodo generate-frontend-config --network testnet

# Override with specific settings
./bin/waltodo generate-frontend-config \
  --network testnet \
  --package-id 0x1234567890abcdef... \
  --deployer-address 0x9876543210fedcba... \
  --force

# Update feature flags
./bin/waltodo generate-frontend-config \
  --network testnet \
  --ai-enabled \
  --blockchain-verification \
  --force
```

## Frontend Integration Examples

### Example 1: Component Using Configuration

```typescript
// src/components/TodoManager.tsx
import { useAppConfig } from '@/lib/config-loader';
import { getSuiClient, getPackageId } from '@/lib/sui-client';

export function TodoManager() {
  const { config, loading, error } = useAppConfig();
  
  if (loading) return <div>Loading configuration...</div>;
  if (error) return <div>Configuration error: {error}</div>;
  
  const handleCreateTodo = async () => {
    const client = await getSuiClient();
    const packageId = getPackageId();
    
    // Use auto-configured client and package ID
    console.log('Using network:', config.network.name);
    console.log('Package ID:', packageId);
  };
  
  return (
    <div>
      <h2>Todo Manager</h2>
      <p>Network: {config.network.name}</p>
      <p>Contract: {config.deployment.packageId}</p>
      <button onClick={handleCreateTodo}>Create Todo</button>
    </div>
  );
}
```

### Example 2: Dynamic Network Switching

```typescript
// src/components/NetworkSelector.tsx
import { useState, useEffect } from 'react';
import { clearConfigCache, loadAppConfig } from '@/lib/config-loader';

export function NetworkSelector() {
  const [currentNetwork, setCurrentNetwork] = useState('testnet');
  const [config, setConfig] = useState(null);
  
  const switchNetwork = async (network: string) => {
    // Update environment variable (in a real app, this would be managed differently)
    process.env.NEXT_PUBLIC_NETWORK = network;
    
    // Clear cache and reload configuration
    clearConfigCache();
    const newConfig = await loadAppConfig();
    
    setCurrentNetwork(network);
    setConfig(newConfig);
  };
  
  return (
    <div>
      <h3>Network: {currentNetwork}</h3>
      <select onChange={(e) => switchNetwork(e.target.value)} value={currentNetwork}>
        <option value="testnet">Testnet</option>
        <option value="devnet">Devnet</option>
        <option value="localnet">Localnet</option>
      </select>
      
      {config && (
        <div>
          <p>RPC URL: {config.network.url}</p>
          <p>Explorer: {config.network.explorerUrl}</p>
          <p>Package ID: {config.deployment.packageId}</p>
        </div>
      )}
    </div>
  );
}
```

### Example 3: Configuration Context Provider

```typescript
// src/contexts/ConfigContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { loadAppConfig, type AppConfig } from '@/lib/config-loader';

interface ConfigContextType {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const newConfig = await loadAppConfig();
      setConfig(newConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration load failed');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadConfig();
  }, []);
  
  return (
    <ConfigContext.Provider value={{ config, loading, error, refresh: loadConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
```

## Troubleshooting Common Issues

### Issue 1: Configuration Not Found

**Problem**: "Configuration not found for network: testnet"

**Solution**:
```bash
# Check if deployment exists
./bin/waltodo list

# Generate configuration if deployment exists
./bin/waltodo generate-frontend-config --network testnet

# Or deploy if no deployment exists
./bin/waltodo deploy --network testnet
```

### Issue 2: Package ID Mismatch

**Problem**: Frontend using wrong contract addresses

**Solution**:
```bash
# Validate configuration
./bin/waltodo validate-config --detailed

# Regenerate configuration with latest deployment
./bin/waltodo generate-frontend-config --force

# Check configuration files
ls -la waltodo-frontend/src/config/
cat waltodo-frontend/src/config/testnet.json
```

### Issue 3: Environment Variable Issues

**Problem**: Frontend not using correct network

**Solution**:
```bash
# Set environment variable for development
export NEXT_PUBLIC_NETWORK=testnet

# Or create .env.local file in frontend
cd waltodo-frontend
echo "NEXT_PUBLIC_NETWORK=testnet" > .env.local

# Restart development server
pnpm dev
```

## Configuration File Structure

After running the demo, you should see these files:

```
waltodo-frontend/
├── src/config/
│   ├── index.ts              # Configuration exports and utilities
│   ├── testnet.ts           # TypeScript config for testnet
│   ├── testnet.json         # JSON config for testnet
│   ├── devnet.ts            # TypeScript config for devnet (if deployed)
│   └── devnet.json          # JSON config for devnet (if deployed)
└── public/config/           # Runtime-accessible configs (auto-generated)
    ├── testnet.json
    └── devnet.json
```

## Validation Report Example

After running `./bin/waltodo validate-config --detailed`, you might see:

```
🔍 Validating configuration...

✅ Configuration is valid!

💡 Suggestions:
  • Set NEXT_PUBLIC_NETWORK environment variable for frontend

📋 Detailed Information:
Available frontend configurations:
  • testnet
  • devnet
  • localnet
```

This automated system eliminates manual configuration copying and ensures your CLI and frontend always stay in sync!