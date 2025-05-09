#!/bin/bash

# This script installs the CLI globally

echo "Installing WalTodo CLI globally..."

# Get the absolute path to the current directory (project root)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
echo "Project root: $PROJECT_ROOT"

# Ensure bin files have correct permissions
echo "Setting correct permissions on bin files..."
chmod +x "$PROJECT_ROOT/bin/waltodo"

# Update the project root path in the waltodo script
echo "Updating project path in waltodo script..."
sed -i.bak "s|# The project root is the parent directory of the bin directory|# Set the project root to the correct path|g" "$PROJECT_ROOT/bin/waltodo"
sed -i.bak "s|PROJECT_ROOT=\"\$( cd \"\$SCRIPT_DIR/..\" \&> /dev/null \&\& pwd )\"|PROJECT_ROOT=\"$PROJECT_ROOT\"|g" "$PROJECT_ROOT/bin/waltodo"
rm -f "$PROJECT_ROOT/bin/waltodo.bak"

# Update command paths in the waltodo script to use dist/src/commands directly
echo "Updating command paths in waltodo script..."
sed -i.bak "s|node bin/run.js|node \"$PROJECT_ROOT/dist/src/commands/\"|g" "$PROJECT_ROOT/bin/waltodo"
rm -f "$PROJECT_ROOT/bin/waltodo.bak"

# Build the project with the compatible version to avoid TypeScript errors
echo "Building with compatible mode..."
pnpm run clean
pnpm run build-compatible

# Generate the manifest
pnpm run manifest

# Create the ~/.local/bin directory if it doesn't exist
mkdir -p ~/.local/bin

# Copy the waltodo script to ~/.local/bin
echo "Installing to ~/.local/bin..."
cp "$PROJECT_ROOT/bin/waltodo" ~/.local/bin/
chmod +x ~/.local/bin/waltodo

# Add ~/.local/bin to PATH if it's not already there
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  echo "Adding ~/.local/bin to PATH..."
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
  export PATH="$HOME/.local/bin:$PATH"
fi

# Verify installation
echo "Verifying installation..."
WALTODO_PATH=$(which waltodo 2>/dev/null || echo "")

if [ -z "$WALTODO_PATH" ]; then
  echo "Error: waltodo command not found. Installation failed."
  exit 1
else
  echo "waltodo command found at: $WALTODO_PATH"
  echo "Done! You can now use the 'waltodo' command globally."
  echo "Try running 'waltodo --help' to verify it works."
fi
