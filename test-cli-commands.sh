#!/bin/bash

# Test script for waltodo CLI commands
# This script will test all available commands and verify their functionality

# Set up colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test list name to use throughout tests
TEST_LIST="test-list"
TEST_TODO_TITLE="Test todo item"

# Function to print section headers
print_header() {
  echo -e "\n${BLUE}==== $1 ====${NC}\n"
}

# Function to run a command and check its success
run_command() {
  echo -e "${YELLOW}Running:${NC} $1"
  eval "$1"
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Command succeeded${NC}"
    return 0
  else
    echo -e "${RED}✗ Command failed${NC}"
    return 1
  fi
}

# Start testing
echo -e "${BLUE}Starting waltodo CLI command tests${NC}"
echo -e "${YELLOW}Note: Some commands may require user interaction${NC}"

# Test help command
print_header "Testing help command"
run_command "node bin/run.js --help"
run_command "node bin/run.js -h"

# Test version command
print_header "Testing version command"
run_command "node bin/run.js --version"

# Test account command
print_header "Testing account command"
run_command "node bin/run.js account --show"

# Test configure command
print_header "Testing configure command"
echo -e "${YELLOW}Skipping interactive configure command${NC}"

# Test simple commands
print_header "Testing simple commands"
run_command "node bin/run.js simple create $TEST_LIST"
run_command "node bin/run.js simple add $TEST_LIST \"$TEST_TODO_TITLE\" -p high -t test,cli"
run_command "node bin/run.js simple list $TEST_LIST"
# Get the ID of the todo we just created to use in the complete command
TODO_ID=$(node bin/run.js simple list $TEST_LIST | grep -o '(.*)')
TODO_ID=${TODO_ID//[()]/}
if [ -n "$TODO_ID" ]; then
  run_command "node bin/run.js simple complete $TEST_LIST --id $TODO_ID"
else
  echo -e "${RED}Could not find todo ID for completion test${NC}"
fi

# Test list command
print_header "Testing list command"
run_command "node bin/run.js list"
run_command "node bin/run.js list $TEST_LIST"
run_command "node bin/run.js list $TEST_LIST --completed"
run_command "node bin/run.js list $TEST_LIST --pending"

# Test add command
print_header "Testing add command"
run_command "node bin/run.js add $TEST_LIST -t \"Another test todo\" -p medium"
run_command "node bin/run.js add $TEST_LIST -t \"Priority todo\" -p high"

# Test complete command
print_header "Testing complete command"
# Get a todo ID to complete
TODO_ID=$(node bin/run.js list $TEST_LIST | grep -o '(.*)')
TODO_ID=${TODO_ID//[()]/}
if [ -n "$TODO_ID" ]; then
  run_command "node bin/run.js complete $TEST_LIST -i $TODO_ID"
else
  echo -e "${RED}Could not find todo ID for completion test${NC}"
fi

# Test check command
print_header "Testing check command"
# Get a todo ID to check/uncheck
TODO_ID=$(node bin/run.js list $TEST_LIST | grep -o '(.*)')
TODO_ID=${TODO_ID//[()]/}
if [ -n "$TODO_ID" ]; then
  run_command "node bin/run.js check $TEST_LIST -i $TODO_ID --complete"
  run_command "node bin/run.js check $TEST_LIST -i $TODO_ID --incomplete"
else
  echo -e "${RED}Could not find todo ID for check test${NC}"
fi

# Test update command
print_header "Testing update command"
# Get a todo ID to update
TODO_ID=$(node bin/run.js list $TEST_LIST | grep -o '(.*)')
TODO_ID=${TODO_ID//[()]/}
if [ -n "$TODO_ID" ]; then
  run_command "node bin/run.js update $TEST_LIST -i $TODO_ID -t \"Updated title\""
else
  echo -e "${RED}Could not find todo ID for update test${NC}"
fi

# Test store command (may require blockchain connection)
print_header "Testing store command"
echo -e "${YELLOW}Note: Store command requires blockchain connection${NC}"
# Get a todo ID to store
TODO_ID=$(node bin/run.js list $TEST_LIST | grep -o '(.*)')
TODO_ID=${TODO_ID//[()]/}
if [ -n "$TODO_ID" ]; then
  run_command "node bin/run.js store --todo $TODO_ID --list $TEST_LIST"
else
  echo -e "${RED}Could not find todo ID for store test${NC}"
fi

# Test retrieve command (may require blockchain connection)
print_header "Testing retrieve command"
echo -e "${YELLOW}Note: Retrieve command requires blockchain connection${NC}"
run_command "node bin/run.js retrieve --list $TEST_LIST"

# Test image command
print_header "Testing image command"
run_command "node bin/run.js image list"
# Get a todo ID for image generation
TODO_ID=$(node bin/run.js list $TEST_LIST | grep -o '(.*)')
TODO_ID=${TODO_ID//[()]/}
if [ -n "$TODO_ID" ]; then
  run_command "node bin/run.js image generate -l $TEST_LIST -i $TODO_ID"
else
  echo -e "${RED}Could not find todo ID for image test${NC}"
fi

# Test create NFT command (may require blockchain connection)
print_header "Testing create NFT command"
echo -e "${YELLOW}Note: Create command requires blockchain connection${NC}"
# Get a todo ID to create NFT
TODO_ID=$(node bin/run.js list $TEST_LIST | grep -o '(.*)')
TODO_ID=${TODO_ID//[()]/}
if [ -n "$TODO_ID" ]; then
  run_command "node bin/run.js create -l $TEST_LIST -i $TODO_ID"
else
  echo -e "${RED}Could not find todo ID for NFT creation test${NC}"
fi

# Test share command
print_header "Testing share command"
run_command "node bin/run.js share $TEST_LIST"

# Test delete command
print_header "Testing delete command"
# Get a todo ID to delete
TODO_ID=$(node bin/run.js list $TEST_LIST | grep -o '(.*)')
TODO_ID=${TODO_ID//[()]/}
if [ -n "$TODO_ID" ]; then
  run_command "node bin/run.js delete $TEST_LIST -i $TODO_ID"
else
  echo -e "${RED}Could not find todo ID for deletion test${NC}"
fi

# Finally, clean up by deleting the test list
print_header "Cleaning up"
run_command "node bin/run.js delete $TEST_LIST"

# Summary
print_header "Test Summary"
echo -e "${GREEN}CLI command testing completed${NC}"
echo -e "Check the output above for any failed commands"
