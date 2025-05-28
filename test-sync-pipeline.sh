#!/bin/bash

# Complete CLI ↔ API ↔ Frontend Sync Pipeline Test
# This script tests the real-time synchronization between all components

set -e

# Configuration
export TEST_WALLET="0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456"
export API_PORT=3001
export FRONTEND_PORT=3000
export TODOS_DIR="./test-todos"
export NODE_ENV="development"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if service is running
check_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            print_success "$name is ready"
            return 0
        fi
        sleep 1
        ((attempt++))
    done
    
    print_error "$name failed to start within $max_attempts seconds"
    return 1
}

# Function to wait for a process to start
wait_for_log() {
    local pid=$1
    local log_pattern=$2
    local timeout=30
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if jobs %$pid 2>/dev/null | grep -q "Running"; then
            sleep 1
            ((elapsed++))
        else
            print_error "Process $pid stopped unexpectedly"
            return 1
        fi
    done
    
    return 0
}

# Function to create test todo via CLI
create_cli_todo() {
    local title="$1"
    local description="$2"
    
    print_status "Creating todo via CLI: $title"
    
    # Ensure todos directory exists
    mkdir -p "$TODOS_DIR"
    
    # Create or update default.json
    local todo_file="$TODOS_DIR/default.json"
    local todo_id="cli-test-$(date +%s)"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    
    if [ ! -f "$todo_file" ]; then
        cat > "$todo_file" << EOF
{
  "todos": [],
  "metadata": {
    "wallet": "$TEST_WALLET",
    "lastModified": "$timestamp"
  }
}
EOF
    fi
    
    # Add new todo
    local new_todo=$(cat << EOF
{
  "id": "$todo_id",
  "title": "$title",
  "description": "$description",
  "completed": false,
  "createdAt": "$timestamp",
  "updatedAt": "$timestamp",
  "wallet": "$TEST_WALLET"
}
EOF
)
    
    # Use jq to add the todo
    if command -v jq > /dev/null; then
        echo "$new_todo" | jq -c . > /tmp/new_todo.json
        jq ".todos += [$(cat /tmp/new_todo.json)]" "$todo_file" > /tmp/updated_todos.json
        mv /tmp/updated_todos.json "$todo_file"
        rm -f /tmp/new_todo.json
        print_success "Created todo with ID: $todo_id"
        echo "$todo_id"
    else
        print_error "jq is required for this test"
        return 1
    fi
}

# Function to check if todo exists in API
check_api_todo() {
    local todo_id="$1"
    
    print_status "Checking if todo exists in API: $todo_id"
    
    local response=$(curl -s -H "X-Wallet-Address: $TEST_WALLET" \
        "http://localhost:$API_PORT/api/v1/todos" || echo "")
    
    if echo "$response" | grep -q "$todo_id"; then
        print_success "Todo found in API"
        return 0
    else
        print_warning "Todo not found in API"
        return 1
    fi
}

# Function to create todo via API
create_api_todo() {
    local title="$1"
    local description="$2"
    
    print_status "Creating todo via API: $title"
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-Wallet-Address: $TEST_WALLET" \
        -d "{\"title\":\"$title\",\"description\":\"$description\",\"completed\":false,\"wallet\":\"$TEST_WALLET\"}" \
        "http://localhost:$API_PORT/api/v1/todos" || echo "")
    
    if echo "$response" | grep -q '"success":true'; then
        local todo_id=$(echo "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        print_success "Created todo via API with ID: $todo_id"
        echo "$todo_id"
    else
        print_error "Failed to create todo via API"
        return 1
    fi
}

# Function to check if todo exists in CLI files
check_cli_todo() {
    local todo_id="$1"
    
    print_status "Checking if todo exists in CLI files: $todo_id"
    
    local todo_file="$TODOS_DIR/default.json"
    
    if [ -f "$todo_file" ] && grep -q "$todo_id" "$todo_file"; then
        print_success "Todo found in CLI files"
        return 0
    else
        print_warning "Todo not found in CLI files"
        return 1
    fi
}

# Function to run the test suite
run_tests() {
    local test_results=()
    
    print_status "Starting sync pipeline tests..."
    
    # Test 1: CLI → API sync
    print_status "Test 1: CLI → API sync"
    local cli_todo_id=$(create_cli_todo "CLI Test Todo" "Created via CLI file system")
    if [ $? -eq 0 ]; then
        sleep 10  # Wait for sync
        if check_api_todo "$cli_todo_id"; then
            test_results+=("✅ CLI → API sync: PASSED")
        else
            test_results+=("❌ CLI → API sync: FAILED")
        fi
    else
        test_results+=("❌ CLI → API sync: FAILED (creation failed)")
    fi
    
    # Test 2: API → CLI sync
    print_status "Test 2: API → CLI sync"
    local api_todo_id=$(create_api_todo "API Test Todo" "Created via API endpoint")
    if [ $? -eq 0 ]; then
        sleep 10  # Wait for sync
        if check_cli_todo "$api_todo_id"; then
            test_results+=("✅ API → CLI sync: PASSED")
        else
            test_results+=("❌ API → CLI sync: FAILED")
        fi
    else
        test_results+=("❌ API → CLI sync: FAILED (creation failed)")
    fi
    
    # Test 3: API health check
    print_status "Test 3: API health check"
    if curl -s -f "http://localhost:$API_PORT/healthz" > /dev/null; then
        test_results+=("✅ API health check: PASSED")
    else
        test_results+=("❌ API health check: FAILED")
    fi
    
    # Test 4: WebSocket connection
    print_status "Test 4: WebSocket connection"
    if curl -s -f "http://localhost:$API_PORT/api" | grep -q "WebSocket"; then
        test_results+=("✅ WebSocket endpoints: PASSED")
    else
        test_results+=("❌ WebSocket endpoints: FAILED")
    fi
    
    # Print results
    echo
    print_status "Test Results Summary"
    echo "=================================="
    for result in "${test_results[@]}"; do
        echo "$result"
    done
    echo
    
    # Count passed tests
    local passed=$(printf '%s\n' "${test_results[@]}" | grep -c "✅")
    local total=${#test_results[@]}
    
    if [ "$passed" -eq "$total" ]; then
        print_success "All tests passed! ($passed/$total)"
        return 0
    else
        print_warning "Some tests failed. ($passed/$total passed)"
        return 1
    fi
}

# Function to cleanup processes
cleanup() {
    print_status "Cleaning up..."
    
    # Kill background processes
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Clean up test files
    if [ -d "$TODOS_DIR" ]; then
        rm -rf "$TODOS_DIR"
        print_status "Cleaned up test todos directory"
    fi
    
    print_status "Cleanup complete"
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    echo "🚀 WalTodo Sync Pipeline Integration Test"
    echo "========================================"
    echo "Testing CLI ↔ API ↔ Frontend synchronization"
    echo
    
    # Check dependencies
    if ! command -v curl > /dev/null; then
        print_error "curl is required for this test"
        exit 1
    fi
    
    if ! command -v jq > /dev/null; then
        print_error "jq is required for this test"
        exit 1
    fi
    
    # Start API server
    print_status "Starting API server..."
    cd apps/api
    pnpm start --port=$API_PORT &
    local api_pid=$!
    cd ../..
    
    # Wait for API to be ready
    if ! check_service "http://localhost:$API_PORT/healthz" "API Server"; then
        print_error "Failed to start API server"
        exit 1
    fi
    
    # Start sync daemon
    print_status "Starting sync daemon..."
    cd apps/cli
    node dist/index.js daemon \
        --wallet "$TEST_WALLET" \
        --api-url "http://localhost:$API_PORT" \
        --todos-dir "$TODOS_DIR" \
        --sync-interval 5 &
    local daemon_pid=$!
    cd ../..
    
    # Wait for daemon to initialize
    sleep 5
    print_success "Sync daemon started"
    
    # Start frontend (optional, for manual testing)
    if [ "$1" = "--with-frontend" ]; then
        print_status "Starting frontend..."
        cd waltodo-frontend
        NEXT_PUBLIC_API_URL="http://localhost:$API_PORT/api" pnpm dev --port=$FRONTEND_PORT &
        local frontend_pid=$!
        cd ..
        
        if check_service "http://localhost:$FRONTEND_PORT" "Frontend"; then
            print_success "Frontend available at http://localhost:$FRONTEND_PORT/realtime-demo"
        fi
    fi
    
    # Run the actual tests
    if run_tests; then
        print_success "🎉 All sync pipeline tests passed!"
        
        if [ "$1" = "--with-frontend" ]; then
            echo
            print_status "🌐 Frontend is running at: http://localhost:$FRONTEND_PORT/realtime-demo"
            print_status "📡 API documentation at: http://localhost:$API_PORT/api"
            print_status "Press Ctrl+C to stop all services"
            
            # Keep running for manual testing
            wait
        fi
        
        exit 0
    else
        print_error "Some tests failed. Check the output above for details."
        exit 1
    fi
}

# Run main function with arguments
main "$@"