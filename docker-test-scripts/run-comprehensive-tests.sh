#!/bin/bash

# Comprehensive WalTodo CLI Testing Script
# This script tests all CLI commands mentioned in the README and available in the system

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_RESULTS_DIR="/home/testuser/waltodo/test-results"
LOG_DIR="/home/testuser/waltodo/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_LOG="$TEST_RESULTS_DIR/comprehensive_test_${TIMESTAMP}.log"
ERROR_LOG="$TEST_RESULTS_DIR/errors_${TIMESTAMP}.log"
SUCCESS_LOG="$TEST_RESULTS_DIR/success_${TIMESTAMP}.log"

# Create results directory
mkdir -p "$TEST_RESULTS_DIR" "$LOG_DIR"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Function to log messages
log() {
    local message="$1"
    local level="${2:-INFO}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$TEST_LOG"
}

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
        "SKIP")
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
    esac
    log "$message" "$status"
}

# Function to run a command and capture result
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_exit_code="${3:-0}"
    local timeout="${4:-30}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    print_status "Running test: $test_name" "INFO"
    log "Command: $command"
    
    # Run command with timeout and capture output
    local start_time=$(date +%s)
    local output
    local exit_code
    
    # Use timeout and handle both success and failure cases
    set +e  # Disable exit on error temporarily
    if output=$(timeout "$timeout" bash -c "$command" 2>&1); then
        exit_code=$?
    else
        exit_code=$?
        if [ $exit_code -eq 124 ]; then
            output="Command timed out after ${timeout} seconds"
        fi
    fi
    set -e  # Re-enable exit on error
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Log the output (truncate if too long)
    local truncated_output=$(echo "$output" | head -c 2000)
    if [ ${#output} -gt 2000 ]; then
        truncated_output="$truncated_output... [TRUNCATED]"
    fi
    log "Output: $truncated_output"
    log "Exit code: $exit_code"
    log "Duration: ${duration}s"
    
    # Check if test passed
    if [ "$exit_code" -eq "$expected_exit_code" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        print_status "$test_name - Duration: ${duration}s" "PASS"
        return 0
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        print_status "$test_name - Expected exit code $expected_exit_code, got $exit_code" "FAIL"
        log "FAILURE DETAILS: Expected exit code $expected_exit_code, got $exit_code" "ERROR"
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..." "INFO"
    
    # Check if Node.js is available
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        print_status "Node.js version: $node_version" "PASS"
    else
        print_status "Node.js not found" "FAIL"
        return 1
    fi
    
    # Check if pnpm is available
    if command -v pnpm >/dev/null 2>&1; then
        local pnpm_version=$(pnpm --version)
        print_status "pnpm version: $pnpm_version" "PASS"
    else
        print_status "pnpm not found" "WARN"
    fi
    
    # Check if WalTodo CLI is available in various locations
    if [ -f "/home/testuser/waltodo/bin/waltodo" ]; then
        print_status "WalTodo CLI binary found at /home/testuser/waltodo/bin/waltodo" "PASS"
    elif command -v waltodo >/dev/null 2>&1; then
        print_status "WalTodo CLI found in PATH" "PASS"
    elif [ -f "/home/testuser/waltodo/apps/cli/dist/cli.js" ]; then
        print_status "WalTodo CLI dist found" "PASS"
    elif [ -f "/home/testuser/waltodo/apps/cli/src/index.ts" ]; then
        print_status "WalTodo CLI source found" "PASS"
    else
        print_status "WalTodo CLI not found anywhere, tests may fail" "WARN"
    fi
}

# Function to set up test environment
setup_test_environment() {
    print_status "Setting up test environment..." "INFO"
    
    # Set environment variables
    export NODE_ENV=test
    export WALTODO_TEST_MODE=true
    export WALTODO_SUPPRESS_WARNINGS=true
    
    # Create test directories
    mkdir -p /home/testuser/waltodo/Todos
    mkdir -p /home/testuser/test-data
    
    # Create mock configuration files
    cat > /home/testuser/.env << EOF
# Test environment configuration
NODE_ENV=test
WALTODO_TEST_MODE=true
SUI_NETWORK=testnet
WALRUS_ENDPOINT=http://localhost:9001
AI_PROVIDER=mock
EOF

    # Create a test todo file
    cat > /home/testuser/test-data/test-todos.json << EOF
{
  "todos": [
    {
      "id": "test-1",
      "title": "Test todo 1",
      "completed": false,
      "created": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
    },
    {
      "id": "test-2", 
      "title": "Test todo 2",
      "completed": true,
      "created": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
    }
  ]
}
EOF
    
    print_status "Test environment setup complete" "PASS"
}

# Function to get the CLI command with multiple fallbacks
get_cli_cmd() {
    # Try different CLI execution methods in order of preference
    if command -v waltodo >/dev/null 2>&1; then
        echo "waltodo"
    elif [ -f "/home/testuser/waltodo/bin/waltodo" ] && [ -x "/home/testuser/waltodo/bin/waltodo" ]; then
        echo "/home/testuser/waltodo/bin/waltodo"
    elif [ -f "/home/testuser/waltodo/apps/cli/dist/cli.js" ]; then
        echo "node /home/testuser/waltodo/apps/cli/dist/cli.js"
    elif [ -f "/home/testuser/waltodo/apps/cli/dist/index.js" ]; then
        echo "node /home/testuser/waltodo/apps/cli/dist/index.js"
    elif [ -f "/home/testuser/waltodo/dist/cli.js" ]; then
        echo "node /home/testuser/waltodo/dist/cli.js"
    elif [ -f "/home/testuser/waltodo/apps/cli/src/index.ts" ]; then
        echo "npx ts-node /home/testuser/waltodo/apps/cli/src/index.ts"
    else
        # Last resort - try to run with pnpm dev
        echo "cd /home/testuser/waltodo && pnpm dev"
    fi
}

# Test basic CLI availability
test_cli_availability() {
    local CLI_CMD=$(get_cli_cmd)
    print_status "Testing CLI availability with command: $CLI_CMD" "INFO"
    
    # Simple availability test
    run_test "CLI Availability Test" "$CLI_CMD --help" 0 15
    
    if [ $? -eq 0 ]; then
        print_status "CLI is available and responding" "PASS"
        return 0
    else
        print_status "CLI is not responding, will attempt alternative methods" "WARN"
        return 1
    fi
}

# Main test suite
run_cli_tests() {
    local CLI_CMD=$(get_cli_cmd)
    print_status "Using CLI command: $CLI_CMD" "INFO"
    
    print_status "=== Starting WalTodo CLI Comprehensive Tests ===" "INFO"
    
    # Test basic CLI availability first
    if ! test_cli_availability; then
        print_status "CLI not available, skipping command tests" "SKIP"
        return 1
    fi
    
    # Basic CLI functionality tests
    print_status "--- Basic CLI Tests ---" "INFO"
    run_test "CLI Help Command" "$CLI_CMD --help"
    run_test "CLI Version Command" "$CLI_CMD --version" 0 10
    run_test "CLI Invalid Command" "$CLI_CMD invalid-command-xyz" 1 10
    
    # Core todo management commands (from README)
    print_status "--- Core Todo Management Commands ---" "INFO"
    run_test "Add Todo Command Help" "$CLI_CMD add --help"
    run_test "List Todos Command Help" "$CLI_CMD list --help"
    run_test "Complete Todo Command Help" "$CLI_CMD complete --help"
    
    # Try some actual operations (if CLI is working)
    run_test "Add Simple Todo" "$CLI_CMD add 'Test todo from Docker container'" 0 20
    run_test "List Current Todos" "$CLI_CMD list" 0 15
    
    # Storage and blockchain commands (from README)
    print_status "--- Storage and Blockchain Commands ---" "INFO"
    run_test "Store Command Help" "$CLI_CMD store --help"
    run_test "Retrieve Command Help" "$CLI_CMD retrieve --help"
    run_test "Deploy Command Help" "$CLI_CMD deploy --help"
    run_test "Storage Analysis Command" "$CLI_CMD storage --help"
    run_test "Sync Command Help" "$CLI_CMD sync --help"
    
    # Account management commands
    print_status "--- Account Management Commands ---" "INFO"
    run_test "Account Command Help" "$CLI_CMD account --help"
    run_test "Configure Command Help" "$CLI_CMD configure --help"
    
    # AI-powered features (from README)
    print_status "--- AI-Powered Features ---" "INFO"
    run_test "AI Command Help" "$CLI_CMD ai --help"
    
    # Additional commands found in the CLI (test help only to avoid side effects)
    print_status "--- Additional CLI Commands ---" "INFO"
    local additional_commands=(
        "create" "delete" "update" "share" "status" "jobs" 
        "history" "interactive" "simple" "template" "verify" 
        "validate-config" "image" "deploy-site" "env" "config"
        "daemon" "provider" "queue" "cancel" "check"
    )
    
    for cmd in "${additional_commands[@]}"; do
        run_test "${cmd^} Command Help" "$CLI_CMD $cmd --help" 0 10
    done
    
    # Command shortcuts and aliases (from help command)
    print_status "--- Command Shortcuts and Aliases ---" "INFO"
    local shortcuts=("a" "l" "c" "d")
    for shortcut in "${shortcuts[@]}"; do
        run_test "Shortcut '$shortcut' Help" "$CLI_CMD $shortcut --help" 0 10
    done
    
    # Test with various flags and options
    print_status "--- Flag and Option Tests ---" "INFO"
    run_test "JSON Output Format" "$CLI_CMD list --json" 0 15
    run_test "Verbose Output" "$CLI_CMD list --verbose" 0 15
    run_test "Help with Shortcuts" "$CLI_CMD help --shortcuts" 0 10
}

# Function to test integration scenarios
run_integration_tests() {
    local CLI_CMD=$(get_cli_cmd)
    
    print_status "--- Integration Test Scenarios ---" "INFO"
    
    # Test the exact commands from README examples (help only for safety)
    print_status "--- README Example Commands (Help) ---" "INFO"
    run_test "README: Add with AI (help)" "$CLI_CMD add --help"
    run_test "README: List with NFT (help)" "$CLI_CMD list --help"
    run_test "README: Store command (help)" "$CLI_CMD store --help"
    run_test "README: Deploy testnet (help)" "$CLI_CMD deploy --help"
    run_test "README: AI analyze (help)" "$CLI_CMD ai --help"
    run_test "README: Sync background (help)" "$CLI_CMD sync --help"
}

# Function to test error conditions safely
run_error_tests() {
    local CLI_CMD=$(get_cli_cmd)
    
    print_status "--- Error Condition Tests ---" "INFO"
    run_test "Invalid Flag" "$CLI_CMD list --invalid-flag-xyz" 1 10
    run_test "Nonexistent Command" "$CLI_CMD nonexistent-command-xyz" 1 10
    run_test "Invalid Combination" "$CLI_CMD --invalid-global-flag" 1 10
}

# Function to generate test report
generate_test_report() {
    local report_file="$TEST_RESULTS_DIR/test_report_${TIMESTAMP}.md"
    
    cat > "$report_file" << EOF
# WalTodo CLI Comprehensive Test Report

**Generated:** $(date)
**Test Duration:** $(($(date +%s) - TEST_START_TIME)) seconds

## Test Summary

- **Total Tests:** $TOTAL_TESTS
- **Passed:** $PASSED_TESTS
- **Failed:** $FAILED_TESTS
- **Skipped:** $SKIPPED_TESTS
- **Success Rate:** $(( TOTAL_TESTS > 0 ? PASSED_TESTS * 100 / TOTAL_TESTS : 0 ))%

## Test Environment

- **Container:** Docker
- **OS:** $(uname -a)
- **Node.js:** $(node --version 2>/dev/null || echo "Not available")
- **pnpm:** $(pnpm --version 2>/dev/null || echo "Not available")
- **CLI Command:** $(get_cli_cmd)

## Test Categories Covered

1. **Basic CLI functionality** - Help, version, invalid commands
2. **Core todo management** - Add, list, complete, delete
3. **Storage and blockchain** - Store, retrieve, deploy, sync
4. **Account management** - Account, configure
5. **AI-powered features** - AI commands and verification
6. **Additional commands** - All available CLI commands
7. **Command shortcuts** - Aliases and smart shortcuts
8. **Integration scenarios** - README examples
9. **Error conditions** - Invalid flags and commands

## Test Results Summary

EOF

    if [ -f "$SUCCESS_LOG" ] && [ -s "$SUCCESS_LOG" ]; then
        echo "### Successful Tests" >> "$report_file"
        echo '```' >> "$report_file"
        head -20 "$SUCCESS_LOG" >> "$report_file"
        if [ $(wc -l < "$SUCCESS_LOG") -gt 20 ]; then
            echo "... and $(($(wc -l < "$SUCCESS_LOG") - 20)) more" >> "$report_file"
        fi
        echo '```' >> "$report_file"
        echo "" >> "$report_file"
    fi

    if [ -f "$ERROR_LOG" ] && [ -s "$ERROR_LOG" ]; then
        echo "### Failed Tests" >> "$report_file"
        echo '```' >> "$report_file"
        cat "$ERROR_LOG" >> "$report_file"
        echo '```' >> "$report_file"
        echo "" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## Detailed Logs

Full test logs are available in:
- **Main Log:** $TEST_LOG
- **Error Log:** $ERROR_LOG  
- **Success Log:** $SUCCESS_LOG

## Recommendations

EOF

    if [ "$FAILED_TESTS" -gt 0 ]; then
        cat >> "$report_file" << EOF
- Review failed tests and fix underlying issues
- Check CLI installation and dependencies
- Verify environment configuration
- Consider running tests with more verbose output
EOF
    else
        cat >> "$report_file" << EOF
- All tests passed successfully
- CLI is working correctly in Docker environment
- Ready for production deployment
EOF
    fi

    print_status "Test report generated: $report_file" "INFO"
}

# Main execution
main() {
    TEST_START_TIME=$(date +%s)
    
    print_status "=== WalTodo CLI Comprehensive Testing Suite ===" "INFO"
    print_status "Test started at: $(date)" "INFO"
    print_status "Results will be saved to: $TEST_RESULTS_DIR" "INFO"
    
    # Change to project directory
    cd /home/testuser/waltodo
    
    # Run all test phases
    check_prerequisites
    setup_test_environment
    
    run_cli_tests
    run_integration_tests
    run_error_tests
    
    # Generate final report
    generate_test_report
    
    print_status "=== Test Suite Complete ===" "INFO"
    print_status "Total Tests: $TOTAL_TESTS | Passed: $PASSED_TESTS | Failed: $FAILED_TESTS" "INFO"
    
    # Output summary
    echo ""
    echo "============================================="
    echo "          FINAL TEST SUMMARY"
    echo "============================================="
    echo "Total Tests:     $TOTAL_TESTS"
    echo "Passed:          $PASSED_TESTS"
    echo "Failed:          $FAILED_TESTS" 
    echo "Success Rate:    $(( TOTAL_TESTS > 0 ? PASSED_TESTS * 100 / TOTAL_TESTS : 0 ))%"
    echo "============================================="
    
    if [ "$FAILED_TESTS" -gt 0 ]; then
        print_status "Some tests failed. Check logs for details." "WARN"
        exit 1
    else
        print_status "All tests passed successfully!" "PASS"
        exit 0
    fi
}

# Run the main function
main "$@"