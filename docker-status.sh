#!/bin/bash

# WalTodo Docker Environment Status Script
# Shows the current status of Docker Compose services and environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to show header
show_header() {
    echo -e "${BLUE}======================================"
    echo -e "  WalTodo Docker Environment Status"
    echo -e "======================================${NC}"
    echo ""
}

# Function to check Docker status
check_docker_status() {
    echo -e "${CYAN}Docker Environment:${NC}"
    
    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        echo -e "  Docker: ${GREEN}$docker_version${NC}"
    else
        echo -e "  Docker: ${RED}Not installed${NC}"
        return 1
    fi
    
    if command -v docker-compose &> /dev/null; then
        local compose_version=$(docker-compose --version | cut -d' ' -f4)
        echo -e "  Docker Compose: ${GREEN}$compose_version${NC}"
    else
        echo -e "  Docker Compose: ${RED}Not installed${NC}"
        return 1
    fi
    
    if docker info &> /dev/null; then
        echo -e "  Docker Daemon: ${GREEN}Running${NC}"
    else
        echo -e "  Docker Daemon: ${RED}Not running${NC}"
        return 1
    fi
    
    echo ""
}

# Function to show environment configuration
show_environment_config() {
    echo -e "${CYAN}Environment Configuration:${NC}"
    
    if [ -f ".env" ]; then
        echo -e "  .env file: ${GREEN}Present${NC}"
        local node_env=$(grep "^NODE_ENV=" .env 2>/dev/null | cut -d'=' -f2 || echo "not set")
        local log_level=$(grep "^LOG_LEVEL=" .env 2>/dev/null | cut -d'=' -f2 || echo "not set")
        local network=$(grep "^NETWORK=" .env 2>/dev/null | cut -d'=' -f2 || echo "not set")
        
        echo -e "    NODE_ENV: ${GREEN}$node_env${NC}"
        echo -e "    LOG_LEVEL: ${GREEN}$log_level${NC}"
        echo -e "    NETWORK: ${GREEN}$network${NC}"
    else
        echo -e "  .env file: ${YELLOW}Missing${NC}"
        if [ -f ".env.docker" ]; then
            echo -e "  .env.docker: ${GREEN}Available${NC} (run: cp .env.docker .env)"
        fi
    fi
    
    echo ""
}

# Function to show running services
show_running_services() {
    echo -e "${CYAN}Running Services:${NC}"
    
    if docker-compose ps --services 2>/dev/null | head -1 > /dev/null; then
        local services=$(docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null)
        if [ -n "$services" ]; then
            echo "$services" | while IFS= read -r line; do
                if echo "$line" | grep -q "Up"; then
                    echo -e "  ${GREEN}$line${NC}"
                elif echo "$line" | grep -q "Exit"; then
                    echo -e "  ${RED}$line${NC}"
                else
                    echo -e "  $line"
                fi
            done
        else
            echo -e "  ${YELLOW}No services running${NC}"
        fi
    else
        echo -e "  ${YELLOW}No services running${NC}"
    fi
    
    echo ""
}

# Function to show available profiles
show_available_profiles() {
    echo -e "${CYAN}Available Profiles:${NC}"
    
    local profiles=("development" "testing" "performance" "monitoring")
    
    for profile in "${profiles[@]}"; do
        if docker-compose --profile "$profile" config --quiet &>/dev/null; then
            echo -e "  ${GREEN}✓${NC} $profile"
        else
            echo -e "  ${RED}✗${NC} $profile"
        fi
    done
    
    echo ""
}

# Function to show volume status
show_volume_status() {
    echo -e "${CYAN}Docker Volumes:${NC}"
    
    local volumes=$(docker volume ls --filter name=walrus_todo --format "{{.Name}}" 2>/dev/null)
    
    if [ -n "$volumes" ]; then
        echo "$volumes" | while IFS= read -r volume; do
            local size=$(docker system df -v 2>/dev/null | grep "$volume" | awk '{print $3}' | head -1)
            echo -e "  ${GREEN}$volume${NC} ($size)"
        done
    else
        echo -e "  ${YELLOW}No WalTodo volumes found${NC}"
    fi
    
    echo ""
}

# Function to show network status
show_network_status() {
    echo -e "${CYAN}Docker Networks:${NC}"
    
    local networks=$(docker network ls --filter name=walrus_todo --format "{{.Name}}" 2>/dev/null)
    
    if [ -n "$networks" ]; then
        echo "$networks" | while IFS= read -r network; do
            echo -e "  ${GREEN}$network${NC}"
        done
    else
        echo -e "  ${YELLOW}No WalTodo networks found${NC}"
    fi
    
    echo ""
}

# Function to show quick commands
show_quick_commands() {
    echo -e "${CYAN}Quick Commands:${NC}"
    echo -e "  Start development:   ${YELLOW}./docker-start.sh -p development${NC}"
    echo -e "  Start testing:       ${YELLOW}./docker-start.sh -p testing -d${NC}"
    echo -e "  View logs:           ${YELLOW}docker-compose logs -f${NC}"
    echo -e "  Stop services:       ${YELLOW}docker-compose down${NC}"
    echo -e "  Clean up:            ${YELLOW}docker-compose down -v${NC}"
    echo -e "  Rebuild:             ${YELLOW}./docker-start.sh -p development -r${NC}"
    echo ""
}

# Function to show health status
show_health_status() {
    echo -e "${CYAN}Service Health:${NC}"
    
    local containers=$(docker-compose ps -q 2>/dev/null)
    
    if [ -n "$containers" ]; then
        echo "$containers" | while IFS= read -r container; do
            local name=$(docker inspect "$container" --format '{{.Name}}' 2>/dev/null | sed 's/^.//')
            local health=$(docker inspect "$container" --format '{{.State.Health.Status}}' 2>/dev/null)
            
            if [ "$health" = "healthy" ]; then
                echo -e "  ${GREEN}✓${NC} $name (healthy)"
            elif [ "$health" = "unhealthy" ]; then
                echo -e "  ${RED}✗${NC} $name (unhealthy)"
            elif [ "$health" = "starting" ]; then
                echo -e "  ${YELLOW}⚠${NC} $name (starting)"
            else
                local status=$(docker inspect "$container" --format '{{.State.Status}}' 2>/dev/null)
                if [ "$status" = "running" ]; then
                    echo -e "  ${GREEN}✓${NC} $name (running)"
                else
                    echo -e "  ${RED}✗${NC} $name ($status)"
                fi
            fi
        done
    else
        echo -e "  ${YELLOW}No containers running${NC}"
    fi
    
    echo ""
}

# Function to show disk usage
show_disk_usage() {
    echo -e "${CYAN}Docker Disk Usage:${NC}"
    
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        local usage=$(docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}" 2>/dev/null)
        if [ -n "$usage" ]; then
            echo "$usage" | tail -n +2 | while IFS= read -r line; do
                echo -e "  $line"
            done
        fi
    fi
    
    echo ""
}

# Main function
main() {
    show_header
    
    # Check if Docker is available
    if ! check_docker_status; then
        echo -e "${RED}Docker is not properly set up. Please install and start Docker.${NC}"
        exit 1
    fi
    
    # Show various status information
    show_environment_config
    show_running_services
    show_health_status
    show_available_profiles
    show_volume_status
    show_network_status
    show_disk_usage
    show_quick_commands
    
    echo -e "${BLUE}For detailed usage instructions, see: docker/README.md${NC}"
}

# Parse command line arguments for any flags (future extension)
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            echo "Usage: $0"
            echo "Shows the current status of WalTodo Docker environment"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi