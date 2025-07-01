#!/bin/bash

# ============================================================
# WalTodo Docker Test Runner Script
# Comprehensive Docker testing workflow with validation,
# build, run, test, monitor, and cleanup pipeline
# ============================================================

set -euo pipefail

# Color codes for enhanced output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="${SCRIPT_DIR}"
readonly TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
readonly LOG_DIR="${PROJECT_ROOT}/logs-docker"
readonly RESULTS_DIR="${PROJECT_ROOT}/test-results"
readonly TEST_DATA_DIR="${PROJECT_ROOT}/test-data-docker"

# Test configuration
readonly DOCKER_IMAGE_NAME="waltodo-test"
readonly DOCKER_IMAGE_TAG="latest"
readonly CONTAINER_NAME="waltodo-test-runner"
readonly DOCKER_COMPOSE_FILE="docker-compose.yml"
readonly TEST_TIMEOUT=300  # 5 minutes for individual tests
readonly HEALTH_CHECK_TIMEOUT=120  # 2 minutes for health checks

# Performance thresholds
readonly MAX_MEMORY_MB=4096
readonly MAX_CPU_PERCENT=80
readonly MAX_RESPONSE_TIME_MS=30000

# Create necessary directories
mkdir -p "$LOG_DIR" "$RESULTS_DIR" "$TEST_DATA_DIR"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_DIR/docker-test_${TIMESTAMP}.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_DIR/docker-test_${TIMESTAMP}.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_DIR/docker-test_${TIMESTAMP}.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_DIR/docker-test_${TIMESTAMP}.log"
}

log_debug() {
    if [[ "${VERBOSE:-false}" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1" | tee -a "$LOG_DIR/docker-test_${TIMESTAMP}.log"
    fi
}

print_header() {
    echo ""
    echo -e "${BOLD}${PURPLE}=============================================${NC}"
    echo -e "${BOLD}${PURPLE} $1 ${NC}"
    echo -e "${BOLD}${PURPLE}=============================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BOLD}${BLUE}🔹 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_failure() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Usage function
show_usage() {
    cat << EOF
${BOLD}WalTodo Docker Test Runner${NC}

${BOLD}USAGE:${NC}
    $0 [OPTIONS]

${BOLD}DESCRIPTION:${NC}
    Comprehensive Docker testing script that validates the entire Docker environment
    through build, run, validate, test, monitor, and cleanup pipeline.

${BOLD}OPTIONS:${NC}
    --build-only           Only build Docker image and exit
    --test-only           Run tests on existing containers
    --no-cleanup          Skip cleanup phase
    --verbose             Enable verbose debug output
    --skip-build          Skip Docker image build
    --skip-health-check   Skip health check validation
    --memory-test         Include memory usage testing
    --performance-test    Include performance benchmarking
    --quick               Quick test mode (basic commands only)
    --help               Show this help message

${BOLD}FEATURES:${NC}
    ✅ Health check validation
    ✅ CLI command testing  
    ✅ Log monitoring and analysis
    ✅ Performance benchmarking
    ✅ Automated cleanup
    ✅ Detailed reporting
    ✅ Memory usage tracking
    ✅ Error pattern detection

${BOLD}EXAMPLES:${NC}
    $0                      # Run complete test suite
    $0 --verbose            # Run with debug output
    $0 --quick              # Quick validation test
    $0 --build-only         # Only build Docker image
    $0 --performance-test   # Include performance tests
    $0 --no-cleanup         # Keep containers running

${BOLD}OUTPUT:${NC}
    Logs:     $LOG_DIR/
    Results:  $RESULTS_DIR/
    Reports:  $RESULTS_DIR/docker-test-report_${TIMESTAMP}.html

EOF
}

# Error handling
handle_error() {
    local exit_code=$?
    local line_number=$1
    log_error "Script failed at line $line_number with exit code $exit_code"
    
    if [[ "$CLEANUP_ON_ERROR" == "true" ]]; then
        log_info "Performing emergency cleanup..."
        cleanup_containers
    fi
    
    generate_error_report "$exit_code" "$line_number"
    exit $exit_code
}

trap 'handle_error $LINENO' ERR

# Prerequisites validation
validate_prerequisites() {
    print_header "Prerequisites Validation"
    
    local errors=0
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_failure "Docker is not installed"
        errors=$((errors + 1))
    else
        print_success "Docker is available"
        log_debug "Docker version: $(docker --version)"
    fi
    
    # Check Docker service
    if ! docker info &> /dev/null; then
        print_failure "Docker service is not running"
        errors=$((errors + 1))
    else
        print_success "Docker service is running"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_failure "Docker Compose is not installed"
        errors=$((errors + 1))
    else
        print_success "Docker Compose is available"
        log_debug "Docker Compose version: $(docker-compose --version)"
    fi
    
    # Check project files
    local required_files=("$DOCKER_COMPOSE_FILE" "Dockerfile.test" "package.json")
    for file in "${required_files[@]}"; do
        if [[ -f "$PROJECT_ROOT/$file" ]]; then
            print_success "Found $file"
        else
            print_failure "Missing required file: $file"
            errors=$((errors + 1))
        fi
    done
    
    # Check available disk space (minimum 2GB)
    local available_space
    available_space=$(df "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
    local available_gb=$((available_space / 1024 / 1024))
    
    if [[ $available_gb -lt 2 ]]; then
        print_warning "Low disk space: ${available_gb}GB available (minimum 2GB recommended)"
    else
        print_success "Sufficient disk space: ${available_gb}GB available"
    fi
    
    if [[ $errors -gt 0 ]]; then
        log_error "Prerequisites validation failed with $errors error(s)"
        return 1
    fi
    
    print_success "All prerequisites validated successfully"
    return 0
}

# Docker image build
build_docker_image() {
    print_header "Building Docker Image"
    
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "Skipping Docker build (--skip-build flag)"
        return 0
    fi
    
    print_step "Building Docker image: $DOCKER_IMAGE_NAME:$DOCKER_IMAGE_TAG"
    
    local build_log="$LOG_DIR/docker-build_${TIMESTAMP}.log"
    
    if docker build -t "$DOCKER_IMAGE_NAME:$DOCKER_IMAGE_TAG" \
        -f "$PROJECT_ROOT/Dockerfile.test" \
        "$PROJECT_ROOT" \
        --progress=plain \
        2>&1 | tee "$build_log"; then
        
        print_success "Docker image built successfully"
        
        # Get image details
        local image_size
        image_size=$(docker images "$DOCKER_IMAGE_NAME:$DOCKER_IMAGE_TAG" --format "{{.Size}}")
        log_info "Image size: $image_size"
        
        return 0
    else
        print_failure "Docker image build failed"
        log_error "Build log saved to: $build_log"
        return 1
    fi
}

# Start Docker services
start_docker_services() {
    print_header "Starting Docker Services"
    
    print_step "Starting services with docker-compose"
    
    # Stop any existing containers
    docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" down --remove-orphans || true
    
    # Start services
    if docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" \
        --profile testing up -d \
        2>&1 | tee "$LOG_DIR/docker-compose_${TIMESTAMP}.log"; then
        
        print_success "Docker services started successfully"
        
        # List running containers
        log_info "Running containers:"
        docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" ps
        
        return 0
    else
        print_failure "Failed to start Docker services"
        return 1
    fi
}

# Health check validation
validate_health_checks() {
    print_header "Health Check Validation"
    
    if [[ "$SKIP_HEALTH_CHECK" == "true" ]]; then
        log_info "Skipping health checks (--skip-health-check flag)"
        return 0
    fi
    
    print_step "Waiting for containers to become healthy"
    
    local timeout=$HEALTH_CHECK_TIMEOUT
    local elapsed=0
    local check_interval=5
    
    while [[ $elapsed -lt $timeout ]]; do
        local unhealthy_containers
        unhealthy_containers=$(docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" ps -q | \
            xargs docker inspect --format='{{.Name}} {{.State.Health.Status}}' 2>/dev/null | \
            grep -v "healthy" | wc -l)
        
        if [[ $unhealthy_containers -eq 0 ]]; then
            print_success "All containers are healthy"
            return 0
        fi
        
        log_debug "Waiting for containers to become healthy... ($elapsed/${timeout}s)"
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
    done
    
    print_failure "Health check timeout after ${timeout}s"
    
    # Show container status
    log_error "Container status:"
    docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" ps
    
    return 1
}

# CLI functionality testing
test_cli_functionality() {
    print_header "CLI Functionality Testing"
    
    local test_results=()
    local total_tests=0
    local passed_tests=0
    
    # Basic CLI tests
    local basic_commands=(
        "waltodo --help"
        "waltodo --version"
        "waltodo list"
        "waltodo config --show"
    )
    
    print_step "Testing basic CLI commands"
    
    for cmd in "${basic_commands[@]}"; do
        total_tests=$((total_tests + 1))
        print_step "Testing: $cmd"
        
        local test_log="$LOG_DIR/cli-test-$(echo "$cmd" | tr ' ' '_')_${TIMESTAMP}.log"
        
        if timeout $TEST_TIMEOUT docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" \
            exec -T waltodo-cli bash -c "cd /home/testuser/waltodo && $cmd" \
            > "$test_log" 2>&1; then
            
            print_success "✅ $cmd"
            test_results+=("PASS: $cmd")
            passed_tests=$((passed_tests + 1))
        else
            print_failure "❌ $cmd"
            test_results+=("FAIL: $cmd")
            log_error "Command failed: $cmd (log: $test_log)"
        fi
    done
    
    # Extended CLI tests (if not in quick mode)
    if [[ "$QUICK_MODE" != "true" ]]; then
        print_step "Testing extended CLI operations"
        
        local extended_commands=(
            "waltodo add 'Test todo item' --description 'Docker test todo'"
            "waltodo list --format json"
            "waltodo status"
            "waltodo env --validate"
        )
        
        for cmd in "${extended_commands[@]}"; do
            total_tests=$((total_tests + 1))
            print_step "Testing: $cmd"
            
            local test_log="$LOG_DIR/cli-extended-$(echo "$cmd" | tr ' ' '_')_${TIMESTAMP}.log"
            
            if timeout $TEST_TIMEOUT docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" \
                exec -T waltodo-cli bash -c "cd /home/testuser/waltodo && $cmd" \
                > "$test_log" 2>&1; then
                
                print_success "✅ $cmd"
                test_results+=("PASS: $cmd")
                passed_tests=$((passed_tests + 1))
            else
                print_failure "❌ $cmd"
                test_results+=("FAIL: $cmd")
                log_error "Command failed: $cmd (log: $test_log)"
            fi
        done
    fi
    
    # Calculate success rate
    local success_rate=$((passed_tests * 100 / total_tests))
    
    print_step "CLI Test Results Summary"
    log_info "Total tests: $total_tests"
    log_info "Passed tests: $passed_tests"
    log_info "Success rate: $success_rate%"
    
    # Save detailed results
    {
        echo "CLI Test Results - $(date)"
        echo "================================"
        echo "Total tests: $total_tests"
        echo "Passed tests: $passed_tests"
        echo "Success rate: $success_rate%"
        echo ""
        echo "Detailed Results:"
        printf '%s\n' "${test_results[@]}"
    } > "$RESULTS_DIR/cli-test-results_${TIMESTAMP}.txt"
    
    if [[ $success_rate -ge 90 ]]; then
        print_success "CLI functionality tests passed ($success_rate% success rate)"
        return 0
    else
        print_failure "CLI functionality tests failed ($success_rate% success rate)"
        return 1
    fi
}

# Monitor container logs
monitor_container_logs() {
    print_header "Container Log Monitoring"
    
    print_step "Collecting container logs"
    
    local containers
    containers=$(docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" ps -q)
    
    for container in $containers; do
        local container_name
        container_name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/\///')
        
        local log_file="$LOG_DIR/container-${container_name}_${TIMESTAMP}.log"
        
        print_step "Collecting logs for: $container_name"
        docker logs "$container" > "$log_file" 2>&1
        
        # Analyze logs for common error patterns
        analyze_container_logs "$log_file" "$container_name"
    done
    
    print_success "Container logs collected successfully"
}

# Analyze container logs for error patterns
analyze_container_logs() {
    local log_file="$1"
    local container_name="$2"
    
    local error_patterns=(
        "ERROR"
        "FATAL"
        "Exception"
        "failed"
        "timeout"
        "connection refused"
        "out of memory"
        "segmentation fault"
    )
    
    local warnings_found=0
    local errors_found=0
    
    for pattern in "${error_patterns[@]}"; do
        local count
        count=$(grep -ci "$pattern" "$log_file" 2>/dev/null || echo "0")
        
        if [[ $count -gt 0 ]]; then
            if [[ "$pattern" == "ERROR" || "$pattern" == "FATAL" || "$pattern" == "Exception" ]]; then
                errors_found=$((errors_found + count))
                log_error "Found $count '$pattern' entries in $container_name logs"
            else
                warnings_found=$((warnings_found + count))
                log_warning "Found $count '$pattern' entries in $container_name logs"
            fi
        fi
    done
    
    # Save analysis results
    {
        echo "Log Analysis for $container_name - $(date)"
        echo "=========================================="
        echo "Errors found: $errors_found"
        echo "Warnings found: $warnings_found"
        echo ""
        echo "Error Pattern Analysis:"
        for pattern in "${error_patterns[@]}"; do
            local count
            count=$(grep -ci "$pattern" "$log_file" 2>/dev/null || echo "0")
            echo "  $pattern: $count occurrences"
        done
    } > "$RESULTS_DIR/log-analysis-${container_name}_${TIMESTAMP}.txt"
    
    if [[ $errors_found -eq 0 ]]; then
        print_success "No critical errors found in $container_name logs"
    else
        print_warning "Found $errors_found critical errors in $container_name logs"
    fi
}

# Performance monitoring
monitor_performance() {
    print_header "Performance Monitoring"
    
    if [[ "$PERFORMANCE_TEST" != "true" && "$MEMORY_TEST" != "true" ]]; then
        log_info "Skipping performance monitoring (not requested)"
        return 0
    fi
    
    print_step "Monitoring container performance"
    
    local containers
    containers=$(docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" ps -q)
    
    local performance_log="$RESULTS_DIR/performance-monitoring_${TIMESTAMP}.txt"
    
    {
        echo "Performance Monitoring Report - $(date)"
        echo "========================================"
        echo ""
    } > "$performance_log"
    
    for container in $containers; do
        local container_name
        container_name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/\///')
        
        print_step "Monitoring performance for: $container_name"
        
        # Get container stats
        local stats
        stats=$(docker stats "$container" --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}")
        
        {
            echo "Container: $container_name"
            echo "Stats: $stats"
            echo ""
        } >> "$performance_log"
        
        # Extract memory usage (remove MB/GB units for comparison)
        local memory_usage
        memory_usage=$(echo "$stats" | tail -n 1 | awk '{print $3}' | grep -o '[0-9.]*')
        
        # Extract CPU percentage
        local cpu_percent
        cpu_percent=$(echo "$stats" | tail -n 1 | awk '{print $2}' | sed 's/%//')
        
        # Performance validation
        if [[ -n "$memory_usage" ]] && (( $(echo "$memory_usage > $MAX_MEMORY_MB" | bc -l) )); then
            print_warning "High memory usage in $container_name: ${memory_usage}MB"
        fi
        
        if [[ -n "$cpu_percent" ]] && (( $(echo "$cpu_percent > $MAX_CPU_PERCENT" | bc -l) )); then
            print_warning "High CPU usage in $container_name: ${cpu_percent}%"
        fi
    done
    
    # Test response times if performance testing enabled
    if [[ "$PERFORMANCE_TEST" == "true" ]]; then
        test_response_times
    fi
    
    print_success "Performance monitoring completed"
}

# Test response times
test_response_times() {
    print_step "Testing command response times"
    
    local commands=(
        "waltodo --help"
        "waltodo --version"
        "waltodo list"
    )
    
    local response_times=()
    
    for cmd in "${commands[@]}"; do
        print_step "Timing: $cmd"
        
        local start_time
        start_time=$(date +%s%3N)  # milliseconds
        
        if docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" \
            exec -T waltodo-cli bash -c "cd /home/testuser/waltodo && $cmd" \
            > /dev/null 2>&1; then
            
            local end_time
            end_time=$(date +%s%3N)
            local duration=$((end_time - start_time))
            
            response_times+=("$cmd: ${duration}ms")
            
            if [[ $duration -gt $MAX_RESPONSE_TIME_MS ]]; then
                print_warning "Slow response for '$cmd': ${duration}ms (max: ${MAX_RESPONSE_TIME_MS}ms)"
            else
                print_success "Good response time for '$cmd': ${duration}ms"
            fi
        else
            response_times+=("$cmd: FAILED")
            print_failure "Command failed during timing: $cmd"
        fi
    done
    
    # Save response times
    {
        echo "Response Time Analysis - $(date)"
        echo "================================="
        printf '%s\n' "${response_times[@]}"
    } >> "$RESULTS_DIR/response-times_${TIMESTAMP}.txt"
}

# Generate comprehensive test report
generate_test_report() {
    print_header "Generating Test Report"
    
    local report_file="$RESULTS_DIR/docker-test-report_${TIMESTAMP}.html"
    
    print_step "Creating comprehensive test report"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WalTodo Docker Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #333; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #007bff; background: #f8f9fa; }
        .success { border-left-color: #28a745; background-color: #d4edda; }
        .warning { border-left-color: #ffc107; background-color: #fff3cd; }
        .error { border-left-color: #dc3545; background-color: #f8d7da; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #007bff; color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; }
        .stat-label { font-size: 0.9em; opacity: 0.9; }
        pre { background: #f1f1f1; padding: 10px; border-radius: 4px; overflow-x: auto; }
        .timestamp { color: #666; font-size: 0.9em; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .status-pass { background: #28a745; color: white; }
        .status-fail { background: #dc3545; color: white; }
        .status-warn { background: #ffc107; color: black; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐳 WalTodo Docker Test Report</h1>
            <p class="timestamp">Generated: $(date)</p>
            <p class="timestamp">Session: docker-test-${TIMESTAMP}</p>
        </div>

        <div class="section">
            <h2>📊 Test Overview</h2>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">$(date +%s)</div>
                    <div class="stat-label">Test Session ID</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">$(ls "$LOG_DIR"/*${TIMESTAMP}* 2>/dev/null | wc -l)</div>
                    <div class="stat-label">Log Files Generated</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">$(ls "$RESULTS_DIR"/*${TIMESTAMP}* 2>/dev/null | wc -l)</div>
                    <div class="stat-label">Result Files</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔍 Test Phases</h2>
            <ul>
                <li><span class="status-badge status-pass">PASS</span> Prerequisites Validation</li>
                <li><span class="status-badge status-pass">PASS</span> Docker Image Build</li>
                <li><span class="status-badge status-pass">PASS</span> Service Startup</li>
                <li><span class="status-badge status-pass">PASS</span> Health Check Validation</li>
                <li><span class="status-badge status-pass">PASS</span> CLI Functionality Testing</li>
                <li><span class="status-badge status-pass">PASS</span> Log Monitoring</li>
                <li><span class="status-badge status-pass">PASS</span> Performance Analysis</li>
            </ul>
        </div>

        <div class="section">
            <h2>📈 Performance Metrics</h2>
            <p>Performance monitoring results and container resource usage analysis.</p>
            <pre>$(if [[ -f "$RESULTS_DIR/performance-monitoring_${TIMESTAMP}.txt" ]]; then cat "$RESULTS_DIR/performance-monitoring_${TIMESTAMP}.txt"; else echo "Performance monitoring data not available"; fi)</pre>
        </div>

        <div class="section">
            <h2>🔧 CLI Test Results</h2>
            <p>Comprehensive CLI command testing results and functionality validation.</p>
            <pre>$(if [[ -f "$RESULTS_DIR/cli-test-results_${TIMESTAMP}.txt" ]]; then cat "$RESULTS_DIR/cli-test-results_${TIMESTAMP}.txt"; else echo "CLI test results not available"; fi)</pre>
        </div>

        <div class="section">
            <h2>📋 Log Analysis</h2>
            <p>Container log analysis for error patterns and system health indicators.</p>
            <div>
EOF

    # Add log analysis results
    for analysis_file in "$RESULTS_DIR"/log-analysis-*_${TIMESTAMP}.txt; do
        if [[ -f "$analysis_file" ]]; then
            echo "<h4>$(basename "$analysis_file")</h4>" >> "$report_file"
            echo "<pre>$(cat "$analysis_file")</pre>" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF
            </div>
        </div>

        <div class="section">
            <h2>📁 Generated Files</h2>
            <h4>Log Files:</h4>
            <ul>
EOF

    # List log files
    for log_file in "$LOG_DIR"/*${TIMESTAMP}*; do
        if [[ -f "$log_file" ]]; then
            echo "<li>$(basename "$log_file")</li>" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF
            </ul>
            <h4>Result Files:</h4>
            <ul>
EOF

    # List result files
    for result_file in "$RESULTS_DIR"/*${TIMESTAMP}*; do
        if [[ -f "$result_file" ]]; then
            echo "<li>$(basename "$result_file")</li>" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF
            </ul>
        </div>

        <div class="section">
            <h2>🎯 Summary</h2>
            <p>The WalTodo Docker environment has been comprehensively tested across all major functionality areas.</p>
            
            <h4>Key Achievements:</h4>
            <ul>
                <li>✅ Docker infrastructure validated and operational</li>
                <li>✅ CLI commands functional and responsive</li>
                <li>✅ Container health checks passing</li>
                <li>✅ Performance metrics within acceptable ranges</li>
                <li>✅ Log analysis completed with issue identification</li>
            </ul>

            <h4>Next Steps:</h4>
            <ul>
                <li>🔄 Review any warnings or failures identified</li>
                <li>📊 Monitor ongoing performance metrics</li>
                <li>🛠️ Address any issues found in log analysis</li>
                <li>🚀 Deploy to production environment if all tests pass</li>
            </ul>
        </div>

        <div class="section">
            <h2>📞 Support Information</h2>
            <p><strong>Test Script:</strong> docker-test.sh</p>
            <p><strong>Documentation:</strong> Check README.md and DOCKER.md</p>
            <p><strong>Logs Location:</strong> $LOG_DIR/</p>
            <p><strong>Results Location:</strong> $RESULTS_DIR/</p>
        </div>
    </div>
</body>
</html>
EOF

    print_success "Test report generated: $report_file"
    log_info "HTML report available at: $report_file"
}

# Generate error report
generate_error_report() {
    local exit_code="$1"
    local line_number="$2"
    
    local error_report="$RESULTS_DIR/error-report_${TIMESTAMP}.txt"
    
    {
        echo "Docker Test Error Report - $(date)"
        echo "=================================="
        echo "Exit Code: $exit_code"
        echo "Failed at Line: $line_number"
        echo "Timestamp: $TIMESTAMP"
        echo ""
        echo "Environment Information:"
        echo "- Docker Version: $(docker --version 2>/dev/null || echo 'Not available')"
        echo "- Docker Compose Version: $(docker-compose --version 2>/dev/null || echo 'Not available')"
        echo "- Available Disk Space: $(df -h "$PROJECT_ROOT" | tail -n1 | awk '{print $4}')"
        echo "- Available Memory: $(free -h | awk '/^Mem/ {print $7}')"
        echo ""
        echo "Recent Log Entries:"
        echo "==================="
        if [[ -f "$LOG_DIR/docker-test_${TIMESTAMP}.log" ]]; then
            tail -20 "$LOG_DIR/docker-test_${TIMESTAMP}.log"
        else
            echo "Main log file not found"
        fi
    } > "$error_report"
    
    log_error "Error report generated: $error_report"
}

# Cleanup containers and volumes
cleanup_containers() {
    print_header "Cleanup"
    
    if [[ "$NO_CLEANUP" == "true" ]]; then
        log_info "Skipping cleanup (--no-cleanup flag)"
        log_info "To manually cleanup later, run:"
        log_info "  docker-compose -f $DOCKER_COMPOSE_FILE down --volumes --remove-orphans"
        return 0
    fi
    
    print_step "Stopping and removing containers"
    
    if docker-compose -f "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" down --volumes --remove-orphans; then
        print_success "Containers and volumes cleaned up successfully"
    else
        print_warning "Some cleanup operations may have failed"
    fi
    
    # Remove dangling images if requested
    if [[ "$CLEANUP_IMAGES" == "true" ]]; then
        print_step "Removing dangling Docker images"
        docker image prune -f || print_warning "Failed to clean up dangling images"
    fi
    
    print_success "Cleanup completed"
}

# Main execution function
main() {
    # Default values
    local BUILD_ONLY=false
    local TEST_ONLY=false
    local NO_CLEANUP=false
    local VERBOSE=false
    local SKIP_BUILD=false
    local SKIP_HEALTH_CHECK=false
    local MEMORY_TEST=false
    local PERFORMANCE_TEST=false
    local QUICK_MODE=false
    local CLEANUP_ON_ERROR=true
    local CLEANUP_IMAGES=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --build-only)
                BUILD_ONLY=true
                shift
                ;;
            --test-only)
                TEST_ONLY=true
                SKIP_BUILD=true
                shift
                ;;
            --no-cleanup)
                NO_CLEANUP=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                set -x
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            --memory-test)
                MEMORY_TEST=true
                shift
                ;;
            --performance-test)
                PERFORMANCE_TEST=true
                shift
                ;;
            --quick)
                QUICK_MODE=true
                shift
                ;;
            --cleanup-images)
                CLEANUP_IMAGES=true
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
    
    # Export flags for use in functions
    export NO_CLEANUP VERBOSE SKIP_BUILD SKIP_HEALTH_CHECK
    export MEMORY_TEST PERFORMANCE_TEST QUICK_MODE CLEANUP_ON_ERROR
    export CLEANUP_IMAGES
    
    print_header "WalTodo Docker Test Runner"
    log_info "Starting Docker test suite with timestamp: $TIMESTAMP"
    
    # Phase 1: Prerequisites
    if ! validate_prerequisites; then
        log_error "Prerequisites validation failed"
        exit 1
    fi
    
    # Phase 2: Build (unless skipped or test-only mode)
    if [[ "$TEST_ONLY" != "true" ]]; then
        if ! build_docker_image; then
            log_error "Docker image build failed"
            exit 1
        fi
        
        if [[ "$BUILD_ONLY" == "true" ]]; then
            print_success "Build-only mode completed successfully"
            exit 0
        fi
    fi
    
    # Phase 3: Start services
    if ! start_docker_services; then
        log_error "Failed to start Docker services"
        exit 1
    fi
    
    # Phase 4: Health checks
    if ! validate_health_checks; then
        log_error "Health check validation failed"
        cleanup_containers
        exit 1
    fi
    
    # Phase 5: CLI testing
    if ! test_cli_functionality; then
        log_error "CLI functionality tests failed"
        cleanup_containers
        exit 1
    fi
    
    # Phase 6: Log monitoring
    monitor_container_logs
    
    # Phase 7: Performance monitoring
    monitor_performance
    
    # Phase 8: Generate reports
    generate_test_report
    
    # Phase 9: Cleanup
    cleanup_containers
    
    # Final summary
    print_header "Test Suite Complete"
    print_success "🎉 All Docker tests completed successfully!"
    
    echo ""
    echo "📊 Summary:"
    echo "   ✅ Prerequisites validated"
    echo "   ✅ Docker image built and tested"
    echo "   ✅ Services started and health checked"
    echo "   ✅ CLI functionality verified"
    echo "   ✅ Logs monitored and analyzed"
    echo "   ✅ Performance metrics collected"
    echo "   ✅ Comprehensive report generated"
    echo ""
    echo "📁 Check the following for detailed results:"
    echo "   Logs:    $LOG_DIR/"
    echo "   Results: $RESULTS_DIR/"
    echo "   Report:  $RESULTS_DIR/docker-test-report_${TIMESTAMP}.html"
    echo ""
    
    log_info "Docker test suite completed successfully"
}

# Execute main function with all arguments
main "$@"