#!/bin/bash

# fix-cli.sh: Fix common issues with the CLI installation
# This script fixes permissions and link issues

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error handling
set -e

echo -e "${BLUE}Fixing waltodo CLI installation...${NC}"

# Fix bin file permissions
echo -e "${BLUE}Fixing bin file permissions...${NC}"
chmod +x ./bin/run.js ./bin/waltodo ./bin/waltodo-direct

# Make all bin files executable
find ./bin -type f -exec chmod +x {} \;

echo -e "${GREEN}Successfully fixed bin file permissions.${NC}"

# Rebuild with transpile-only mode (safer)
echo -e "${BLUE}Rebuilding with transpile-only mode...${NC}"
pnpm run build-compatible

# Re-create the manifest
echo -e "${BLUE}Recreating OCLIF manifest...${NC}"
pnpm run manifest

# Refresh global link
echo -e "${BLUE}Refreshing global link...${NC}"
npm link

echo -e "${GREEN}CLI fixes completed.${NC}"
echo -e "${GREEN}You can now use 'waltodo' from any directory.${NC}"