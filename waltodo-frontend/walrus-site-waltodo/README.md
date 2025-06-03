# WalTodo Walrus Sites Integration

This directory contains the optimized Walrus Sites integration for deploying the WalTodo frontend to the decentralized web using Walrus Sites.

## Overview

Walrus Sites is a decentralized hosting platform that stores website files on Walrus (decentralized storage) and serves them through various portals. This integration provides a robust, reliable deployment solution with comprehensive error handling and validation.

## Quick Start

1. **Setup Environment**
   ```bash
   ./scripts/setup-walrus-site.sh
   ```

2. **Validate Configuration**
   ```bash
   ./scripts/verify-site-builder-config.js
   ```

3. **Deploy to Walrus Sites**
   ```bash
   ./scripts/deploy-walrus-site.sh
   ```

## File Structure

```
walrus-site-waltodo/
├── scripts/
│   ├── setup-walrus-site.sh              # Environment setup script
│   ├── deploy-walrus-site.sh             # Main deployment script
│   ├── walrus-site-wrapper.sh            # Wrapper functions for site-builder
│   ├── verify-config.js                  # Legacy config verification
│   └── verify-site-builder-config.js     # Comprehensive validation
├── sites-config.yaml                     # Optimized site-builder config
├── out/                                   # Built frontend files (generated)
├── .walrus-site-url                      # Deployed site URL (generated)
├── .walrus-object-id                     # Site object ID (generated)
└── README.md                             # This file
```

## Configuration Files

### sites-config.yaml

The main configuration file for site-builder, optimized with:

- **Package Configuration**: Uses official Walrus Sites package ID
- **Network Settings**: Testnet/mainnet RPC URLs and gas budgets
- **Site Configuration**: Headers, caching, redirects, and error pages
- **Security Headers**: Content security and caching policies
- **Performance Optimization**: Static asset caching and compression

Key features:
```yaml
# Package ID from official Walrus Sites deployment
package: 0xd84704c17fc870b8764832c535aa6b11f21a95cd6f5bb38a9b07d2cf42220c66

# Optimized caching for Next.js static assets
headers:
  "/_next/static/*":
    - "Cache-Control: public, max-age=31536000, immutable"
  
# API redirects to centralized backend
redirects:
  - from: "/api/*"
    to: "https://api.waltodo.com/api/*"
    status: 307
```

## Scripts Documentation

### setup-walrus-site.sh

Comprehensive environment setup script that:

- **Downloads and installs site-builder CLI** for your platform (Linux/macOS/Windows)
- **Creates Walrus client configuration** with network-specific endpoints
- **Validates system requirements** (Node.js, pnpm, curl, etc.)
- **Sets up wallet configuration** for deployment transactions
- **Performs health checks** to ensure everything is working

Usage:
```bash
./scripts/setup-walrus-site.sh [OPTIONS]

Options:
  --skip-install     Skip site-builder installation
  --skip-config      Skip configuration setup  
  --skip-wallet      Skip wallet verification
  -n, --network      Network to configure (testnet|mainnet)
  --version         site-builder version to install
```

### deploy-walrus-site.sh

Robust deployment script with advanced features:

- **Enhanced Error Handling**: Retry logic with exponential backoff
- **Network Validation**: Tests connectivity before deployment
- **Wallet Balance Checking**: Verifies sufficient funds for deployment
- **Command Optimization**: Uses correct site-builder syntax and options
- **Information Extraction**: Saves site URL and object ID for future use
- **Troubleshooting Guidance**: Provides specific error resolution steps

Usage:
```bash
./scripts/deploy-walrus-site.sh [OPTIONS]

Options:
  -n, --network      Network to deploy to (testnet|mainnet)
  -f, --force        Force rebuild even if build exists
  -s, --skip-build   Skip build process and deploy existing build
  --site-name        Name for the Walrus site
  --config-dir       Walrus config directory
```

Key improvements:
- Retry logic with intelligent error classification
- Network connectivity validation
- Wallet balance verification
- Proper command syntax for site-builder
- Comprehensive error messages with solutions

### walrus-site-wrapper.sh

Library of wrapper functions for reliable site-builder operations:

**Core Functions:**
- `walrus_site_publish()` - Publish new sites with retry logic
- `walrus_site_update()` - Update existing sites safely
- `walrus_site_convert()` - Convert object IDs to Base36 format
- `walrus_site_sitemap()` - Retrieve site structure information
- `walrus_site_health_check()` - Comprehensive system validation

**Utility Functions:**
- `extract_deployment_info()` - Parse deployment output to JSON
- `validate_site_builder()` - Verify site-builder installation
- `execute_site_builder_with_retry()` - Generic retry wrapper

Usage:
```bash
# Source the functions
source ./scripts/walrus-site-wrapper.sh

# Use wrapper functions
walrus_site_publish ./out sites-config.yaml testnet 100
walrus_site_health_check testnet
```

### verify-site-builder-config.js

Comprehensive validation script that checks:

**Critical Validations (must pass):**
- Dependencies (Node.js, pnpm, curl, site-builder)
- Configuration file structure and syntax
- Build directory and essential files
- Network connectivity to Sui and Walrus endpoints

**Optional Validations (warnings only):**
- Sui CLI installation and configuration
- Wallet balance and gas objects
- System resources (disk space, memory)

Usage:
```bash
./scripts/verify-site-builder-config.js
```

Output includes:
- ✅ Success indicators for passing checks
- ⚠️ Warnings for optional features
- ❌ Errors for critical issues
- 📋 Next steps and troubleshooting guidance

## Deployment Process

### 1. Prerequisites

Ensure you have:
- Node.js 18+ and pnpm installed
- Internet connection for downloading dependencies
- Sui wallet with sufficient balance (0.1+ SUI for testnet, 1+ SUI for mainnet)

### 2. Environment Setup

Run the setup script to install and configure everything:

```bash
./scripts/setup-walrus-site.sh --network testnet
```

This will:
- Install site-builder CLI for your platform
- Create Walrus client configuration
- Set up wallet integration
- Validate system requirements

### 3. Build Preparation

Ensure your frontend is built for static export:

```bash
cd /path/to/waltodo-frontend
pnpm run build:export
```

The build will be created in the `out/` directory.

### 4. Validation

Run comprehensive validation before deployment:

```bash
./scripts/verify-site-builder-config.js
```

Fix any critical issues before proceeding.

### 5. Deployment

Deploy to Walrus Sites:

```bash
# Testnet deployment
./scripts/deploy-walrus-site.sh --network testnet

# Mainnet deployment  
./scripts/deploy-walrus-site.sh --network mainnet
```

### 6. Post-Deployment

After successful deployment:

- Site URL is saved to `.walrus-site-url`
- Object ID is saved to `.walrus-object-id`
- Use these for future updates and SuiNS configuration

## Error Handling & Troubleshooting

### Common Issues

**1. site-builder not found**
```bash
# Solution: Install site-builder
./scripts/setup-walrus-site.sh
```

**2. Build directory not found**
```bash
# Solution: Build the frontend
pnpm run build:export
```

**3. Network connectivity issues**
```bash
# Solution: Check firewall and network
curl -s https://fullnode.testnet.sui.io:443
```

**4. Insufficient wallet balance**
```bash
# Solution: Add SUI tokens to your wallet
sui client gas
```

### Error Classification

The deployment script automatically classifies errors:

- **Network Errors**: Automatically retried with exponential backoff
- **Balance Errors**: Immediate failure with guidance to add funds
- **Configuration Errors**: Immediate failure with config validation advice
- **Unknown Errors**: Retried with generic delay

### Recovery Procedures

**Failed Deployment Recovery:**
1. Check error logs for specific failure reason
2. Run validation script to identify issues
3. Fix identified problems
4. Retry deployment with `--force` flag if needed

**Update Existing Site:**
```bash
# Use the saved object ID for updates
OBJECT_ID=$(cat .walrus-object-id)
source ./scripts/walrus-site-wrapper.sh
walrus_site_update ./out $OBJECT_ID
```

## Advanced Configuration

### Custom Package IDs

To use custom Walrus Sites deployments:

```yaml
# sites-config.yaml
package: 0x[your-custom-package-id]
```

### Custom Networks

For private networks or custom RPC endpoints:

```yaml
general:
  rpc_url: https://your-custom-rpc-endpoint.com
```

### Performance Optimization

Optimize for larger sites:

```yaml
sites:
  waltodo-app:
    epochs: 183  # Maximum storage duration (1 year)
    headers:
      "/*":
        - "Cache-Control: public, max-age=31536000"
```

### Security Hardening

Additional security headers:

```yaml
headers:
  "/*":
    - "Content-Security-Policy: default-src 'self'"
    - "Strict-Transport-Security: max-age=31536000"
```

## Monitoring & Maintenance

### Health Monitoring

Regular health checks:

```bash
# Quick health check
source ./scripts/walrus-site-wrapper.sh
walrus_site_health_check testnet

# Comprehensive validation
./scripts/verify-site-builder-config.js
```

### Site Updates

Update process for new frontend versions:

```bash
# 1. Build new version
pnpm run build:export

# 2. Validate build
./scripts/verify-site-builder-config.js

# 3. Update site
OBJECT_ID=$(cat .walrus-object-id)
source ./scripts/walrus-site-wrapper.sh
walrus_site_update ./out $OBJECT_ID sites-config.yaml testnet 100
```

### Backup & Recovery

Important files to backup:
- `sites-config.yaml` - Site configuration
- `.walrus-object-id` - For site updates
- Wallet keystore files - For deployment permissions

## Integration with SuiNS

After deployment, you can set up a custom domain using SuiNS:

1. **Get Base36 subdomain:**
   ```bash
   OBJECT_ID=$(cat .walrus-object-id)
   source ./scripts/walrus-site-wrapper.sh
   walrus_site_convert $OBJECT_ID
   ```

2. **Register SuiNS name** pointing to your object ID

3. **Access via custom domain:** `https://yourname.walrus.site`

## Support & Resources

- **Walrus Sites Documentation**: https://docs.wal.app/walrus-sites
- **Site-builder Repository**: https://github.com/MystenLabs/walrus-sites
- **Sui Network Documentation**: https://docs.sui.io
- **WalTodo Project Repository**: [Your repository URL]

## Contributing

To improve this Walrus Sites integration:

1. Test changes thoroughly on testnet
2. Validate with the verification script
3. Update documentation for new features
4. Submit pull requests with clear descriptions

## License

This integration follows the same license as the main WalTodo project.