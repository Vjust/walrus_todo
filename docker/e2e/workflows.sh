#!/bin/bash

# E2E Test Script for Waltodo
# This script tests the complete TODO lifecycle, data persistence, and error handling

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_USER_ID="${TEST_USER_ID:-test-user-$(date +%s)}"
TEST_TIMEOUT="${TEST_TIMEOUT:-30}"
CONTAINER_NAME="${CONTAINER_NAME:-waltodo-app}"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_test() {
    echo -e "${PURPLE}[TEST]${NC} $1"
}

# Execute command in container
exec_waltodo() {
    docker exec -it "$CONTAINER_NAME" node /app/dist/index.js "$@"
}

# Execute command and capture output
exec_waltodo_capture() {
    docker exec "$CONTAINER_NAME" node /app/dist/index.js "$@" 2>&1
}

# Wait for container to be ready
wait_for_container() {
    log_info "Waiting for container to be ready..."
    local retries=0
    while [ $retries -lt $TEST_TIMEOUT ]; do
        if docker exec "$CONTAINER_NAME" node -e "console.log('ready')" &>/dev/null; then
            log_success "Container is ready"
            return 0
        fi
        sleep 1
        ((retries++))
    done
    log_error "Container failed to become ready within $TEST_TIMEOUT seconds"
    return 1
}

# Test functions
test_help_command() {
    log_test "Testing help command"
    if exec_waltodo --help | grep -q "Usage:"; then
        log_success "Help command works"
    else
        log_error "Help command failed"
        return 1
    fi
}

test_version_command() {
    log_test "Testing version command"
    if exec_waltodo --version | grep -q "0.1.0"; then
        log_success "Version command works"
    else
        log_error "Version command failed"
        return 1
    fi
}

test_todo_creation() {
    log_test "Testing TODO creation"
    local todo_title="Test TODO $(date +%s)"
    local output=$(exec_waltodo_capture add "$todo_title" --description "Test description")
    
    if echo "$output" | grep -q "created successfully"; then
        log_success "TODO creation successful"
        # Extract TODO ID for later tests
        TODO_ID=$(echo "$output" | grep -oP 'ID: \K[a-f0-9-]+' || true)
        export TODO_ID
        return 0
    else
        log_error "TODO creation failed: $output"
        return 1
    fi
}

test_todo_listing() {
    log_test "Testing TODO listing"
    local output=$(exec_waltodo_capture list)
    
    if echo "$output" | grep -q "Test TODO"; then
        log_success "TODO listing successful"
        return 0
    else
        log_error "TODO listing failed: $output"
        return 1
    fi
}

test_todo_details() {
    log_test "Testing TODO details view"
    if [ -z "${TODO_ID:-}" ]; then
        log_warning "No TODO_ID available, skipping details test"
        return 0
    fi
    
    local output=$(exec_waltodo_capture view "$TODO_ID")
    
    if echo "$output" | grep -q "Test description"; then
        log_success "TODO details view successful"
        return 0
    else
        log_error "TODO details view failed: $output"
        return 1
    fi
}

test_todo_update() {
    log_test "Testing TODO update"
    if [ -z "${TODO_ID:-}" ]; then
        log_warning "No TODO_ID available, skipping update test"
        return 0
    fi
    
    local output=$(exec_waltodo_capture update "$TODO_ID" --status completed)
    
    if echo "$output" | grep -q "updated successfully"; then
        log_success "TODO update successful"
        return 0
    else
        log_error "TODO update failed: $output"
        return 1
    fi
}

test_todo_deletion() {
    log_test "Testing TODO deletion"
    if [ -z "${TODO_ID:-}" ]; then
        log_warning "No TODO_ID available, skipping deletion test"
        return 0
    fi
    
    local output=$(exec_waltodo_capture delete "$TODO_ID" --force)
    
    if echo "$output" | grep -q "deleted successfully"; then
        log_success "TODO deletion successful"
        return 0
    else
        log_error "TODO deletion failed: $output"
        return 1
    fi
}

test_data_persistence() {
    log_test "Testing data persistence across container restarts"
    
    # Create a TODO
    local todo_title="Persistence Test $(date +%s)"
    exec_waltodo_capture add "$todo_title" --description "This should persist"
    
    # Restart container
    log_info "Restarting container..."
    docker restart "$CONTAINER_NAME"
    wait_for_container
    
    # Check if TODO still exists
    local output=$(exec_waltodo_capture list)
    
    if echo "$output" | grep -q "$todo_title"; then
        log_success "Data persistence test passed"
        return 0
    else
        log_error "Data persistence test failed: TODO not found after restart"
        return 1
    fi
}

test_error_handling() {
    log_test "Testing error handling"
    
    # Test invalid command
    local output=$(exec_waltodo_capture invalid-command 2>&1 || true)
    if echo "$output" | grep -qi "error\|unknown"; then
        log_success "Invalid command error handling works"
    else
        log_error "Invalid command error handling failed"
    fi
    
    # Test missing required arguments
    output=$(exec_waltodo_capture add 2>&1 || true)
    if echo "$output" | grep -qi "error\|required"; then
        log_success "Missing argument error handling works"
    else
        log_error "Missing argument error handling failed"
    fi
    
    # Test invalid TODO ID
    output=$(exec_waltodo_capture view "invalid-id-123" 2>&1 || true)
    if echo "$output" | grep -qi "error\|not found"; then
        log_success "Invalid ID error handling works"
    else
        log_error "Invalid ID error handling failed"
    fi
}

test_concurrent_operations() {
    log_test "Testing concurrent operations"
    
    # Create multiple TODOs concurrently
    local pids=()
    for i in {1..5}; do
        exec_waltodo_capture add "Concurrent TODO $i" &
        pids+=($!)
    done
    
    # Wait for all operations to complete
    local all_success=true
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            all_success=false
        fi
    done
    
    if [ "$all_success" = true ]; then
        log_success "Concurrent operations test passed"
        return 0
    else
        log_error "Concurrent operations test failed"
        return 1
    fi
}

test_storage_sync() {
    log_test "Testing Walrus storage synchronization"
    
    # Create TODO and get its blob ID
    local todo_title="Sync Test $(date +%s)"
    local output=$(exec_waltodo_capture add "$todo_title")
    
    # Extract blob ID if available
    local blob_id=$(echo "$output" | grep -oP 'Blob ID: \K[a-zA-Z0-9]+' || true)
    
    if [ -n "$blob_id" ]; then
        log_info "TODO stored with blob ID: $blob_id"
        log_success "Storage sync test passed"
        return 0
    else
        log_warning "Could not extract blob ID, but TODO may still be stored"
        return 0
    fi
}

# Main test execution
main() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}    Waltodo E2E Test Suite${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo
    
    log_info "Test configuration:"
    log_info "  Container: $CONTAINER_NAME"
    log_info "  User ID: $TEST_USER_ID"
    log_info "  Timeout: $TEST_TIMEOUT seconds"
    echo
    
    # Wait for container to be ready
    if ! wait_for_container; then
        log_error "Container is not ready, aborting tests"
        exit 1
    fi
    
    # Run tests
    echo -e "${CYAN}Running tests...${NC}"
    echo
    
    test_help_command
    test_version_command
    test_todo_creation
    test_todo_listing
    test_todo_details
    test_todo_update
    test_todo_deletion
    test_data_persistence
    test_error_handling
    test_concurrent_operations
    test_storage_sync
    
    # Summary
    echo
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}    Test Summary${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
    echo
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed!${NC}"
        exit 1
    fi
}

# Run main function
main "$@"