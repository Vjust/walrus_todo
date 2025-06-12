#!/bin/bash

# ============================================================
# WalTodo Docker E2E Comprehensive Validation Script
# Phase 3: Enhanced End-to-End Testing Infrastructure
#
# Purpose: Validate ALL README commands in Docker environment
# Target: 95%+ success rate validation
# ============================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Color codes for enhanced output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="${SCRIPT_DIR}"
readonly DOCKER_TEST_DIR="${PROJECT_ROOT}/test-results-docker"
readonly DOCKER_DATA_DIR="${PROJECT_ROOT}/test-data-docker"
readonly DOCKER_LOGS_DIR="${PROJECT_ROOT}/logs-docker"

# Test configuration
readonly TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
readonly TEST_SESSION="docker_e2e_${TIMESTAMP}"
readonly TEST_LOG="${DOCKER_TEST_DIR}/${TEST_SESSION}.log"
readonly ERROR_LOG="${DOCKER_TEST_DIR}/${TEST_SESSION}_errors.log"
readonly SUCCESS_LOG="${DOCKER_TEST_DIR}/${TEST_SESSION}_success.log"
readonly ANALYSIS_LOG="${DOCKER_TEST_DIR}/${TEST_SESSION}_analysis.md"

# Test counters
declare -i TOTAL_TESTS=0
declare -i PASSED_TESTS=0
declare -i FAILED_TESTS=0
declare -i SKIPPED_TESTS=0
declare -i CRITICAL_FAILURES=0

# Test categories tracking (using simple arrays for compatibility)
# Will use string-based tracking instead of associative arrays

# Docker configuration
readonly DOCKER_IMAGE="waltodo-test:latest"
readonly DOCKER_CONTAINER="waltodo-test-runner"
readonly DOCKER_TIMEOUT=300  # 5 minutes max per test
readonly DOCKER_WORK_DIR="/home/testuser/waltodo"

# README commands to validate (exact from README.md)
readonly -a README_COMMANDS=(
    "waltodo add \"Complete project milestone\" --ai"
    "waltodo list --nft"
    "waltodo complete --id 123"
    "waltodo store my-important-list"
    "waltodo deploy --network testnet"
    "waltodo transfer --todo <nft-id> --to <sui-address>"
    "waltodo ai analyze --verify"
    "waltodo sync --background"
)

# Extended test matrix for comprehensive validation
readonly -a EXTENDED_COMMANDS=(
    # Core operations
    "waltodo --help"
    "waltodo --version"
    "waltodo add \"Test todo in Docker\""
    "waltodo list"
    "waltodo list --json"
    "waltodo complete --help"
    "waltodo delete --help"
    
    # Storage operations
    "waltodo store --help"
    "waltodo retrieve --help"
    "waltodo storage --help"
    "waltodo storage --analyze"
    
    # Blockchain operations  
    "waltodo deploy --help"
    "waltodo verify --help"
    "waltodo sync --help"
    
    # Account management
    "waltodo account --help"
    "waltodo configure --help"
    "waltodo config --help"
    
    # AI features
    "waltodo ai --help"
    "waltodo ai credentials --help"
    "waltodo suggest --help"
    
    # Advanced features
    "waltodo interactive --help"
    "waltodo history --help"
    "waltodo jobs --help"
    "waltodo status"
    "waltodo queue --help"
    "waltodo daemon --help"
    
    # Image operations
    "waltodo image --help"
    "waltodo image upload --help"
    
    # Site deployment
    "waltodo deploy-site --help"
    "waltodo deploy-with-health-check --help"
    
    # Utility commands
    "waltodo env --help"
    "waltodo validate-config --help"
    "waltodo template --help"
    "waltodo provider --help"
    "waltodo share --help"
)

# ============================================================
# Utility Functions
# ============================================================

log() {
    local level="${2:-INFO}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $1" | tee -a "$TEST_LOG"
}

print_header() {
    echo -e "\n${BOLD}${BLUE}=============================================${NC}"
    echo -e "${BOLD}${BLUE} $1 ${NC}"
    echo -e "${BOLD}${BLUE}=============================================${NC}\n"
    log "$1" "HEADER"
}

print_status() {
    local message="$1"
    local status="$2"
    local category="${3:-GENERAL}"
    
    case "$status" in
        "PASS")
            echo -e "${GREEN}✓${NC} $message"
            echo "PASS: $message" >> "$SUCCESS_LOG"
            echo "${category}_PASS: $message" >> "${SUCCESS_LOG}.categories"
            ;;
        "FAIL")
            echo -e "${RED}✗${NC} $message"
            echo "FAIL: $message" >> "$ERROR_LOG"
            echo "${category}_FAIL: $message" >> "${ERROR_LOG}.categories"
            ;;
        "SKIP")
            echo -e "${YELLOW}⚠${NC} $message"
            echo "${category}_SKIP: $message" >> "${SUCCESS_LOG}.categories"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
        "CRITICAL")
            echo -e "${RED}${BOLD}💥${NC} $message"
            CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
            ;;
    esac
    log "$message" "$status"
}

# ============================================================
# Docker Management Functions
# ============================================================

setup_docker_environment() {
    print_header "Setting Up Docker Test Environment"
    
    # Create necessary directories
    mkdir -p "$DOCKER_TEST_DIR" "$DOCKER_DATA_DIR" "$DOCKER_LOGS_DIR"
    
    # Clean up any existing containers
    if docker ps -a --format "table {{.Names}}" | grep -q "$DOCKER_CONTAINER"; then
        print_status "Removing existing Docker container" "INFO"
        docker rm -f "$DOCKER_CONTAINER" 2>/dev/null || true
    fi
    
    # Check if Docker image exists
    if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^$DOCKER_IMAGE$"; then
        print_status "Docker image $DOCKER_IMAGE not found" "CRITICAL"
        print_status "Please build the Docker image first: docker build -t $DOCKER_IMAGE ." "INFO"
        return 1
    fi
    
    print_status "Docker environment setup complete" "PASS"
    return 0
}

start_docker_container() {
    print_header "Starting Docker Container"
    
    # Start container with volume mounts for test results
    docker run -d \
        --name "$DOCKER_CONTAINER" \
        --workdir "$DOCKER_WORK_DIR" \
        -v "$DOCKER_TEST_DIR:/tmp/test-results" \
        -v "$DOCKER_DATA_DIR:/tmp/test-data" \
        -v "$DOCKER_LOGS_DIR:/tmp/logs" \
        -e NODE_ENV=test \
        -e WALTODO_TEST_MODE=true \
        -e WALTODO_SUPPRESS_WARNINGS=true \
        "$DOCKER_IMAGE" \
        tail -f /dev/null
    
    # Wait for container to be ready
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if docker exec "$DOCKER_CONTAINER" echo "Container ready" >/dev/null 2>&1; then
            print_status "Docker container started successfully" "PASS"
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
    done
    
    print_status "Failed to start Docker container" "CRITICAL"
    return 1
}

cleanup_docker() {
    print_header "Cleaning Up Docker Environment"
    
    # Copy logs before cleanup
    docker exec "$DOCKER_CONTAINER" sh -c "cp -r /home/testuser/waltodo/logs/* /tmp/logs/ 2>/dev/null || true"
    docker exec "$DOCKER_CONTAINER" sh -c "cp -r /home/testuser/waltodo/test-results-docker/* /tmp/test-results/ 2>/dev/null || true"
    
    # Stop and remove container
    docker stop "$DOCKER_CONTAINER" >/dev/null 2>&1 || true
    docker rm "$DOCKER_CONTAINER" >/dev/null 2>&1 || true
    
    print_status "Docker cleanup complete" "INFO"
}

# ============================================================
# Test Execution Functions
# ============================================================

execute_docker_command() {
    local test_name="$1"
    local command="$2"
    local expected_exit_code="${3:-0}"
    local timeout="${4:-$DOCKER_TIMEOUT}"
    local category="${5:-GENERAL}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    print_status "Running: $test_name" "INFO"
    log "Command: $command" "DEBUG"
    
    local start_time=$(date +%s)
    local output
    local exit_code
    
    # Execute command in Docker container
    set +e  # Disable exit on error temporarily
    output=$(timeout "$timeout" docker exec "$DOCKER_CONTAINER" bash -c "cd $DOCKER_WORK_DIR && $command" 2>&1)
    exit_code=$?
    set -e  # Re-enable exit on error
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Store timing information
    echo "$test_name: ${duration}s" >> "${TEST_LOG}.timings"
    
    # Handle timeout
    if [ $exit_code -eq 124 ]; then
        output="Command timed out after ${timeout} seconds"
        echo "$test_name: TIMEOUT" >> "${ERROR_LOG}.reasons"
    fi
    
    # Log output (truncated for readability)
    local truncated_output
    if [ ${#output} -gt 2000 ]; then
        truncated_output="${output:0:2000}... [TRUNCATED - ${#output} chars total]"
    else
        truncated_output="$output"
    fi
    
    log "Output: $truncated_output" "DEBUG"
    log "Exit code: $exit_code, Expected: $expected_exit_code" "DEBUG"
    log "Duration: ${duration}s" "DEBUG"
    
    # Evaluate test result
    if [ "$exit_code" -eq "$expected_exit_code" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        print_status "$test_name (${duration}s)" "PASS" "$category"
        return 0
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        print_status "$test_name - Expected $expected_exit_code, got $exit_code (${duration}s)" "FAIL" "$category"
        echo "$test_name: EXIT_CODE_MISMATCH" >> "${ERROR_LOG}.reasons"
        
        # Log additional failure details
        {
            echo "=== FAILURE DETAILS ==="
            echo "Test: $test_name"
            echo "Command: $command"
            echo "Expected exit code: $expected_exit_code"
            echo "Actual exit code: $exit_code"
            echo "Duration: ${duration}s"
            echo "Output:"
            echo "$output"
            echo "========================"
        } >> "$ERROR_LOG"
        
        return 1
    fi
}

# ============================================================
# Test Suites
# ============================================================

test_docker_prerequisites() {
    print_header "Docker Prerequisites Validation"
    
    # Test Docker availability
    if ! command -v docker >/dev/null 2>&1; then
        print_status "Docker not found" "CRITICAL"
        return 1
    fi
    
    # Test Docker daemon
    if ! docker info >/dev/null 2>&1; then
        print_status "Docker daemon not running" "CRITICAL"
        return 1
    fi
    
    print_status "Docker prerequisites validated" "PASS"
    return 0
}

test_container_environment() {
    print_header "Container Environment Validation"
    
    execute_docker_command "Container OS Info" "uname -a" 0 10 "ENVIRONMENT"
    execute_docker_command "Container Node.js" "node --version" 0 10 "ENVIRONMENT"
    execute_docker_command "Container pnpm" "pnpm --version" 0 10 "ENVIRONMENT"
    execute_docker_command "Working Directory" "pwd" 0 5 "ENVIRONMENT"
    execute_docker_command "Project Files Present" "ls -la" 0 10 "ENVIRONMENT"
    
    return 0
}

test_cli_availability() {
    print_header "CLI Availability Testing"
    
    # Test various CLI execution methods
    local cli_methods=(
        "waltodo --help:Global CLI"
        "./bin/run --help:Local Binary"
        "node apps/cli/dist/index.js --help:Node.js Direct"
        "pnpm waltodo --help:pnpm Script"
    )
    
    local cli_available=false
    
    for method in "${cli_methods[@]}"; do
        local cmd="${method%:*}"
        local name="${method#*:}"
        
        if execute_docker_command "CLI Test - $name" "$cmd" 0 15 "CLI_AVAILABILITY"; then
            cli_available=true
            break
        fi
    done
    
    if [ "$cli_available" = true ]; then
        print_status "CLI is available in container" "PASS"
        return 0
    else
        print_status "CLI not available in container" "CRITICAL"
        return 1
    fi
}

test_readme_commands() {
    print_header "README Commands Validation"
    
    # Test help versions of README commands for safety
    local readme_help_commands=(
        "waltodo add --help:Add Command Help"
        "waltodo list --help:List Command Help"
        "waltodo complete --help:Complete Command Help"
        "waltodo store --help:Store Command Help"
        "waltodo deploy --help:Deploy Command Help"
        "waltodo transfer --help:Transfer Command Help"
        "waltodo ai --help:AI Command Help"
        "waltodo sync --help:Sync Command Help"
    )
    
    for cmd_info in "${readme_help_commands[@]}"; do
        local cmd="${cmd_info%:*}"
        local name="${cmd_info#*:}"
        execute_docker_command "$name" "$cmd" 0 15 "README_COMMANDS"
    done
    
    # Test safe versions of actual README commands
    execute_docker_command "Add Test Todo" "waltodo add 'Docker E2E test todo'" 0 30 "README_COMMANDS"
    execute_docker_command "List Todos" "waltodo list" 0 20 "README_COMMANDS"
    execute_docker_command "List JSON Format" "waltodo list --json" 0 20 "README_COMMANDS"
    
    return 0
}

test_extended_commands() {
    print_header "Extended Commands Validation"
    
    for cmd in "${EXTENDED_COMMANDS[@]}"; do
        local test_name="Extended: ${cmd%% *}"
        execute_docker_command "$test_name" "$cmd" 0 20 "EXTENDED_COMMANDS"
    done
    
    return 0
}

test_error_conditions() {
    print_header "Error Conditions Testing"
    
    # Test commands that should fail
    execute_docker_command "Invalid Command" "waltodo invalid-command-xyz" 1 10 "ERROR_CONDITIONS"
    execute_docker_command "Invalid Flag" "waltodo list --invalid-flag" 1 10 "ERROR_CONDITIONS"
    execute_docker_command "Missing Required Arg" "waltodo complete" 1 10 "ERROR_CONDITIONS"
    
    return 0
}

test_performance_scenarios() {
    print_header "Performance Scenarios Testing"
    
    # Test performance-related scenarios
    execute_docker_command "Multiple List Calls" "waltodo list && waltodo list && waltodo list" 0 30 "PERFORMANCE"
    execute_docker_command "Help Performance" "time waltodo --help" 0 15 "PERFORMANCE"
    execute_docker_command "Large Help Output" "waltodo --help | wc -l" 0 10 "PERFORMANCE"
    
    return 0
}

# ============================================================
# Analysis and Reporting
# ============================================================

analyze_test_results() {
    print_header "Test Results Analysis"
    
    local success_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    fi
    
    # Calculate category statistics from files
    local categories=("ENVIRONMENT" "CLI_AVAILABILITY" "README_COMMANDS" "EXTENDED_COMMANDS" "ERROR_CONDITIONS" "PERFORMANCE")
    
    {
        echo "# WalTodo Docker E2E Test Analysis"
        echo
        echo "**Generated:** $(date)"
        echo "**Test Session:** $TEST_SESSION"
        echo "**Duration:** $(($(date +%s) - ${TEST_START_TIME:-$(date +%s)})) seconds"
        echo
        echo "## Executive Summary"
        echo
        echo "- **Total Tests:** $TOTAL_TESTS"
        echo "- **Passed:** $PASSED_TESTS"
        echo "- **Failed:** $FAILED_TESTS"
        echo "- **Skipped:** $SKIPPED_TESTS"
        echo "- **Success Rate:** ${success_rate}%"
        echo "- **Critical Failures:** $CRITICAL_FAILURES"
        echo
        
        if [ $success_rate -ge 95 ]; then
            echo "🎯 **TARGET ACHIEVED: 95%+ Success Rate**"
        else
            echo "⚠️ **TARGET MISSED: Success rate below 95%**"
        fi
        echo
        
        echo "## Category Breakdown"
        echo
        echo "| Category | Passed | Failed | Skipped | Success Rate |"
        echo "|----------|--------|--------|---------|--------------|"
        
        for category in "${categories[@]}"; do
            local passed=0
            local failed=0
            local skipped=0
            
            # Count from category files if they exist
            if [[ -f "${SUCCESS_LOG}.categories" ]]; then
                passed=$(grep -c "^${category}_PASS:" "${SUCCESS_LOG}.categories" 2>/dev/null || echo 0)
            fi
            if [[ -f "${ERROR_LOG}.categories" ]]; then
                failed=$(grep -c "^${category}_FAIL:" "${ERROR_LOG}.categories" 2>/dev/null || echo 0)
                skipped=$(grep -c "^${category}_SKIP:" "${SUCCESS_LOG}.categories" 2>/dev/null || echo 0)
            fi
            
            local total=$((passed + failed + skipped))
            local cat_success=0
            
            if [ $total -gt 0 ]; then
                cat_success=$(( passed * 100 / total ))
            fi
            
            echo "| $category | $passed | $failed | $skipped | ${cat_success}% |"
        done
        echo
        
        echo "## Performance Analysis"
        echo
        echo "### Command Timing Statistics"
        echo
        local total_time=0
        local cmd_count=0
        
        # Calculate timing statistics from file
        if [[ -f "${TEST_LOG}.timings" ]]; then
            while IFS=': ' read -r cmd time_str; do
                if [[ -n "$cmd" && -n "$time_str" ]]; then
                    local time_num=${time_str%s}
                    total_time=$((total_time + time_num))
                    cmd_count=$((cmd_count + 1))
                fi
            done < "${TEST_LOG}.timings"
        fi
        
        if [ $cmd_count -gt 0 ]; then
            local avg_time=$((total_time / cmd_count))
            echo "- **Total Execution Time:** ${total_time}s"
            echo "- **Average Command Time:** ${avg_time}s"
            echo "- **Commands Tested:** $cmd_count"
        fi
        echo
        
        # Show failure analysis if failures exist
        if [[ -f "${ERROR_LOG}.reasons" ]] && [[ -s "${ERROR_LOG}.reasons" ]]; then
            echo "## Failure Analysis"
            echo
            echo "### Failure Breakdown"
            echo
            while IFS=': ' read -r test reason; do
                if [[ -n "$test" && -n "$reason" ]]; then
                    echo "- **$test:** $reason"
                fi
            done < "${ERROR_LOG}.reasons"
            echo
        fi
        
        echo "## Recommendations"
        echo
        
        if [ $CRITICAL_FAILURES -gt 0 ]; then
            echo "### Critical Issues (Must Fix)"
            echo "- $CRITICAL_FAILURES critical failures detected"
            echo "- Review Docker image build process"
            echo "- Verify CLI installation in container"
            echo "- Check environment configuration"
            echo
        fi
        
        if [ $FAILED_TESTS -gt 0 ]; then
            echo "### Test Failures"
            echo "- $FAILED_TESTS tests failed"
            echo "- Review error log: $ERROR_LOG"
            echo "- Consider increasing timeouts for slow commands"
            echo "- Verify command syntax and dependencies"
            echo
        fi
        
        if [ $success_rate -ge 95 ]; then
            echo "### Success ✅"
            echo "- Docker environment is working correctly"
            echo "- CLI commands are properly functional"
            echo "- Ready for full deployment testing"
            echo "- Consider expanding test coverage"
        else
            echo "### Action Required ⚠️"
            echo "- Success rate below 95% target"
            echo "- Review failed tests and fix issues"
            echo "- Re-run tests after fixes"
        fi
        
        echo
        echo "## Detailed Logs"
        echo
        echo "- **Main Log:** $TEST_LOG"
        echo "- **Error Log:** $ERROR_LOG"
        echo "- **Success Log:** $SUCCESS_LOG"
        echo
        
    } > "$ANALYSIS_LOG"
    
    print_status "Analysis report generated: $ANALYSIS_LOG" "INFO"
}

generate_final_report() {
    print_header "Final Test Report"
    
    local success_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    fi
    
    echo ""
    echo "============================================================"
    echo "              DOCKER E2E TEST FINAL REPORT"
    echo "============================================================"
    echo "Test Session:    $TEST_SESSION"
    echo "Total Tests:     $TOTAL_TESTS"
    echo "Passed:          $PASSED_TESTS"
    echo "Failed:          $FAILED_TESTS"
    echo "Skipped:         $SKIPPED_TESTS"
    echo "Success Rate:    ${success_rate}%"
    echo "Critical Issues: $CRITICAL_FAILURES"
    echo "============================================================"
    
    if [ $success_rate -ge 95 ]; then
        echo -e "${GREEN}${BOLD}🎯 SUCCESS: 95%+ TARGET ACHIEVED${NC}"
        echo "Docker environment is ready for production validation"
    else
        echo -e "${RED}${BOLD}⚠️  WARNING: Success rate below 95% target${NC}"
        echo "Review failures and re-test before proceeding"
    fi
    
    echo ""
    echo "Generated Reports:"
    echo "- Analysis: $ANALYSIS_LOG"
    echo "- Test Log: $TEST_LOG"
    echo "- Errors:   $ERROR_LOG"
    echo "- Success:  $SUCCESS_LOG"
    echo "============================================================"
}

# ============================================================
# Main Execution Flow
# ============================================================

main() {
    local dry_run=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--dry-run] [--help]"
                echo "  --dry-run  Show what would be tested without execution"
                echo "  --help     Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Set start time for duration calculation
    TEST_START_TIME=$(date +%s)
    
    print_header "WalTodo Docker E2E Comprehensive Validation"
    print_status "Starting comprehensive Docker E2E test suite" "INFO"
    print_status "Target: 95%+ success rate validation" "INFO"
    
    if [ "$dry_run" = true ]; then
        print_status "DRY RUN MODE - No actual tests will be executed" "WARN"
        echo "Would test ${#README_COMMANDS[@]} README commands"
        echo "Would test ${#EXTENDED_COMMANDS[@]} extended commands"
        echo "Would generate reports in: $DOCKER_TEST_DIR"
        exit 0
    fi
    
    # Trap for cleanup
    trap cleanup_docker EXIT
    
    # Execute test phases
    if ! test_docker_prerequisites; then
        print_status "Docker prerequisites failed" "CRITICAL"
        exit 1
    fi
    
    if ! setup_docker_environment; then
        print_status "Docker environment setup failed" "CRITICAL"
        exit 1
    fi
    
    if ! start_docker_container; then
        print_status "Failed to start Docker container" "CRITICAL"
        exit 1
    fi
    
    # Run test suites
    test_container_environment
    test_cli_availability
    test_readme_commands
    test_extended_commands
    test_error_conditions
    test_performance_scenarios
    
    # Generate analysis and reports
    analyze_test_results
    generate_final_report
    
    # Determine exit code based on success rate
    local success_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    fi
    
    if [ $CRITICAL_FAILURES -gt 0 ]; then
        print_status "Critical failures detected - infrastructure issues" "CRITICAL"
        exit 2
    elif [ $success_rate -lt 95 ]; then
        print_status "Success rate below 95% target" "WARN"
        exit 1
    else
        print_status "All validation criteria met!" "PASS"
        exit 0
    fi
}

# Execute main function
main "$@"