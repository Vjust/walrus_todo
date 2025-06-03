#!/bin/bash

# Fixed Walrus Site Deployment Script with Robust Error Handling
# Builds and deploys the WalTodo frontend to Walrus Sites with retry logic

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SITE_CONFIG_FILE="$PROJECT_DIR/sites-config.yaml"
BUILD_DIR="$PROJECT_DIR/out"

# Network and retry configuration
MAX_RETRIES=5
BASE_DELAY=2
MAX_DELAY=60
CONNECTION_TIMEOUT=30
GAS_BUDGET=500000000

# Testnet RPC endpoints (fallbacks)
TESTNET_RPC_ENDPOINTS=(
    "https://fullnode.testnet.sui.io:443"
    "https://sui-testnet.nodeinfra.com"
    "https://sui-testnet.publicnode.com"
)

# Mainnet RPC endpoints (fallbacks)
MAINNET_RPC_ENDPOINTS=(
    "https://fullnode.mainnet.sui.io:443"
    "https://sui-mainnet.nodeinfra.com"
    "https://sui-mainnet.publicnode.com"
)

# Default values
NETWORK="testnet"
FORCE_REBUILD=false
SKIP_BUILD=false
SITE_NAME="waltodo-app"
CONFIG_DIR="$HOME/.config/walrus"
VERBOSE=false
DRY_RUN=false
CURRENT_RPC_INDEX=0

# Help function
show_help() {
    cat << EOF
Fixed Walrus Site Deployment Script for WalTodo Frontend

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -n, --network NETWORK     Network to deploy to (testnet|mainnet) [default: testnet]
    -f, --force              Force rebuild even if build exists
    -s, --skip-build         Skip build process and deploy existing build
    --site-name NAME         Name for the Walrus site [default: waltodo-app]
    --config-dir DIR         Walrus config directory [default: ~/.config/walrus]
    --gas-budget AMOUNT      Gas budget for transactions [default: 500000000]
    --max-retries COUNT      Maximum retry attempts [default: 5]
    --dry-run                Validate configuration without deploying
    -v, --verbose            Enable verbose logging
    -h, --help               Show this help message

EXAMPLES:
    $0                                    # Deploy to testnet with default settings
    $0 --network mainnet                  # Deploy to mainnet
    $0 --force --network testnet          # Force rebuild and deploy to testnet
    $0 --skip-build --network mainnet     # Deploy existing build to mainnet
    $0 --dry-run --verbose                # Validate configuration with verbose output

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

# Utility functions for retry logic and network validation
wait_with_backoff() {
    local attempt=$1
    local delay=$((BASE_DELAY * (2 ** (attempt - 1))))
    if [[ $delay -gt $MAX_DELAY ]]; then
        delay=$MAX_DELAY
    fi
    log_info "Waiting ${delay}s before retry (attempt $attempt/$MAX_RETRIES)..."
    sleep $delay
}

# Test RPC endpoint connectivity
test_rpc_endpoint() {
    local rpc_url=$1
    local timeout=${2:-$CONNECTION_TIMEOUT}
    
    if [[ "$VERBOSE" == true ]]; then
        log_info "Testing RPC endpoint: $rpc_url"
    fi
    
    # Test basic connectivity with curl
    if curl -s --max-time "$timeout" --connect-timeout 10 \
        -X POST "$rpc_url" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"sui_getChainIdentifier","params":[],"id":1}' \
        >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Get the next available RPC endpoint
get_next_rpc_endpoint() {
    local endpoints
    if [[ "$NETWORK" == "mainnet" ]]; then
        endpoints=("${MAINNET_RPC_ENDPOINTS[@]}")
    else
        endpoints=("${TESTNET_RPC_ENDPOINTS[@]}")
    fi
    
    local total_endpoints=${#endpoints[@]}
    if [[ $total_endpoints -eq 0 ]]; then
        log_error "No RPC endpoints configured for network: $NETWORK"
        return 1
    fi
    
    # Try each endpoint in order
    for ((i=0; i<total_endpoints; i++)); do
        local index=$(( (CURRENT_RPC_INDEX + i) % total_endpoints ))
        local endpoint="${endpoints[$index]}"
        
        if test_rpc_endpoint "$endpoint"; then
            CURRENT_RPC_INDEX=$index
            echo "$endpoint"
            return 0
        else
            log_warning "RPC endpoint failed: $endpoint"
        fi
    done
    
    log_error "All RPC endpoints failed for network: $NETWORK"
    return 1
}

# Execute command with retry logic
execute_with_retry() {
    local cmd=("$@")
    local attempt=1
    
    while [[ $attempt -le $MAX_RETRIES ]]; do
        if [[ "$VERBOSE" == true ]]; then
            log_info "Attempt $attempt/$MAX_RETRIES: ${cmd[*]}"
        fi
        
        local output
        local exit_code=0
        
        # Capture both stdout and stderr
        if output=$("${cmd[@]}" 2>&1); then
            echo "$output"
            return 0
        else
            exit_code=$?
            log_warning "Command failed (attempt $attempt/$MAX_RETRIES)"
            
            # Check if it's a network-related error
            if echo "$output" | grep -iq "connection reset by peer\|network\|timeout\|refused\|connection.*error"; then
                log_warning "Network error detected: $output"
                
                # Try to get a new RPC endpoint
                if [[ $attempt -lt $MAX_RETRIES ]]; then
                    log_info "Attempting to find alternative RPC endpoint..."
                    local new_rpc
                    if new_rpc=$(get_next_rpc_endpoint); then
                        log_info "Switching to RPC endpoint: $new_rpc"
                        # Update the command if it contains an RPC URL
                        for i in "${!cmd[@]}"; do
                            if [[ "${cmd[$i]}" =~ https://.*sui.*\.(io|com) ]]; then
                                cmd[$i]="$new_rpc"
                                break
                            fi
                        done
                    fi
                fi
            fi
            
            if [[ $attempt -eq $MAX_RETRIES ]]; then
                log_error "Command failed after $MAX_RETRIES attempts: $output"
                return $exit_code
            fi
            
            wait_with_backoff $attempt
            ((attempt++))
        fi
    done
    
    return 1
}

# Validate network connectivity and configuration
validate_network_config() {
    log_info "Validating network configuration for $NETWORK..."
    
    # Test basic internet connectivity
    if ! curl -s --max-time 10 --connect-timeout 5 https://www.google.com >/dev/null 2>&1; then
        log_error "No internet connectivity detected"
        return 1
    fi
    
    # Get a working RPC endpoint
    local rpc_url
    if ! rpc_url=$(get_next_rpc_endpoint); then
        log_error "No working RPC endpoints found for $NETWORK"
        log_info "Please check your internet connection and try again"
        return 1
    fi
    
    log_success "Using RPC endpoint: $rpc_url"
    
    # Test Walrus aggregator connectivity
    local walrus_url
    if [[ "$NETWORK" == "mainnet" ]]; then
        walrus_url="https://aggregator.walrus.space"
    else
        walrus_url="https://aggregator-devnet.walrus.space"
    fi
    
    if test_rpc_endpoint "$walrus_url" 15; then
        log_success "Walrus aggregator connectivity verified: $walrus_url"
    else
        log_warning "Walrus aggregator test failed: $walrus_url (proceeding anyway)"
    fi
    
    return 0
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
            -f|--force)
                FORCE_REBUILD=true
                shift
                ;;
            -s|--skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --site-name)
                SITE_NAME="$2"
                shift 2
                ;;
            --config-dir)
                CONFIG_DIR="$2"
                shift 2
                ;;
            --gas-budget)
                GAS_BUDGET="$2"
                shift 2
                ;;
            --max-retries)
                MAX_RETRIES="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
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

# Check prerequisites with enhanced validation
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local prerequisites_passed=true
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
        log_error "package.json not found. Are you in the right directory?"
        prerequisites_passed=false
    fi
    
    # Check for required utilities
    local required_tools=("curl" "grep" "sort" "node" "pnpm")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            prerequisites_passed=false
        fi
    done
    
    # Check for site-builder
    SITE_BUILDER_CMD="site-builder"
    if [[ -n "${SITE_BUILDER_PATH:-}" ]]; then
        SITE_BUILDER_CMD="$SITE_BUILDER_PATH"
    fi
    
    if ! command -v "$SITE_BUILDER_CMD" &> /dev/null; then
        log_error "site-builder CLI not found. Please install it first:"
        log_error "Run: ./scripts/setup-walrus-site.sh"
        prerequisites_passed=false
    else
        # Verify site-builder version and configuration
        local site_builder_version
        if site_builder_version=$("$SITE_BUILDER_CMD" --version 2>/dev/null | head -1); then
            if [[ "$VERBOSE" == true ]]; then
                log_info "site-builder version: $site_builder_version"
            fi
        else
            log_error "site-builder is not working properly"
            prerequisites_passed=false
        fi
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_NODE="18.0.0"
    if ! printf '%s\n%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V -C; then
        log_error "Node.js version $NODE_VERSION is less than required $REQUIRED_NODE"
        prerequisites_passed=false
    fi
    
    # Check Walrus configuration
    if [[ ! -d "$CONFIG_DIR" ]]; then
        log_warning "Walrus config directory not found: $CONFIG_DIR"
        log_info "Will use default configuration"
    fi
    
    if [[ "$prerequisites_passed" != true ]]; then
        log_error "Prerequisites check failed. Please fix the errors above."
        exit 1
    fi
    
    # Validate network connectivity
    if ! validate_network_config; then
        log_error "Network validation failed"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    cd "$PROJECT_DIR"
    
    if [[ ! -d "node_modules" ]]; then
        execute_with_retry pnpm install
    else
        log_info "Dependencies already installed, checking for updates..."
        execute_with_retry pnpm install --frozen-lockfile
    fi
    
    log_success "Dependencies installed"
}

# Build the application
build_application() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_info "Skipping build as requested"
        if [[ ! -d "$BUILD_DIR" ]]; then
            log_error "Build directory $BUILD_DIR does not exist. Cannot skip build."
            exit 1
        fi
        return
    fi
    
    log_info "Building application for static export..."
    cd "$PROJECT_DIR"
    
    # Clean previous build if force rebuild or build directory exists
    if [[ "$FORCE_REBUILD" == true ]] || [[ -d "$BUILD_DIR" ]]; then
        log_info "Cleaning previous build..."
        rm -rf "$BUILD_DIR"
    fi
    
    # Build the application
    log_info "Running build process..."
    if ! execute_with_retry pnpm run build; then
        log_error "Build failed"
        exit 1
    fi
    
    # Verify build output
    if [[ ! -d "$BUILD_DIR" ]]; then
        log_error "Build directory $BUILD_DIR was not created"
        exit 1
    fi
    
    # Check if build has content
    if [[ -z "$(ls -A "$BUILD_DIR" 2>/dev/null)" ]]; then
        log_error "Build directory is empty"
        exit 1
    fi
    
    log_success "Application built successfully"
}

# Validate build output
validate_build() {
    log_info "Validating build output..."
    
    # Check for essential files
    local essential_files=("index.html")
    for file in "${essential_files[@]}"; do
        if [[ ! -e "$BUILD_DIR/$file" ]]; then
            log_warning "Expected file/directory not found: $file"
        fi
    done
    
    # Check build size
    local build_size=$(du -sh "$BUILD_DIR" | cut -f1)
    log_info "Build size: $build_size"
    
    # Warn if build is suspiciously large (>100MB)
    local size_bytes=$(du -s "$BUILD_DIR" | cut -f1)
    if [[ $size_bytes -gt 102400 ]]; then  # 100MB in KB
        log_warning "Build size is quite large ($build_size). Consider optimizing assets."
    fi
    
    log_success "Build validation completed"
}

# Deploy to Walrus Sites with enhanced error handling
deploy_to_walrus() {
    log_info "Deploying to Walrus Sites ($NETWORK)..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "DRY RUN: Skipping actual deployment"
        return 0
    fi
    
    cd "$PROJECT_DIR"
    
    # Get the best available RPC endpoint
    local rpc_url
    if ! rpc_url=$(get_next_rpc_endpoint); then
        log_error "No working RPC endpoints available"
        exit 1
    fi
    
    # Prepare deployment command
    local publish_cmd=("$SITE_BUILDER_CMD")
    
    # Add context for network
    if [[ "$NETWORK" == "testnet" ]]; then
        publish_cmd+=("--context" "testnet")
    else
        publish_cmd+=("--context" "mainnet")
    fi
    
    # Add configuration file if it exists
    local global_sites_config="$CONFIG_DIR/sites-config.yaml"
    if [[ -f "$global_sites_config" ]]; then
        publish_cmd+=("--config" "$global_sites_config")
    fi
    
    # Add the publish command and options
    publish_cmd+=("publish" "--epochs" "100")
    
    # Add RPC URL
    publish_cmd+=("--rpc-url" "$rpc_url")
    
    # Add gas budget
    publish_cmd+=("--gas-budget" "$GAS_BUDGET")
    
    # Add wallet configuration if provided
    if [[ -n "${WALRUS_WALLET_PATH:-}" ]]; then
        publish_cmd+=("--wallet" "$WALRUS_WALLET_PATH")
    fi
    
    # Add build directory (must be last argument)
    publish_cmd+=("$BUILD_DIR")
    
    log_info "Executing deployment command..."
    if [[ "$VERBOSE" == true ]]; then
        log_info "Command: ${publish_cmd[*]}"
    fi
    
    # Execute deployment with retry logic
    local deployment_output
    if deployment_output=$(execute_with_retry "${publish_cmd[@]}"); then
        log_success "Deployment completed successfully!"
        echo "$deployment_output"
        
        # Extract site URL if available
        local site_url
        if site_url=$(echo "$deployment_output" | grep -oE 'https://[a-zA-Z0-9.-]+\.walrus\.site' | head -1); then
            log_success "Site deployed at: $site_url"
            
            # Save URL for future reference
            echo "$site_url" > "$PROJECT_DIR/.walrus-site-url"
            log_info "Site URL saved to .walrus-site-url"
        fi
        
        # Extract object ID if available
        local object_id
        if object_id=$(echo "$deployment_output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1); then
            echo "$object_id" > "$PROJECT_DIR/.walrus-site-object-id"
            log_info "Site object ID saved to .walrus-site-object-id: $object_id"
        fi
        
    else
        log_error "Deployment failed after all retry attempts"
        log_info ""
        log_info "Troubleshooting steps:"
        log_info "1. Check wallet balance: sui client gas"
        log_info "2. Verify network connectivity: ping google.com"
        log_info "3. Test RPC endpoint manually: curl -X POST $rpc_url"
        log_info "4. Check Walrus configuration: ls -la $CONFIG_DIR"
        log_info "5. Validate build directory: ls -la $BUILD_DIR"
        log_info "6. Try with verbose output: $0 --verbose"
        exit 1
    fi
}

# Main execution
main() {
    log_info "Fixed WalTodo Walrus Sites Deployment Script"
    log_info "============================================"
    
    # Parse command line arguments
    parse_args "$@"
    
    # Display configuration
    log_info "Configuration:"
    log_info "  Network: $NETWORK"
    log_info "  Site Name: $SITE_NAME"
    log_info "  Force Rebuild: $FORCE_REBUILD"
    log_info "  Skip Build: $SKIP_BUILD"
    log_info "  Dry Run: $DRY_RUN"
    log_info "  Verbose: $VERBOSE"
    log_info "  Max Retries: $MAX_RETRIES"
    log_info "  Gas Budget: $GAS_BUDGET"
    log_info "  Project Directory: $PROJECT_DIR"
    log_info "  Build Directory: $BUILD_DIR"
    log_info "  Config Directory: $CONFIG_DIR"
    
    # Execute deployment steps
    check_prerequisites
    install_dependencies
    build_application
    validate_build
    deploy_to_walrus
    
    log_success "Deployment process completed successfully!"
    log_info "Your WalTodo frontend is now live on Walrus Sites."
    
    if [[ -f "$PROJECT_DIR/.walrus-site-url" ]]; then
        local site_url=$(cat "$PROJECT_DIR/.walrus-site-url")
        log_success "Access your site at: $site_url"
    fi
    
    if [[ -f "$PROJECT_DIR/.walrus-site-object-id" ]]; then
        local object_id=$(cat "$PROJECT_DIR/.walrus-site-object-id")
        log_info "Site object ID: $object_id"
    fi
}

# Run main function with all arguments
main "$@"