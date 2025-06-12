#!/bin/bash

# Local WalTodo CLI Testing Script
# This script tests CLI commands locally without Docker

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test configuration
TEST_RESULTS_DIR="./test-results-local"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_LOG="$TEST_RESULTS_DIR/local_test_${TIMESTAMP}.log"
ERROR_LOG="$TEST_RESULTS_DIR/errors_${TIMESTAMP}.log"
SUCCESS_LOG="$TEST_RESULTS_DIR/success_${TIMESTAMP}.log"

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print colored output
print_status() {
    local message="$1"
    local status="$2"
    case "$status" in
        "PASS")
            echo -e "${GREEN}✓${NC} $message"
            echo "PASS: $message" >> "$SUCCESS_LOG"
            ;;
        "FAIL")
            echo -e "${RED}✗${NC} $message"
            echo "FAIL: $message" >> "$ERROR_LOG"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
    esac
    echo "[$TIMESTAMP] [$status] $message" >> "$TEST_LOG"
}

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_exit_code="${3:-0}"
    local timeout="${4:-30}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    print_status "Testing: $test_name" "INFO"
    echo "Command: $command" >> "$TEST_LOG"
    
    local start_time=$(date +%s)
    local output
    local exit_code
    
    set +e
    if output=$(timeout "$timeout" bash -c "$command" 2>&1); then
        exit_code=$?
    else
        exit_code=$?
    fi
    set -e
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Log truncated output
    local truncated_output=$(echo "$output" | head -c 1000)
    echo "Output: $truncated_output" >> "$TEST_LOG"
    echo "Exit code: $exit_code, Duration: ${duration}s" >> "$TEST_LOG"
    
    if [ "$exit_code" -eq "$expected_exit_code" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        print_status "$test_name (${duration}s)" "PASS"
        return 0
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        print_status "$test_name - Expected $expected_exit_code, got $exit_code" "FAIL"
        return 1
    fi
}

# Function to get CLI command
get_cli_cmd() {
    if command -v waltodo >/dev/null 2>&1; then
        echo "waltodo"
    elif [ -f "./bin/waltodo" ] && [ -x "./bin/waltodo" ]; then
        echo "./bin/waltodo"
    elif [ -f "./apps/cli/dist/cli.js" ]; then
        echo "node ./apps/cli/dist/cli.js"
    else
        echo "npx ts-node ./apps/cli/src/index.ts"
    fi
}

# Main test execution
main() {
    TEST_START_TIME=$(date +%s)
    
    print_status "=== WalTodo CLI Local Test Suite ===" "INFO"
    print_status "Started at: $(date)" "INFO"
    
    # Check prerequisites
    print_status "Checking prerequisites..." "INFO"
    
    if command -v node >/dev/null 2>&1; then
        print_status "Node.js: $(node --version)" "PASS"
    else
        print_status "Node.js not found" "FAIL"
        exit 1
    fi
    
    CLI_CMD=$(get_cli_cmd)
    print_status "Using CLI: $CLI_CMD" "INFO"
    
    # Core functionality tests
    print_status "--- Basic CLI Tests ---" "INFO"
    run_test "CLI Help" "$CLI_CMD --help" 0 15
    run_test "CLI Version" "$CLI_CMD --version" 0 10
    run_test "Invalid Command" "$CLI_CMD invalid-xyz-command" 1 10
    
    # Command help tests (safe, no side effects)
    print_status "--- Command Help Tests ---" "INFO"
    
    local commands=(
        "add" "list" "complete" "delete" "update"
        "store" "retrieve" "deploy" "sync" "storage"
        "account" "configure" "ai" "create" "share"
        "status" "jobs" "history" "interactive" "simple"
        "template" "verify" "validate-config" "image"
        "env" "config" "daemon" "provider" "queue"
        "cancel" "check"
    )
    
    for cmd in "${commands[@]}"; do
        run_test "$cmd Help" "$CLI_CMD $cmd --help" 0 10
    done
    
    # Shortcut tests
    print_status "--- Shortcut Tests ---" "INFO"
    local shortcuts=("a" "l" "c" "d")
    for shortcut in "${shortcuts[@]}"; do
        run_test "Shortcut '$shortcut'" "$CLI_CMD $shortcut --help" 0 10
    done
    
    # Flag tests
    print_status "--- Flag Tests ---" "INFO"
    run_test "Help Shortcuts" "$CLI_CMD help --shortcuts" 0 10
    run_test "List JSON" "$CLI_CMD list --json" 0 15
    run_test "List Verbose" "$CLI_CMD list --verbose" 0 15
    
    # Error condition tests
    print_status "--- Error Tests ---" "INFO"
    run_test "Invalid Flag" "$CLI_CMD list --invalid-flag-test" 1 10
    run_test "Invalid Global Flag" "$CLI_CMD --invalid-global" 1 10
    
    # Generate summary
    local end_time=$(date +%s)
    local total_duration=$((end_time - TEST_START_TIME))
    
    print_status "=== Test Summary ===" "INFO"
    echo ""
    echo "============================================="
    echo "          LOCAL TEST RESULTS"
    echo "============================================="
    echo "Total Tests:     $TOTAL_TESTS"
    echo "Passed:          $PASSED_TESTS"
    echo "Failed:          $FAILED_TESTS"
    echo "Success Rate:    $(( TOTAL_TESTS > 0 ? PASSED_TESTS * 100 / TOTAL_TESTS : 0 ))%"
    echo "Duration:        ${total_duration}s"
    echo "CLI Command:     $CLI_CMD"
    echo "============================================="
    echo ""
    echo "Logs saved to:"
    echo "  Main Log:      $TEST_LOG"
    echo "  Success Log:   $SUCCESS_LOG"
    echo "  Error Log:     $ERROR_LOG"
    echo ""
    
    if [ "$FAILED_TESTS" -gt 0 ]; then
        echo "Some tests failed. Check error log for details:"
        cat "$ERROR_LOG"
        exit 1
    else
        echo "All tests passed!"
        exit 0
    fi
}

main "$@"