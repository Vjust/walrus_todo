#!/bin/bash

# test-all-commands.sh: Test all commands to ensure the build system is working correctly

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print step
print_step() {
  echo -e "${BLUE}Testing: $1${NC}"
}

# Success message
success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Error message
error() {
  echo -e "${RED}✗ $1${NC}"
  exit 1
}

# Warning message
warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Test a build command
test_command() {
  command=$1
  description=$2
  
  print_step "$description"
  if npm run $command; then
    success "$command succeeded"
  else
    error "$command failed"
  fi
  echo
}

# Main function
main() {
  echo -e "${BLUE}Starting test of all build commands${NC}"
  echo
  
  # Clean everything first
  test_command "clean" "Clean build"
  
  # Test basic build
  test_command "build" "Default build"
  
  # Test fast build
  test_command "build:fast" "Fast build (transpile-only)"
  
  # Test clean and build
  test_command "build:clean" "Clean and build"
  
  # Test type checking build
  test_command "build:check" "Build with type checking"
  
  # Test manifest
  test_command "manifest" "Generate manifest"
  
  # Test permission fixing
  test_command "fix:permissions" "Fix permissions"
  
  echo -e "${GREEN}All commands tested successfully!${NC}"
}

# Run the main function
main