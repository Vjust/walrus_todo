#!/bin/bash

# Local Development Deployment Script for WalTodo Frontend
# This script sets up and runs the frontend locally with proper configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_PORT=3000
NETWORK="${NETWORK:-testnet}"
MODE="${MODE:-development}"

echo -e "${GREEN}🏠 WalTodo Frontend Local Deployment${NC}"
echo "===================================="
echo -e "${BLUE}Network: ${NETWORK}${NC}"
echo -e "${BLUE}Mode: ${MODE}${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}❌ Node.js 18+ is required${NC}"
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        echo -e "${RED}❌ pnpm is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

# Setup environment
setup_environment() {
    echo -e "\n${YELLOW}Setting up environment...${NC}"
    
    # Create .env.local if it doesn't exist
    if [ ! -f ".env.local" ]; then
        cat > .env.local << EOF
# Local development environment
NEXT_PUBLIC_NETWORK=${NETWORK}
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_API_URL=http://localhost:3001

# Development flags
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_MOCK_WALLET=false
EOF
        echo -e "${GREEN}✓ Created .env.local${NC}"
    else
        echo -e "${BLUE}ℹ️  Using existing .env.local${NC}"
    fi
    
    # Setup configuration
    pnpm run setup-config
    
    echo -e "${GREEN}✓ Environment setup completed${NC}"
}

# Install dependencies
install_dependencies() {
    echo -e "\n${YELLOW}Installing dependencies...${NC}"
    
    # Check if node_modules exists and is recent
    if [ -d "node_modules" ] && [ -f "pnpm-lock.yaml" ]; then
        # Check if pnpm-lock.yaml is newer than node_modules
        if [ "pnpm-lock.yaml" -nt "node_modules" ]; then
            echo "Lock file is newer than node_modules, reinstalling..."
            rm -rf node_modules
            pnpm install
        else
            echo -e "${BLUE}ℹ️  Dependencies already installed${NC}"
        fi
    else
        pnpm install
    fi
    
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Find available port
find_available_port() {
    local port=$DEFAULT_PORT
    while lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; do
        port=$((port + 1))
    done
    echo $port
}

# Start development server
start_development() {
    echo -e "\n${YELLOW}Starting development server...${NC}"
    
    # Find available port
    PORT=$(find_available_port)
    if [ "$PORT" != "$DEFAULT_PORT" ]; then
        echo -e "${YELLOW}⚠️  Port $DEFAULT_PORT is in use, using port $PORT${NC}"
    fi
    
    export PORT=$PORT
    export NEXT_PUBLIC_NETWORK=$NETWORK
    
    echo -e "${GREEN}✓ Starting server on http://localhost:$PORT${NC}"
    echo -e "${BLUE}Press Ctrl+C to stop the server${NC}"
    echo ""
    
    # Start the development server
    pnpm run dev:fixed-port
}

# Start production build locally
start_production() {
    echo -e "\n${YELLOW}Starting production build locally...${NC}"
    
    # Build the application
    echo "Building application..."
    export NODE_ENV=production
    pnpm run build
    
    # Find available port
    PORT=$(find_available_port)
    if [ "$PORT" != "$DEFAULT_PORT" ]; then
        echo -e "${YELLOW}⚠️  Port $DEFAULT_PORT is in use, using port $PORT${NC}"
    fi
    
    export PORT=$PORT
    
    echo -e "${GREEN}✓ Starting production server on http://localhost:$PORT${NC}"
    echo -e "${BLUE}Press Ctrl+C to stop the server${NC}"
    echo ""
    
    # Start the production server
    pnpm run start:fixed-port
}

# Test static build
test_static_build() {
    echo -e "\n${YELLOW}Testing static build...${NC}"
    
    # Build static export
    export NEXT_EXPORT=true
    export BUILD_MODE=static
    pnpm run build:static
    
    # Serve static files
    if command -v serve &> /dev/null; then
        PORT=$(find_available_port)
        echo -e "${GREEN}✓ Serving static build on http://localhost:$PORT${NC}"
        echo -e "${BLUE}Press Ctrl+C to stop the server${NC}"
        echo ""
        npx serve out -p $PORT
    else
        echo -e "${GREEN}✓ Static build completed${NC}"
        echo -e "${YELLOW}Install 'serve' to test static build: npm i -g serve${NC}"
        echo -e "${BLUE}Static files are in the 'out' directory${NC}"
    fi
}

# Health check
health_check() {
    echo -e "\n${YELLOW}Running health check...${NC}"
    
    # Check package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found${NC}"
        exit 1
    fi
    
    # Check critical files
    local critical_files=(
        "src/app/layout.tsx"
        "src/app/page.tsx"
        "next.config.js"
        "tsconfig.json"
    )
    
    for file in "${critical_files[@]}"; do
        if [ ! -f "$file" ]; then
            echo -e "${RED}❌ Critical file missing: $file${NC}"
            exit 1
        fi
    done
    
    # Check configuration
    if [ ! -f "public/config/${NETWORK}.json" ]; then
        echo -e "${YELLOW}⚠️  Network configuration missing for $NETWORK${NC}"
    fi
    
    echo -e "${GREEN}✓ Health check passed${NC}"
}

# Display useful information
show_info() {
    echo -e "\n${BLUE}📋 Development Information${NC}"
    echo "=========================="
    echo -e "${YELLOW}Available commands:${NC}"
    echo "  pnpm dev              - Start development server"
    echo "  pnpm build            - Build for production"
    echo "  pnpm start            - Start production server"
    echo "  pnpm test             - Run tests"
    echo "  pnpm lint             - Run linting"
    echo ""
    echo -e "${YELLOW}Useful URLs:${NC}"
    echo "  Frontend: http://localhost:3000"
    echo "  API (if running): http://localhost:3001"
    echo ""
    echo -e "${YELLOW}Network Configuration:${NC}"
    echo "  Current: $NETWORK"
    echo "  Config: public/config/${NETWORK}.json"
    echo ""
    echo -e "${YELLOW}Walrus Sites Testing:${NC}"
    echo "  ./scripts/deploy-walrus-sites.sh testnet"
    echo ""
}

# Main function
main() {
    case "${1:-}" in
        --help|-h)
            echo "Usage: $0 [COMMAND] [OPTIONS]"
            echo ""
            echo "Commands:"
            echo "  dev        Start development server (default)"
            echo "  prod       Start production build locally"
            echo "  static     Test static build"
            echo "  check      Run health check only"
            echo "  info       Show development information"
            echo ""
            echo "Environment variables:"
            echo "  NETWORK    Target network (testnet|mainnet) [default: testnet]"
            echo "  MODE       Development mode [default: development]"
            exit 0
            ;;
        dev|"")
            check_prerequisites
            health_check
            setup_environment
            install_dependencies
            start_development
            ;;
        prod)
            check_prerequisites
            health_check
            setup_environment
            install_dependencies
            start_production
            ;;
        static)
            check_prerequisites
            health_check
            setup_environment
            install_dependencies
            test_static_build
            ;;
        check)
            check_prerequisites
            health_check
            echo -e "\n${GREEN}✅ All checks passed${NC}"
            ;;
        info)
            show_info
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Shutting down...${NC}"; exit 0' INT

# Run main function
main "$@"