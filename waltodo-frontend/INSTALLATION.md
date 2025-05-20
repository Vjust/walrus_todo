# Frontend-v2 Installation Guide

This document explains how to install and work with the Next.js frontend for the Walrus Todo application.

## Prerequisites

- Node.js LTS (≥18.x) 
- pnpm (≥8.x)

## Installation Steps

### 1. Clean Install

If you're setting up the frontend for the first time or experiencing installation issues:

```bash
# Clean up existing node_modules
cd packages/frontend-v2
rm -rf node_modules

# Clean pnpm store (optional)
pnpm store prune

# Install dependencies
pnpm install
```

### 2. Working with Workspace

This frontend is part of a pnpm workspace. If the root project has TypeScript errors during installation, you can still work with the frontend independently:

```bash
# Install only frontend dependencies
cd packages/frontend-v2
pnpm install --ignore-scripts

# Or if the workspace install fails, use CI mode
CI=true pnpm install
```

## Development

Start the development server:

```bash
pnpm dev
```

The server runs on http://localhost:3000 by default. If that port is in use, it will automatically use port 3001.

## Building

Create a production build:

```bash
pnpm build
```

## Linting

Run ESLint:

```bash
pnpm lint

# Fix lint issues automatically
pnpm lint:fix
```

## Troubleshooting

### Port Conflicts

If you see "Port 3000 is in use", the dev server will automatically use port 3001.

### TypeScript Errors in Root Project

The root project's TypeScript errors during `pnpm install` won't prevent the frontend from working. The frontend has its own TypeScript configuration and can be built independently.

### Network Issues During Install

If you experience timeouts during package installation:

1. Try using a different network
2. Use CI mode to disable prompts: `CI=true pnpm install`
3. Install packages one by one: `pnpm add <package-name>`

## Environment Configuration

The project includes `.npmrc` files for proper workspace configuration:

- Root `.npmrc`: Configures workspace-wide settings like `shamefully-hoist=true`
- Frontend `.npmrc`: Ensures proper package resolution

## CI/CD Integration

For CI pipelines, use:

```bash
# Install dependencies
CI=true pnpm install --filter @walrus-todo/frontend

# Build
pnpm --filter @walrus-todo/frontend build

# Lint
pnpm --filter @walrus-todo/frontend lint
```

## Additional Resources

- See the main [README.md](./README.md) for feature documentation
- Check [WALLET_INTEGRATION.md](./WALLET_INTEGRATION.md) for wallet setup
- Use [Next.js documentation](https://nextjs.org/docs) for framework-specific questions