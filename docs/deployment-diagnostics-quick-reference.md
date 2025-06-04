# Walrus Sites Deployment Diagnostics - Quick Reference

## Command Overview

### Diagnostic Commands
```bash
# Run comprehensive diagnostics
waltodo deploy:diagnostics

# Analyze specific error message
waltodo deploy:diagnostics --analyze-error "connection refused"

# Save diagnostic report to file
waltodo deploy:diagnostics --save-report ./diagnostics-report.md

# Attempt automatic fixes
waltodo deploy:diagnostics --fix --auto-recovery
```

### Enhanced Deployment Commands
```bash
# Deploy with full diagnostics and recovery
waltodo deploy:enhanced --auto-recover

# Diagnostics only (no deployment)
waltodo deploy:enhanced --diagnostics-only

# Force rebuild with comprehensive logging
waltodo deploy:enhanced --force-rebuild --save-logs --verbose

# Deploy to mainnet with retry logic
waltodo deploy:enhanced --network mainnet --max-retries 5 --auto-recover
```

## Common Error Scenarios

### 🌐 Network Issues
**Symptoms:** Connection refused, timeout, DNS errors
```bash
# Quick fix
waltodo deploy:diagnostics --analyze-error "connection refused"

# Test connectivity
ping walrus.site
curl -I https://walrus.site

# Deploy with retry
waltodo deploy:enhanced --auto-recover --max-retries 5
```

### 🔑 Authentication Issues
**Symptoms:** Wallet not found, insufficient funds, authentication failed
```bash
# Check wallet status
sui client active-address
sui client gas

# Auto-fix wallet issues
waltodo deploy:diagnostics --fix

# Get testnet SUI
sui client faucet
```

### 🔨 Build Issues
**Symptoms:** Build failed, missing files, empty build directory
```bash
# Clean rebuild
pnpm clean && pnpm build

# Auto-fix build issues
waltodo deploy:enhanced --force-rebuild --auto-recover

# Validate build output
ls -la out/
```

### ⚙️ Configuration Issues
**Symptoms:** Config not found, invalid YAML, missing fields
```bash
# Create default config
waltodo deploy:diagnostics --fix

# Validate configuration
yamllint sites-config.yaml

# Deploy with config creation
waltodo deploy:enhanced --auto-recover
```

## Quick Troubleshooting

### Step 1: Basic Health Check
```bash
# Check all prerequisites
waltodo deploy:diagnostics --verbose

# Look for critical issues (red 🚨)
# Address warnings (yellow ⚠️) if needed
```

### Step 2: Analyze Specific Errors
```bash
# Copy your error message and analyze
waltodo deploy:diagnostics --analyze-error "YOUR_ERROR_MESSAGE_HERE"

# Get specific troubleshooting guide
# Follow recovery steps provided
```

### Step 3: Attempt Recovery
```bash
# Try automatic fixes first
waltodo deploy:diagnostics --fix --auto-recovery

# If that fails, use enhanced deployment
waltodo deploy:enhanced --auto-recover --max-retries 3
```

### Step 4: Manual Investigation
```bash
# Save detailed report for analysis
waltodo deploy:diagnostics --save-report diagnosis.md --verbose

# Check logs for patterns
tail -f logs/deployments/deployment-*.json
```

## Emergency Recovery

### Complete Environment Reset
```bash
# 1. Clean everything
pnpm clean
rm -rf node_modules .next out

# 2. Reinstall dependencies
pnpm install

# 3. Rebuild application
pnpm run build

# 4. Reset Walrus configuration
rm -rf ~/.walrus
site-builder init

# 5. Deploy with full diagnostics
waltodo deploy:enhanced --auto-recover --save-logs
```

### Wallet Recovery
```bash
# 1. Check if wallet exists
sui client active-address

# 2. Create new wallet if needed
sui client new-address ed25519

# 3. Get testnet funds
sui client faucet

# 4. Verify balance
sui client gas

# 5. Deploy
waltodo deploy:enhanced --network testnet
```

### Network Troubleshooting
```bash
# 1. Test basic connectivity
ping google.com

# 2. Test Walrus endpoints
curl -I https://walrus.site
curl -I https://publisher.walrus.space

# 3. Check DNS
nslookup walrus.site

# 4. Try alternative network
waltodo deploy:enhanced --network mainnet
```

## Flag Reference

### Diagnostic Flags
| Flag | Description | Example |
|------|-------------|---------|
| `--network` | Target network (testnet/mainnet) | `--network mainnet` |
| `--analyze-error` | Analyze specific error message | `--analyze-error "timeout"` |
| `--save-report` | Save report to file | `--save-report report.md` |
| `--fix` | Attempt automatic fixes | `--fix` |
| `--auto-recovery` | Enable auto-recovery | `--auto-recovery` |
| `--verbose` | Detailed output | `--verbose` |

### Deployment Flags
| Flag | Description | Example |
|------|-------------|---------|
| `--force-rebuild` | Force clean rebuild | `--force-rebuild` |
| `--skip-build` | Skip build process | `--skip-build` |
| `--diagnostics-only` | Run diagnostics without deploy | `--diagnostics-only` |
| `--max-retries` | Maximum retry attempts | `--max-retries 5` |
| `--retry-delay` | Delay between retries (seconds) | `--retry-delay 10` |
| `--timeout` | Deployment timeout (minutes) | `--timeout 15` |
| `--save-logs` | Save deployment logs | `--save-logs` |

## Error Code Reference

### Critical Errors (🚨)
- `NET-conn` - Network connection issues
- `AUT-wall` - Wallet/authentication problems  
- `BLD-fail` - Build process failures
- `CFG-miss` - Missing configuration files

### Warnings (⚠️)
- `PER-size` - Large build size warnings
- `NET-slow` - Slow network performance
- `RES-memo` - High memory usage
- `BLD-time` - Slow build times

### Info (ℹ️)
- `ENV-vers` - Version information
- `PER-metr` - Performance metrics
- `CFG-defa` - Default configuration used
- `REC-sugg` - Recovery suggestions

## Common Patterns

### Pattern: "Connection Refused"
```bash
# 1. Quick diagnosis
waltodo deploy:diagnostics --analyze-error "connection refused"

# 2. Network check
ping walrus.site

# 3. Auto-recovery deploy
waltodo deploy:enhanced --auto-recover --max-retries 3
```

### Pattern: "Build Failed"
```bash
# 1. Clean rebuild
waltodo deploy:enhanced --force-rebuild

# 2. Check build output
ls -la out/

# 3. Validate and deploy
waltodo deploy:enhanced --auto-recover
```

### Pattern: "Authentication Failed"
```bash
# 1. Check wallet
sui client active-address
sui client gas

# 2. Fix wallet issues
waltodo deploy:diagnostics --fix

# 3. Deploy with recovery
waltodo deploy:enhanced --auto-recover
```

## Support Resources

### Documentation
- [Full Diagnostics Guide](./walrus-deployment-diagnostics.md)
- [Walrus Sites Docs](https://docs.walrus.site)
- [Sui Network Docs](https://docs.sui.io)

### Commands for Help
```bash
# Command help
waltodo deploy:diagnostics --help
waltodo deploy:enhanced --help

# System information
waltodo deploy:diagnostics --verbose

# Generate troubleshooting report
waltodo deploy:diagnostics --save-report support-info.md --verbose
```

### Emergency Contacts
- GitHub Issues: [Create Issue](https://github.com/your-repo/issues)
- Discord: [Join Server](https://discord.gg/walrus)
- Status Page: [Check Status](https://status.sui.io)

## Tips for Success

1. **Always run diagnostics first** before attempting deployment
2. **Enable auto-recovery** for resilient deployments  
3. **Save logs** for troubleshooting persistent issues
4. **Use testnet** for development and testing
5. **Monitor resource usage** to optimize performance
6. **Keep dependencies updated** to avoid compatibility issues
7. **Check network status** during outages or slow performance