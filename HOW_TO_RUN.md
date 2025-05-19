# How to Run Walrus Todo

This guide explains how to set up and run the Walrus Todo application, including both the CLI backend and the Next.js frontend.

## Prerequisites

- Node.js LTS (≥18.x)
- pnpm (≥8.x)
- Sui CLI (for blockchain operations)
- Walrus CLI (for storage operations)

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd walrus_todo
```

### 2. Install Dependencies

#### Option A: Install Everything (if TypeScript builds pass)
```bash
pnpm install
```

#### Option B: Install with Workarounds (if TypeScript errors exist)
```bash
# Skip prepare scripts during installation
CI=true pnpm install

# Or install specific workspaces
pnpm install --filter @walrus-todo/frontend
```

### 3. Configure Environment

Create a `.env` file in the root:
```bash
cp .env.example .env
```

Key environment variables:
- `XAI_API_KEY`: For AI features
- `WALRUS_USE_MOCK`: Set to `true` for testing without real Walrus
- `SUI_RPC_URL`: Sui blockchain RPC endpoint

## Running the Application

### CLI Backend

#### Development Mode
```bash
# Fast development build (skips type checking)
pnpm run build:dev

# Run in development mode with hot reload
pnpm run dev
```

#### Production Mode
```bash
# Full production build with type checking
pnpm build

# Install globally
./install-global.sh

# Use the CLI
waltodo add "My new todo"
waltodo list
waltodo complete 1
```

### Frontend (frontend-v2)

#### Development Mode
```bash
# From root directory
pnpm run nextjs

# Or from frontend directory
cd packages/frontend-v2
pnpm dev
```

The frontend runs on http://localhost:3000 (or 3001 if 3000 is in use).

#### Production Mode
```bash
# Build frontend
pnpm run nextjs:build

# Start production server
pnpm run nextjs:start
```

## Common Tasks

### Build Both Backend and Frontend
```bash
pnpm run build:all
```

### Run Tests
```bash
# All tests
pnpm test

# Frontend-specific tests
pnpm test --filter @walrus-todo/frontend
```

### Linting
```bash
# Backend
pnpm lint

# Frontend
pnpm --filter @walrus-todo/frontend lint
```

## Troubleshooting

### TypeScript Errors During Install

If you encounter TypeScript compilation errors during `pnpm install`:

1. Use CI mode: `CI=true pnpm install`
2. Skip scripts: `pnpm install --ignore-scripts`
3. Install packages independently: `cd packages/frontend-v2 && pnpm install`

### Port Conflicts

- Frontend: Automatically uses port 3001 if 3000 is in use
- Backend: Configure port in environment variables

### Network Issues

If package installation times out:
1. Try a different network
2. Use a VPN to change your location
3. Install packages incrementally

### Walrus Storage

To use mock storage instead of real Walrus:
```bash
export WALRUS_USE_MOCK=true
```

Or use the `--mock` flag with store command:
```bash
waltodo store --mock
```

## Advanced Usage

### Workspace Commands

Run commands for specific workspaces:
```bash
# Run frontend commands from root
pnpm --filter @walrus-todo/frontend <command>

# Run backend commands
pnpm --filter waltodo <command>
```

### CI/CD Integration

For CI pipelines:
```bash
# Install with CI flag
CI=true pnpm install

# Build and test
pnpm run build:all
pnpm test
```

## Additional Resources

- [Frontend Installation Guide](packages/frontend-v2/INSTALLATION.md)
- [Workspace Installation Fixes](docs/workspace-installation-fixes.md)
- [CLI User Guide](docs/user-guide.md)
- [Frontend Documentation](packages/frontend-v2/README.md)