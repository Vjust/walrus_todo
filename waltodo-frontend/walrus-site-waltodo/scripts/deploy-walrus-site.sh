#!/bin/bash

# Walrus Site Deployment Script
# Builds and deploys the WalTodo frontend to Walrus Sites

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
    "https://sui-testnet.chainstack.com"
    "https://sui-testnet.publicnode.com"
)

# Mainnet RPC endpoints (fallbacks)
MAINNET_RPC_ENDPOINTS=(
    "https://fullnode.mainnet.sui.io:443"
    "https://sui-mainnet.nodeinfra.com"
    "https://sui-mainnet.chainstack.com"
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
AUTO_OPTIMIZE=false

# Help function
show_help() {
    cat << EOF
Walrus Site Deployment Script for WalTodo Frontend

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -n, --network NETWORK     Network to deploy to (testnet|mainnet) [default: testnet]
    -f, --force              Force rebuild even if build exists
    -s, --skip-build         Skip build process and deploy existing build
    --optimize               Automatically optimize assets during build validation
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

ENVIRONMENT VARIABLES:
    WALRUS_CONFIG_PATH       Path to Walrus configuration file
    WALRUS_WALLET_PATH       Path to wallet file for deployment
    SITE_BUILDER_PATH        Path to site-builder executable
    SUI_RPC_URL              Override RPC endpoint URL
    WALRUS_VERBOSE           Enable verbose Walrus output

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
        -d '{"jsonrpc":"2.0","method":"sui_getLatestSuiSystemState","params":[],"id":1}' \
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
            log_warning "Command failed (attempt $attempt/$MAX_RETRIES): ${cmd[*]}"
            
            # Check if it's a network-related error
            if echo "$output" | grep -iq "connection reset by peer\\|network\\|timeout\\|refused"; then
                log_warning "Network error detected: $output"
                
                # Try to get a new RPC endpoint
                if [[ $attempt -lt $MAX_RETRIES ]]; then
                    log_info "Attempting to find alternative RPC endpoint..."
                    local new_rpc
                    if new_rpc=$(get_next_rpc_endpoint); then
                        log_info "Switching to RPC endpoint: $new_rpc"
                        # Update the command if it contains an RPC URL
                        for i in "${!cmd[@]}"; do
                            if [[ "${cmd[$i]}" =~ https://.*sui\\.io:443 ]] || [[ "${cmd[$i]}" =~ https://.*sui.*\\.(com|io) ]]; then
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
            --optimize)
                AUTO_OPTIMIZE=true
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

# Enhanced prerequisites check with comprehensive validation
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local prerequisites_passed=true
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
        log_error "package.json not found. Are you in the right directory?"
        prerequisites_passed=false
    fi
    
    # Check if pnpm is installed
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is required but not installed. Please install pnpm first."
        log_info "Install: curl -fsSL https://get.pnpm.io/install.sh | sh"
        prerequisites_passed=false
    else
        local pnpm_version=$(pnpm --version)
        log_success "pnpm found: v$pnpm_version"
    fi
    
    # Check for site-builder with enhanced validation
    SITE_BUILDER_CMD="site-builder"
    if [[ -n "${SITE_BUILDER_PATH:-}" ]]; then
        SITE_BUILDER_CMD="$SITE_BUILDER_PATH"
    fi
    
    if ! command -v "$SITE_BUILDER_CMD" &> /dev/null; then
        log_error "site-builder CLI not found. Please install it first:"
        log_error "Run: ./scripts/setup-walrus-site.sh"
        prerequisites_passed=false
    else
        # Test site-builder functionality
        local site_builder_version
        if site_builder_version=$("$SITE_BUILDER_CMD" --version 2>/dev/null | head -1); then
            log_success "site-builder found: $site_builder_version"
        else
            log_warning "site-builder found but version check failed"
        fi
        
        # Test site-builder help command
        if ! "$SITE_BUILDER_CMD" --help &> /dev/null; then
            log_warning "site-builder help command failed - binary might be corrupted"
        fi
    fi
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js 18 or higher."
        prerequisites_passed=false
    else
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        REQUIRED_NODE="18.0.0"
        if ! printf '%s\n%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V -C; then
            log_error "Node.js version $NODE_VERSION is less than required $REQUIRED_NODE"
            prerequisites_passed=false
        else
            log_success "Node.js found: v$NODE_VERSION"
        fi
    fi
    
    # Check for curl (required for network tests)
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed."
        prerequisites_passed=false
    fi
    
    # Check for sui CLI (optional but recommended)
    if command -v sui &> /dev/null; then
        local sui_version=$(sui --version 2>/dev/null | head -1 || echo "unknown")
        log_success "Sui CLI found: $sui_version"
        
        # Check if sui client is configured
        if sui client active-address &> /dev/null; then
            local active_address=$(sui client active-address 2>/dev/null)
            log_success "Sui client configured with address: $active_address"
        else
            log_warning "Sui client not configured. Run 'sui client' to configure."
        fi
    else
        log_warning "Sui CLI not found. Wallet operations may be limited."
        log_info "Install: curl -fsSL https://sui.io/install | sh"
    fi
    
    # Check disk space
    local available_space=$(df "$PROJECT_DIR" | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 1048576 ]]; then  # Less than 1GB
        log_warning "Low disk space: ${available_space}KB available"
    fi
    
    # Check memory
    if command -v free &> /dev/null; then
        local available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
        if [[ $available_mem -lt 512 ]]; then
            log_warning "Low memory: ${available_mem}MB available"
        fi
    fi
    
    # Validate configuration files
    validate_config_files
    
    if [[ "$prerequisites_passed" != true ]]; then
        log_error "Prerequisites check failed. Please address the issues above."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Validate configuration files
validate_config_files() {
    log_info "Validating configuration files..."
    
    # Check for walrus config
    local walrus_config_paths=(
        "$HOME/.config/walrus/client_config.yaml"
        "$HOME/.walrus/client_config.yaml"
        "./client_config.yaml"
    )
    
    local walrus_config_found=false
    for config_path in "${walrus_config_paths[@]}"; do
        if [[ -f "$config_path" ]]; then
            log_success "Walrus config found: $config_path"
            walrus_config_found=true
            break
        fi
    done
    
    if [[ "$walrus_config_found" != true ]]; then
        log_warning "Walrus client config not found. Using defaults."
        log_info "Run ./scripts/setup-walrus-site.sh to create config."
    fi
    
    # Validate sites config structure
    if [[ -f "$SITE_CONFIG_FILE" ]]; then
        log_info "Validating sites config structure..."
        
        # Basic YAML syntax check
        if command -v python3 &> /dev/null; then
            if ! python3 -c "import yaml; yaml.safe_load(open('$SITE_CONFIG_FILE'))" 2>/dev/null; then
                log_warning "Sites config has invalid YAML syntax"
            else
                log_success "Sites config YAML syntax is valid"
            fi
        fi
        
        # Check for required fields
        if grep -q "package:" "$SITE_CONFIG_FILE"; then
            log_success "Package ID found in config"
        else
            log_warning "Package ID not found in config"
        fi
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    cd "$PROJECT_DIR"
    
    if [[ ! -d "node_modules" ]]; then
        pnpm install
    else
        log_info "Dependencies already installed, checking for updates..."
        pnpm install --frozen-lockfile
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
        pnpm run clean
    fi
    
    # Build the application
    log_info "Running build process..."
    if ! pnpm run build:export; then
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

# Validate build output using enhanced validator
validate_build() {
    log_info "Running enhanced build validation..."
    
    if [[ -f "$SCRIPT_DIR/build-validator.sh" ]]; then
        if "$SCRIPT_DIR/build-validator.sh" --build-dir "$BUILD_DIR"; then
            log_success "Enhanced build validation passed"
            
            # Check if optimization is recommended
            if [[ -f "$PROJECT_DIR/build-validation-report.json" ]]; then
                local warnings=$(jq -r '.summary.warnings // 0' "$PROJECT_DIR/build-validation-report.json" 2>/dev/null || echo 0)
                if [[ $warnings -gt 0 ]]; then
                    log_info "Build validation found $warnings optimization opportunities"
                    
                    # Ask user if they want to optimize
                    if [[ "${AUTO_OPTIMIZE:-false}" == "true" ]]; then
                        log_info "Auto-optimization enabled, running asset optimizer..."
                        optimize_build
                    else
                        log_info "Run with --optimize flag to automatically optimize assets"
                    fi
                fi
            fi
        else
            log_error "Enhanced build validation failed"
            log_error "Run '$SCRIPT_DIR/build-validator.sh --build-dir $BUILD_DIR' for detailed report"
            return 1
        fi
    else
        log_warning "Enhanced validator not found, falling back to basic validation"
        validate_build_basic
    fi
}

# Basic build validation (fallback)
validate_build_basic() {
    log_info "Running basic build validation..."
    
    # Check for essential files
    local essential_files=("index.html" "_next" "404.html")
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
    
    log_success "Basic build validation completed"
}

# Optimize build assets
optimize_build() {
    log_info "Optimizing build assets..."
    
    if [[ -f "$SCRIPT_DIR/asset-optimizer.sh" ]]; then
        if "$SCRIPT_DIR/asset-optimizer.sh" --build-dir "$BUILD_DIR"; then
            log_success "Asset optimization completed"
        else
            log_warning "Asset optimization failed, continuing with unoptimized build"
        fi
    else
        log_warning "Asset optimizer not found, skipping optimization"
    fi
}

# Create or update sites config
setup_sites_config() {
    log_info "Setting up sites configuration..."
    
    local config_content
    read -r -d '' config_content << EOF || true
# Walrus Sites Configuration for WalTodo Frontend
# Generated by deploy-walrus-site.sh

$SITE_NAME:
  source: "$BUILD_DIR"
  network: "$NETWORK"
  # Walrus Sites specific configuration
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
      - "X-Content-Type-Options: nosniff"
      - "X-Frame-Options: DENY"
      - "X-XSS-Protection: 1; mode=block"
  redirects:
    - from: "/api/*"
      to: "https://api.waltodo.com/api/*"
      status: 307
  error_pages:
    404: "/404.html"
EOF
    
    echo "$config_content" > "$SITE_CONFIG_FILE"
    log_success "Sites configuration created at $SITE_CONFIG_FILE"
}

# Deploy to Walrus Sites with enhanced error handling and retry logic
deploy_to_walrus() {
    log_info "Deploying to Walrus Sites ($NETWORK)..."
    
    cd "$PROJECT_DIR"
    
    # Validate network configuration
    validate_network_config
    
    # Check wallet balance before deployment
    check_wallet_balance
    
    # Prepare deployment command with proper syntax
    local publish_cmd=()
    
    # Add global config options (must come before command)
    if [[ -f "$SITE_CONFIG_FILE" ]]; then
        publish_cmd+=("--config" "$SITE_CONFIG_FILE")
    fi
    
    # Add site-builder executable
    publish_cmd+=("$SITE_BUILDER_CMD")
    
    # Add the publish command
    publish_cmd+=("publish")
    
    # Add command-specific options
    publish_cmd+=("--epochs" "100")
    
    # Add wallet if specified
    if [[ -n "${WALRUS_WALLET_PATH:-}" ]]; then
        publish_cmd+=("--wallet" "$WALRUS_WALLET_PATH")
    fi
    
    # Add RPC URL for network
    if [[ "$NETWORK" == "mainnet" ]]; then
        publish_cmd+=("--rpc-url" "https://fullnode.mainnet.sui.io:443")
    else
        publish_cmd+=("--rpc-url" "https://fullnode.testnet.sui.io:443")
    fi
    
    # Add build directory (must be last argument)
    publish_cmd+=("$BUILD_DIR")
    
    log_info "Command to execute: ${publish_cmd[*]}"
    
    # Execute deployment with retry logic
    local max_retries=3
    local retry_count=0
    local deployment_output=""
    local deployment_success=false
    
    while [[ $retry_count -lt $max_retries && "$deployment_success" == false ]]; do
        log_info "Deployment attempt $((retry_count + 1))/$max_retries..."
        
        if deployment_output=$("${publish_cmd[@]}" 2>&1); then
            deployment_success=true
            log_success "Deployment completed successfully!"
            echo "$deployment_output"
            
            # Extract and save site information
            extract_site_info "$deployment_output"
            
        else
            retry_count=$((retry_count + 1))
            log_warning "Deployment attempt $retry_count failed"
            echo "$deployment_output" >&2
            
            # Check for specific error types
            if echo "$deployment_output" | grep -q "insufficient.*balance"; then
                log_error "Insufficient wallet balance. Please add more SUI tokens."
                break
            elif echo "$deployment_output" | grep -q "network.*error\|connection.*error"; then
                log_warning "Network error detected. Retrying in 10 seconds..."
                sleep 10
            elif echo "$deployment_output" | grep -q "invalid.*config\|config.*not.*found"; then
                log_error "Configuration error detected. Please check your config files."
                break
            else
                log_warning "Unknown error. Retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done
    
    if [[ "$deployment_success" != true ]]; then
        log_error "Deployment failed after $max_retries attempts"
        log_error "Last error output:"
        echo "$deployment_output" >&2
        
        # Provide troubleshooting guidance
        log_info "Troubleshooting steps:"
        log_info "1. Check wallet balance: sui client gas"
        log_info "2. Verify network connectivity"
        log_info "3. Check site-builder configuration"
        log_info "4. Review build directory contents"
        
        exit 1
    fi
}

# Validate network configuration
validate_network_config() {
    log_info "Validating network configuration..."
    
    # Check if network endpoints are reachable
    local rpc_url
    if [[ "$NETWORK" == "mainnet" ]]; then
        rpc_url="https://fullnode.mainnet.sui.io:443"
    else
        rpc_url="https://fullnode.testnet.sui.io:443"
    fi
    
    log_info "Testing connection to $rpc_url..."
    if ! curl -s -f --connect-timeout 10 "$rpc_url" > /dev/null; then
        log_warning "Cannot reach Sui RPC endpoint. Network might be slow."
    else
        log_success "Network connection verified"
    fi
}

# Check wallet balance before deployment
check_wallet_balance() {
    log_info "Checking wallet balance..."
    
    # Try to get balance using sui client
    if command -v sui &> /dev/null; then
        local balance_output
        if balance_output=$(sui client gas 2>/dev/null); then
            log_info "Wallet balance check:"
            echo "$balance_output" | head -5
        else
            log_warning "Could not check wallet balance. Ensure sui client is configured."
        fi
    else
        log_warning "Sui CLI not found. Cannot check wallet balance."
    fi
}

# Extract site information from deployment output
extract_site_info() {
    local output="$1"
    
    # Extract site URL
    local site_url
    if site_url=$(echo "$output" | grep -oE 'https://[a-zA-Z0-9.-]+\.walrus\.site' | head -1); then
        log_success "Site deployed at: $site_url"
        echo "$site_url" > "$PROJECT_DIR/.walrus-site-url"
        log_info "Site URL saved to .walrus-site-url"
    fi
    
    # Extract object ID
    local object_id
    if object_id=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1); then
        log_success "Site object ID: $object_id"
        echo "$object_id" > "$PROJECT_DIR/.walrus-object-id"
        log_info "Object ID saved to .walrus-object-id"
    fi
    
    # Extract blob IDs for future reference
    local blob_ids
    if blob_ids=$(echo "$output" | grep -oE 'blob.*ID.*0x[a-fA-F0-9]+' | head -5); then
        log_info "Blob IDs created:"
        echo "$blob_ids"
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Add any cleanup logic here if needed
}

# Main execution
main() {
    log_info "WalTodo Walrus Sites Deployment Script"
    log_info "======================================="
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Parse command line arguments
    parse_args "$@"
    
    # Display configuration
    log_info "Configuration:"
    log_info "  Network: $NETWORK"
    log_info "  Site Name: $SITE_NAME"
    log_info "  Force Rebuild: $FORCE_REBUILD"
    log_info "  Skip Build: $SKIP_BUILD"
    log_info "  Project Directory: $PROJECT_DIR"
    log_info "  Build Directory: $BUILD_DIR"
    
    # Execute deployment steps
    check_prerequisites
    install_dependencies
    build_application
    validate_build
    setup_sites_config
    deploy_to_walrus
    
    log_success "Deployment process completed successfully!"
    log_info "Your WalTodo frontend is now live on Walrus Sites."
    
    if [[ -f "$PROJECT_DIR/.walrus-site-url" ]]; then
        local site_url=$(cat "$PROJECT_DIR/.walrus-site-url")
        log_success "Access your site at: $site_url"
    fi
}

# Run main function with all arguments
main "$@"