#!/bin/bash

# Network Connectivity Test Script for Walrus Sites Deployment
# Tests various endpoints and provides diagnostic information

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TIMEOUT=30
CONNECT_TIMEOUT=10

# Test endpoints
TESTNET_ENDPOINTS=(
    "https://fullnode.testnet.sui.io:443"
    "https://sui-testnet.nodeinfra.com"
    "https://sui-testnet.chainstack.com"
    "https://sui-testnet.publicnode.com"
)

MAINNET_ENDPOINTS=(
    "https://fullnode.mainnet.sui.io:443"
    "https://sui-mainnet.nodeinfra.com"
    "https://sui-mainnet.chainstack.com"
    "https://sui-mainnet.publicnode.com"
)

WALRUS_ENDPOINTS=(
    "https://aggregator-devnet.walrus.space"
    "https://publisher-devnet.walrus.space"
    "https://aggregator.walrus.space"
    "https://publisher.walrus.space"
)

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
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test basic connectivity
test_basic_connectivity() {
    log_info "Testing basic internet connectivity..."
    
    if curl -s --max-time 10 --connect-timeout 5 https://www.google.com >/dev/null 2>&1; then
        log_success "Internet connectivity: OK"
        return 0
    else
        log_error "Internet connectivity: FAILED"
        return 1
    fi
}

# Test RPC endpoint
test_rpc_endpoint() {
    local url=$1
    local name=$2
    
    log_info "Testing $name: $url"
    
    # Test basic connectivity
    if ! curl -s --max-time $CONNECT_TIMEOUT --connect-timeout 5 "$url" >/dev/null 2>&1; then
        log_error "$name: Connection failed"
        return 1
    fi
    
    # Test RPC call
    local response
    if response=$(curl -s --max-time $TIMEOUT --connect-timeout $CONNECT_TIMEOUT \
        -X POST "$url" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"sui_getChainIdentifier","params":[],"id":1}' 2>&1); then
        
        if echo "$response" | grep -q '"result"'; then
            log_success "$name: RPC call successful"
            return 0
        else
            log_warning "$name: RPC call failed - $response"
            return 1
        fi
    else
        log_error "$name: RPC call failed - $response"
        return 1
    fi
}

# Test Walrus endpoint
test_walrus_endpoint() {
    local url=$1
    local name=$2
    
    log_info "Testing $name: $url"
    
    if curl -s --max-time $TIMEOUT --connect-timeout $CONNECT_TIMEOUT "$url" >/dev/null 2>&1; then
        log_success "$name: Connection successful"
        return 0
    else
        log_error "$name: Connection failed"
        return 1
    fi
}

# Test all endpoints
test_all_endpoints() {
    log_info "Testing Sui Testnet RPC endpoints..."
    local testnet_working=0
    for endpoint in "${TESTNET_ENDPOINTS[@]}"; do
        if test_rpc_endpoint "$endpoint" "Testnet RPC"; then
            ((testnet_working++))
        fi
        echo
    done
    
    log_info "Testing Sui Mainnet RPC endpoints..."
    local mainnet_working=0
    for endpoint in "${MAINNET_ENDPOINTS[@]}"; do
        if test_rpc_endpoint "$endpoint" "Mainnet RPC"; then
            ((mainnet_working++))
        fi
        echo
    done
    
    log_info "Testing Walrus endpoints..."
    local walrus_working=0
    for endpoint in "${WALRUS_ENDPOINTS[@]}"; do
        if test_walrus_endpoint "$endpoint" "Walrus"; then
            ((walrus_working++))
        fi
        echo
    done
    
    # Summary
    log_info "Connectivity Summary:"
    log_info "  Testnet RPC endpoints working: $testnet_working/${#TESTNET_ENDPOINTS[@]}"
    log_info "  Mainnet RPC endpoints working: $mainnet_working/${#MAINNET_ENDPOINTS[@]}"
    log_info "  Walrus endpoints working: $walrus_working/${#WALRUS_ENDPOINTS[@]}"
    
    if [[ $testnet_working -eq 0 && $mainnet_working -eq 0 ]]; then
        log_error "No Sui RPC endpoints are working!"
        return 1
    elif [[ $walrus_working -eq 0 ]]; then
        log_error "No Walrus endpoints are working!"
        return 1
    else
        log_success "Network connectivity test passed"
        return 0
    fi
}

# Get system information
get_system_info() {
    log_info "System Information:"
    log_info "  OS: $(uname -s)"
    log_info "  Architecture: $(uname -m)"
    
    if command -v curl >&/dev/null; then
        log_info "  curl version: $(curl --version | head -1)"
    else
        log_error "  curl: NOT INSTALLED"
    fi
    
    # Check DNS resolution
    if nslookup google.com >/dev/null 2>&1; then
        log_success "  DNS resolution: OK"
    else
        log_error "  DNS resolution: FAILED"
    fi
    
    # Check if behind proxy
    if [[ -n "${HTTP_PROXY:-}${HTTPS_PROXY:-}${http_proxy:-}${https_proxy:-}" ]]; then
        log_warning "  Proxy detected: ${HTTP_PROXY:-}${HTTPS_PROXY:-}${http_proxy:-}${https_proxy:-}"
    else
        log_info "  Proxy: None detected"
    fi
}

# Main function
main() {
    echo "Network Connectivity Test for Walrus Sites Deployment"
    echo "===================================================="
    echo
    
    get_system_info
    echo
    
    if ! test_basic_connectivity; then
        log_error "Basic connectivity test failed. Please check your internet connection."
        exit 1
    fi
    echo
    
    if test_all_endpoints; then
        log_success "All network connectivity tests passed!"
        echo
        log_info "You can proceed with Walrus Sites deployment."
    else
        log_error "Some network connectivity tests failed."
        echo
        log_info "Troubleshooting suggestions:"
        log_info "1. Check your internet connection"
        log_info "2. Verify firewall settings"
        log_info "3. Check if you're behind a corporate proxy"
        log_info "4. Try connecting from a different network"
        log_info "5. Wait a few minutes and try again (endpoints might be temporarily down)"
        exit 1
    fi
}

main "$@"