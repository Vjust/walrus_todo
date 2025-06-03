# WalTodo Frontend Deployment Guide

This guide covers all deployment scenarios for the WalTodo frontend application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Walrus Sites Deployment](#walrus-sites-deployment)
- [Build Optimization](#build-optimization)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **pnpm**: Version 10.11.0 or higher (recommended package manager)
- **Git**: For version control and deployment

### Development Tools

- **TypeScript**: Included in project dependencies
- **Next.js**: 15.3.3 (configured for both App Router and static export)
- **Tailwind CSS**: For styling

### Blockchain Tools (for Walrus Sites)

- **Walrus CLI**: For interacting with Walrus storage
- **site-builder**: For building Walrus Sites
- **WalTodo CLI**: For backend configuration

## Local Development

### Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
./scripts/deploy-local.sh dev

# Or use pnpm directly
pnpm dev
```

### Development Commands

```bash
# Start development server with automatic port detection
pnpm run dev

# Start on fixed port (3000)
pnpm run dev:fixed-port

# Start with proxy configuration
pnpm run dev:proxy

# Start both frontend and API
pnpm run dev:all
```

### Environment Configuration

Create `.env.local` for local development:

```env
# Network configuration
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_ENVIRONMENT=development

# API configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# Development flags
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_MOCK_WALLET=false
```

### Network Configuration

The application supports multiple networks:

- **testnet**: For development and testing
- **devnet**: For early development
- **mainnet**: For production

Configuration files are located in `public/config/`:
- `testnet.json`
- `devnet.json` 
- `mainnet.json`

Run `pnpm run setup-config` to initialize configurations.

## Production Deployment

### Standard Production Build

```bash
# Run complete production deployment
./scripts/deploy-production.sh

# Or step by step
pnpm run build:production
pnpm start
```

### Production Build Options

```bash
# Standard production build
pnpm run build

# Development build (faster, less strict)
pnpm run build:dev

# Static export build
pnpm run build:static

# Production build with deployment
pnpm run build:production
```

### Hosting Providers

#### Vercel Deployment

1. Install Vercel CLI: `npm i -g vercel`
2. Configure `vercel.json` (already included)
3. Deploy: `vercel --prod`

#### Netlify Deployment

1. Install Netlify CLI: `npm i -g netlify-cli`
2. Configure `netlify.toml`
3. Deploy: `netlify deploy --prod`

#### Docker Deployment

```bash
# Build Docker image
docker build -t waltodo-frontend .

# Run container
docker run -p 3000:3000 waltodo-frontend
```

## Walrus Sites Deployment

Walrus Sites provides decentralized hosting on the Walrus network.

### Prerequisites

1. Install Walrus CLI tools:
   ```bash
   # Install Walrus CLI
   curl -fsSL https://install.walrus.site | bash
   
   # Install site-builder
   cargo install site-builder
   ```

2. Configure network access:
   ```bash
   # Deploy backend configuration
   cd ../apps/cli
   waltodo deploy --network testnet
   ```

### Deployment Process

```bash
# Deploy to testnet (recommended for testing)
./scripts/deploy-walrus-sites.sh testnet

# Deploy to mainnet (production)
./scripts/deploy-walrus-sites.sh mainnet
```

### Manual Walrus Sites Deployment

```bash
# 1. Build static export
export NEXT_EXPORT=true
pnpm run build:static

# 2. Navigate to Walrus site directory
cd walrus-site-waltodo

# 3. Copy build output
cp -r ../out .

# 4. Deploy to Walrus
./scripts/deploy-walrus-site-enhanced.sh testnet
```

### Walrus Sites Configuration

Configuration files in `walrus-site-waltodo/`:

- `sites-config.yaml`: Main site configuration
- `sites-config-mainnet.yaml`: Mainnet-specific config
- `scripts/`: Deployment and optimization scripts

## Build Optimization

### Bundle Analysis

```bash
# Analyze bundle size
pnpm run analyze:bundle

# Generate bundle report
pnpm run analyze:bundle:report

# Run performance tests
pnpm run test:lighthouse
```

### Performance Optimization

The build includes several optimizations:

1. **Code Splitting**: Automatic chunk splitting for better loading
2. **Tree Shaking**: Removes unused code
3. **Image Optimization**: Automatic image compression and optimization
4. **CSS Optimization**: Minification and deduplication
5. **TypeScript Compilation**: Optimized for production

### Asset Optimization for Walrus

```bash
# Run asset optimization
cd walrus-site-waltodo
./scripts/asset-optimizer.sh
```

This optimizes:
- Image compression
- JavaScript minification
- CSS optimization
- File size reduction for Walrus storage

## Configuration Management

### Network Switching

```bash
# Generate configuration for specific network
NETWORK=testnet pnpm run setup-config

# Embed configurations for static build
pnpm run embed-configs

# Restore original configurations
pnpm run restore-configs
```

### Environment Variables

Key environment variables:

```env
# Build configuration
NODE_ENV=production
NEXT_EXPORT=true
BUILD_MODE=static

# Network configuration
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_ENVIRONMENT=production

# Feature flags
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_MOCK_WALLET=false
```

## Troubleshooting

### Common Build Issues

#### TypeScript Errors

```bash
# Check TypeScript compilation
npx tsc --noEmit

# Fix with lenient configuration (temporary)
# Edit next.config.js: typescript.ignoreBuildErrors = true
```

#### Memory Issues

```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm run build
```

#### Missing Dependencies

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Walrus Sites Issues

#### Site Not Accessible

1. Check network configuration:
   ```bash
   cd walrus-site-waltodo
   ./scripts/verify-config.js
   ```

2. Verify site deployment:
   ```bash
   ./scripts/build-validator.sh
   ```

3. Test network connectivity:
   ```bash
   ./scripts/test-network-connectivity.sh
   ```

#### Large Bundle Size

1. Run asset optimization:
   ```bash
   cd walrus-site-waltodo
   ./scripts/asset-optimizer.sh
   ```

2. Check bundle analysis:
   ```bash
   pnpm run analyze:bundle:report
   ```

### Performance Issues

#### Slow Loading

1. Check bundle splitting configuration in `next.config.js`
2. Verify image optimization settings
3. Review network requests in browser dev tools

#### Build Timeouts

1. Increase timeout in `next.config.js`:
   ```js
   staticPageGenerationTimeout: 300
   ```

2. Use development build for faster iteration:
   ```bash
   pnpm run build:dev
   ```

### Network Configuration Issues

#### Wrong Network

1. Check current configuration:
   ```bash
   cat public/config/testnet.json
   ```

2. Regenerate configuration:
   ```bash
   pnpm run setup-config
   ```

3. Verify CLI backend is deployed:
   ```bash
   cd ../apps/cli
   waltodo status --network testnet
   ```

## Deployment Checklist

### Pre-deployment

- [ ] All tests pass: `pnpm test`
- [ ] Linting passes: `pnpm lint`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Bundle size is acceptable: `pnpm run analyze:bundle`
- [ ] Network configuration is correct
- [ ] Backend is deployed and accessible

### Production Deployment

- [ ] Environment variables are set correctly
- [ ] Build completes successfully
- [ ] Static assets are optimized
- [ ] Performance tests pass
- [ ] Site is accessible at deployment URL

### Walrus Sites Deployment

- [ ] Walrus CLI tools are installed
- [ ] Network connectivity is verified
- [ ] Static build exports correctly
- [ ] Site deploys to Walrus successfully
- [ ] Site is accessible via Walrus portal
- [ ] Blockchain features work correctly

### Post-deployment

- [ ] All critical user flows work
- [ ] Wallet connectivity functions
- [ ] NFT creation and display work
- [ ] Error monitoring is active
- [ ] Performance metrics are collected

## Support

For deployment issues:

1. Check this documentation first
2. Review build logs for specific errors
3. Test locally before deploying
4. Verify network configurations
5. Check Walrus Sites documentation for platform-specific issues

For emergency issues, use the recovery scripts in `walrus-site-waltodo/scripts/`.