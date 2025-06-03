#!/bin/bash

# Optimized Build Script for Walrus Sites
# Enhanced with caching, performance optimizations, and environment-specific configurations

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/out"
CACHE_DIR="$PROJECT_DIR/.build-cache"
TEMP_DIR="$PROJECT_DIR/.temp"

# Default values
ENVIRONMENT="development"
CLEAN_CACHE=false
PARALLEL_JOBS=4
ENABLE_COMPRESSION=true
ENABLE_OPTIMIZATION=true
SKIP_DEPS=false
VERBOSE=false

# Performance tracking
START_TIME=$(date +%s)

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_debug() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

# Performance timing
time_operation() {
    local operation_name="$1"
    local start_time=$(date +%s.%N)
    
    "$@"
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc -l)
    log_debug "Operation '$operation_name' took ${duration}s"
}

# Help function
show_help() {
    cat << EOF
Optimized Build Script for Walrus Sites

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV     Build environment (development|staging|production) [default: development]
    -c, --clean-cache         Clean build cache before building
    -j, --jobs NUM           Number of parallel jobs [default: 4]
    --no-compression         Disable compression
    --no-optimization        Disable optimizations
    --skip-deps              Skip dependency installation
    -v, --verbose            Enable verbose logging
    -h, --help               Show this help message

EXAMPLES:
    $0                                    # Development build with defaults
    $0 -e production -c                   # Clean production build
    $0 -e staging -v -j 8                 # Verbose staging build with 8 parallel jobs
    $0 --no-optimization --skip-deps     # Fast build without optimizations

ENVIRONMENT VARIABLES:
    NODE_ENV                 Node.js environment
    BUILD_CACHE_DISABLED     Disable build caching
    MAX_PARALLEL_JOBS        Maximum parallel jobs
    COMPRESSION_LEVEL        Compression level (1-9)

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
                    log_error "Invalid environment: $ENVIRONMENT. Must be 'development', 'staging', or 'production'"
                    exit 1
                fi
                shift 2
                ;;
            -c|--clean-cache)
                CLEAN_CACHE=true
                shift
                ;;
            -j|--jobs)
                PARALLEL_JOBS="$2"
                if ! [[ "$PARALLEL_JOBS" =~ ^[1-9][0-9]*$ ]]; then
                    log_error "Invalid number of jobs: $PARALLEL_JOBS"
                    exit 1
                fi
                shift 2
                ;;
            --no-compression)
                ENABLE_COMPRESSION=false
                shift
                ;;
            --no-optimization)
                ENABLE_OPTIMIZATION=false
                shift
                ;;
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Setup build environment
setup_environment() {
    log_info "Setting up build environment..."
    
    # Create necessary directories
    mkdir -p "$CACHE_DIR" "$TEMP_DIR"
    
    # Set Node.js environment
    export NODE_ENV="$ENVIRONMENT"
    export NEXT_TELEMETRY_DISABLED=1
    
    # Set performance options
    if [[ "$ENABLE_OPTIMIZATION" == true ]]; then
        export NODE_OPTIONS="--max-old-space-size=4096"
        export UV_THREADPOOL_SIZE="$PARALLEL_JOBS"
    fi
    
    # Cache configuration
    if [[ "${BUILD_CACHE_DISABLED:-false}" != "true" ]]; then
        export NEXT_CACHE_DIR="$CACHE_DIR/next"
        mkdir -p "$NEXT_CACHE_DIR"
    fi
    
    log_success "Environment setup completed"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    if ! printf '%s\n%s\n' "$required_version" "$node_version" | sort -V -C; then
        log_error "Node.js version $node_version is less than required $required_version"
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is required but not installed"
        exit 1
    fi
    
    # Check available disk space (require at least 1GB)
    local available_space=$(df "$PROJECT_DIR" | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 1048576 ]]; then  # 1GB in KB
        log_warning "Low disk space available: $(($available_space / 1024))MB"
    fi
    
    # Check available memory
    if command -v free &> /dev/null; then
        local available_memory=$(free -m | awk 'NR==2{printf "%d", $7}')
        if [[ $available_memory -lt 1024 ]]; then
            log_warning "Low memory available: ${available_memory}MB"
            PARALLEL_JOBS=2  # Reduce parallel jobs
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Clean cache if requested
clean_cache() {
    if [[ "$CLEAN_CACHE" == true ]]; then
        log_info "Cleaning build cache..."
        
        # Clean Next.js cache
        if [[ -d "$CACHE_DIR" ]]; then
            rm -rf "$CACHE_DIR"
            log_debug "Removed cache directory: $CACHE_DIR"
        fi
        
        # Clean previous build
        if [[ -d "$BUILD_DIR" ]]; then
            rm -rf "$BUILD_DIR"
            log_debug "Removed build directory: $BUILD_DIR"
        fi
        
        # Clean Next.js build artifacts
        if [[ -d "$PROJECT_DIR/.next" ]]; then
            rm -rf "$PROJECT_DIR/.next"
            log_debug "Removed .next directory"
        fi
        
        log_success "Cache cleaned"
    fi
}

# Install dependencies with caching
install_dependencies() {
    if [[ "$SKIP_DEPS" == true ]]; then
        log_info "Skipping dependency installation as requested"
        return
    fi
    
    log_info "Installing dependencies..."
    cd "$PROJECT_DIR"
    
    # Check if node_modules is up to date
    local lockfile_modified=0
    local nodemodules_modified=0
    
    if [[ -f "pnpm-lock.yaml" ]]; then
        lockfile_modified=$(stat -c %Y "pnpm-lock.yaml" 2>/dev/null || stat -f %m "pnpm-lock.yaml")
    fi
    
    if [[ -d "node_modules" ]]; then
        nodemodules_modified=$(stat -c %Y "node_modules" 2>/dev/null || stat -f %m "node_modules")
    fi
    
    if [[ $lockfile_modified -gt $nodemodules_modified ]]; then
        log_info "Lock file is newer than node_modules, installing dependencies..."
        time_operation "dependency_install" pnpm install --frozen-lockfile --prefer-offline
    else
        log_debug "Dependencies are up to date"
    fi
    
    log_success "Dependencies ready"
}

# Generate environment-specific configuration
generate_config() {
    log_info "Generating configuration for environment: $ENVIRONMENT"
    
    # Generate sites configuration using environment manager
    local config_script="$PROJECT_DIR/config/environments.js"
    if [[ -f "$config_script" ]]; then
        local sites_config="$PROJECT_DIR/sites-config.${ENVIRONMENT}.yaml"
        time_operation "config_generation" node "$config_script" "$ENVIRONMENT" "$sites_config"
        log_success "Generated environment-specific configuration"
    else
        log_warning "Environment configuration script not found, using defaults"
    fi
}

# Optimize assets
optimize_assets() {
    if [[ "$ENABLE_OPTIMIZATION" != true ]]; then
        log_info "Asset optimization disabled, skipping..."
        return
    fi
    
    log_info "Optimizing assets..."
    cd "$PROJECT_DIR"
    
    # Optimize images if imagemin is available
    if command -v imagemin &> /dev/null && [[ -d "public/images" ]]; then
        log_debug "Optimizing images..."
        time_operation "image_optimization" imagemin "public/images/*" --out-dir="$TEMP_DIR/images" --plugin=imagemin-mozjpeg --plugin=imagemin-pngquant
        
        if [[ -d "$TEMP_DIR/images" ]]; then
            cp -r "$TEMP_DIR/images"/* "public/images/"
            log_debug "Optimized images copied back"
        fi
    fi
    
    log_success "Asset optimization completed"
}

# Build the application
build_application() {
    log_info "Building application for $ENVIRONMENT environment..."
    cd "$PROJECT_DIR"
    
    # Set build-specific environment variables
    case "$ENVIRONMENT" in
        "development")
            export NODE_ENV=development
            export NEXT_BUILD_MODE=development
            ;;
        "staging")
            export NODE_ENV=production
            export NEXT_BUILD_MODE=production
            export ENABLE_SOURCEMAPS=true
            ;;
        "production")
            export NODE_ENV=production
            export NEXT_BUILD_MODE=production
            export ENABLE_SOURCEMAPS=false
            export NEXT_OPTIMIZE=true
            ;;
    esac
    
    # Build with timing
    local build_start=$(date +%s)
    
    if [[ "$VERBOSE" == true ]]; then
        time_operation "next_build" pnpm run build:export
    else
        time_operation "next_build" pnpm run build:export > /dev/null
    fi
    
    local build_end=$(date +%s)
    local build_duration=$((build_end - build_start))
    
    # Verify build output
    if [[ ! -d "$BUILD_DIR" ]]; then
        log_error "Build directory was not created: $BUILD_DIR"
        exit 1
    fi
    
    local file_count=$(find "$BUILD_DIR" -type f | wc -l)
    local build_size=$(du -sh "$BUILD_DIR" | cut -f1)
    
    log_success "Build completed in ${build_duration}s"
    log_info "Build contains $file_count files ($build_size)"
}

# Post-build optimizations
post_build_optimization() {
    if [[ "$ENABLE_OPTIMIZATION" != true ]]; then
        log_info "Post-build optimization disabled, skipping..."
        return
    fi
    
    log_info "Running post-build optimizations..."
    cd "$BUILD_DIR"
    
    # Compress static assets if enabled
    if [[ "$ENABLE_COMPRESSION" == true ]] && command -v gzip &> /dev/null; then
        log_debug "Compressing static assets..."
        
        # Compress JS and CSS files
        find . -name "*.js" -o -name "*.css" -o -name "*.html" | while read -r file; do
            if [[ ! -f "${file}.gz" ]]; then
                gzip -k -9 "$file"
                log_debug "Compressed: $file"
            fi
        done
        
        log_debug "Asset compression completed"
    fi
    
    # Generate file manifest
    log_debug "Generating file manifest..."
    find . -type f -exec stat -c '%n %s %Y' {} \; > "$BUILD_DIR/file-manifest.txt"
    
    log_success "Post-build optimization completed"
}

# Validate build output
validate_build() {
    log_info "Validating build output..."
    
    # Run configuration validator if available
    local validator_script="$PROJECT_DIR/scripts/validate-config-enhanced.js"
    if [[ -f "$validator_script" ]]; then
        if node "$validator_script"; then
            log_success "Configuration validation passed"
        else
            log_warning "Configuration validation failed, but continuing..."
        fi
    fi
    
    # Check essential files
    local essential_files=("index.html" "404.html")
    for file in "${essential_files[@]}"; do
        if [[ ! -f "$BUILD_DIR/$file" ]]; then
            log_warning "Missing essential file: $file"
        fi
    done
    
    # Performance analysis
    local total_size=$(du -s "$BUILD_DIR" | cut -f1)
    if [[ $total_size -gt 102400 ]]; then  # 100MB in KB
        log_warning "Build size is large ($(($total_size / 1024))MB), consider optimization"
    fi
    
    log_success "Build validation completed"
}

# Generate build report
generate_report() {
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    
    log_info "Generating build report..."
    
    local report_file="$PROJECT_DIR/build-report-${ENVIRONMENT}.json"
    
    cat > "$report_file" << EOF
{
  "environment": "$ENVIRONMENT",
  "timestamp": "$(date -Iseconds)",
  "duration": $total_duration,
  "buildPath": "$BUILD_DIR",
  "configuration": {
    "parallelJobs": $PARALLEL_JOBS,
    "compressionEnabled": $ENABLE_COMPRESSION,
    "optimizationEnabled": $ENABLE_OPTIMIZATION,
    "cacheCleared": $CLEAN_CACHE
  },
  "statistics": {
    "fileCount": $(find "$BUILD_DIR" -type f | wc -l),
    "totalSize": $(du -s "$BUILD_DIR" | cut -f1),
    "sizeFormatted": "$(du -sh "$BUILD_DIR" | cut -f1)"
  },
  "performance": {
    "nodeVersion": "$(node --version)",
    "pnpmVersion": "$(pnpm --version)",
    "memoryUsage": "$(ps -o rss= -p $$ | awk '{print $1}')KB"
  }
}
EOF
    
    log_success "Build report generated: $report_file"
    
    # Display summary
    echo ""
    echo -e "${CYAN}📊 Build Summary${NC}"
    echo "===================="
    echo "Environment: $ENVIRONMENT"
    echo "Duration: ${total_duration}s"
    echo "Files: $(find "$BUILD_DIR" -type f | wc -l)"
    echo "Size: $(du -sh "$BUILD_DIR" | cut -f1)"
    echo "Report: $report_file"
}

# Cleanup function
cleanup() {
    log_debug "Cleaning up temporary files..."
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

# Main execution
main() {
    log_info "WalTodo Optimized Build Script"
    log_info "=============================="
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Parse command line arguments
    parse_args "$@"
    
    # Display configuration
    log_info "Configuration:"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  Parallel Jobs: $PARALLEL_JOBS"
    log_info "  Clean Cache: $CLEAN_CACHE"
    log_info "  Compression: $ENABLE_COMPRESSION"
    log_info "  Optimization: $ENABLE_OPTIMIZATION"
    log_info "  Skip Dependencies: $SKIP_DEPS"
    log_info "  Verbose: $VERBOSE"
    
    # Execute build steps
    setup_environment
    check_prerequisites
    clean_cache
    install_dependencies
    generate_config
    optimize_assets
    build_application
    post_build_optimization
    validate_build
    generate_report
    
    log_success "Build process completed successfully!"
    log_info "Built application is ready at: $BUILD_DIR"
}

# Check if script is being sourced or executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi