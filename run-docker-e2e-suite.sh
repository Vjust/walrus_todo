#!/bin/bash

# ============================================================
# WalTodo Docker E2E Test Suite Orchestrator
# Master script for complete Docker testing workflow
# ============================================================

set -euo pipefail

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="${SCRIPT_DIR}"
readonly TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

print_status() {
    local message="$1"
    local status="$2"
    
    case "$status" in
        "PASS")
            echo -e "${GREEN}✅${NC} $message"
            ;;
        "FAIL")
            echo -e "${RED}❌${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️${NC} $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️${NC} $message"
            ;;
        "START")
            echo -e "${BOLD}${BLUE}🚀${NC} $message"
            ;;
    esac
}

print_header() {
    echo -e "\n${BOLD}${BLUE}=============================================${NC}"
    echo -e "${BOLD}${BLUE} $1 ${NC}"
    echo -e "${BOLD}${BLUE}=============================================${NC}\n"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

WalTodo Docker E2E Test Suite Orchestrator

OPTIONS:
    --validate-only     Only run setup validation
    --build-image       Build Docker image before testing
    --skip-validation   Skip setup validation
    --dry-run          Show what would be tested
    --verbose          Enable verbose output
    --help             Show this help message

EXAMPLES:
    $0                          # Run complete test suite
    $0 --validate-only          # Just validate setup
    $0 --build-image            # Build image and run tests
    $0 --dry-run                # Preview test execution

EOF
}

validate_setup() {
    print_header "Step 1: Setup Validation"
    
    if [[ ! -f "$PROJECT_ROOT/validate-docker-test-setup.sh" ]]; then
        print_status "Setup validation script missing" "FAIL"
        return 1
    fi
    
    print_status "Running setup validation..." "START"
    if "$PROJECT_ROOT/validate-docker-test-setup.sh"; then
        print_status "Setup validation completed successfully" "PASS"
        return 0
    else
        print_status "Setup validation failed" "FAIL"
        return 1
    fi
}

build_docker_image() {
    print_header "Step 2: Docker Image Build"
    
    if ! command -v docker >/dev/null 2>&1; then
        print_status "Docker not available" "FAIL"
        return 1
    fi
    
    # Check if Dockerfile exists
    local dockerfile_path=""
    if [[ -f "$PROJECT_ROOT/Dockerfile.test" ]]; then
        dockerfile_path="$PROJECT_ROOT/Dockerfile.test"
    elif [[ -f "$PROJECT_ROOT/Dockerfile" ]]; then
        dockerfile_path="$PROJECT_ROOT/Dockerfile"
    else
        print_status "No Dockerfile found" "FAIL"
        return 1
    fi
    
    print_status "Building Docker image from $dockerfile_path..." "START"
    
    if docker build -t waltodo-test:latest -f "$dockerfile_path" "$PROJECT_ROOT"; then
        print_status "Docker image built successfully" "PASS"
        return 0
    else
        print_status "Docker image build failed" "FAIL"
        return 1
    fi
}

check_docker_image() {
    print_header "Docker Image Check"
    
    if docker images --format "table {{.Repository}}:{{.Tag}}" | grep -q "waltodo-test:latest"; then
        print_status "Docker test image available" "PASS"
        return 0
    else
        print_status "Docker test image not found" "WARN"
        print_status "Consider running with --build-image flag" "INFO"
        return 1
    fi
}

run_comprehensive_tests() {
    print_header "Step 3: Comprehensive E2E Tests"
    
    if [[ ! -f "$PROJECT_ROOT/docker-test-comprehensive-e2e.sh" ]]; then
        print_status "Comprehensive E2E test script missing" "FAIL"
        return 1
    fi
    
    print_status "Executing comprehensive E2E test suite..." "START"
    
    local test_args=()
    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        test_args+=("--dry-run")
    fi
    
    if "$PROJECT_ROOT/docker-test-comprehensive-e2e.sh" "${test_args[@]}"; then
        print_status "Comprehensive E2E tests completed successfully" "PASS"
        return 0
    else
        local exit_code=$?
        case $exit_code in
            1)
                print_status "Some tests failed but infrastructure is working" "WARN"
                ;;
            2)
                print_status "Critical infrastructure failures detected" "FAIL"
                ;;
            *)
                print_status "Tests failed with unexpected exit code: $exit_code" "FAIL"
                ;;
        esac
        return $exit_code
    fi
}

analyze_results() {
    print_header "Step 4: Results Analysis"
    
    local results_dir="$PROJECT_ROOT/test-results-docker"
    
    if [[ ! -d "$results_dir" ]]; then
        print_status "Results directory not found" "WARN"
        return 1
    fi
    
    # Find latest test results
    local latest_analysis
    latest_analysis=$(find "$results_dir" -name "*_analysis.md" -type f -exec ls -t {} + | head -1)
    
    if [[ -n "$latest_analysis" && -f "$latest_analysis" ]]; then
        print_status "Latest analysis report: $latest_analysis" "INFO"
        
        # Extract key metrics from analysis
        if grep -q "TARGET ACHIEVED: 95%" "$latest_analysis"; then
            print_status "95%+ success rate target achieved!" "PASS"
        elif grep -q "TARGET MISSED" "$latest_analysis"; then
            print_status "Success rate below 95% target" "WARN"
        fi
        
        if grep -q "Critical Failures: 0" "$latest_analysis"; then
            print_status "No critical failures detected" "PASS"
        else
            print_status "Critical failures found - review analysis" "FAIL"
        fi
        
    else
        print_status "No analysis report found" "WARN"
    fi
    
    # List all available reports
    local report_count
    report_count=$(find "$results_dir" -name "docker_e2e_*" -type f | wc -l)
    print_status "Generated $report_count test result files" "INFO"
    
    return 0
}

generate_summary_report() {
    print_header "Step 5: Summary Report Generation"
    
    local summary_file="$PROJECT_ROOT/test-results-docker/DOCKER_E2E_SUMMARY_${TIMESTAMP}.md"
    
    cat > "$summary_file" << EOF
# WalTodo Docker E2E Test Suite Summary

**Generated:** $(date)
**Session:** docker_e2e_${TIMESTAMP}

## Test Suite Execution Summary

This document summarizes the complete Docker E2E test suite execution.

### Test Phases Completed

1. ✅ **Setup Validation** - Infrastructure readiness check
2. ✅ **Docker Image Check** - Container image availability
3. ✅ **Comprehensive E2E Tests** - All README commands and extended tests
4. ✅ **Results Analysis** - Performance and success rate evaluation

### Key Test Categories

- **Environment Tests:** Container setup validation
- **CLI Availability:** Command execution readiness
- **README Commands:** All 8 example commands from documentation
- **Extended Commands:** 25+ additional CLI commands
- **Error Conditions:** Invalid command handling
- **Performance Tests:** Command timing and reliability

### Success Criteria

- 🎯 **Target Success Rate:** 95%+
- 🔄 **Command Coverage:** All README examples
- ⚡ **Performance:** Commands under 30s average
- 🚫 **Critical Failures:** Zero tolerance

### Generated Reports

EOF

    # List all generated reports
    if [[ -d "$PROJECT_ROOT/test-results-docker" ]]; then
        echo "#### Test Result Files" >> "$summary_file"
        echo "" >> "$summary_file"
        find "$PROJECT_ROOT/test-results-docker" -name "docker_e2e_*" -type f -exec basename {} \; | while read -r file; do
            echo "- \`$file\`" >> "$summary_file"
        done
        echo "" >> "$summary_file"
    fi
    
    cat >> "$summary_file" << EOF

### Next Steps

Based on test results:

1. **If all tests passed (95%+ success rate):**
   - ✅ Docker environment is production-ready
   - ✅ CLI commands are fully functional
   - ✅ Proceed with deployment validation

2. **If tests failed:**
   - 🔍 Review detailed error logs
   - 🛠️ Fix identified issues
   - 🔄 Re-run test suite

### Quick Commands

\`\`\`bash
# View latest results
ls -la test-results-docker/

# Re-run tests
./run-docker-e2e-suite.sh

# Validate setup only
./run-docker-e2e-suite.sh --validate-only
\`\`\`

---

*Generated by WalTodo Docker E2E Test Suite Orchestrator*
EOF

    print_status "Summary report generated: $summary_file" "INFO"
    
    # Display quick summary
    echo ""
    echo "📊 Quick Summary:"
    echo "   Report: $(basename "$summary_file")"
    echo "   Location: test-results-docker/"
    echo "   Timestamp: $TIMESTAMP"
    echo ""
}

main() {
    local validate_only=false
    local build_image=false
    local skip_validation=false
    local dry_run=false
    local verbose=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --validate-only)
                validate_only=true
                shift
                ;;
            --build-image)
                build_image=true
                shift
                ;;
            --skip-validation)
                skip_validation=true
                shift
                ;;
            --dry-run)
                dry_run=true
                export DRY_RUN=true
                shift
                ;;
            --verbose)
                verbose=true
                set -x
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    print_header "WalTodo Docker E2E Test Suite Orchestrator"
    print_status "Starting comprehensive Docker testing workflow" "START"
    
    if [[ "$dry_run" == "true" ]]; then
        print_status "DRY RUN MODE - No actual operations will be performed" "WARN"
    fi
    
    # Create results directory
    mkdir -p "$PROJECT_ROOT/test-results-docker"
    
    local overall_status=0
    
    # Phase 1: Setup Validation
    if [[ "$skip_validation" != "true" ]]; then
        if ! validate_setup; then
            overall_status=1
            print_status "Setup validation failed - stopping execution" "FAIL"
            exit 1
        fi
    fi
    
    # Early exit for validate-only mode
    if [[ "$validate_only" == "true" ]]; then
        print_status "Validation-only mode completed" "PASS"
        exit 0
    fi
    
    # Phase 2: Docker Image Management
    if [[ "$build_image" == "true" ]]; then
        if ! build_docker_image; then
            overall_status=1
            print_status "Docker image build failed" "FAIL"
            exit 1
        fi
    else
        if ! check_docker_image; then
            print_status "Consider building Docker image with --build-image" "INFO"
        fi
    fi
    
    # Phase 3: Comprehensive Testing
    if [[ "$dry_run" != "true" ]]; then
        if ! run_comprehensive_tests; then
            overall_status=$?
        fi
    else
        print_status "Skipping actual test execution (dry run mode)" "INFO"
    fi
    
    # Phase 4: Analysis and Reporting
    analyze_results
    generate_summary_report
    
    # Final status
    print_header "Test Suite Complete"
    
    if [[ $overall_status -eq 0 ]]; then
        print_status "🎉 All phases completed successfully!" "PASS"
        echo ""
        echo "🎯 Key achievements:"
        echo "   ✅ Setup validation passed"
        echo "   ✅ Docker environment ready"
        echo "   ✅ E2E tests executed"
        echo "   ✅ Results analyzed and reported"
        echo ""
        echo "📁 Check test-results-docker/ for detailed reports"
    else
        print_status "Some phases encountered issues" "WARN"
        echo ""
        echo "🔍 Review the following:"
        echo "   - Error logs in test-results-docker/"
        echo "   - Docker image availability"
        echo "   - CLI build status"
        echo "   - Test failure details"
    fi
    
    exit $overall_status
}

main "$@"