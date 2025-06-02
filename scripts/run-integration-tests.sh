#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 WalTodo Integration Test Runner${NC}\n"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    exit 1
fi

# Parse command line arguments
TEST_SUITE="all"
COVERAGE=false
WATCH=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --suite)
            TEST_SUITE="$2"
            shift 2
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --suite <name>    Run specific test suite (all, api, cli, websocket, sync)"
            echo "  --coverage        Generate coverage report"
            echo "  --watch          Run in watch mode"
            echo "  --verbose        Enable verbose output"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    if check_port $1; then
        echo -e "${YELLOW}⚠️  Port $1 is in use. Attempting to free it...${NC}"
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Setup environment
echo -e "${BLUE}📋 Setting up test environment...${NC}"

# Create necessary directories
mkdir -p Todos logs .waltodo-cache test-artifacts
mkdir -p .waltodo-cache/{ai-responses,background-retrievals,blockchain,config}

# Clean up any existing test data
rm -f Todos/todos.json
rm -f logs/test.log
rm -rf test-artifacts/*

# Kill any processes using test ports
echo -e "${BLUE}🔍 Checking for port conflicts...${NC}"
for port in 3001 3002 3003 3004 3005; do
    kill_port $port
done

# Set environment variables
export NODE_ENV=test
export LOG_LEVEL=error
export API_KEY=test-integration-key
export JWT_SECRET=test-jwt-secret
export ENABLE_WEBSOCKET=true
export ENABLE_AUTH=false
export RATE_LIMIT_MAX=0

if [ "$VERBOSE" = true ]; then
    export LOG_LEVEL=debug
fi

# Build projects
echo -e "${BLUE}🔨 Building projects...${NC}"
if ! pnpm build:dev; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Install CLI globally
echo -e "${BLUE}📦 Installing CLI...${NC}"
if ! pnpm run global-install; then
    echo -e "${YELLOW}⚠️  CLI installation failed, continuing anyway${NC}"
fi

# Determine which tests to run
case $TEST_SUITE in
    all)
        TEST_PATTERN=""
        ;;
    api)
        TEST_PATTERN="tests/integration/cli-frontend-integration.test.ts"
        ;;
    cli)
        TEST_PATTERN="tests/e2e/todo-lifecycle.e2e.test.ts"
        ;;
    websocket)
        TEST_PATTERN="tests/e2e/websocket-realtime.e2e.test.ts"
        ;;
    sync)
        TEST_PATTERN="tests/e2e/api-cli-sync.e2e.test.ts"
        ;;
    *)
        echo -e "${RED}❌ Unknown test suite: $TEST_SUITE${NC}"
        exit 1
        ;;
esac

# Build Jest command
JEST_CMD="npx jest --config=jest.integration.config.js --no-typecheck --forceExit"

if [ -n "$TEST_PATTERN" ]; then
    JEST_CMD="$JEST_CMD $TEST_PATTERN"
fi

if [ "$COVERAGE" = true ]; then
    JEST_CMD="$JEST_CMD --coverage"
fi

if [ "$WATCH" = true ]; then
    JEST_CMD="$JEST_CMD --watch"
fi

if [ "$VERBOSE" = true ]; then
    JEST_CMD="$JEST_CMD --verbose"
fi

# Run tests
echo -e "\n${BLUE}🧪 Running integration tests...${NC}"
echo -e "${YELLOW}Command: NODE_OPTIONS='--max-old-space-size=3072' $JEST_CMD${NC}\n"

if NODE_OPTIONS='--max-old-space-size=3072' $JEST_CMD; then
    echo -e "\n${GREEN}✅ Integration tests passed!${NC}"
    
    # Show coverage summary if enabled
    if [ "$COVERAGE" = true ] && [ -f "coverage/integration/lcov-report/index.html" ]; then
        echo -e "${BLUE}📊 Coverage report generated at: coverage/integration/lcov-report/index.html${NC}"
    fi
else
    echo -e "\n${RED}❌ Integration tests failed${NC}"
    exit 1
fi

# Cleanup
echo -e "\n${BLUE}🧹 Cleaning up...${NC}"
rm -f Todos/todos.json
rm -f logs/test.log

# Kill any leftover processes
for port in 3001 3002 3003 3004 3005; do
    kill_port $port 2>/dev/null || true
done

echo -e "\n${GREEN}✨ Done!${NC}"