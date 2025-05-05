#!/bin/bash

# This script installs the CLI globally

echo "Installing WalTodo CLI globally..."

# Ensure bin files have correct permissions
echo "Setting correct permissions on bin files..."
chmod +x ./bin/run ./bin/run.js ./bin/waltodo

# Clean and rebuild
echo "Cleaning and rebuilding..."
npm run clean
npm run build

# Generate manifest
echo "Generating manifest..."
npm run manifest

# Install globally
echo "Installing globally..."
npm link

# Verify installation
echo "Verifying installation..."
WALTODO_PATH=$(which waltodo)
if [ -z "$WALTODO_PATH" ]; then
  echo "Warning: waltodo command not found in PATH."
  echo "You may need to restart your terminal or run 'hash -r' to refresh your shell's command cache."
else
  echo "waltodo command found at: $WALTODO_PATH"
fi

echo "Done! You can now use the 'waltodo' command globally."
echo "Try running 'waltodo --help' to verify it works."
