#!/bin/bash

# build-scripts.sh: A unified bash script for build-related operations
# This script handles build operations with proper error handling and colored output

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Error handling function
handle_error() {
  echo -e "${RED}Error: $1${NC}" >&2
  exit 1
}

# Success message function
success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Warning message function
warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Info message function
info() {
  echo -e "${BLUE}$1${NC}"
}

# Check for required binaries
check_requirements() {
  info "Checking build requirements..."
  
  # Check for node
  if ! command -v node &> /dev/null; then
    handle_error "Node.js is required but not installed. Please install Node.js v18 or newer."
  fi
  
  # Check for npm
  if ! command -v npm &> /dev/null; then
    handle_error "npm is required but not installed."
  fi
  
  # Check for pnpm (preferred)
  if ! command -v pnpm &> /dev/null; then
    warning "pnpm is recommended but not installed. Will use npm instead."
    PACKAGE_MANAGER="npm"
  else
    PACKAGE_MANAGER="pnpm"
  fi
  
  success "All build requirements satisfied."
}

# Fix permissions for bin files
fix_bin_permissions() {
  info "Fixing bin directory permissions..."
  
  if [ ! -d "bin" ]; then
    warning "Bin directory not found, skipping permission fix."
    return
  fi
  
  chmod +x bin/run.js bin/waltodo bin/waltodo-direct 2>/dev/null || warning "Failed to set permissions for some bin files."
  
  # Make all bin files executable
  find bin -type f -exec chmod +x {} \; 2>/dev/null
  
  success "Bin directory permissions fixed."
}

# Clean the dist directory
clean_dist() {
  info "Cleaning dist directory..."
  
  if [ -d "dist" ]; then
    rm -rf dist || handle_error "Failed to clean dist directory."
    success "Dist directory cleaned."
  else
    info "Dist directory does not exist, nothing to clean."
  fi
}

# Touch or create the manifest file
touch_manifest() {
  info "Creating/touching manifest file..."
  
  touch oclif.manifest.json || handle_error "Failed to create/touch manifest file."
  success "Manifest file created/updated."
}

# Run TypeScript compiler
run_tsc() {
  info "Running TypeScript compiler with full type checking..."
  
  if [ "$SKIP_TYPECHECK" = true ]; then
    $PACKAGE_MANAGER exec tsc --skipLibCheck --noEmitOnError false || warning "TypeScript compilation had errors, but continuing due to SKIP_TYPECHECK=true."
  else
    $PACKAGE_MANAGER exec tsc --skipLibCheck || handle_error "TypeScript compilation failed."
  fi
  
  success "TypeScript compilation completed."
}

# Run transpile-only build
run_transpile_only() {
  info "Running transpile-only build (fast mode)..."
  
  $PACKAGE_MANAGER exec ts-node --transpileOnly scripts/build-helper.ts || handle_error "Transpile-only build failed."
  
  success "Transpile-only build completed."
}

# Run unified build script
run_unified_build() {
  info "Running unified build script..."
  
  local build_args=""
  [ "$VERBOSE" = true ] && build_args="$build_args --verbose"
  [ "$CLEAN" = true ] && build_args="$build_args --clean"
  [ "$SKIP_TYPECHECK" = true ] && build_args="$build_args --skip-typecheck"
  [ "$TRANSPILE_ONLY" = true ] && build_args="$build_args --transpile-only"
  
  $PACKAGE_MANAGER exec ts-node scripts/unified-build.ts $build_args || handle_error "Unified build failed."
  
  success "Unified build completed."
}

# Install dependencies if needed
install_dependencies() {
  info "Checking for dependencies..."
  
  if [ ! -d "node_modules" ]; then
    info "Installing dependencies with $PACKAGE_MANAGER..."
    $PACKAGE_MANAGER install || handle_error "Failed to install dependencies."
    success "Dependencies installed."
  else
    info "Dependencies already installed, skipping."
  fi
}

# Display help
show_help() {
  echo -e "${CYAN}Build Script Help${NC}"
  echo "Usage: ./build-scripts.sh [OPTIONS] COMMAND"
  echo 
  echo "Commands:"
  echo "  build             Full build with type checking"
  echo "  build-fast        Build with transpile-only mode (no type checking)"
  echo "  clean             Clean dist directory"
  echo "  fix-permissions   Fix bin directory permissions"
  echo "  manifest          Update OCLIF manifest file"
  echo "  unified           Run the unified build process (recommended)"
  echo
  echo "Options:"
  echo "  --verbose         Show detailed output"
  echo "  --skip-typecheck  Skip TypeScript type checking"
  echo "  --clean           Clean before building"
  echo "  --no-install      Skip dependency installation check"
  echo "  --help            Show this help message"
  echo
  echo "Examples:"
  echo "  ./build-scripts.sh unified --verbose        # Run unified build with verbose output"
  echo "  ./build-scripts.sh build-fast --clean       # Run fast build after cleaning"
  echo "  ./build-scripts.sh clean                    # Just clean the dist directory"
  echo
}

# Main script execution
main() {
  # Set defaults
  VERBOSE=false
  SKIP_TYPECHECK=false
  CLEAN=false
  INSTALL=true
  PACKAGE_MANAGER="pnpm"
  
  # Parse arguments
  COMMAND=""
  
  for arg in "$@"; do
    case $arg in
      --verbose)
        VERBOSE=true
        ;;
      --skip-typecheck)
        SKIP_TYPECHECK=true
        ;;
      --clean)
        CLEAN=true
        ;;
      --no-install)
        INSTALL=false
        ;;
      --help)
        show_help
        exit 0
        ;;
      build|build-fast|clean|fix-permissions|manifest|unified)
        COMMAND=$arg
        ;;
      *)
        warning "Unknown argument: $arg"
        ;;
    esac
  done
  
  if [ -z "$COMMAND" ]; then
    warning "No command specified."
    show_help
    exit 1
  fi
  
  # Show configuration if verbose
  if [ "$VERBOSE" = true ]; then
    echo -e "${CYAN}Build configuration:${NC}"
    echo "  Command: $COMMAND"
    echo "  Verbose: $VERBOSE"
    echo "  Skip TypeCheck: $SKIP_TYPECHECK"
    echo "  Clean: $CLEAN"
    echo "  Install: $INSTALL"
    echo "  Package Manager: $PACKAGE_MANAGER"
    echo
  fi
  
  # Record start time
  START_TIME=$(date +%s)
  
  # Check requirements
  check_requirements
  
  # Install dependencies if needed
  if [ "$INSTALL" = true ]; then
    install_dependencies
  fi
  
  # Execute the requested command
  case $COMMAND in
    clean)
      clean_dist
      ;;
    fix-permissions)
      fix_bin_permissions
      ;;
    manifest)
      touch_manifest
      ;;
    build)
      [ "$CLEAN" = true ] && clean_dist
      run_tsc
      fix_bin_permissions
      touch_manifest
      ;;
    build-fast)
      [ "$CLEAN" = true ] && clean_dist
      run_transpile_only
      fix_bin_permissions
      touch_manifest
      ;;
    unified)
      # Use the new unified build script 
      run_unified_build
      ;;
    *)
      handle_error "Unknown command: $COMMAND"
      ;;
  esac
  
  # Calculate execution time
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  
  success "Operation completed in $DURATION seconds."
}

# Execute main function with all arguments
main "$@"