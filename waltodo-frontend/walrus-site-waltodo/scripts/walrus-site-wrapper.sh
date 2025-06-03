#!/bin/bash

# Walrus Site Builder Wrapper Functions
# Provides reliable wrapper functions for common site-builder operations

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_CONFIG="$PROJECT_DIR/sites-config.yaml"
DEFAULT_NETWORK="testnet"
DEFAULT_EPOCHS=100

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

# Get site-builder command with fallback
get_site_builder_cmd() {
    local site_builder_cmd="site-builder"
    
    if [[ -n "${SITE_BUILDER_PATH:-}" ]]; then
        site_builder_cmd="$SITE_BUILDER_PATH"
    fi
    
    if ! command -v "$site_builder_cmd" &> /dev/null; then
        log_error "site-builder not found. Please install it first."
        return 1
    fi
    
    echo "$site_builder_cmd"
}

# Validate site-builder installation
validate_site_builder() {
    local site_builder_cmd
    if ! site_builder_cmd=$(get_site_builder_cmd); then
        return 1
    fi
    
    # Test basic functionality
    if ! "$site_builder_cmd" --help &> /dev/null; then
        log_error "site-builder binary appears to be corrupted"
        return 1
    fi
    
    return 0
}

# Execute site-builder command with retry logic
execute_site_builder_with_retry() {
    local cmd=("$@")
    local max_retries=3
    local retry_count=0
    local output=""
    local success=false
    
    while [[ $retry_count -lt $max_retries && "$success" == false ]]; do
        log_info "Attempt $((retry_count + 1))/$max_retries: ${cmd[*]}"
        
        if output=$("${cmd[@]}" 2>&1); then
            success=true
            echo "$output"
            return 0
        else
            retry_count=$((retry_count + 1))
            log_warning "Command failed (attempt $retry_count):"
            echo "$output" >&2
            
            # Check for specific error patterns
            if echo "$output" | grep -qi "network\|connection\|timeout"; then
                log_info "Network error detected, retrying in 10 seconds..."
                sleep 10
            elif echo "$output" | grep -qi "insufficient.*balance"; then
                log_error "Insufficient balance - cannot retry"
                break
            else
                log_info "Retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done
    
    log_error "Command failed after $max_retries attempts"
    echo "$output" >&2
    return 1
}

# Publish a new Walrus Site
walrus_site_publish() {
    local source_dir="$1"
    local config_file="${2:-$DEFAULT_CONFIG}"
    local network="${3:-$DEFAULT_NETWORK}"
    local epochs="${4:-$DEFAULT_EPOCHS}"
    
    log_info "Publishing Walrus Site..."
    log_info "  Source: $source_dir"
    log_info "  Config: $config_file"
    log_info "  Network: $network"
    log_info "  Epochs: $epochs"
    
    # Validate inputs
    if [[ ! -d "$source_dir" ]]; then
        log_error "Source directory does not exist: $source_dir"
        return 1
    fi
    
    if [[ ! -f "$config_file" ]]; then
        log_warning "Config file not found: $config_file"
        config_file=""
    fi
    
    # Validate site-builder
    local site_builder_cmd
    if ! site_builder_cmd=$(get_site_builder_cmd); then
        return 1
    fi
    
    # Build command
    local cmd=("$site_builder_cmd")
    
    # Add config if available
    if [[ -n "$config_file" ]]; then
        cmd+=("--config" "$config_file")
    fi
    
    # Add publish command and options
    cmd+=("publish" "--epochs" "$epochs")
    
    # Add RPC URL for network
    if [[ "$network" == "mainnet" ]]; then
        cmd+=("--rpc-url" "https://fullnode.mainnet.sui.io:443")
    else
        cmd+=("--rpc-url" "https://fullnode.testnet.sui.io:443")
    fi
    
    # Add source directory
    cmd+=("$source_dir")
    
    # Execute with retry logic
    execute_site_builder_with_retry "${cmd[@]}"
}

# Update an existing Walrus Site
walrus_site_update() {
    local source_dir="$1"
    local object_id="$2"
    local config_file="${3:-$DEFAULT_CONFIG}"
    local network="${4:-$DEFAULT_NETWORK}"
    local epochs="${5:-$DEFAULT_EPOCHS}"
    
    log_info "Updating Walrus Site..."
    log_info "  Source: $source_dir"
    log_info "  Object ID: $object_id"
    log_info "  Config: $config_file"
    log_info "  Network: $network"
    log_info "  Epochs: $epochs"
    
    # Validate inputs
    if [[ ! -d "$source_dir" ]]; then
        log_error "Source directory does not exist: $source_dir"
        return 1
    fi
    
    if [[ ! "$object_id" =~ ^0x[a-fA-F0-9]+$ ]]; then
        log_error "Invalid object ID format: $object_id"
        return 1
    fi
    
    if [[ ! -f "$config_file" ]]; then
        log_warning "Config file not found: $config_file"
        config_file=""
    fi
    
    # Validate site-builder
    local site_builder_cmd
    if ! site_builder_cmd=$(get_site_builder_cmd); then
        return 1
    fi
    
    # Build command
    local cmd=("$site_builder_cmd")
    
    # Add config if available
    if [[ -n "$config_file" ]]; then
        cmd+=("--config" "$config_file")
    fi
    
    # Add update command and options
    cmd+=("update" "--epochs" "$epochs")
    
    # Add RPC URL for network
    if [[ "$network" == "mainnet" ]]; then
        cmd+=("--rpc-url" "https://fullnode.mainnet.sui.io:443")
    else
        cmd+=("--rpc-url" "https://fullnode.testnet.sui.io:443")
    fi
    
    # Add source directory and object ID
    cmd+=("$source_dir" "$object_id")
    
    # Execute with retry logic
    execute_site_builder_with_retry "${cmd[@]}"
}

# Convert object ID to Base36 format for subdomain
walrus_site_convert() {
    local object_id="$1"
    
    log_info "Converting object ID to Base36 format..."
    
    # Validate input
    if [[ ! "$object_id" =~ ^0x[a-fA-F0-9]+$ ]]; then
        log_error "Invalid object ID format: $object_id"
        return 1
    fi
    
    # Validate site-builder
    local site_builder_cmd
    if ! site_builder_cmd=$(get_site_builder_cmd); then
        return 1
    fi
    
    # Execute conversion
    execute_site_builder_with_retry "$site_builder_cmd" "convert" "$object_id"
}

# Show sitemap for a Walrus Site
walrus_site_sitemap() {
    local object_id="$1"
    local config_file="${2:-$DEFAULT_CONFIG}"
    
    log_info "Retrieving sitemap for Walrus Site..."
    
    # Validate input
    if [[ ! "$object_id" =~ ^0x[a-fA-F0-9]+$ ]]; then
        log_error "Invalid object ID format: $object_id"
        return 1
    fi
    
    # Validate site-builder
    local site_builder_cmd
    if ! site_builder_cmd=$(get_site_builder_cmd); then
        return 1
    fi
    
    # Build command
    local cmd=("$site_builder_cmd")
    
    # Add config if available
    if [[ -f "$config_file" ]]; then
        cmd+=("--config" "$config_file")
    fi
    
    # Add sitemap command
    cmd+=("sitemap" "$object_id")
    
    # Execute command
    execute_site_builder_with_retry "${cmd[@]}"
}

# Generate directory listing preview
walrus_site_list_directory() {
    local source_dir="$1"
    local output_file="${2:-index.html}"
    
    log_info "Generating directory listing preview..."
    
    # Validate input
    if [[ ! -d "$source_dir" ]]; then
        log_error "Source directory does not exist: $source_dir"
        return 1
    fi
    
    # Validate site-builder
    local site_builder_cmd
    if ! site_builder_cmd=$(get_site_builder_cmd); then
        return 1
    fi
    
    # Execute command
    execute_site_builder_with_retry "$site_builder_cmd" "list-directory" "$source_dir" "$output_file"
}

# Extract site information from deployment output
extract_deployment_info() {
    local output="$1"
    local info_file="${2:-deployment-info.json}"
    
    log_info "Extracting deployment information..."
    
    # Extract site URL
    local site_url=""
    if site_url=$(echo "$output" | grep -oE 'https://[a-zA-Z0-9.-]+\.walrus\.site' | head -1); then
        log_success "Site URL: $site_url"
    fi
    
    # Extract object ID
    local object_id=""
    if object_id=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1); then
        log_success "Object ID: $object_id"
    fi
    
    # Extract blob IDs
    local blob_ids=()
    while IFS= read -r line; do
        blob_ids+=("$line")
    done < <(echo "$output" | grep -oE '0x[a-fA-F0-9]{32,}' | head -10)
    
    # Create JSON output
    local json_output
    json_output=$(cat << EOF
{
  "deployment_time": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "site_url": "$site_url",
  "object_id": "$object_id",
  "blob_ids": [$(printf '"%s",' "${blob_ids[@]}" | sed 's/,$//')]
}
EOF
)
    
    echo "$json_output" > "$info_file"
    log_success "Deployment info saved to: $info_file"
    
    return 0
}

# Health check for site-builder and network connectivity
walrus_site_health_check() {
    local network="${1:-$DEFAULT_NETWORK}"
    
    log_info "Performing Walrus Site health check..."
    
    # Check site-builder installation
    if ! validate_site_builder; then
        return 1
    fi
    
    # Check network connectivity
    local rpc_url
    if [[ "$network" == "mainnet" ]]; then
        rpc_url="https://fullnode.mainnet.sui.io:443"
    else
        rpc_url="https://fullnode.testnet.sui.io:443"
    fi
    
    log_info "Testing network connectivity to $rpc_url..."
    if curl -s -f --connect-timeout 10 "$rpc_url" > /dev/null; then
        log_success "Network connectivity: OK"
    else
        log_warning "Network connectivity: FAILED"
        return 1
    fi
    
    # Check Sui CLI if available
    if command -v sui &> /dev/null; then
        log_info "Checking Sui CLI configuration..."
        if sui client active-address &> /dev/null; then
            local address=$(sui client active-address 2>/dev/null)
            log_success "Sui CLI configured with address: $address"
        else
            log_warning "Sui CLI not configured"
        fi
    fi
    
    log_success "Health check completed"
    return 0
}

# Show help information
show_wrapper_help() {
    cat << EOF
Walrus Site Builder Wrapper Functions

AVAILABLE FUNCTIONS:
  walrus_site_publish DIR [CONFIG] [NETWORK] [EPOCHS]
    Publish a new Walrus Site
    
  walrus_site_update DIR OBJECT_ID [CONFIG] [NETWORK] [EPOCHS]
    Update an existing Walrus Site
    
  walrus_site_convert OBJECT_ID
    Convert object ID to Base36 format
    
  walrus_site_sitemap OBJECT_ID [CONFIG]
    Show sitemap for a Walrus Site
    
  walrus_site_list_directory DIR [OUTPUT_FILE]
    Generate directory listing preview
    
  extract_deployment_info OUTPUT [INFO_FILE]
    Extract deployment info to JSON
    
  walrus_site_health_check [NETWORK]
    Perform health check
    
  validate_site_builder
    Validate site-builder installation

EXAMPLES:
  source ./scripts/walrus-site-wrapper.sh
  walrus_site_publish ./out
  walrus_site_update ./out 0x123...
  walrus_site_health_check testnet

ENVIRONMENT VARIABLES:
  SITE_BUILDER_PATH    Path to site-builder executable
  DEFAULT_CONFIG       Default config file path
  DEFAULT_NETWORK      Default network (testnet/mainnet)
  DEFAULT_EPOCHS       Default storage epochs

EOF
}

# If script is run directly, show help
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    show_wrapper_help
fi