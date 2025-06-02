#!/bin/bash

# Production deployment script for WalTodo Frontend
# This script prepares and deploys the application to production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_BRANCH="main"
DEPLOY_ENV="production"

echo -e "${GREEN}🚀 WalTodo Frontend Production Deployment${NC}"
echo "======================================"

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
    
    # Check git status
    if [[ -n $(git status -s) ]]; then
        echo -e "${RED}❌ Working directory is not clean. Commit or stash changes.${NC}"
        exit 1
    fi
    
    # Check current branch
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "$DEPLOY_BRANCH" ]; then
        echo -e "${YELLOW}⚠️  Not on $DEPLOY_BRANCH branch. Current: $CURRENT_BRANCH${NC}"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

# Run tests
run_tests() {
    echo -e "\n${YELLOW}Running tests...${NC}"
    
    # Run unit tests
    pnpm test || {
        echo -e "${RED}❌ Tests failed${NC}"
        exit 1
    }
    
    # Run linting
    pnpm lint || {
        echo -e "${RED}❌ Linting failed${NC}"
        exit 1
    }
    
    echo -e "${GREEN}✓ All tests passed${NC}"
}

# Build application
build_application() {
    echo -e "\n${YELLOW}Building application...${NC}"
    
    # Clean previous builds
    rm -rf .next
    
    # Set production environment
    export NODE_ENV=production
    
    # Run production build
    pnpm run build:production || {
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    }
    
    echo -e "${GREEN}✓ Build completed successfully${NC}"
}

# Run performance tests
run_performance_tests() {
    echo -e "\n${YELLOW}Running performance tests...${NC}"
    
    # Start production server in background
    pnpm start &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 10
    
    # Run Lighthouse tests
    pnpm run test:lighthouse || {
        echo -e "${YELLOW}⚠️  Performance tests failed (non-critical)${NC}"
    }
    
    # Kill server
    kill $SERVER_PID 2>/dev/null || true
    
    echo -e "${GREEN}✓ Performance tests completed${NC}"
}

# Deploy to hosting provider
deploy_to_provider() {
    echo -e "\n${YELLOW}Deploying to hosting provider...${NC}"
    
    # Check deployment method
    if [ -f "vercel.json" ] && command -v vercel &> /dev/null; then
        echo "Deploying to Vercel..."
        vercel --prod || {
            echo -e "${RED}❌ Vercel deployment failed${NC}"
            exit 1
        }
    elif [ -f "netlify.toml" ] && command -v netlify &> /dev/null; then
        echo "Deploying to Netlify..."
        netlify deploy --prod || {
            echo -e "${RED}❌ Netlify deployment failed${NC}"
            exit 1
        }
    else
        echo -e "${YELLOW}⚠️  No deployment provider configured${NC}"
        echo "Build artifacts are ready in .next directory"
    fi
}

# Post-deployment tasks
post_deployment() {
    echo -e "\n${YELLOW}Running post-deployment tasks...${NC}"
    
    # Tag the deployment
    VERSION=$(node -p "require('./package.json').version")
    git tag -a "frontend-v${VERSION}" -m "Frontend deployment v${VERSION}"
    
    # Generate deployment report
    cat > deployment-report.json << EOF
{
  "version": "${VERSION}",
  "environment": "${DEPLOY_ENV}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "commit": "$(git rev-parse HEAD)",
  "branch": "$(git branch --show-current)",
  "node_version": "$(node -v)",
  "pnpm_version": "$(pnpm -v)"
}
EOF
    
    echo -e "${GREEN}✓ Post-deployment tasks completed${NC}"
}

# Main deployment flow
main() {
    check_prerequisites
    run_tests
    build_application
    run_performance_tests
    deploy_to_provider
    post_deployment
    
    echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Verify the deployment at your production URL"
    echo "2. Test all critical user flows"
    echo "3. Monitor error logs and performance metrics"
    echo "4. Update status page if applicable"
}

# Run main function
main "$@"