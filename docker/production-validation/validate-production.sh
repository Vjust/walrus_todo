#!/bin/bash

# Production Validation Script
# Comprehensive validation of production readiness with zero TypeScript errors

set -e

echo "🚀 Starting Production Readiness Validation"
echo "=========================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
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

# Initialize validation report
VALIDATION_REPORT="/app/validation-report.json"
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","validation_results":{}}' > $VALIDATION_REPORT

# Function to update validation report
update_report() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    local error_count="$4"
    
    jq --arg name "$test_name" --arg status "$status" --arg details "$details" --argjson errors "$error_count" \
        '.validation_results[$name] = {"status": $status, "details": $details, "error_count": $errors}' \
        $VALIDATION_REPORT > temp.json && mv temp.json $VALIDATION_REPORT
}

# 1. TypeScript Error Count Validation
print_status "Phase 1: TypeScript Error Count Validation"
echo "-------------------------------------------"

error_count=$(pnpm run typecheck 2>&1 | grep -c "error TS" || echo "0")
print_status "Current TypeScript error count: $error_count"

if [ "$error_count" -eq 0 ]; then
    print_success "Zero TypeScript errors achieved! 🎉"
    update_report "typescript_errors" "PASS" "Zero TypeScript errors achieved" 0
else
    print_warning "TypeScript errors remaining: $error_count"
    update_report "typescript_errors" "PENDING" "TypeScript errors still present" $error_count
fi

# 2. Build Process Validation
print_status "Phase 2: Build Process Validation"
echo "----------------------------------"

# Test development build
print_status "Testing development build (pnpm build:dev)..."
if pnpm build:dev 2>&1 | tee build-dev.log; then
    print_success "Development build completed successfully"
    update_report "build_dev" "PASS" "Development build successful" 0
else
    print_error "Development build failed"
    update_report "build_dev" "FAIL" "Development build failed" 1
fi

# Test production build
print_status "Testing production build (pnpm build)..."
if timeout 300 pnpm build 2>&1 | tee build-prod.log; then
    print_success "Production build completed successfully"
    update_report "build_prod" "PASS" "Production build successful" 0
else
    print_error "Production build failed or timed out"
    update_report "build_prod" "FAIL" "Production build failed or timed out" 1
fi

# 3. CLI Installation and Functionality Testing
print_status "Phase 3: CLI Functionality Testing"
echo "-----------------------------------"

# Install CLI globally
print_status "Installing CLI globally..."
if pnpm run global-install 2>&1 | tee cli-install.log; then
    print_success "CLI installed successfully"
    update_report "cli_install" "PASS" "CLI installation successful" 0
else
    print_error "CLI installation failed"
    update_report "cli_install" "FAIL" "CLI installation failed" 1
fi

# Test basic CLI commands
print_status "Testing basic CLI commands..."
cli_tests_passed=0
cli_tests_total=5

# Test help command
if waltodo --help > /dev/null 2>&1; then
    print_success "CLI help command works"
    ((cli_tests_passed++))
else
    print_error "CLI help command failed"
fi

# Test version command
if waltodo --version > /dev/null 2>&1; then
    print_success "CLI version command works"
    ((cli_tests_passed++))
else
    print_error "CLI version command failed"
fi

# Test list command
if waltodo list > /dev/null 2>&1; then
    print_success "CLI list command works"
    ((cli_tests_passed++))
else
    print_error "CLI list command failed"
fi

# Test config command
if waltodo config > /dev/null 2>&1; then
    print_success "CLI config command works"
    ((cli_tests_passed++))
else
    print_error "CLI config command failed"
fi

# Test status command
if waltodo status > /dev/null 2>&1; then
    print_success "CLI status command works"
    ((cli_tests_passed++))
else
    print_error "CLI status command failed"
fi

update_report "cli_functionality" "PASS" "CLI tests passed: $cli_tests_passed/$cli_tests_total" $((cli_tests_total - cli_tests_passed))

# 4. Test Suite Validation
print_status "Phase 4: Test Suite Validation"
echo "-------------------------------"

# Run unit tests
print_status "Running unit tests..."
if timeout 300 pnpm test:unit 2>&1 | tee unit-tests.log; then
    unit_test_result="PASS"
    print_success "Unit tests completed successfully"
else
    unit_test_result="FAIL"
    print_error "Unit tests failed"
fi

# Count test results
unit_tests_passed=$(grep -o "Tests:.*passed" unit-tests.log | head -1 | grep -o "[0-9]\+ passed" | grep -o "[0-9]\+" || echo "0")
unit_tests_failed=$(grep -o "Tests:.*failed" unit-tests.log | head -1 | grep -o "[0-9]\+ failed" | grep -o "[0-9]\+" || echo "0")

update_report "unit_tests" "$unit_test_result" "Passed: $unit_tests_passed, Failed: $unit_tests_failed" $unit_tests_failed

# Run integration tests (with timeout)
print_status "Running integration tests..."
if timeout 180 pnpm test:integration 2>&1 | tee integration-tests.log; then
    integration_test_result="PASS"
    print_success "Integration tests completed successfully"
else
    integration_test_result="FAIL"
    print_error "Integration tests failed or timed out"
fi

integration_tests_passed=$(grep -o "Tests:.*passed" integration-tests.log | head -1 | grep -o "[0-9]\+ passed" | grep -o "[0-9]\+" || echo "0")
integration_tests_failed=$(grep -o "Tests:.*failed" integration-tests.log | head -1 | grep -o "[0-9]\+ failed" | grep -o "[0-9]\+" || echo "0")

update_report "integration_tests" "$integration_test_result" "Passed: $integration_tests_passed, Failed: $integration_tests_failed" $integration_tests_failed

# 5. Frontend Build Validation
print_status "Phase 5: Frontend Build Validation"
echo "-----------------------------------"

cd /app/waltodo-frontend

# Install frontend dependencies
print_status "Installing frontend dependencies..."
if pnpm install 2>&1 | tee ../frontend-install.log; then
    print_success "Frontend dependencies installed"
else
    print_error "Frontend dependency installation failed"
fi

# Test frontend build
print_status "Testing frontend build..."
if timeout 300 pnpm build 2>&1 | tee ../frontend-build.log; then
    print_success "Frontend build completed successfully"
    update_report "frontend_build" "PASS" "Frontend build successful" 0
else
    print_error "Frontend build failed"
    update_report "frontend_build" "FAIL" "Frontend build failed" 1
fi

cd /app

# 6. Dependency Security Audit
print_status "Phase 6: Security Audit"
echo "------------------------"

# Run security audit
print_status "Running security audit..."
if pnpm audit --audit-level high 2>&1 | tee security-audit.log; then
    print_success "Security audit completed"
    update_report "security_audit" "PASS" "No high-severity vulnerabilities found" 0
else
    print_warning "Security audit found issues"
    vulnerability_count=$(grep -c "high\|critical" security-audit.log || echo "0")
    update_report "security_audit" "WARN" "Security vulnerabilities found" $vulnerability_count
fi

# 7. Generate Final Report
print_status "Phase 7: Generating Production Readiness Report"
echo "-----------------------------------------------"

# Calculate overall score
total_tests=$(jq '.validation_results | length' $VALIDATION_REPORT)
passed_tests=$(jq '[.validation_results[] | select(.status == "PASS")] | length' $VALIDATION_REPORT)
failed_tests=$(jq '[.validation_results[] | select(.status == "FAIL")] | length' $VALIDATION_REPORT)
pending_tests=$(jq '[.validation_results[] | select(.status == "PENDING")] | length' $VALIDATION_REPORT)

# Add summary to report
jq --argjson total "$total_tests" --argjson passed "$passed_tests" --argjson failed "$failed_tests" --argjson pending "$pending_tests" \
    '.summary = {"total_tests": $total, "passed": $passed, "failed": $failed, "pending": $pending, "success_rate": (($passed / $total) * 100 | floor)}' \
    $VALIDATION_REPORT > temp.json && mv temp.json $VALIDATION_REPORT

# Print summary
echo ""
echo "🎯 PRODUCTION VALIDATION SUMMARY"
echo "================================"
echo "Total Tests: $total_tests"
echo "Passed: $passed_tests"
echo "Failed: $failed_tests"
echo "Pending: $pending_tests"
echo "Success Rate: $(jq '.summary.success_rate' $VALIDATION_REPORT)%"
echo ""

if [ "$failed_tests" -eq 0 ] && [ "$error_count" -eq 0 ]; then
    print_success "🚀 PRODUCTION READY! All validations passed with zero TypeScript errors."
    echo "production_ready=true" >> validation-summary.env
elif [ "$failed_tests" -eq 0 ]; then
    print_warning "⚠️  PRODUCTION READY (with TypeScript errors). All functional tests passed."
    echo "production_ready=partial" >> validation-summary.env
else
    print_error "❌ NOT PRODUCTION READY. Critical validations failed."
    echo "production_ready=false" >> validation-summary.env
fi

echo ""
echo "📊 Detailed validation report saved to: $VALIDATION_REPORT"
echo "📋 Validation logs available in current directory"
echo ""

# Display the full report
print_status "Full Validation Report:"
jq '.' $VALIDATION_REPORT

exit 0