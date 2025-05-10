#!/bin/bash

# install-global.sh: Install the CLI tool globally
# This is a replacement for the missing script referenced in package.json

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error handling
set -e

echo -e "${BLUE}Installing waltodo CLI globally...${NC}"

# Check if we have permission to write to global bin directory
if [ "$(npm config get prefix)" = "/usr/local" ] && [ ! -w "/usr/local/bin" ]; then
  echo -e "${YELLOW}Warning: You don't have write permission to /usr/local/bin${NC}"
  echo -e "${YELLOW}Using sudo to install globally...${NC}"
  sudo npm link
else
  npm link
fi

# Verify the installation
if command -v waltodo &> /dev/null; then
  echo -e "${GREEN}Successfully installed waltodo CLI globally!${NC}"
  echo -e "${GREEN}You can now use 'waltodo' from any directory.${NC}"
  
  # Show version
  echo -e "${BLUE}Installed version:${NC}"
  waltodo --version
else
  echo -e "${RED}Installation may have failed. 'waltodo' command not found.${NC}"
  echo -e "${YELLOW}Try running with sudo: sudo ./install-global.sh${NC}"
  exit 1
fi