#!/bin/bash

# Optimized Docker build script for WalTodo CLI testing
# Implements build caching, multi-stage optimization, and performance monitoring

set -euo pipefail

# Configuration
DOCKER_BUILDKIT=1
export DOCKER_BUILDKIT

BUILD_START_TIME=$(date +%s)
BUILD_LOG="./logs/docker-build-optimized.log"
PERFORMANCE_LOG="./logs/docker-performance.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$BUILD_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$BUILD_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$BUILD_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$BUILD_LOG"
}

# Create log directories
mkdir -p logs test-results

# Function to check Docker and BuildKit availability
check_docker_setup() {
    log "Checking Docker setup..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker buildx version &> /dev/null; then
        log_error "Docker BuildKit is not available"
        exit 1
    fi
    
    log_success "Docker and BuildKit are available"
}

# Function to clean up old builds and caches
cleanup_old_builds() {
    log "Cleaning up old Docker builds and caches..."
    
    # Remove old test containers
    docker container prune -f || log_warning "Failed to prune containers"
    
    # Remove old test images
    docker image ls --filter "reference=waltodo-test*" --format "{{.ID}}" | head -n -2 | xargs -r docker rmi -f || log_warning "Failed to remove old images"
    
    # Clean up build cache (keep recent builds)
    docker buildx prune -f --filter "until=24h" || log_warning "Failed to prune build cache"
    
    log_success "Cleanup completed"
}

# Function to build optimized Docker image
build_optimized_image() {
    log "Building optimized Docker image..."
    
    local build_args=(
        "--file" "Dockerfile.test.optimized"
        "--target" "test-runner"
        "--tag" "waltodo-test-optimized:latest"
        "--cache-from" "waltodo-test-optimized:latest"
        "--build-arg" "BUILDKIT_INLINE_CACHE=1"
        "--build-arg" "NODE_ENV=test"
        "--progress" "plain"
        "."
    )
    
    # Build with timeout and progress monitoring
    if timeout 600 docker buildx build "${build_args[@]}" 2>&1 | tee -a "$BUILD_LOG"; then
        log_success "Docker image built successfully"
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log_error "Docker build timed out after 10 minutes"
        else
            log_error "Docker build failed with exit code $exit_code"
        fi
        return $exit_code
    fi
}

# Function to analyze build performance
analyze_build_performance() {
    log "Analyzing build performance..."
    
    local build_end_time=$(date +%s)
    local build_duration=$((build_end_time - BUILD_START_TIME))
    
    # Get image size
    local image_size=$(docker images waltodo-test-optimized:latest --format "{{.Size}}")
    
    # Get layer information
    local layer_count=$(docker history waltodo-test-optimized:latest --quiet | wc -l)
    
    # Performance report
    cat > "$PERFORMANCE_LOG" << EOF
WalTodo Docker Build Performance Report
======================================

Build Time: ${build_duration} seconds
Image Size: ${image_size}
Layer Count: ${layer_count}
Build Method: Multi-stage optimized
Cache Strategy: BuildKit inline cache

Performance Metrics:
- Build Speed: $(( build_duration < 300 ? "EXCELLENT" : build_duration < 600 ? "GOOD" : "NEEDS_IMPROVEMENT" ))
- Image Size: $(docker images waltodo-test-optimized:latest --format "{{.Size}}")
- Cache Efficiency: $(docker system df --format "{{.Reclaimable}}")

Recommendations:
- Build time under 5 minutes: $([ $build_duration -lt 300 ] && echo "✅ ACHIEVED" || echo "❌ NOT ACHIEVED")
- Image size under 2GB: $([ "$(docker images waltodo-test-optimized:latest --format "{{.Size}}" | sed 's/[^0-9.]//g')" -lt 2 ] 2>/dev/null && echo "✅ ACHIEVED" || echo "⚠️  NEEDS ANALYSIS")

EOF

    log_success "Performance analysis completed - see $PERFORMANCE_LOG"
    
    # Display key metrics
    echo
    echo "=== BUILD PERFORMANCE SUMMARY ==="
    echo "Build Duration: ${build_duration} seconds"
    echo "Image Size: ${image_size}"
    echo "Layer Count: ${layer_count}"
    echo
}

# Function to validate optimized build
validate_optimized_build() {
    log "Validating optimized build..."
    
    # Test image layers
    if docker history waltodo-test-optimized:latest >/dev/null 2>&1; then
        log_success "Image layers are valid"
    else
        log_error "Image validation failed"
        return 1
    fi
    
    # Test basic container functionality
    if docker run --rm waltodo-test-optimized:latest node --version >/dev/null 2>&1; then
        log_success "Container basic functionality validated"
    else
        log_error "Container functionality validation failed"
        return 1
    fi
    
    # Test pnpm availability
    if docker run --rm waltodo-test-optimized:latest pnpm --version >/dev/null 2>&1; then
        log_success "PNPM is available in container"
    else
        log_warning "PNPM validation failed"
    fi
    
    log_success "Build validation completed"
}

# Function to compare with original build
compare_with_original() {
    log "Comparing optimized build with original..."
    
    if docker images waltodo-test:latest >/dev/null 2>&1; then
        local original_size=$(docker images waltodo-test:latest --format "{{.Size}}")
        local optimized_size=$(docker images waltodo-test-optimized:latest --format "{{.Size}}")
        
        echo "Original Image Size: $original_size"
        echo "Optimized Image Size: $optimized_size"
        
        # Add to performance log
        echo >> "$PERFORMANCE_LOG"
        echo "Comparison with Original Build:" >> "$PERFORMANCE_LOG"
        echo "- Original Size: $original_size" >> "$PERFORMANCE_LOG"
        echo "- Optimized Size: $optimized_size" >> "$PERFORMANCE_LOG"
        
        log_success "Size comparison completed"
    else
        log_warning "Original image not found for comparison"
    fi
}

# Main execution
main() {
    echo "Starting optimized Docker build for WalTodo CLI testing..."
    echo "Build log: $BUILD_LOG"
    echo "Performance log: $PERFORMANCE_LOG"
    echo
    
    check_docker_setup
    cleanup_old_builds
    
    if build_optimized_image; then
        analyze_build_performance
        validate_optimized_build
        compare_with_original
        
        echo
        log_success "Optimized Docker build completed successfully!"
        echo "Run the following command to test:"
        echo "  docker-compose -f docker-compose.test.optimized.yml up --build"
        
        return 0
    else
        log_error "Optimized Docker build failed"
        return 1
    fi
}

# Execute main function
main "$@"