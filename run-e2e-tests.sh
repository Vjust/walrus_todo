#!/bin/bash

# Comprehensive E2E Test Runner for Waltodo System
# This script runs all end-to-end integration tests and generates a comprehensive report

set -e  # Exit on any error

echo "🚀 Starting Comprehensive Waltodo E2E Test Suite"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
PROJECT_ROOT=$(pwd)
TEST_RESULTS_DIR="$PROJECT_ROOT/e2e-test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$TEST_RESULTS_DIR/e2e-report_$TIMESTAMP.txt"

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"

echo "📁 Test results will be saved to: $TEST_RESULTS_DIR"
echo "📝 Report file: $REPORT_FILE"
echo ""

# Function to log with timestamp
log_with_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$REPORT_FILE"
}

# Function to run test and capture results
run_test_suite() {
    local test_name="$1"
    local test_command="$2"
    local test_file="$3"
    
    echo -e "${BLUE}🔄 Running $test_name...${NC}"
    log_with_timestamp "Starting $test_name"
    
    local start_time=$(date +%s)
    local success=false
    
    if eval "$test_command" 2>&1 | tee -a "$REPORT_FILE"; then
        success=true
        echo -e "${GREEN}✅ $test_name PASSED${NC}"
        log_with_timestamp "$test_name PASSED"
    else
        echo -e "${RED}❌ $test_name FAILED${NC}"
        log_with_timestamp "$test_name FAILED"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_with_timestamp "$test_name duration: ${duration}s"
    echo ""
    
    return $([ "$success" = true ] && echo 0 || echo 1)
}

# Initialize report
cat > "$REPORT_FILE" << EOF
Waltodo System - Comprehensive E2E Test Report
==============================================
Timestamp: $(date)
Project Root: $PROJECT_ROOT
Test Runner: Bash Script

EOF

# Check prerequisites
echo -e "${YELLOW}📋 Checking Prerequisites...${NC}"
log_with_timestamp "Checking prerequisites"

prerequisites_ok=true

# Check Node.js
if command -v node >/dev/null 2>&1; then
    node_version=$(node --version)
    echo "✅ Node.js: $node_version"
    log_with_timestamp "Node.js: $node_version"
else
    echo "❌ Node.js not found"
    log_with_timestamp "ERROR: Node.js not found"
    prerequisites_ok=false
fi

# Check pnpm
if command -v pnpm >/dev/null 2>&1; then
    pnpm_version=$(pnpm --version)
    echo "✅ pnpm: $pnpm_version"
    log_with_timestamp "pnpm: $pnpm_version"
else
    echo "❌ pnpm not found"
    log_with_timestamp "ERROR: pnpm not found"
    prerequisites_ok=false
fi

# Check Sui CLI
if command -v sui >/dev/null 2>&1; then
    sui_version=$(sui --version 2>/dev/null || echo "installed")
    echo "✅ Sui CLI: $sui_version"
    log_with_timestamp "Sui CLI: $sui_version"
else
    echo "❌ Sui CLI not found"
    log_with_timestamp "ERROR: Sui CLI not found"
    prerequisites_ok=false
fi

# Check Walrus CLI (optional)
if command -v walrus >/dev/null 2>&1; then
    walrus_version=$(walrus --version 2>/dev/null || echo "installed")
    echo "✅ Walrus CLI: $walrus_version"
    log_with_timestamp "Walrus CLI: $walrus_version"
else
    echo "⚠️  Walrus CLI not found - will use mock mode"
    log_with_timestamp "WARNING: Walrus CLI not found - will use mock mode"
fi

if [ "$prerequisites_ok" = false ]; then
    echo -e "${RED}❌ Prerequisites not met. Please install missing components.${NC}"
    log_with_timestamp "ERROR: Prerequisites not met"
    exit 1
fi

echo ""

# Build the project
echo -e "${YELLOW}🔧 Building Project...${NC}"
log_with_timestamp "Building project"

if pnpm run build:dev 2>&1 | tee -a "$REPORT_FILE"; then
    echo -e "${GREEN}✅ Project built successfully${NC}"
    log_with_timestamp "Project built successfully"
else
    echo -e "${RED}❌ Project build failed${NC}"
    log_with_timestamp "ERROR: Project build failed"
    exit 1
fi

echo ""

# Install frontend dependencies
echo -e "${YELLOW}📦 Installing Frontend Dependencies...${NC}"
log_with_timestamp "Installing frontend dependencies"

if [ -d "waltodo-frontend" ]; then
    cd waltodo-frontend
    if pnpm install 2>&1 | tee -a "$REPORT_FILE"; then
        echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
        log_with_timestamp "Frontend dependencies installed"
    else
        echo -e "${YELLOW}⚠️  Frontend dependency installation failed - some tests may be skipped${NC}"
        log_with_timestamp "WARNING: Frontend dependency installation failed"
    fi
    cd ..
else
    echo -e "${YELLOW}⚠️  Frontend directory not found - frontend tests will be skipped${NC}"
    log_with_timestamp "WARNING: Frontend directory not found"
fi

echo ""

# Run test suites
echo -e "${BLUE}🧪 Running Test Suites...${NC}"
log_with_timestamp "Starting test suites"

test_results=()

# Test Suite 1: Unit Tests
run_test_suite "Unit Tests" "pnpm test:unit" "src/__tests__/**/*.test.ts"
test_results+=($?)

# Test Suite 2: Integration Tests
run_test_suite "Integration Tests" "pnpm test tests/integration" "tests/integration/**/*.test.ts"
test_results+=($?)

# Test Suite 3: CLI Command Tests
run_test_suite "CLI Command Tests" "pnpm test tests/commands" "tests/commands/**/*.test.ts"
test_results+=($?)

# Test Suite 4: Comprehensive System Integration
run_test_suite "System Integration Tests" "pnpm test tests/e2e/comprehensive-system-integration.e2e.test.ts" "tests/e2e/comprehensive-system-integration.e2e.test.ts"
test_results+=($?)

# Test Suite 5: Frontend-CLI Integration
run_test_suite "Frontend-CLI Integration Tests" "pnpm test tests/e2e/frontend-cli-integration.e2e.test.ts" "tests/e2e/frontend-cli-integration.e2e.test.ts"
test_results+=($?)

# Test Suite 6: Walrus Integration
run_test_suite "Walrus Integration Tests" "pnpm test tests/e2e/walrus-integration.e2e.test.ts" "tests/e2e/walrus-integration.e2e.test.ts"
test_results+=($?)

# Calculate results
total_tests=${#test_results[@]}
passed_tests=0
failed_tests=0

for result in "${test_results[@]}"; do
    if [ $result -eq 0 ]; then
        ((passed_tests++))
    else
        ((failed_tests++))
    fi
done

# Generate summary report
echo -e "${BLUE}📊 Test Results Summary${NC}"
echo "======================="
log_with_timestamp "Generating test results summary"

echo "Total Test Suites: $total_tests"
echo -e "Passed: ${GREEN}$passed_tests${NC}"
echo -e "Failed: ${RED}$failed_tests${NC}"

if [ $failed_tests -eq 0 ]; then
    echo -e "${GREEN}🎉 All test suites passed! System is ready for production.${NC}"
    log_with_timestamp "SUCCESS: All test suites passed"
    final_status="SUCCESS"
else
    echo -e "${RED}⚠️  $failed_tests test suite(s) failed. Please review and fix issues.${NC}"
    log_with_timestamp "WARNING: $failed_tests test suite(s) failed"
    final_status="PARTIAL_FAILURE"
fi

# Add summary to report
cat >> "$REPORT_FILE" << EOF

=====================================
FINAL TEST RESULTS SUMMARY
=====================================
Total Test Suites: $total_tests
Passed: $passed_tests
Failed: $failed_tests
Final Status: $final_status
Test Completion Time: $(date)

RECOMMENDATIONS:
EOF

if [ $failed_tests -eq 0 ]; then
    cat >> "$REPORT_FILE" << EOF
✅ All tests passed - system is ready for production deployment
✅ All core features are working correctly
✅ Error handling is functioning properly
✅ Integration between components is verified
EOF
else
    cat >> "$REPORT_FILE" << EOF
⚠️  Review failed test results above
⚠️  Fix any issues before production deployment
⚠️  Consider running individual test suites for detailed debugging
⚠️  Some features may have partial implementation
EOF
fi

# System status checks
echo ""
echo -e "${YELLOW}🔍 System Status Checks...${NC}"
log_with_timestamp "Performing system status checks"

echo "Checking CLI functionality..."
if pnpm run cli -- --version >/dev/null 2>&1; then
    echo "✅ CLI is functional"
    log_with_timestamp "CLI is functional"
else
    echo "❌ CLI not working properly"
    log_with_timestamp "ERROR: CLI not working properly"
fi

echo "Checking configuration..."
if pnpm run cli -- config >/dev/null 2>&1; then
    echo "✅ Configuration system working"
    log_with_timestamp "Configuration system working"
else
    echo "⚠️  Configuration may need setup"
    log_with_timestamp "WARNING: Configuration may need setup"
fi

echo ""
echo -e "${BLUE}📝 Detailed Report Location:${NC}"
echo "$REPORT_FILE"
echo ""
echo -e "${BLUE}🔍 Additional Test Artifacts:${NC}"
echo "- Jest test reports: ./coverage/ (if generated)"
echo "- Frontend build artifacts: ./waltodo-frontend/.next/ (if built)"
echo "- CLI build artifacts: ./dist/"
echo ""

# Final exit status
if [ $failed_tests -eq 0 ]; then
    echo -e "${GREEN}✅ E2E Test Suite Completed Successfully!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  E2E Test Suite Completed with Issues${NC}"
    exit 1
fi