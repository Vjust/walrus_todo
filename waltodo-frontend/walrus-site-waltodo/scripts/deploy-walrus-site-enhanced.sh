#!/bin/bash

# Enhanced Walrus Site Deployment Script with Recovery Support
# Integrates with the WalTodo CLI deployment recovery system

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_DIR="$(cd "$PROJECT_DIR/../../apps/cli" && pwd)"
BUILD_DIR="$PROJECT_DIR/out"
RECOVERY_DIR="$PROJECT_DIR/.walrus-deployment"

# Default values
NETWORK="testnet"
FORCE_REBUILD=false
SKIP_BUILD=false
SITE_NAME="waltodo-app"
USE_CLI_RECOVERY=true
RESUME_DEPLOYMENT=""
ROLLBACK_DEPLOYMENT=""
LIST_DEPLOYMENTS=false
CLEANUP_OLD_DAYS=""
MONITOR_DEPLOYMENT=false
DEPLOYMENT_ID=""

# Help function
show_help() {
    cat << EOF
Enhanced Walrus Site Deployment Script for WalTodo Frontend

USAGE:
    $0 [OPTIONS]

BASIC DEPLOYMENT OPTIONS:
    -n, --network NETWORK      Network to deploy to (testnet|mainnet) [default: testnet]
    -s, --site-name NAME       Name for the Walrus site [default: waltodo-app]
    -f, --force               Force rebuild even if build exists
    --skip-build              Skip build process and deploy existing build
    --no-recovery             Disable CLI recovery features (use basic deployment)

RECOVERY AND MANAGEMENT OPTIONS:
    --resume ID               Resume a failed deployment by deployment ID
    --rollback ID             Rollback a deployment to previous version
    --cancel ID               Cancel an active deployment
    --list-deployments        List all active and recent deployments
    --status ID               Get detailed status of a deployment
    --cleanup-old DAYS        Clean up deployments older than specified days
    --monitor                 Start real-time monitoring of deployment progress

ADVANCED OPTIONS:
    --epochs N                Number of storage epochs [default: 5]
    --max-retries N           Maximum number of retries for failed operations [default: 3]
    --timeout SECONDS         Deployment timeout in seconds [default: 300]
    --progress                Show live progress updates during deployment [default: true]
    --verbose                 Show detailed deployment information
    -h, --help                Show this help message

EXAMPLES:
    # Basic deployment
    $0 --site-name my-app --network testnet

    # Deploy with custom settings
    $0 --site-name prod-app --network mainnet --epochs 10 --force

    # Resume failed deployment
    $0 --resume deploy_1640995200000_a1b2

    # Monitor deployment progress
    $0 --monitor --status deploy_1640995200000_a1b2

    # List and manage deployments
    $0 --list-deployments
    $0 --cleanup-old 7

    # Rollback deployment
    $0 --rollback deploy_1640995200000_a1b2

RECOVERY FEATURES:
    • Automatic state tracking and checkpointing
    • Resume interrupted deployments from last checkpoint
    • Rollback to previous versions
    • Network interruption handling
    • Partial upload recovery
    • Failed transaction retry
    • Resource cleanup after failures

ENVIRONMENT VARIABLES:
    WALRUS_CONFIG_PATH       Path to Walrus configuration file
    WALRUS_WALLET_PATH       Path to wallet file for deployment
    SITE_BUILDER_PATH        Path to site-builder executable
    WALTODO_CLI_PATH         Path to WalTodo CLI executable

EOF
}

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
    if [[ "${VERBOSE:-false}" == "true" ]]; then
        echo -e "${PURPLE}[DEBUG]${NC} $1"
    fi
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -n|--network)
                NETWORK="$2"
                if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
                    log_error "Invalid network: $NETWORK. Must be 'testnet' or 'mainnet'"
                    exit 1
                fi
                shift 2
                ;;
            -s|--site-name)
                SITE_NAME="$2"
                shift 2
                ;;
            -f|--force)
                FORCE_REBUILD=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --no-recovery)
                USE_CLI_RECOVERY=false
                shift
                ;;
            --resume)
                RESUME_DEPLOYMENT="$2"
                USE_CLI_RECOVERY=true
                shift 2
                ;;
            --rollback)
                ROLLBACK_DEPLOYMENT="$2"
                USE_CLI_RECOVERY=true
                shift 2
                ;;
            --cancel)
                CANCEL_DEPLOYMENT="$2"
                USE_CLI_RECOVERY=true
                shift 2
                ;;
            --list-deployments)
                LIST_DEPLOYMENTS=true
                USE_CLI_RECOVERY=true
                shift
                ;;
            --status)
                DEPLOYMENT_STATUS="$2"
                USE_CLI_RECOVERY=true
                shift 2
                ;;
            --cleanup-old)
                CLEANUP_OLD_DAYS="$2"
                USE_CLI_RECOVERY=true
                shift 2
                ;;
            --monitor)
                MONITOR_DEPLOYMENT=true
                shift
                ;;
            --epochs)
                EPOCHS="$2"
                shift 2
                ;;
            --max-retries)
                MAX_RETRIES="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --progress)
                SHOW_PROGRESS=true
                shift
                ;;
            --verbose)
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

# Check if WalTodo CLI is available and working
check_cli_availability() {
    local cli_path="${WALTODO_CLI_PATH:-waltodo}"
    
    if ! command -v "$cli_path" &> /dev/null; then
        log_warning "WalTodo CLI not found in PATH. Attempting to use local build..."
        
        # Try to find CLI in the project
        local local_cli="$CLI_DIR/dist/index.js"
        if [[ -f "$local_cli" ]]; then
            cli_path="node $local_cli"
        else
            log_error "WalTodo CLI not found. Please install it first:"
            log_error "Run: cd $CLI_DIR && pnpm install && pnpm build && pnpm run global-install"
            return 1
        fi
    fi
    
    # Test CLI functionality
    if ! $cli_path --version &> /dev/null; then
        log_error "WalTodo CLI is not working properly"
        return 1
    fi
    
    echo "$cli_path"
}

# Use CLI deployment with recovery features
deploy_with_cli_recovery() {
    log_info "Using WalTodo CLI deployment with recovery support"
    
    local cli_path
    cli_path=$(check_cli_availability) || {
        log_error "CLI recovery not available, falling back to basic deployment"
        return 1
    }
    
    # Handle management commands
    if [[ "$LIST_DEPLOYMENTS" == "true" ]]; then
        log_info "Listing deployments..."
        $cli_path deploy-site --list-deployments
        return 0
    fi
    
    if [[ -n "$DEPLOYMENT_STATUS" ]]; then
        log_info "Getting deployment status: $DEPLOYMENT_STATUS"
        $cli_path deploy-site --deployment-status "$DEPLOYMENT_STATUS"
        return 0
    fi
    
    if [[ -n "$CLEANUP_OLD_DAYS" ]]; then
        log_info "Cleaning up deployments older than $CLEANUP_OLD_DAYS days"
        $cli_path deploy-site --cleanup-old "$CLEANUP_OLD_DAYS"
        return 0
    fi
    
    if [[ -n "$RESUME_DEPLOYMENT" ]]; then
        log_info "Resuming deployment: $RESUME_DEPLOYMENT"
        $cli_path deploy-site --resume "$RESUME_DEPLOYMENT" ${VERBOSE:+--verbose}
        return 0
    fi
    
    if [[ -n "$ROLLBACK_DEPLOYMENT" ]]; then
        log_info "Rolling back deployment: $ROLLBACK_DEPLOYMENT"
        $cli_path deploy-site --rollback "$ROLLBACK_DEPLOYMENT"
        return 0
    fi
    
    if [[ -n "$CANCEL_DEPLOYMENT" ]]; then
        log_info "Cancelling deployment: $CANCEL_DEPLOYMENT"
        $cli_path deploy-site --cancel "$CANCEL_DEPLOYMENT"
        return 0
    fi
    
    # Build the deployment command
    local deploy_cmd="$cli_path deploy-site"
    
    # Add build directory if not using management commands
    if [[ -z "$RESUME_DEPLOYMENT" && -z "$ROLLBACK_DEPLOYMENT" ]]; then
        deploy_cmd="$deploy_cmd $BUILD_DIR"
    fi
    
    # Add options
    deploy_cmd="$deploy_cmd --site-name $SITE_NAME"
    deploy_cmd="$deploy_cmd --network $NETWORK"
    
    if [[ -n "${EPOCHS:-}" ]]; then
        deploy_cmd="$deploy_cmd --epochs $EPOCHS"
    fi
    
    if [[ -n "${MAX_RETRIES:-}" ]]; then
        deploy_cmd="$deploy_cmd --max-retries $MAX_RETRIES"
    fi
    
    if [[ -n "${TIMEOUT:-}" ]]; then
        deploy_cmd="$deploy_cmd --timeout $TIMEOUT"
    fi
    
    if [[ "${FORCE_REBUILD:-false}" == "true" ]]; then
        deploy_cmd="$deploy_cmd --force"
    fi
    
    if [[ "${SKIP_BUILD:-false}" == "true" ]]; then
        deploy_cmd="$deploy_cmd --skip-validation"
    fi
    
    if [[ "${SHOW_PROGRESS:-true}" == "true" ]]; then
        deploy_cmd="$deploy_cmd --progress"
    fi
    
    if [[ "${VERBOSE:-false}" == "true" ]]; then
        deploy_cmd="$deploy_cmd --verbose"
    fi
    
    log_info "Executing CLI deployment with recovery..."
    log_debug "Command: $deploy_cmd"
    
    # Execute the deployment
    if $deploy_cmd; then
        log_success "Deployment completed successfully with CLI recovery!"
        
        # Optionally start monitoring
        if [[ "$MONITOR_DEPLOYMENT" == "true" ]]; then
            log_info "Starting deployment monitoring..."
            $cli_path deploy-site --list-deployments
        fi
        
        return 0
    else
        local exit_code=$?
        log_error "CLI deployment failed with exit code $exit_code"
        
        # Show recovery options
        log_info "Recovery options available:"
        log_info "  • List deployments: $0 --list-deployments"
        log_info "  • Resume deployment: $0 --resume <deployment-id>"
        log_info "  • Check status: $0 --status <deployment-id>"
        
        return $exit_code
    fi
}

# Basic deployment without CLI recovery (fallback)
deploy_basic() {
    log_warning "Using basic deployment without recovery features"
    
    # This would use the original deployment script logic
    # For brevity, we'll just show the concept
    local original_script="$SCRIPT_DIR/deploy-walrus-site.sh"
    
    if [[ -f "$original_script" ]]; then
        log_info "Executing basic deployment script..."
        
        local basic_args=""
        basic_args="$basic_args --network $NETWORK"
        basic_args="$basic_args --site-name $SITE_NAME"
        
        if [[ "$FORCE_REBUILD" == "true" ]]; then
            basic_args="$basic_args --force"
        fi
        
        if [[ "$SKIP_BUILD" == "true" ]]; then
            basic_args="$basic_args --skip-build"
        fi
        
        $original_script $basic_args
    else
        log_error "Basic deployment script not found: $original_script"
        return 1
    fi
}

# Monitor deployment progress in real-time
monitor_deployment() {
    if [[ -z "$DEPLOYMENT_ID" ]]; then
        log_error "Deployment ID required for monitoring"
        return 1
    fi
    
    local cli_path
    cli_path=$(check_cli_availability) || {
        log_error "CLI not available for monitoring"
        return 1
    }
    
    log_info "Monitoring deployment: $DEPLOYMENT_ID"
    log_info "Press Ctrl+C to stop monitoring"
    
    while true; do
        clear
        echo -e "${CYAN}📊 WalTodo Deployment Monitor${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        
        # Get deployment status
        $cli_path deploy-site --deployment-status "$DEPLOYMENT_ID" || {
            log_error "Failed to get deployment status"
            break
        }
        
        echo ""
        echo -e "${CYAN}Last updated: $(date)${NC}"
        echo -e "${CYAN}Press Ctrl+C to exit${NC}"
        
        # Wait 5 seconds before next update
        sleep 5
    done
}

# Validate build directory
validate_build() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        if [[ ! -d "$BUILD_DIR" ]]; then
            log_error "Build directory $BUILD_DIR does not exist. Cannot skip build."
            return 1
        fi
        
        if [[ -z "$(ls -A "$BUILD_DIR" 2>/dev/null)" ]]; then
            log_error "Build directory is empty. Cannot skip build."
            return 1
        fi
        
        log_info "Using existing build in $BUILD_DIR"
        return 0
    fi
    
    # Check if we need to build
    if [[ "$FORCE_REBUILD" == "true" ]] || [[ ! -d "$BUILD_DIR" ]] || [[ -z "$(ls -A "$BUILD_DIR" 2>/dev/null)" ]]; then
        log_info "Building application..."
        
        cd "$PROJECT_DIR"
        
        # Clean previous build if exists
        if [[ -d "$BUILD_DIR" ]]; then
            rm -rf "$BUILD_DIR"
        fi
        
        # Install dependencies
        if [[ ! -d "node_modules" ]]; then
            log_info "Installing dependencies..."
            pnpm install
        fi
        
        # Build
        log_info "Running build process..."
        if ! pnpm run build:export; then
            log_error "Build failed"
            return 1
        fi
        
        log_success "Build completed successfully"
    else
        log_info "Using existing build"
    fi
    
    # Validate build output
    if [[ ! -f "$BUILD_DIR/index.html" ]]; then
        log_error "Build validation failed: index.html not found"
        return 1
    fi
    
    local build_size=$(du -sh "$BUILD_DIR" | cut -f1)
    log_info "Build size: $build_size"
}

# Main execution
main() {
    log_info "WalTodo Enhanced Walrus Sites Deployment"
    log_info "========================================="
    
    # Parse command line arguments
    parse_args "$@"
    
    # Display configuration
    log_info "Configuration:"
    log_info "  Network: $NETWORK"
    log_info "  Site Name: $SITE_NAME"
    log_info "  Use CLI Recovery: $USE_CLI_RECOVERY"
    log_info "  Project Directory: $PROJECT_DIR"
    log_info "  Build Directory: $BUILD_DIR"
    
    # Handle monitoring mode
    if [[ "$MONITOR_DEPLOYMENT" == "true" && -n "${DEPLOYMENT_STATUS:-}" ]]; then
        DEPLOYMENT_ID="$DEPLOYMENT_STATUS"
        monitor_deployment
        return $?
    fi
    
    # Use CLI recovery if available and enabled
    if [[ "$USE_CLI_RECOVERY" == "true" ]]; then
        if deploy_with_cli_recovery; then
            return 0
        else
            local cli_exit_code=$?
            log_warning "CLI deployment failed, checking if fallback is needed..."
            
            # Only fallback for certain types of failures
            if [[ $cli_exit_code -eq 127 ]]; then  # Command not found
                log_info "Falling back to basic deployment..."
                USE_CLI_RECOVERY=false
            else
                return $cli_exit_code
            fi
        fi
    fi
    
    # Fallback to basic deployment
    if [[ "$USE_CLI_RECOVERY" == "false" ]]; then
        # Only validate and build for new deployments
        if [[ -z "$RESUME_DEPLOYMENT" && -z "$ROLLBACK_DEPLOYMENT" && -z "$CANCEL_DEPLOYMENT" && "$LIST_DEPLOYMENTS" != "true" && -z "$DEPLOYMENT_STATUS" && -z "$CLEANUP_OLD_DAYS" ]]; then
            validate_build || exit 1
        fi
        
        deploy_basic
    fi
}

# Set up signal handlers for graceful shutdown
trap 'log_warning "Deployment interrupted by user"; exit 130' INT TERM

# Run main function with all arguments
main "$@"