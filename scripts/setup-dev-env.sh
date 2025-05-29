#!/bin/bash

# WalTodo Development Environment Setup Script
# This script sets up the complete development environment for WalTodo

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print colored output
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

echo "🐋 WalTodo Development Environment Setup"
echo "========================================"
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install it first:"
    echo "  npm install -g pnpm"
    exit 1
fi

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -f "pnpm-workspace.yaml" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Step 1: Setup environment files
print_info "Setting up environment files..."

# Root .env
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Created .env from .env.example"
    else
        print_error "No .env.example found in root directory"
    fi
else
    print_info ".env already exists in root directory"
fi

# CLI .env
if [ ! -f "apps/cli/.env" ]; then
    if [ -f "apps/cli/.env.example" ]; then
        cp apps/cli/.env.example apps/cli/.env
        print_success "Created apps/cli/.env from .env.example"
    else
        print_info "No .env.example found in apps/cli directory"
    fi
else
    print_info ".env already exists in apps/cli directory"
fi

# API .env
if [ ! -f "apps/api/.env" ]; then
    if [ -f "apps/api/.env.example" ]; then
        cp apps/api/.env.example apps/api/.env
        print_success "Created apps/api/.env from .env.example"
    else
        print_info "No .env.example found in apps/api directory"
    fi
else
    print_info ".env already exists in apps/api directory"
fi

# Frontend .env.local
if [ ! -f "waltodo-frontend/.env.local" ]; then
    if [ -f "waltodo-frontend/.env.example" ]; then
        cp waltodo-frontend/.env.example waltodo-frontend/.env.local
        print_success "Created waltodo-frontend/.env.local from .env.example"
    else
        print_info "No .env.example found in waltodo-frontend directory"
    fi
else
    print_info ".env.local already exists in waltodo-frontend directory"
fi

# Step 2: Install dependencies
print_info "Installing dependencies with pnpm..."
pnpm install
print_success "Dependencies installed"

# Step 3: Build shared packages
print_info "Building shared packages..."
if [ -d "packages" ]; then
    pnpm -r --filter "./packages/**" build || print_info "No packages to build"
else
    print_info "No shared packages found"
fi

# Step 4: Build the CLI
print_info "Building the CLI..."
cd apps/cli
pnpm build:dev
cd ../..
print_success "CLI built successfully"

# Step 5: Install CLI globally
print_info "Installing CLI globally..."
pnpm run global-install
print_success "CLI installed globally"

# Step 6: Build the API
print_info "Building the API..."
cd apps/api
pnpm build || print_info "API build not configured, skipping..."
cd ../..

# Step 7: Generate frontend configuration
print_info "Generating frontend configuration..."
waltodo generate-frontend-config || print_info "Frontend config generation skipped (CLI might need configuration first)"

# Step 8: Build frontend
print_info "Building frontend..."
cd waltodo-frontend
pnpm build || print_info "Frontend build not configured, skipping..."
cd ..

# Create necessary directories
print_info "Creating necessary directories..."
mkdir -p Todos
mkdir -p logs
mkdir -p .waltodo-cache
print_success "Directories created"

echo ""
echo "========================================"
print_success "Development environment setup complete!"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Configure your environment variables:"
echo "   - Edit .env files in root, apps/cli, apps/api, and waltodo-frontend"
echo "   - Set up your Sui wallet and Walrus credentials"
echo ""
echo "2. Start the development servers:"
echo "   - API Server: cd apps/api && pnpm dev"
echo "   - Frontend: cd waltodo-frontend && pnpm dev"
echo "   - CLI: waltodo --help"
echo ""
echo "3. Test the setup:"
echo "   - CLI: waltodo add \"Test todo\""
echo "   - Frontend: Open http://localhost:3000"
echo "   - API: Open http://localhost:3001/health"
echo ""
echo "For more information, see README.md and DEVELOPMENT.md"
echo ""