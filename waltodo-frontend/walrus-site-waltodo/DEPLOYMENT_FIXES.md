# Walrus Sites Deployment Fixes

This document outlines the fixes implemented to resolve "Connection reset by peer" errors and other network issues during Walrus Sites deployment.

## Problem Summary

The original deployment was failing with:
- "Connection reset by peer (os error 54)" during Sui blockchain interaction
- Network connectivity issues with testnet endpoints
- Lack of retry logic and error handling
- No alternative endpoint fallbacks
- Poor error messages and recovery suggestions

## Solutions Implemented

### 1. Enhanced Deployment Script (`deploy-walrus-site-enhanced.sh`)

**Key Features:**
- **Exponential backoff retry logic** with configurable attempts (default: 5)
- **Multiple RPC endpoint fallbacks** for both testnet and mainnet
- **Network validation** before deployment starts
- **Enhanced error detection** and recovery strategies
- **Verbose logging** and troubleshooting guidance
- **Dry-run mode** for testing configuration

**Usage:**
```bash
# Basic deployment
./scripts/deploy-walrus-site-enhanced.sh

# Deployment with verbose output and custom retries
./scripts/deploy-walrus-site-enhanced.sh --verbose --max-retries 8

# Test configuration without deploying
./scripts/deploy-walrus-site-enhanced.sh --dry-run --verbose

# Deploy to mainnet with force rebuild
./scripts/deploy-walrus-site-enhanced.sh --network mainnet --force
```

### 2. Network Connectivity Test Script (`test-network-connectivity.sh`)

**Features:**
- Tests all RPC endpoints for both networks
- Validates Walrus aggregator connectivity
- Provides system diagnostic information
- Identifies specific network issues

**Usage:**
```bash
./scripts/test-network-connectivity.sh
```

### 3. Improved Walrus Configuration

**Client Config Updates (`~/.config/walrus/client_config.yaml`):**
- Increased timeout values (120s total, 60s pool idle)
- Enhanced retry settings (8 retries, exponential backoff)
- Multiple RPC endpoint fallbacks
- Better HTTP/2 keep-alive settings

**Sites Config Updates (`~/.config/walrus/sites-config.yaml`):**
- Updated to use primary Sui RPC endpoints
- Proper network context configuration

### 4. RPC Endpoint Fallback Strategy

**Testnet Endpoints (in priority order):**
1. `https://fullnode.testnet.sui.io:443` (Primary)
2. `https://sui-testnet.nodeinfra.com` (Fallback)
3. `https://sui-testnet.chainstack.com` (Fallback)
4. `https://sui-testnet.publicnode.com` (Fallback)

**Mainnet Endpoints (in priority order):**
1. `https://fullnode.mainnet.sui.io:443` (Primary)
2. `https://sui-mainnet.nodeinfra.com` (Fallback)
3. `https://sui-mainnet.chainstack.com` (Fallback)
4. `https://sui-mainnet.publicnode.com` (Fallback)

### 5. Error Detection and Recovery

**Network Error Patterns:**
- "connection reset by peer"
- "network error"
- "timeout"
- "connection refused"
- "connection error"

**Recovery Actions:**
1. **Automatic RPC endpoint switching** when network errors occur
2. **Exponential backoff** between retry attempts
3. **Specific error handling** for common failure scenarios:
   - Insufficient wallet balance
   - Configuration errors
   - Network connectivity issues

### 6. Enhanced Logging and Diagnostics

**Verbose Mode Features:**
- Detailed command execution logging
- RPC endpoint testing results
- Network connectivity validation
- Configuration file validation

**Troubleshooting Guidance:**
- Wallet balance checking instructions
- Network connectivity verification steps
- Configuration file validation
- Alternative deployment methods

## Best Practices for Deployment

### 1. Pre-deployment Validation
```bash
# Test network connectivity first
./scripts/test-network-connectivity.sh

# Validate configuration
./scripts/deploy-walrus-site-enhanced.sh --dry-run --verbose
```

### 2. Recommended Settings
```bash
# For unstable networks
./scripts/deploy-walrus-site-enhanced.sh --max-retries 10 --verbose

# For production deployments
./scripts/deploy-walrus-site-enhanced.sh --network mainnet --gas-budget 1000000000
```

### 3. Monitoring Deployment
- Use `--verbose` flag for detailed logging
- Monitor network connectivity during deployment
- Check wallet balance before starting

## Troubleshooting Common Issues

### Connection Reset by Peer
**Symptoms:** TCP connections forcibly closed by remote server
**Solutions:**
1. Run network connectivity test
2. Try deployment with higher retry count
3. Check firewall/proxy settings
4. Use alternative RPC endpoints

### Network Timeout Errors
**Symptoms:** Requests timing out after 30+ seconds
**Solutions:**
1. Increase timeout values in configuration
2. Check internet connection stability
3. Try deployment from different network
4. Use mainnet endpoints (often more stable)

### Insufficient Gas Budget
**Symptoms:** "gas budget too low" errors
**Solutions:**
1. Increase gas budget: `--gas-budget 1000000000`
2. Check wallet SUI balance
3. Use testnet for testing (lower costs)

### Configuration Errors
**Symptoms:** "config not found" or "invalid config"
**Solutions:**
1. Run setup script: `./scripts/setup-walrus-site.sh`
2. Verify config files exist in `~/.config/walrus/`
3. Check YAML syntax in config files

## Migration Guide

### From Original Script
1. **Backup existing configuration:**
   ```bash
   cp ~/.config/walrus/client_config.yaml ~/.config/walrus/client_config.yaml.backup
   ```

2. **Use enhanced script:**
   ```bash
   ./scripts/deploy-walrus-site-enhanced.sh --verbose
   ```

3. **Test deployment:**
   ```bash
   ./scripts/deploy-walrus-site-enhanced.sh --dry-run
   ```

### Environment Variables
The enhanced script supports these environment variables:
- `WALRUS_CONFIG_PATH`: Override config file location
- `WALRUS_WALLET_PATH`: Override wallet file location
- `SITE_BUILDER_PATH`: Override site-builder executable location
- `SUI_RPC_URL`: Override RPC endpoint URL
- `WALRUS_VERBOSE`: Enable verbose Walrus output

## Performance Optimizations

### Network Settings
- **Connection pooling** with 60s idle timeout
- **HTTP/2 keep-alive** with optimized intervals
- **Concurrent connection limits** to prevent overwhelming servers
- **Smart retry scheduling** with exponential backoff

### Deployment Optimizations
- **Build validation** before network operations
- **Prerequisite checking** to catch issues early
- **Parallel dependency installation** where possible
- **Efficient error recovery** without full restart

## Security Considerations

### Network Security
- **TLS-only connections** to all endpoints
- **Certificate validation** enabled
- **Proxy detection** and handling
- **Timeout limits** to prevent hanging connections

### Configuration Security
- **File permission validation** (600 for sensitive files)
- **Path sanitization** for all user inputs
- **Environment variable validation**
- **No sensitive data in logs** (except verbose mode)

## Monitoring and Metrics

### Success Metrics
- Deployment completion time
- Network endpoint success rates
- Retry attempt statistics
- Error recovery success rates

### Failure Metrics
- Connection failure patterns
- Timeout occurrence rates
- Configuration error frequencies
- Wallet-related failure rates

## Future Improvements

### Planned Enhancements
1. **Automatic endpoint health monitoring**
2. **Smart endpoint selection based on latency**
3. **Deployment progress indicators**
4. **Automatic wallet balance verification**
5. **Integration with CI/CD pipelines**

### Performance Monitoring
1. **Real-time network quality assessment**
2. **Historical deployment success tracking**
3. **Predictive failure detection**
4. **Automated recovery recommendations**

## Support and Resources

### Documentation
- [Walrus Sites Official Documentation](https://docs.wal.app/walrus-sites/)
- [Sui Network Documentation](https://docs.sui.io/)
- [Site Builder CLI Reference](https://docs.wal.app/walrus-sites/commands.html)

### Community Resources
- [Sui Developer Forum](https://forums.sui.io/)
- [Walrus Discord](https://discord.gg/walrus)
- [GitHub Issues](https://github.com/MystenLabs/walrus-sites/issues)

### Emergency Procedures
If deployment continues to fail after trying all solutions:
1. Check [Sui Network Status](https://status.sui.io/)
2. Verify [Walrus Network Health](https://walrus.site/)
3. Report issues to the community forums
4. Use alternative deployment methods (manual upload)