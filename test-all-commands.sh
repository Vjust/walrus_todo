#!/bin/bash

# This script tests all CLI commands to ensure they work properly

# Set up colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run a command and check if it succeeds
run_command() {
  echo -e "${BLUE}Running:${NC} $1"
  eval "$1"
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Command succeeded${NC}"
  else
    echo -e "${RED}✗ Command failed${NC}"
  fi
  echo ""
}

# Make sure we're using the local bin directory
export PATH="$HOME/.local/bin:$PATH"

# Test list of commands to run
echo -e "${BLUE}=== Testing waltodo CLI commands ===${NC}\n"

# Basic commands
run_command "waltodo --help"
run_command "waltodo --version"

# List commands
run_command "waltodo list"
run_command "waltodo list default"
run_command "waltodo list default --completed"
run_command "waltodo list default --pending"

# Account commands
run_command "waltodo account --show"

# Add a test todo
TEST_LIST="cli-test-list"
TEST_TODO="CLI Test Todo Item"

# Create a test list and add a todo in one command
run_command "waltodo add $TEST_LIST -t \"$TEST_TODO\""

# List the test list
run_command "waltodo list $TEST_LIST"

echo -e "${GREEN}All tests completed!${NC}"
