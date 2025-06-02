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

# Default values
NETWORK="testnet"
FORCE_REBUILD=false
SKIP_BUILD=false
SITE_NAME="waltodo-app"
CONFIG_DIR="$HOME/.walrus"

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
    --site-name NAME         Name for the Walrus site [default: waltodo-app]
    --config-dir DIR         Walrus config directory [default: ~/.walrus]
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
        log_error "package.json not found. Are you in the right directory?"
        exit 1
    fi
    
    # Check if pnpm is installed
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is required but not installed. Please install pnpm first."
        exit 1
    fi
    
    # Check for site-builder
    SITE_BUILDER_CMD="site-builder"
    if [[ -n "${SITE_BUILDER_PATH:-}" ]]; then
        SITE_BUILDER_CMD="$SITE_BUILDER_PATH"
    fi
    
    if ! command -v "$SITE_BUILDER_CMD" &> /dev/null; then
        log_error "site-builder CLI not found. Please install it first:"
        log_error "Run: ./scripts/setup-walrus-site.sh"
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_NODE="18.0.0"
    if ! printf '%s\n%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V -C; then
        log_error "Node.js version $NODE_VERSION is less than required $REQUIRED_NODE"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
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

# Validate build output
validate_build() {
    log_info "Validating build output..."
    
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
    
    log_success "Build validation completed"
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

# Deploy to Walrus Sites
deploy_to_walrus() {
    log_info "Deploying to Walrus Sites ($NETWORK)..."
    
    cd "$PROJECT_DIR"
    
    # Set up environment variables for deployment
    local deploy_cmd=("$SITE_BUILDER_CMD" "deploy")
    
    # Add network flag
    deploy_cmd+=("--network" "$NETWORK")
    
    # Add config file if it exists
    if [[ -f "$SITE_CONFIG_FILE" ]]; then
        deploy_cmd+=("--config" "$SITE_CONFIG_FILE")
    fi
    
    # Add wallet configuration if provided
    if [[ -n "${WALRUS_WALLET_PATH:-}" ]]; then
        deploy_cmd+=("--wallet" "$WALRUS_WALLET_PATH")
    fi
    
    # Add configuration directory
    if [[ -d "$CONFIG_DIR" ]]; then
        deploy_cmd+=("--config-dir" "$CONFIG_DIR")
    fi
    
    # Execute deployment - use publish instead of deploy
    local publish_cmd=("$SITE_BUILDER_CMD")
    
    # Add global options first (context and config go before command)
    if [[ "$NETWORK" == "testnet" ]]; then
        publish_cmd+=("--context" "testnet")
    fi
    
    # Use the actual config file location
    local config_file="$HOME/.config/walrus/sites-config.yaml"
    if [[ -f "$config_file" ]]; then
        publish_cmd+=("--config" "$config_file")
    else
        log_info "Walrus config not found at $config_file, using default"
    fi
    
    # Add the publish command and its options
    publish_cmd+=("publish" "--epochs" "5" "--site-name" "$SITE_NAME")
    
    # Add build directory
    publish_cmd+=("$BUILD_DIR")
    
    log_info "Running: ${publish_cmd[*]}"
    
    local deployment_output
    if deployment_output=$("${publish_cmd[@]}" 2>&1); then
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
        
    else
        log_error "Deployment failed:"
        echo "$deployment_output" >&2
        exit 1
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