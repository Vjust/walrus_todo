#!/bin/bash

# Local Production Validation Script
# Quick validation without Docker for immediate feedback

set -e

echo "🔍 Local Production Validation"
echo "==============================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Change to project root
cd "$(dirname "$0")/.."

# Initialize counters
total_checks=0
passed_checks=0
failed_checks=0

run_check() {
    local check_name="$1"
    local command="$2"
    ((total_checks++))
    
    print_status "Running: $check_name"
    if eval "$command" > /dev/null 2>&1; then
        print_success "$check_name"
        ((passed_checks++))
        return 0
    else
        print_error "$check_name"
        ((failed_checks++))
        return 1
    fi
}

# 1. Quick TypeScript Check
print_status "Phase 1: TypeScript Error Analysis"
echo "-----------------------------------"

error_count=$(pnpm run typecheck 2>&1 | grep -c "error TS" || echo "0")
print_status "Current TypeScript errors: $error_count"

if [ "$error_count" -eq 0 ]; then
    print_success "🎉 ZERO TYPESCRIPT ERRORS ACHIEVED!"
    zero_errors=true
else
    print_warning "TypeScript errors remaining: $error_count"
    zero_errors=false
fi

# 2. Essential Build Validation
print_status "Phase 2: Build Process Validation" 
echo "----------------------------------"

run_check "Development Build" "timeout 120 pnpm build:dev"
run_check "TypeScript Compilation" "timeout 60 pnpm run typecheck"
run_check "ESLint Validation" "pnpm lint --max-warnings 0"

# 3. CLI Basic Functionality
print_status "Phase 3: CLI Validation"
echo "------------------------"

# Ensure CLI is built
if [ ! -f "apps/cli/dist/index.js" ]; then
    print_status "Building CLI..."
    pnpm build:dev
fi

run_check "CLI Help Command" "node apps/cli/dist/index.js --help"
run_check "CLI Version Command" "node apps/cli/dist/index.js --version"
run_check "CLI Config Command" "node apps/cli/dist/index.js config"

# 4. Critical Test Validation
print_status "Phase 4: Critical Tests"
echo "------------------------"

run_check "Unit Tests (Sample)" "timeout 30 pnpm test tests/unit/basic.test.ts"
run_check "Simple Integration Test" "timeout 30 pnpm test tests/integration/commands.test.ts"

# 5. Frontend Build Check
print_status "Phase 5: Frontend Validation"
echo "-----------------------------"

cd waltodo-frontend
run_check "Frontend Dependency Check" "pnpm install --frozen-lockfile"
run_check "Frontend TypeScript Check" "pnpm run type-check"
cd ..

# 6. Generate Summary
print_status "Validation Summary"
echo "=================="

success_rate=$((passed_checks * 100 / total_checks))

echo "Total Checks: $total_checks"
echo "Passed: $passed_checks"
echo "Failed: $failed_checks"
echo "Success Rate: $success_rate%"
echo "TypeScript Errors: $error_count"
echo ""

# Determine production readiness
if [ "$failed_checks" -eq 0 ] && [ "$zero_errors" = true ]; then
    print_success "🚀 PRODUCTION READY! Zero errors, all checks passed."
    exit 0
elif [ "$failed_checks" -eq 0 ]; then
    print_warning "⚠️  FUNCTIONALLY READY (with $error_count TypeScript errors)"
    exit 0
else
    print_error "❌ NOT PRODUCTION READY ($failed_checks critical failures)"
    exit 1
fi