#!/bin/bash

# Master script for updating the CLI
# This script handles building, manifest generation, and installation

set -e # Exit immediately if a command exits with a non-zero status

# Text formatting
BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
BLUE="\033[34m"
YELLOW="\033[33m"
RESET="\033[0m"

# Get the absolute path of the project directory
PROJECT_DIR="/Users/angel/Documents/Projects/walrus_todo"
cd "$PROJECT_DIR" || { echo -e "${RED}${BOLD}ERROR:${RESET} Could not navigate to project directory"; exit 1; }

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

# Build the project
log_info "Building the project..."
node scripts/enhanced-run-build.js --mode=dev || {
  log_error "Build failed"
  exit 1
}

# Generate the manifest
log_info "Generating OCLIF manifest..."
node scripts/generate-manifest.js || {
  log_warning "Manifest generation failed, using default empty manifest"
  echo '{"version":"1.0.0","commands":{},"topics":{}}' > oclif.manifest.json
}

# Update permissions
log_info "Updating permissions..."
node scripts/fix-permissions.js || log_warning "Permission fix failed"

# Install the CLI globally
log_info "Installing CLI globally..."
bash scripts/install-global.sh || {
  log_error "Global installation failed"
  log_info "You can still use the CLI with 'node bin/run.js'"
  exit 1
}

log_success "CLI updated successfully!"