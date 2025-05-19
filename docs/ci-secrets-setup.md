# CI Secrets Setup Guide

**Date**: January 17, 2025

This guide documents all required environment variables and secrets needed for the CI/CD pipeline to function properly.

## Required Secrets

### 1. Core Application Secrets

#### `XAI_API_KEY`
- **Description**: API key for Grok (X.ai) service
- **Required for**: AI-powered features (suggest, analyze, prioritize)
- **Format**: String
- **Example**: `xai-xxxxxxxxxxxxxxxxxxxxx`
- **How to obtain**: Sign up at https://x.ai

#### `SUI_PRIVATE_KEY`
- **Description**: Private key for Sui blockchain interactions
- **Required for**: Deploying smart contracts, minting NFTs, blockchain transactions
- **Format**: Base64 encoded private key
- **Example**: `AKC5...` (64 characters)
- **How to obtain**: Create a Sui wallet and export the private key

#### `ANTHROPIC_API_KEY`
- **Description**: API key for Claude (Anthropic) service
- **Required for**: AI operations verification and fallback
- **Format**: String
- **Example**: `sk-ant-xxxxx`
- **How to obtain**: Sign up at https://anthropic.com

### 2. Storage Configuration

#### `WALRUS_AGGREGATOR_URL`
- **Description**: URL for Walrus aggregator endpoint
- **Required for**: Decentralized storage operations
- **Format**: URL
- **Default**: `https://aggregator.walrus-testnet.walrus.space`
- **Notes**: Can be set to local aggregator for testing

#### `WALRUS_PUBLISHER_URL`
- **Description**: URL for Walrus publisher endpoint
- **Required for**: Publishing data to Walrus storage
- **Format**: URL
- **Default**: `https://publisher.walrus-testnet.walrus.space`
- **Notes**: Should match the aggregator network (testnet/mainnet)

#### `WALRUS_CONFIG_PATH`
- **Description**: Path to Walrus configuration file
- **Required for**: Custom Walrus configuration
- **Format**: File path
- **Default**: `~/.config/walrus/client_config.yaml`
- **Notes**: Only needed if using non-standard configuration

### 3. Test Configuration

#### `WALRUS_USE_MOCK`
- **Description**: Enable mock mode for Walrus storage
- **Required for**: Running tests without actual storage operations
- **Format**: Boolean string
- **Values**: `true` or `false`
- **Default**: `false`
- **Notes**: Automatically set to `true` in test environments

#### `TEST_TIMEOUT`
- **Description**: Global timeout for test execution
- **Required for**: Integration tests
- **Format**: Number (milliseconds)
- **Default**: `120000` (2 minutes)
- **Notes**: Increase for slower CI environments

#### `OPENAI_API_KEY`
- **Description**: API key for OpenAI service
- **Required for**: AI operations fallback and testing
- **Format**: String
- **Example**: `sk-proj-xxxxx`
- **How to obtain**: Sign up at https://openai.com

### 4. Network Configuration

#### `SUI_NETWORK`
- **Description**: Sui network to use
- **Required for**: Blockchain operations
- **Format**: String
- **Values**: `testnet`, `mainnet`, `localnet`
- **Default**: `testnet`
- **Notes**: Most CI should use testnet

#### `SUI_FULLNODE_URL`
- **Description**: Custom Sui full node URL
- **Required for**: Custom node connections
- **Format**: URL
- **Example**: `https://fullnode.testnet.sui.io:443`
- **Notes**: Only needed if not using default networks

### 5. Build Configuration

#### `NODE_ENV`
- **Description**: Node.js environment
- **Required for**: Build optimization
- **Format**: String
- **Values**: `production`, `development`, `test`
- **Default**: `test` for CI
- **Notes**: Affects build output and optimizations

#### `BUILD_TYPE`
- **Description**: Type of build to perform
- **Required for**: Conditional compilation
- **Format**: String
- **Values**: `dev`, `prod`
- **Default**: `prod` for CI
- **Notes**: `dev` skips type checking

## GitHub Actions Configuration

### Setting Up Secrets in GitHub

1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each required secret

### Example GitHub Actions Workflow

```yaml
name: CI/CD Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      # Core secrets
      XAI_API_KEY: ${{ secrets.XAI_API_KEY }}
      SUI_PRIVATE_KEY: ${{ secrets.SUI_PRIVATE_KEY }}
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      
      # Network configuration
      SUI_NETWORK: testnet
      
      # Test configuration
      WALRUS_USE_MOCK: true
      NODE_ENV: test
      
      # Storage configuration
      WALRUS_AGGREGATOR_URL: https://aggregator.walrus-testnet.walrus.space
      WALRUS_PUBLISHER_URL: https://publisher.walrus-testnet.walrus.space
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Run tests
        run: pnpm test
        
      - name: Build
        run: pnpm build
```

## CI-Specific Considerations

### Security Best Practices

1. **Never commit secrets to the repository**
   - Use `.gitignore` to exclude `.env` files
   - Review PRs for accidental secret exposure

2. **Rotate keys regularly**
   - Update API keys every 90 days
   - Update private keys if compromised

3. **Use environment-specific keys**
   - Separate keys for development, staging, and production
   - Never use production keys in CI

### Performance Optimization

1. **Cache dependencies**
   ```yaml
   - name: Cache pnpm modules
     uses: actions/cache@v3
     with:
       path: ~/.pnpm-store
       key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
   ```

2. **Use mock services when possible**
   - Set `WALRUS_USE_MOCK=true` for unit tests
   - Only use real services for integration tests

3. **Parallel test execution**
   - Configure Jest to run tests in parallel
   - Use separate jobs for different test suites

### Debugging CI Issues

1. **Enable debug logging**
   ```yaml
   env:
     DEBUG: walrus-cli:*
     LOG_LEVEL: debug
   ```

2. **Check secret availability**
   ```bash
   - name: Verify secrets
     run: |
       if [ -z "$XAI_API_KEY" ]; then
         echo "XAI_API_KEY is not set"
         exit 1
       fi
   ```

3. **Common issues**
   - Missing secrets: Check GitHub secrets configuration
   - Network timeouts: Increase `TEST_TIMEOUT`
   - Build failures: Check Node.js version compatibility

## Local Development

For local development, create a `.env` file with the same variables:

```bash
# .env
XAI_API_KEY=your-api-key
SUI_PRIVATE_KEY=your-private-key
ANTHROPIC_API_KEY=your-api-key
OPENAI_API_KEY=your-api-key
WALRUS_USE_MOCK=true
SUI_NETWORK=testnet
```

Make sure `.env` is in your `.gitignore` file to prevent accidental commits.

## Summary

Proper CI secret configuration is essential for:
- Running tests successfully
- Building the application
- Deploying to production
- Maintaining security

Always verify that all required secrets are configured before running CI pipelines, and regularly review and update secrets to maintain security.