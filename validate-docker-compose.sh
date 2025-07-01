#!/bin/bash

# Docker Compose Validation Script for WalTodo
# This script validates the Docker Compose configuration and environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation results
VALIDATION_PASSED=true

# Function to log validation steps
log_step() {
    echo -e "${BLUE}[VALIDATION]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    VALIDATION_PASSED=false
}

# Function to check if required files exist
check_required_files() {
    log_step "Checking required files..."
    
    local required_files=(
        "docker-compose.yml"
        "Dockerfile.test"
        "Dockerfile.test.optimized"
        "docker/fluent-bit.conf"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            log_success "Found $file"
        else
            log_error "Missing required file: $file"
        fi
    done
}

# Function to validate Docker Compose syntax
validate_compose_syntax() {
    log_step "Validating Docker Compose syntax..."
    
    if docker-compose config > /dev/null 2>&1; then
        log_success "Docker Compose syntax is valid"
    else
        log_error "Docker Compose syntax validation failed"
        echo "Run 'docker-compose config' for detailed error information"
    fi
}

# Function to check environment file
check_environment_file() {
    log_step "Checking environment configuration..."
    
    if [ -f ".env" ]; then
        log_success "Found .env file"
    elif [ -f ".env.docker" ]; then
        log_warning "Found .env.docker but no .env file"
        log_step "You may want to copy .env.docker to .env"
    elif [ -f ".env.example" ]; then
        log_warning "Found .env.example but no .env file"
        log_step "You may want to copy .env.example to .env"
    else
        log_error "No environment file found (.env, .env.docker, or .env.example)"
    fi
}

# Function to validate Docker and Docker Compose installation
check_docker_installation() {
    log_step "Checking Docker installation..."
    
    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version)
        log_success "Docker is installed: $docker_version"
    else
        log_error "Docker is not installed"
        return
    fi
    
    if command -v docker-compose &> /dev/null; then
        local compose_version=$(docker-compose --version)
        log_success "Docker Compose is installed: $compose_version"
    else
        log_error "Docker Compose is not installed"
    fi
    
    if docker info &> /dev/null; then
        log_success "Docker daemon is running"
    else
        log_error "Docker daemon is not running"
    fi
}

# Function to validate volume paths
validate_volume_paths() {
    log_step "Validating volume mount paths..."
    
    local paths_to_check=(
        "./Todos"
        "./test-data-docker"
        "./test-results"
        "./logs-docker"
    )
    
    for path in "${paths_to_check[@]}"; do
        if [ -d "$path" ] || mkdir -p "$path" 2>/dev/null; then
            log_success "Volume path accessible: $path"
        else
            log_warning "Cannot create volume path: $path"
        fi
    done
}

# Function to check network configuration
validate_network_config() {
    log_step "Validating network configuration..."
    
    # Check if the subnet is available
    local subnet="172.20.0.0/16"
    if docker network ls | grep -q "172.20"; then
        log_warning "Subnet $subnet might be in use by another Docker network"
    else
        log_success "Network subnet $subnet appears available"
    fi
}

# Function to validate service configurations
validate_service_configs() {
    log_step "Validating service configurations..."
    
    # Check if all profiles are properly defined
    local profiles=("development" "testing" "performance" "monitoring")
    
    for profile in "${profiles[@]}"; do
        if docker-compose --profile "$profile" config > /dev/null 2>&1; then
            log_success "Profile '$profile' is valid"
        else
            log_error "Profile '$profile' configuration is invalid"
        fi
    done
}

# Function to test basic Docker Compose operations
test_compose_operations() {
    log_step "Testing basic Docker Compose operations..."
    
    # Test config validation
    if docker-compose config --quiet; then
        log_success "Compose configuration validates successfully"
    else
        log_error "Compose configuration validation failed"
    fi
    
    # Test profile-specific configs
    local test_profiles=("development" "testing")
    for profile in "${test_profiles[@]}"; do
        if docker-compose --profile "$profile" config --quiet; then
            log_success "Profile '$profile' validates successfully"
        else
            log_error "Profile '$profile' validation failed"
        fi
    done
}

# Function to check Dockerfile dependencies
check_dockerfile_dependencies() {
    log_step "Checking Dockerfile dependencies..."
    
    if [ -f "Dockerfile.test" ]; then
        # Check if base image is available
        local base_image=$(grep "^FROM" Dockerfile.test | head -1 | awk '{print $2}')
        log_step "Base image: $base_image"
        
        if docker pull "$base_image" &> /dev/null; then
            log_success "Base image '$base_image' is accessible"
        else
            log_warning "Cannot pull base image '$base_image' (might be cached)"
        fi
    fi
}

# Function to validate Fluent Bit configuration
validate_fluent_bit_config() {
    log_step "Validating Fluent Bit configuration..."
    
    if [ -f "docker/fluent-bit.conf" ]; then
        log_success "Fluent Bit configuration file exists"
        
        # Basic syntax check
        if grep -q "\[SERVICE\]" "docker/fluent-bit.conf" && \
           grep -q "\[INPUT\]" "docker/fluent-bit.conf" && \
           grep -q "\[OUTPUT\]" "docker/fluent-bit.conf"; then
            log_success "Fluent Bit configuration has required sections"
        else
            log_warning "Fluent Bit configuration might be incomplete"
        fi
    else
        log_error "Fluent Bit configuration file not found"
    fi
}

# Function to show recommendations
show_recommendations() {
    echo ""
    log_step "Recommendations:"
    
    if [ ! -f ".env" ]; then
        echo "  • Create .env file from .env.docker or .env.example"
    fi
    
    echo "  • Run 'docker-compose config' to validate complete configuration"
    echo "  • Test individual profiles with 'docker-compose --profile <name> config'"
    echo "  • Use './docker-start.sh -h' for easy startup options"
    echo "  • Check docker/README.md for detailed usage instructions"
}

# Function to show usage examples
show_usage_examples() {
    echo ""
    log_step "Usage Examples:"
    echo "  • Start development environment: ./docker-start.sh -p development"
    echo "  • Start testing environment: ./docker-start.sh -p testing -d"
    echo "  • Rebuild and start performance testing: ./docker-start.sh -p performance -r"
    echo "  • View all logs: docker-compose logs -f"
    echo "  • Stop all services: docker-compose down"
}

# Main validation function
main() {
    echo -e "${BLUE}WalTodo Docker Compose Validation${NC}"
    echo "========================================"
    echo ""
    
    # Run all validation steps
    check_docker_installation
    check_required_files
    check_environment_file
    validate_compose_syntax
    validate_volume_paths
    validate_network_config
    validate_service_configs
    test_compose_operations
    check_dockerfile_dependencies
    validate_fluent_bit_config
    
    echo ""
    echo "========================================"
    
    # Show final result
    if [ "$VALIDATION_PASSED" = true ]; then
        echo -e "${GREEN}All validations passed! ✓${NC}"
        echo -e "${GREEN}Your Docker Compose environment is ready to use.${NC}"
    else
        echo -e "${RED}Some validations failed! ✗${NC}"
        echo -e "${YELLOW}Please address the errors above before proceeding.${NC}"
    fi
    
    # Show recommendations and examples
    show_recommendations
    show_usage_examples
    
    # Exit with appropriate code
    if [ "$VALIDATION_PASSED" = true ]; then
        exit 0
    else
        exit 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi