# WalTodo Development Guide

This guide provides detailed information for developers working on the WalTodo project, including development workflows, architecture details, and troubleshooting tips.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [CLI and Frontend Communication](#cli-and-frontend-communication)
- [Common Development Tasks](#common-development-tasks)
- [Testing](#testing)
- [Building and Deployment](#building-and-deployment)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Development Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js** v18.0.0 or higher
- **pnpm** v8.0.0 or higher
- **Git**
- **tmux** (optional, for development orchestrator)

### Quick Setup

The fastest way to get started:

```bash
# Clone and enter the repository
git clone https://github.com/Vjust/walrus_todo.git
cd walrus_todo

# Run the automated setup script
./scripts/setup-dev-env.sh

# Start all services
pnpm dev:all
```

### Manual Setup Steps

If the automated setup doesn't work for your environment:

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Configure Environment Variables**
   ```bash
   # Root directory
   cp .env.example .env
   
   # CLI
   cp apps/cli/.env.example apps/cli/.env
   
   # API Server
   cp apps/api/.env.example apps/api/.env
   
   # Frontend
   cp waltodo-frontend/.env.example waltodo-frontend/.env.local
   ```

3. **Build the Project**
   ```bash
   # Development build (fast, no type checking)
   pnpm build:dev
   
   # Production build (with type checking)
   pnpm build
   ```

4. **Install CLI Globally**
   ```bash
   pnpm run global-install
   ```

## Project Architecture

### Monorepo Structure

WalTodo uses a monorepo structure managed by pnpm workspaces:

```
walrus_todo/
├── apps/
│   ├── api/          # Express.js API server
│   └── cli/          # OCLIF-based CLI application
├── waltodo-frontend/ # Next.js web frontend
├── packages/         # Shared packages (if any)
├── scripts/          # Development and build scripts
└── docs/            # Documentation
```

### Key Components

#### 1. CLI (apps/cli)

The CLI is built with OCLIF and follows a command-service-adapter pattern:

- **Commands** (`src/commands/`): User-facing CLI commands
- **Services** (`src/services/`): Business logic and integrations
- **Adapters** (`src/types/adapters/`): Compatibility layer for external dependencies
- **Utils** (`src/utils/`): Shared utilities

#### 2. API Server (apps/api)

Express.js server providing REST endpoints:

- **Controllers** (`src/controllers/`): Request handlers
- **Routes** (`src/routes/`): API endpoint definitions
- **Services** (`src/services/`): Business logic
- **Middleware** (`src/middleware/`): Authentication, validation, etc.

#### 3. Frontend (waltodo-frontend)

Next.js 14 application with:

- **App Router**: Modern Next.js routing
- **Components** (`src/components/`): React components
- **Hooks** (`src/hooks/`): Custom React hooks
- **Lib** (`src/lib/`): Utilities and API clients

### Storage Layers

WalTodo implements a multi-tier storage architecture:

1. **Local Storage**: JSON files in `Todos/` directory
2. **API Database**: Centralized storage for sync and queries
3. **Walrus Storage**: Decentralized blob storage
4. **Sui Blockchain**: NFT ownership and verification

## Development Workflow

### Starting Development

#### Option 1: All Services (Recommended)

```bash
# Start CLI, API, and Frontend in tmux
pnpm dev:all
```

This creates a tmux session with:
- Left pane: CLI ready for testing
- Top right: API server (port 3001)
- Bottom right: Frontend (port 3000)

#### Option 2: Individual Services

```bash
# Terminal 1: API Server
cd apps/api && pnpm dev

# Terminal 2: Frontend
cd waltodo-frontend && pnpm dev

# Terminal 3: CLI Development
cd apps/cli && pnpm build:watch
```

### Making Changes

#### CLI Development

1. **Edit Command Files**
   ```bash
   # Edit a command
   vim apps/cli/src/commands/add.ts
   ```

2. **Rebuild and Test**
   ```bash
   # Fast rebuild
   cd apps/cli && pnpm build:dev
   
   # Test the command
   waltodo add "Test todo"
   ```

3. **Update Global Installation**
   ```bash
   pnpm run global-install
   ```

#### API Development

1. **Edit API Files**
   ```bash
   vim apps/api/src/routes/todos.ts
   ```

2. **API Auto-reloads** with nodemon during development

3. **Test Endpoints**
   ```bash
   curl http://localhost:3001/api/todos
   ```

#### Frontend Development

1. **Edit Components**
   ```bash
   vim waltodo-frontend/src/components/todo-list.tsx
   ```

2. **Frontend Auto-reloads** with Next.js fast refresh

3. **View Changes** at http://localhost:3000

### Git Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes and Commit**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## CLI and Frontend Communication

### Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     CLI     │────▶│  API Server │◀────│  Frontend   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│Local Storage│     │  Database   │     │   Browser   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Data Flow

1. **CLI → API**
   - CLI commands call API endpoints
   - Authentication via API keys or JWT
   - Data synced to centralized database

2. **Frontend → API**
   - React components fetch data via API client
   - Real-time updates via WebSocket
   - State management with React Query

3. **Shared Types**
   - Common type definitions in `apps/cli/src/types/`
   - Ensures consistency between CLI and Frontend

### API Endpoints

Key endpoints used by both CLI and Frontend:

```typescript
// Todo CRUD Operations
GET    /api/todos          // List todos
POST   /api/todos          // Create todo
PUT    /api/todos/:id      // Update todo
DELETE /api/todos/:id      // Delete todo

// List Management
GET    /api/lists          // Get all lists
POST   /api/lists          // Create list
DELETE /api/lists/:name    // Delete list

// Sync Operations
POST   /api/sync/push      // Push local changes
GET    /api/sync/pull      // Pull remote changes
```

### Frontend Configuration

The CLI generates configuration for the frontend:

```bash
# Generate frontend config from CLI settings
waltodo generate-frontend-config

# This creates/updates:
# waltodo-frontend/public/config/testnet.json
```

## Common Development Tasks

### Adding a New CLI Command

1. **Create Command File**
   ```bash
   # Use the template
   cp apps/cli/src/commands/template.ts apps/cli/src/commands/mycommand.ts
   ```

2. **Implement Command Logic**
   ```typescript
   import { BaseCommand } from '../base-command'
   
   export default class MyCommand extends BaseCommand {
     static description = 'My new command'
     
     async run(): Promise<void> {
       // Command implementation
     }
   }
   ```

3. **Add to Exports**
   ```typescript
   // In apps/cli/src/commands/index.ts
   export { default as mycommand } from './mycommand'
   ```

4. **Create Tests**
   ```bash
   # Create test file
   touch apps/cli/src/__tests__/commands/mycommand.test.ts
   ```

### Adding an API Endpoint

1. **Create Route Handler**
   ```typescript
   // apps/api/src/routes/myroute.ts
   import { Router } from 'express'
   
   const router = Router()
   
   router.get('/myendpoint', async (req, res) => {
     // Handler logic
   })
   
   export default router
   ```

2. **Register Route**
   ```typescript
   // apps/api/src/server.ts
   import myRoute from './routes/myroute'
   
   app.use('/api', myRoute)
   ```

### Adding a Frontend Feature

1. **Create Component**
   ```typescript
   // waltodo-frontend/src/components/MyComponent.tsx
   export function MyComponent() {
     return <div>My Component</div>
   }
   ```

2. **Add to Page**
   ```typescript
   // waltodo-frontend/src/app/page.tsx
   import { MyComponent } from '@/components/MyComponent'
   ```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run CLI tests only
cd apps/cli && pnpm test

# Run API tests only
cd apps/api && pnpm test

# Run with coverage
pnpm test -- --coverage

# Run specific test file
pnpm test -- apps/cli/src/__tests__/commands/add.test.ts

# Run in watch mode
pnpm test -- --watch
```

### Writing Tests

#### CLI Command Test Example

```typescript
import { expect, test } from '@oclif/test'

describe('add command', () => {
  test
    .stdout()
    .command(['add', 'Test todo'])
    .it('adds a new todo', ctx => {
      expect(ctx.stdout).to.contain('Added todo: Test todo')
    })
})
```

#### API Endpoint Test Example

```typescript
import request from 'supertest'
import app from '../src/server'

describe('GET /api/todos', () => {
  it('returns todo list', async () => {
    const response = await request(app)
      .get('/api/todos')
      .expect(200)
    
    expect(response.body).toHaveProperty('todos')
  })
})
```

## Building and Deployment

### Build Commands

```bash
# Development build (fast, no type checking)
pnpm build:dev

# Production build (with type checking)
pnpm build

# Build specific workspace
pnpm --filter @waltodo/cli build

# Clean and rebuild
pnpm clean && pnpm build
```

### Deployment Options

#### CLI Distribution

```bash
# Build for distribution
cd apps/cli
pnpm build

# Package as npm module
npm pack

# Or publish to npm
npm publish
```

#### API Deployment

```bash
# Build API
cd apps/api
pnpm build

# Deploy to your platform
# Examples: Heroku, Railway, Vercel, etc.
```

#### Frontend Deployment

```bash
# Build frontend
cd waltodo-frontend
pnpm build

# Deploy to static hosting
# Examples: Vercel, Netlify, Cloudflare Pages
```

## Troubleshooting

### Common Issues and Solutions

#### 1. TypeScript Errors

**Problem**: TypeScript errors during build

**Solution**:
```bash
# Use development build to skip type checking
pnpm build:dev

# Or fix types gradually
pnpm typecheck
```

#### 2. Port Conflicts

**Problem**: "Port already in use" error

**Solution**:
```bash
# Find process using port
lsof -i :3000  # or :3001

# Kill the process
kill -9 <PID>

# Or use different ports
API_PORT=3002 pnpm dev
```

#### 3. CLI Not Found

**Problem**: `waltodo: command not found`

**Solution**:
```bash
# Reinstall globally
pnpm run global-install

# Or use direct path
~/.local/bin/waltodo
```

#### 4. Dependency Issues

**Problem**: Module not found errors

**Solution**:
```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Clear pnpm cache
pnpm store prune
```

#### 5. Build Failures

**Problem**: Build script fails

**Solution**:
```bash
# Check Node version
node --version  # Should be 18+

# Clean build directories
pnpm clean

# Rebuild
pnpm build:dev
```

### Debug Mode

Enable debug output for troubleshooting:

```bash
# CLI Debug
DEBUG=* waltodo list

# API Debug
DEBUG=express:* pnpm dev

# Frontend Debug
NEXT_PUBLIC_DEBUG=true pnpm dev
```

## Best Practices

### Code Style

1. **Use TypeScript** for all new code
2. **Follow ESLint rules** - run `pnpm lint`
3. **Write tests** for new features
4. **Document complex logic** with comments

### Git Commit Messages

Follow conventional commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: format code
refactor: restructure code
test: add tests
chore: update dependencies
```

### Performance

1. **Use development builds** during development
2. **Implement caching** for expensive operations
3. **Batch API requests** when possible
4. **Lazy load** frontend components

### Security

1. **Never commit secrets** - use .env files
2. **Validate all inputs** - CLI flags and API requests
3. **Use secure dependencies** - run `pnpm audit`
4. **Follow security guidelines** in docs/security/

### Testing

1. **Write tests first** for bug fixes
2. **Test edge cases** and error conditions
3. **Mock external services** for unit tests
4. **Run integration tests** before deployment

## Additional Resources

- [CLI Commands Reference](CLI-COMMANDS.md)
- [API Documentation](docs/api.md)
- [Architecture Overview](docs/architecture.md)
- [Security Guide](docs/security/)
- [Frontend Guide](waltodo-frontend/README.md)

## Getting Help

- Check existing issues on GitHub
- Join our Discord community
- Review the documentation
- Use `--help` flag with any CLI command

Happy coding! 🚀