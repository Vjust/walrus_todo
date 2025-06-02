#!/bin/bash

# Walrus Site Setup Script
# Sets up the environment for deploying WalTodo frontend to Walrus Sites

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
CONFIG_DIR="$HOME/.walrus"
SITE_BUILDER_VERSION="latest"

# Default values
INSTALL_SITE_BUILDER=true
SETUP_CONFIG=true
CHECK_WALLET=true
NETWORK="testnet"

# Help function
show_help() {
    cat << EOF
Walrus Site Setup Script for WalTodo Frontend

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --skip-install           Skip site-builder installation
    --skip-config            Skip configuration setup
    --skip-wallet            Skip wallet verification
    -n, --network NETWORK    Network to configure (testnet|mainnet) [default: testnet]
    --version VERSION        site-builder version to install [default: latest]
    --config-dir DIR         Walrus config directory [default: ~/.walrus]
    -h, --help               Show this help message

EXAMPLES:
    $0                       # Full setup with defaults
    $0 --skip-install        # Setup config and wallet only
    $0 --network mainnet     # Setup for mainnet

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
            --skip-install)
                INSTALL_SITE_BUILDER=false
                shift
                ;;
            --skip-config)
                SETUP_CONFIG=false
                shift
                ;;
            --skip-wallet)
                CHECK_WALLET=false
                shift
                ;;
            -n|--network)
                NETWORK="$2"
                if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
                    log_error "Invalid network: $NETWORK. Must be 'testnet' or 'mainnet'"
                    exit 1
                fi
                shift 2
                ;;
            --version)
                SITE_BUILDER_VERSION="$2"
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

# Check system requirements
check_system_requirements() {
    log_info "Checking system requirements..."
    
    # Check operating system
    case "$OSTYPE" in
        linux-gnu*) OS="linux" ;;
        darwin*) OS="macos" ;;
        msys*|cygwin*) OS="windows" ;;
        *) 
            log_error "Unsupported operating system: $OSTYPE"
            exit 1
            ;;
    esac
    log_info "Operating system: $OS"
    
    # Check architecture
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64) ARCH="x64" ;;
        arm64|aarch64) ARCH="arm64" ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    log_info "Architecture: $ARCH"
    
    # Check required tools
    local required_tools=("curl" "tar" "node" "pnpm")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_NODE="18.0.0"
    if ! printf '%s\n%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V -C; then
        log_error "Node.js version $NODE_VERSION is less than required $REQUIRED_NODE"
        exit 1
    fi
    
    log_success "System requirements check passed"
}

# Install site-builder CLI
install_site_builder() {
    if [[ "$INSTALL_SITE_BUILDER" != true ]]; then
        log_info "Skipping site-builder installation"
        return
    fi
    
    log_info "Installing site-builder CLI..."
    
    # Check if already installed
    if command -v site-builder &> /dev/null; then
        local current_version
        current_version=$(site-builder --version 2>/dev/null | head -1 || echo "unknown")
        log_info "site-builder is already installed: $current_version"
        
        read -p "Do you want to reinstall site-builder? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Skipping site-builder installation"
            return
        fi
    fi
    
    # Create temporary directory for download
    local temp_dir
    temp_dir=$(mktemp -d)
    trap "rm -rf '$temp_dir'" EXIT
    
    # Determine download URL based on OS and architecture
    local download_url
    case "$OS" in
        linux)
            case "$ARCH" in
                x64) download_url="https://github.com/MystenLabs/walrus-sites/releases/latest/download/site-builder-linux-x64.tar.gz" ;;
                arm64) download_url="https://github.com/MystenLabs/walrus-sites/releases/latest/download/site-builder-linux-arm64.tar.gz" ;;
            esac
            ;;
        macos)
            case "$ARCH" in
                x64) download_url="https://github.com/MystenLabs/walrus-sites/releases/latest/download/site-builder-macos-x64.tar.gz" ;;
                arm64) download_url="https://github.com/MystenLabs/walrus-sites/releases/latest/download/site-builder-macos-arm64.tar.gz" ;;
            esac
            ;;
        windows)
            download_url="https://github.com/MystenLabs/walrus-sites/releases/latest/download/site-builder-windows-x64.zip"
            ;;
    esac
    
    if [[ -z "$download_url" ]]; then
        log_error "No site-builder binary available for $OS-$ARCH"
        log_info "Please build from source: https://github.com/MystenLabs/walrus-sites"
        exit 1
    fi
    
    # Download and extract
    log_info "Downloading site-builder from: $download_url"
    local archive_file="$temp_dir/site-builder.tar.gz"
    
    if ! curl -L -o "$archive_file" "$download_url"; then
        log_error "Failed to download site-builder"
        exit 1
    fi
    
    # Extract based on file type
    if [[ "$download_url" == *.zip ]]; then
        unzip -q "$archive_file" -d "$temp_dir"
    else
        tar -xzf "$archive_file" -C "$temp_dir"
    fi
    
    # Find the executable
    local site_builder_binary
    site_builder_binary=$(find "$temp_dir" -name "site-builder*" -type f -executable | head -1)
    
    if [[ -z "$site_builder_binary" ]]; then
        log_error "site-builder binary not found in downloaded archive"
        exit 1
    fi
    
    # Install to a directory in PATH
    local install_dir="/usr/local/bin"
    if [[ ! -w "$install_dir" ]]; then
        install_dir="$HOME/.local/bin"
        mkdir -p "$install_dir"
    fi
    
    log_info "Installing site-builder to $install_dir"
    cp "$site_builder_binary" "$install_dir/site-builder"
    chmod +x "$install_dir/site-builder"
    
    # Verify installation
    if command -v site-builder &> /dev/null; then
        local installed_version
        installed_version=$(site-builder --version 2>/dev/null | head -1 || echo "unknown")
        log_success "site-builder installed successfully: $installed_version"
    else
        log_warning "site-builder installed but not in PATH. Add $install_dir to your PATH."
        echo "export PATH=\"$install_dir:\$PATH\"" >> "$HOME/.bashrc"
        echo "export PATH=\"$install_dir:\$PATH\"" >> "$HOME/.zshrc" 2>/dev/null || true
    fi
}

# Setup Walrus configuration
setup_walrus_config() {
    if [[ "$SETUP_CONFIG" != true ]]; then
        log_info "Skipping configuration setup"
        return
    fi
    
    log_info "Setting up Walrus configuration..."
    
    # Create config directory
    mkdir -p "$CONFIG_DIR"
    
    # Create basic configuration file
    local config_file="$CONFIG_DIR/client_config.yaml"
    
    if [[ -f "$config_file" ]]; then
        log_info "Configuration file already exists at $config_file"
        read -p "Do you want to overwrite it? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Keeping existing configuration"
            return
        fi
    fi
    
    # Generate configuration based on network
    local config_content
    if [[ "$NETWORK" == "mainnet" ]]; then
        read -r -d '' config_content << EOF || true
# Walrus Client Configuration - Mainnet
# Generated by setup-walrus-site.sh

api_base_url: "https://publisher.walrus.space"
aggregator_url: "https://aggregator.walrus.space"
sui_rpc_url: "https://fullnode.mainnet.sui.io:443"
sui_ws_url: "wss://fullnode.mainnet.sui.io:443"

# Site publishing configuration
site_publisher_config:
  package_id: "0x1f3f67151a0e3d7f0a0d0a7a3a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a"
  publisher_id: "0x2f3f67151a0e3d7f0a0d0a7a3a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a"

# Default settings
default_epochs: 5
max_redirect_depth: 3
EOF
    else
        read -r -d '' config_content << EOF || true
# Walrus Client Configuration - Testnet
# Generated by setup-walrus-site.sh

api_base_url: "https://publisher-devnet.walrus.space"
aggregator_url: "https://aggregator-devnet.walrus.space"  
sui_rpc_url: "https://fullnode.devnet.sui.io:443"
sui_ws_url: "wss://fullnode.devnet.sui.io:443"

# Site publishing configuration
site_publisher_config:
  package_id: "0x1f3f67151a0e3d7f0a0d0a7a3a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a"
  publisher_id: "0x2f3f67151a0e3d7f0a0d0a7a3a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a"

# Default settings
default_epochs: 5
max_redirect_depth: 3
EOF
    fi
    
    echo "$config_content" > "$config_file"
    log_success "Configuration created at $config_file"
    
    # Set appropriate permissions
    chmod 600 "$config_file"
    
    log_info "Network configured for: $NETWORK"
}

# Setup wallet for deployment
setup_wallet() {
    if [[ "$CHECK_WALLET" != true ]]; then
        log_info "Skipping wallet setup"
        return
    fi
    
    log_info "Setting up wallet for deployment..."
    
    local wallet_dir="$CONFIG_DIR/wallets"
    mkdir -p "$wallet_dir"
    
    # Check for existing wallets
    if ls "$wallet_dir"/*.keystore &> /dev/null; then
        log_info "Existing wallet keystores found:"
        ls -la "$wallet_dir"/*.keystore
        
        read -p "Do you want to create a new wallet? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Using existing wallet"
            return
        fi
    fi
    
    log_info "To deploy to Walrus Sites, you'll need:"
    log_info "1. A Sui wallet with sufficient SUI tokens"
    log_info "2. WAL tokens for storage (if using custom Walrus deployment)"
    echo
    log_info "Wallet setup options:"
    log_info "1. Use existing Sui CLI wallet"
    log_info "2. Create new wallet keystore"
    log_info "3. Use hardware wallet"
    echo
    
    read -p "Choose option (1-3): " -r wallet_option
    
    case "$wallet_option" in
        1)
            log_info "To use Sui CLI wallet, ensure you have:"
            log_info "- Sui CLI installed and configured"
            log_info "- Active wallet with sufficient balance"
            log_info "Run 'sui client active-address' to verify"
            ;;
        2)
            local keystore_file="$wallet_dir/deployment.keystore"
            log_info "Creating new wallet keystore..."
            log_warning "IMPORTANT: Save your mnemonic phrase securely!"
            
            # This would typically use Sui CLI to generate a keystore
            log_info "To create a new keystore, run:"
            log_info "sui client new-address ed25519"
            log_info "Then export it to: $keystore_file"
            ;;
        3)
            log_info "Hardware wallet setup:"
            log_info "- Connect your Ledger device"
            log_info "- Install Sui app on Ledger"
            log_info "- Configure Sui CLI to use Ledger"
            ;;
        *)
            log_warning "Invalid option selected"
            ;;
    esac
    
    # Check for minimum balance
    log_info ""
    log_info "Balance requirements:"
    log_info "- Testnet: ~0.1 SUI for gas fees"
    log_info "- Mainnet: ~1 SUI for gas fees + WAL tokens for storage"
    log_info ""
    log_warning "Ensure your wallet has sufficient balance before deploying!"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    local success=true
    
    # Check site-builder
    if command -v site-builder &> /dev/null; then
        local version
        version=$(site-builder --version 2>/dev/null | head -1 || echo "unknown")
        log_success "site-builder: $version"
    else
        log_error "site-builder not found in PATH"
        success=false
    fi
    
    # Check configuration
    local config_file="$CONFIG_DIR/client_config.yaml"
    if [[ -f "$config_file" ]]; then
        log_success "Configuration: $config_file"
    else
        log_error "Configuration file not found"
        success=false
    fi
    
    # Check project setup
    if [[ -f "$PROJECT_DIR/package.json" ]]; then
        log_success "Project: WalTodo frontend ready"
    else
        log_error "Project package.json not found"
        success=false
    fi
    
    if [[ "$success" == true ]]; then
        log_success "Installation verification passed!"
        log_info ""
        log_info "Next steps:"
        log_info "1. Ensure your wallet has sufficient balance"
        log_info "2. Run './scripts/deploy-walrus-site.sh' to deploy"
        log_info "3. Monitor deployment with site-builder status commands"
    else
        log_error "Installation verification failed. Please check the errors above."
        exit 1
    fi
}

# Main execution
main() {
    log_info "WalTodo Walrus Sites Setup Script"
    log_info "================================="
    
    # Parse command line arguments
    parse_args "$@"
    
    # Display configuration
    log_info "Configuration:"
    log_info "  Network: $NETWORK"
    log_info "  Install site-builder: $INSTALL_SITE_BUILDER"
    log_info "  Setup config: $SETUP_CONFIG"
    log_info "  Check wallet: $CHECK_WALLET"
    log_info "  Config directory: $CONFIG_DIR"
    
    # Execute setup steps
    check_system_requirements
    install_site_builder
    setup_walrus_config
    setup_wallet
    verify_installation
    
    log_success "Setup completed successfully!"
    log_info "Your environment is ready for Walrus Sites deployment."
}

# Run main function with all arguments
main "$@"