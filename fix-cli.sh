#!/bin/bash

# This script fixes CLI command issues and reinstalls the CLI

echo "Fixing CLI command issues..."

# Ensure bin files have correct permissions
echo "Setting correct permissions on bin files..."
chmod +x ./bin/run ./bin/run.js ./bin/waltodo ./bin/waltodo-direct ./bin/waltodo-bash

# Clean and rebuild
echo "Cleaning and rebuilding..."
npm run clean
npm run build

# Generate manifest
echo "Generating manifest..."
node generate-manifest.js

# Create a local installation
echo "Creating a local installation..."
mkdir -p ~/.local/bin

# Copy the bash script to the local bin directory
echo "Installing bash CLI command..."
cp ./bin/waltodo-bash ~/.local/bin/waltodo
chmod +x ~/.local/bin/waltodo

echo "Installation complete. You can now use 'waltodo' from anywhere."
echo "Example usage:"
echo "  waltodo add \"My todo title\" -p high"
echo "  waltodo list"
echo "  waltodo complete 123"

# Verify installation
WALTODO_PATH=$(which waltodo 2>/dev/null)
if [ -z "$WALTODO_PATH" ]; then
  echo "Warning: waltodo is not in your PATH. You may need to add ~/.local/bin to your PATH."
  echo "Add this to your ~/.bashrc or ~/.zshrc file:"
  echo "  export PATH=\$PATH:~/.local/bin"
  echo "Note: waltodo command is installed in ~/.local/bin"
  echo "You can run it directly using ~/.local/bin/waltodo"
else
  echo "waltodo is installed at: $WALTODO_PATH"
fi

echo "Done! You can now use the 'waltodo' command."
echo "Try running 'waltodo --help' to verify it works."
echo "If the command is not found, you can run it directly using:"
echo "~/.local/bin/waltodo"
