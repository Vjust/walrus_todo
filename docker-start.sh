#!/bin/bash

# WalTodo Docker Compose Startup Script
# This script helps users easily start the Docker environment with different profiles

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROFILE="development"
DETACHED=false
REBUILD=false
VERBOSE=false

# Function to display usage
usage() {
    echo -e "${BLUE}WalTodo Docker Compose Startup Script${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --profile PROFILE    Docker Compose profile to use"
    echo "                          (development, testing, performance, monitoring)"
    echo "  -d, --detached          Run in detached mode (background)"
    echo "  -r, --rebuild           Rebuild containers before starting"
    echo "  -v, --verbose           Enable verbose output"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Available Profiles:"
    echo "  development   - Interactive development with live code mounting"
    echo "  testing       - Comprehensive automated testing environment"
    echo "  performance   - Performance testing and benchmarking"
    echo "  monitoring    - Log collection and monitoring only"
    echo ""
    echo "Examples:"
    echo "  $0                      # Start development environment"
    echo "  $0 -p testing -d        # Start testing environment in background"
    echo "  $0 -p performance -r    # Start performance environment with rebuild"
    echo "  $0 -p monitoring -v     # Start monitoring with verbose output"
}

# Function to check if Docker is running
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo -e "${RED}Error: Docker is not running${NC}"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Error: Docker Compose is not installed${NC}"
        exit 1
    fi
}

# Function to check environment setup
check_environment() {
    if [ ! -f ".env" ] && [ ! -f ".env.docker" ]; then
        echo -e "${YELLOW}Warning: No .env file found${NC}"
        if [ -f ".env.docker" ]; then
            echo -e "${BLUE}Copying .env.docker to .env${NC}"
            cp .env.docker .env
        else
            echo -e "${YELLOW}Creating .env from .env.example${NC}"
            if [ -f ".env.example" ]; then
                cp .env.example .env
            else
                echo -e "${RED}Error: No environment template found${NC}"
                exit 1
            fi
        fi
    fi
}

# Function to validate profile
validate_profile() {
    case $PROFILE in
        development|testing|performance|monitoring)
            ;;
        *)
            echo -e "${RED}Error: Invalid profile '$PROFILE'${NC}"
            echo -e "${YELLOW}Valid profiles: development, testing, performance, monitoring${NC}"
            exit 1
            ;;
    esac
}

# Function to show environment info
show_environment_info() {
    echo -e "${BLUE}WalTodo Docker Environment${NC}"
    echo -e "Profile: ${GREEN}$PROFILE${NC}"
    echo -e "Mode: ${GREEN}$([ "$DETACHED" = true ] && echo "detached" || echo "foreground")${NC}"
    echo -e "Rebuild: ${GREEN}$([ "$REBUILD" = true ] && echo "yes" || echo "no")${NC}"
    echo ""
}

# Function to start services
start_services() {
    local compose_args=()
    
    # Add profile
    compose_args+=(--profile "$PROFILE")
    
    # Add rebuild flag
    if [ "$REBUILD" = true ]; then
        echo -e "${BLUE}Rebuilding containers...${NC}"
        docker-compose "${compose_args[@]}" build --no-cache
    fi
    
    # Add detached flag
    if [ "$DETACHED" = true ]; then
        compose_args+=(up -d)
    else
        compose_args+=(up)
    fi
    
    # Add verbose flag
    if [ "$VERBOSE" = true ]; then
        set -x
    fi
    
    echo -e "${BLUE}Starting services with profile: ${GREEN}$PROFILE${NC}"
    docker-compose "${compose_args[@]}"
    
    if [ "$DETACHED" = true ]; then
        echo ""
        echo -e "${GREEN}Services started successfully!${NC}"
        echo ""
        echo "Useful commands:"
        echo "  docker-compose logs -f                 # View all logs"
        echo "  docker-compose ps                      # Check service status"
        echo "  docker-compose exec waltodo-cli bash   # Access CLI container"
        echo "  docker-compose down                    # Stop all services"
        echo ""
        
        # Show running services
        echo -e "${BLUE}Running services:${NC}"
        docker-compose ps
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--profile)
            PROFILE="$2"
            shift 2
            ;;
        -d|--detached)
            DETACHED=true
            shift
            ;;
        -r|--rebuild)
            REBUILD=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo -e "${BLUE}WalTodo Docker Compose Startup${NC}"
    echo ""
    
    # Pre-flight checks
    check_docker
    check_environment
    validate_profile
    
    # Show environment info
    show_environment_info
    
    # Start services
    start_services
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi