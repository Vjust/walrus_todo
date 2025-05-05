#!/bin/bash

# This script updates the CLI after changes are made

echo "Updating WalTodo CLI..."

# Ensure bin files have correct permissions
echo "Setting correct permissions on bin files..."
chmod +x ./bin/run ./bin/run.js ./bin/waltodo ./bin/waltodo-standalone

# Clean and rebuild
echo "Cleaning and rebuilding..."
npm run clean
npm run build

# Skip manifest generation to avoid errors
echo "Skipping manifest generation..."
touch oclif.manifest.json

# Update the local installation
echo "Updating local installation..."
mkdir -p ~/.local/bin
cp ./bin/waltodo-standalone ~/.local/bin/waltodo
chmod +x ~/.local/bin/waltodo

# Add to PATH if not already there
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
  export PATH="$HOME/.local/bin:$PATH"
fi

echo "Done! You can now use the updated 'waltodo' command."
echo "Try running 'waltodo --help' to verify it works."
