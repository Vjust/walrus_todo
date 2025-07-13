#!/bin/bash

# Run E2E tests for Waltodo
# This script builds the Docker image, starts the container, and runs the test suite

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        log_warning ".env file not found. Creating from .env.example..."
        cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
        log_info "Please review and update $ENV_FILE with your configuration"
    fi
    
    log_success "Prerequisites check passed"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    
    if [ $? -eq 0 ]; then
        log_success "Docker image built successfully"
    else
        log_error "Failed to build Docker image"
        exit 1
    fi
}

# Start containers
start_containers() {
    log_info "Starting containers..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" up -d
    
    if [ $? -eq 0 ]; then
        log_success "Containers started successfully"
    else
        log_error "Failed to start containers"
        exit 1
    fi
    
    # Wait for container to be ready
    log_info "Waiting for container to be ready..."
    sleep 5
}

# Run E2E tests
run_tests() {
    log_info "Running E2E tests..."
    
    cd "$SCRIPT_DIR"
    ./e2e/workflows.sh
    
    return $?
}

# Stop containers
stop_containers() {
    log_info "Stopping containers..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" down
    
    if [ $? -eq 0 ]; then
        log_success "Containers stopped successfully"
    else
        log_warning "Failed to stop containers gracefully"
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    stop_containers
}

# Main execution
main() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}    Waltodo E2E Test Runner${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo
    
    # Set up cleanup on exit
    trap cleanup EXIT
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --keep-running)
                KEEP_RUNNING=true
                shift
                ;;
            --clean)
                log_info "Cleaning up existing containers and volumes..."
                cd "$PROJECT_ROOT"
                docker-compose -f "$COMPOSE_FILE" down -v
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-build     Skip building Docker image"
                echo "  --keep-running   Keep containers running after tests"
                echo "  --clean          Clean up existing containers and volumes"
                echo "  --help           Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Run the test pipeline
    check_prerequisites
    
    if [ "${SKIP_BUILD:-false}" != "true" ]; then
        build_image
    else
        log_info "Skipping image build"
    fi
    
    start_containers
    
    # Run tests and capture exit code
    run_tests
    TEST_EXIT_CODE=$?
    
    # Handle cleanup based on options
    if [ "${KEEP_RUNNING:-false}" == "true" ]; then
        log_info "Keeping containers running. To stop them, run:"
        echo "  cd $PROJECT_ROOT && docker-compose -f $COMPOSE_FILE down"
        trap - EXIT  # Remove cleanup trap
    fi
    
    # Exit with test exit code
    exit $TEST_EXIT_CODE
}

# Run main function
main "$@"