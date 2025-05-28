#!/bin/bash

# WalTodo Simple Development Starter
# Alternative to tmux-based orchestrator - starts services sequentially

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[ORCHESTRATOR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_status "🚀 Starting WalTodo Development Environment (Simple Mode)"
print_info ""

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "pnpm is not installed. Please install pnpm first: npm install -g pnpm"
    exit 1
fi

# Install dependencies
print_status "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    print_status "Installing root dependencies..."
    pnpm install
fi

if [ ! -d "waltodo-frontend/node_modules" ]; then
    print_status "Installing frontend dependencies..."
    cd waltodo-frontend && pnpm install && cd ..
fi

if [ ! -d "apps/api/node_modules" ]; then
    print_status "Installing API dependencies..."
    cd apps/api && pnpm install && cd ../..
fi

# Build CLI
print_status "Building CLI for development..."
pnpm build:dev

print_info ""
print_info "🎯 WalTodo Development Environment - Simple Mode"
print_info "================================================"
print_info ""
print_info "This script will guide you through starting the services."
print_info "You'll need to open multiple terminal windows/tabs."
print_info ""

echo "Press Enter to continue..."
read

print_info "Step 1: CLI is ready"
print_info "The CLI is built and ready for testing in this terminal."
print_info "Try: waltodo --help"
print_info ""

echo "Press Enter to see Step 2..."
read

print_info "Step 2: Start the API Server"
print_info "In a new terminal window, run:"
print_info "  cd $(pwd)"
print_info "  pnpm start:api"
print_info ""
print_info "This will start the API server on http://localhost:3001"
print_info ""

echo "Press Enter to see Step 3..."
read

print_info "Step 3: Start the Web Frontend"
print_info "In another new terminal window, run:"
print_info "  cd $(pwd)/waltodo-frontend"
print_info "  pnpm dev"
print_info ""
print_info "This will start the web frontend on http://localhost:3000"
print_info ""

echo "Press Enter to see the final summary..."
read

print_status "🎉 Setup Complete!"
print_info ""
print_info "📋 Services Overview:"
print_info "  • CLI: Ready in this terminal"
print_info "  • API: http://localhost:3001 (manual start required)"
print_info "  • Web: http://localhost:3000 (manual start required)"
print_info ""
print_info "🚀 Next Steps:"
print_info "  1. Follow steps 2 & 3 above to start API and Web"
print_info "  2. Test CLI commands: waltodo add 'Test task'"
print_info "  3. Open web interface at http://localhost:3000"
print_info "  4. Check API docs at http://localhost:3001/api"
print_info ""
print_info "💡 Tip: For a better experience, install tmux and use:"
print_info "  ./pnpm-dev.sh"
print_info ""