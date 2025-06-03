#!/bin/bash

# Walrus Sites Deployment Script for WalTodo Frontend
# This script builds and deploys the application to Walrus Sites

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WALRUS_SITE_DIR="walrus-site-waltodo"
DEPLOY_NETWORK="${DEPLOY_NETWORK:-testnet}"
BUILD_MODE="static"

echo -e "${GREEN}🐋 WalTodo Frontend Walrus Sites Deployment${NC}"
echo "============================================="
echo -e "${BLUE}Network: ${DEPLOY_NETWORK}${NC}"
echo -e "${BLUE}Build Mode: ${BUILD_MODE}${NC}"

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
    
    # Check Walrus CLI
    if ! command -v walrus &> /dev/null; then
        echo -e "${RED}❌ Walrus CLI is not installed${NC}"
        echo "Install from: https://docs.walrus.site/usage/setup"
        exit 1
    fi
    
    # Check site-builder
    if ! command -v site-builder &> /dev/null; then
        echo -e "${RED}❌ site-builder is not installed${NC}"
        echo "Install from: https://docs.walrus.site/site-builder"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

# Setup configuration
setup_configuration() {
    echo -e "\n${YELLOW}Setting up configuration...${NC}"
    
    # Run setup-config to ensure network configs are ready
    pnpm run setup-config
    
    # Verify network config exists
    if [ ! -f "public/config/${DEPLOY_NETWORK}.json" ]; then
        echo -e "${RED}❌ Network configuration for ${DEPLOY_NETWORK} not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Configuration setup completed${NC}"
}

# Build for static export
build_static() {
    echo -e "\n${YELLOW}Building static export...${NC}"
    
    # Clean previous builds
    rm -rf .next out
    
    # Set environment variables for static build
    export NODE_ENV=production
    export NEXT_EXPORT=true
    export BUILD_MODE=static
    export NEXT_PUBLIC_NETWORK=$DEPLOY_NETWORK
    
    # Run static build
    pnpm run build:static || {
        echo -e "${RED}❌ Static build failed${NC}"
        exit 1
    }
    
    # Verify output directory exists
    if [ ! -d "out" ]; then
        echo -e "${RED}❌ Static export output directory not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Static build completed${NC}"
    echo -e "${BLUE}Output size: $(du -sh out | cut -f1)${NC}"
}

# Optimize assets for Walrus
optimize_assets() {
    echo -e "\n${YELLOW}Optimizing assets for Walrus...${NC}"
    
    # Navigate to walrus site directory
    if [ ! -d "$WALRUS_SITE_DIR" ]; then
        echo -e "${RED}❌ Walrus site directory not found: $WALRUS_SITE_DIR${NC}"
        exit 1
    fi
    
    cd "$WALRUS_SITE_DIR"
    
    # Run asset optimization if script exists
    if [ -f "scripts/asset-optimizer.sh" ]; then
        ./scripts/asset-optimizer.sh || {
            echo -e "${YELLOW}⚠️  Asset optimization had issues (continuing)${NC}"
        }
    fi
    
    cd ..
    echo -e "${GREEN}✓ Asset optimization completed${NC}"
}

# Deploy to Walrus Sites
deploy_to_walrus() {
    echo -e "\n${YELLOW}Deploying to Walrus Sites...${NC}"
    
    cd "$WALRUS_SITE_DIR"
    
    # Copy fresh build output
    echo "Copying static build output..."
    rm -rf out
    cp -r ../out .
    
    # Select the appropriate deployment script
    DEPLOY_SCRIPT="scripts/deploy-walrus-site-enhanced.sh"
    if [ ! -f "$DEPLOY_SCRIPT" ]; then
        DEPLOY_SCRIPT="scripts/deploy-walrus-site.sh"
    fi
    
    if [ ! -f "$DEPLOY_SCRIPT" ]; then
        echo -e "${RED}❌ Deployment script not found${NC}"
        exit 1
    fi
    
    # Make script executable
    chmod +x "$DEPLOY_SCRIPT"
    
    # Run deployment
    echo "Running Walrus Sites deployment..."
    ./"$DEPLOY_SCRIPT" "$DEPLOY_NETWORK" || {
        echo -e "${RED}❌ Walrus Sites deployment failed${NC}"
        cd ..
        exit 1
    }
    
    cd ..
    echo -e "${GREEN}✓ Walrus Sites deployment completed${NC}"
}

# Validate deployment
validate_deployment() {
    echo -e "\n${YELLOW}Validating deployment...${NC}"
    
    cd "$WALRUS_SITE_DIR"
    
    # Run validation if script exists
    if [ -f "scripts/build-validator.sh" ]; then
        ./scripts/build-validator.sh || {
            echo -e "${YELLOW}⚠️  Validation had issues (check manually)${NC}"
        }
    fi
    
    # Check if site URL was generated
    if [ -f "site-url.txt" ]; then
        SITE_URL=$(cat site-url.txt)
        echo -e "${GREEN}✓ Site deployed at: ${SITE_URL}${NC}"
        
        # Test site accessibility (basic check)
        echo "Testing site accessibility..."
        if curl -s -f "$SITE_URL" > /dev/null; then
            echo -e "${GREEN}✓ Site is accessible${NC}"
        else
            echo -e "${YELLOW}⚠️  Site may not be accessible yet (propagation delay)${NC}"
        fi
    fi
    
    cd ..
    echo -e "${GREEN}✓ Validation completed${NC}"
}

# Generate deployment report
generate_report() {
    echo -e "\n${YELLOW}Generating deployment report...${NC}"
    
    VERSION=$(node -p "require('./package.json').version")
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat > walrus-deployment-report.json << EOF
{
  "version": "${VERSION}",
  "environment": "walrus-sites",
  "network": "${DEPLOY_NETWORK}",
  "timestamp": "${TIMESTAMP}",
  "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "node_version": "$(node -v)",
  "pnpm_version": "$(pnpm -v)",
  "build_mode": "${BUILD_MODE}",
  "output_size": "$(du -sh out 2>/dev/null | cut -f1 || echo 'unknown')"
}
EOF
    
    echo -e "${GREEN}✓ Deployment report generated: walrus-deployment-report.json${NC}"
}

# Cleanup
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    
    # Optional: Remove build artifacts to save space
    if [ "$CLEANUP_BUILD" = "true" ]; then
        rm -rf .next out
        echo -e "${GREEN}✓ Build artifacts cleaned${NC}"
    else
        echo -e "${BLUE}ℹ️  Build artifacts preserved (set CLEANUP_BUILD=true to auto-clean)${NC}"
    fi
}

# Main deployment flow
main() {
    echo -e "\n${BLUE}Starting Walrus Sites deployment process...${NC}"
    
    check_prerequisites
    setup_configuration
    build_static
    optimize_assets
    deploy_to_walrus
    validate_deployment
    generate_report
    cleanup
    
    echo -e "\n${GREEN}🎉 Walrus Sites deployment completed successfully!${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Test the deployed site functionality"
    echo "2. Check wallet connectivity and blockchain features"
    echo "3. Verify Walrus storage integration"
    echo "4. Monitor site performance and accessibility"
    
    if [ -f "$WALRUS_SITE_DIR/site-url.txt" ]; then
        echo -e "\n${BLUE}🌐 Site URL: $(cat $WALRUS_SITE_DIR/site-url.txt)${NC}"
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [NETWORK]"
        echo ""
        echo "Deploy WalTodo frontend to Walrus Sites"
        echo ""
        echo "Arguments:"
        echo "  NETWORK    Target network (testnet|mainnet) [default: testnet]"
        echo ""
        echo "Environment variables:"
        echo "  CLEANUP_BUILD    Set to 'true' to auto-clean build artifacts"
        echo "  DEPLOY_NETWORK   Override target network"
        exit 0
        ;;
    testnet|mainnet)
        DEPLOY_NETWORK="$1"
        ;;
    "")
        # Use default network
        ;;
    *)
        echo -e "${RED}❌ Invalid network: $1${NC}"
        echo "Use: testnet, mainnet, or --help"
        exit 1
        ;;
esac

# Run main function
main "$@"