#!/bin/bash

# Improved global installation script for the WalTodo CLI
# This script provides a robust installation process with proper error handling

set -e # Exit immediately if a command exits with a non-zero status

# Text formatting
BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
BLUE="\033[34m"
YELLOW="\033[33m"
RESET="\033[0m"

# Get the absolute path of the installation directory
PROJECT_DIR="/Users/angel/Documents/Projects/walrus_todo"
BIN_DIR="$PROJECT_DIR/bin"
DIST_DIR="$PROJECT_DIR/dist"

# Log messages
log_info() {
  echo -e "${BLUE}${BOLD}INFO:${RESET} $1"
}

log_success() {
  echo -e "${GREEN}${BOLD}SUCCESS:${RESET} $1"
}

log_warning() {
  echo -e "${YELLOW}${BOLD}WARNING:${RESET} $1"
}

log_error() {
  echo -e "${RED}${BOLD}ERROR:${RESET} $1"
}

# Check if the directory exists
if [ ! -d "$PROJECT_DIR" ]; then
  log_error "Project directory $PROJECT_DIR not found."
  exit 1
fi

# Navigate to the project directory
cd "$PROJECT_DIR" || { log_error "Could not navigate to project directory"; exit 1; }

# Ensure the scripts are executable
log_info "Ensuring scripts are executable..."
chmod +x "$BIN_DIR"/*.js 2>/dev/null || true
chmod +x "$BIN_DIR"/run* 2>/dev/null || true
chmod +x "$BIN_DIR"/waltodo* 2>/dev/null || true
chmod +x scripts/*.js 2>/dev/null || true
chmod +x generate-manifest*.js 2>/dev/null || true

# Check for Node.js
if ! command -v node &> /dev/null; then
  log_error "Node.js is required but not installed. Please install Node.js first."
  exit 1
fi

# Check node version
NODE_VERSION=$(node --version | sed 's/v//')
if [[ "$(echo -e "${NODE_VERSION}\n18.0.0" | sort -V | head -n1)" != "18.0.0" ]]; then
  log_warning "Node.js version ${NODE_VERSION} is below the recommended version (18.0.0+)"
  read -p "Continue anyway? (y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Installation aborted."
    exit 1
  fi
fi

# Generate proper OCLIF manifest
log_info "Generating OCLIF manifest..."
if [ -f "generate-manifest-improved.js" ]; then
  node generate-manifest-improved.js
else
  log_warning "Improved manifest generator not found, using default generator..."
  node generate-manifest.js 2>/dev/null || {
    log_warning "Default manifest generator failed, creating an empty manifest..."
    echo '{"version":"1.0.0","commands":{},"topics":{}}' > oclif.manifest.json
  }
fi

# Build the project
log_info "Building the project..."
node scripts/enhanced-run-build.js --mode=dev

# Create user's bin directory if it doesn't exist
USER_BIN_DIR="$HOME/.local/bin"
mkdir -p "$USER_BIN_DIR" || {
  log_error "Could not create $USER_BIN_DIR"
  log_info "Trying to install to /usr/local/bin instead..."
  USER_BIN_DIR="/usr/local/bin"
  if [ ! -w "$USER_BIN_DIR" ]; then
    log_error "Cannot write to $USER_BIN_DIR. Please run with sudo or create and add ~/.local/bin to your PATH."
    exit 1
  fi
}

# Copy the waltodo script to the bin directory
log_info "Installing waltodo CLI to $USER_BIN_DIR..."
cp -f "$BIN_DIR/waltodo" "$USER_BIN_DIR/waltodo" || {
  log_error "Failed to copy waltodo script to $USER_BIN_DIR"
  exit 1
}
chmod +x "$USER_BIN_DIR/waltodo" || {
  log_error "Failed to make waltodo script executable"
  exit 1
}

# Set the correct project path in the installation
log_info "Configuring installation path..."
sed -i.bak "s|PROJECT_DIR=.*|PROJECT_DIR=\"$PROJECT_DIR\"|" "$USER_BIN_DIR/waltodo" || {
  log_error "Failed to set project path in waltodo script"
  exit 1
}

# Check if PATH includes the bin directory
if [[ ":$PATH:" != *":$USER_BIN_DIR:"* ]]; then
  log_warning "$USER_BIN_DIR is not in your PATH"
  log_info "Add the following line to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
  echo "  export PATH=\"\$PATH:$USER_BIN_DIR\""
fi

# Verify installation
if command -v waltodo &>/dev/null; then
  log_success "WalTodo CLI installed successfully!"
  log_info "You can now use 'waltodo' from anywhere."
  
  # Test the CLI
  log_info "Testing the CLI..."
  waltodo --version
  
  log_success "Installation completed successfully."
else
  log_warning "Installation successful, but 'waltodo' command not found in PATH."
  log_info "You can manually run the CLI using: $USER_BIN_DIR/waltodo"
  log_info "To add $USER_BIN_DIR to your PATH, run:"
  echo "  export PATH=\"\$PATH:$USER_BIN_DIR\""
fi

# Provide helpful usage information
log_info "Quick start guide:"
echo "  waltodo add \"My first todo\"     # Add a new todo"
echo "  waltodo list                    # List all todos"
echo "  waltodo add \"Buy milk\" -l groceries  # Add a todo to a specific list"
echo "  waltodo complete -i \"My first todo\"  # Complete a todo"
echo ""
log_info "For more information, run:"
echo "  waltodo --help"