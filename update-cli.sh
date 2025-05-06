#!/bin/bash

# This script updates the CLI to use the lowercase "todos" directory

echo "Updating CLI to use lowercase 'todos' directory..."

# Create the todos directory if it doesn't exist
mkdir -p todos

# Copy any existing todos from the Todos directory to the new todos directory
if [ -d "Todos" ]; then
  echo "Copying existing todos from Todos to todos directory..."
  cp -n Todos/*.json todos/ 2>/dev/null || true
fi

# Update the constants.ts file
echo "Updating constants.ts file..."
sed -i '' 's/TODOS_DIR: '\''Todos'\''/TODOS_DIR: '\''todos'\''/' src/constants.ts

# Ensure bin files have correct permissions
echo "Setting correct permissions on bin files..."
chmod +x ./bin/run ./bin/run.js ./bin/waltodo ./bin/waltodo-bash

# Update the local installation
echo "Updating local installation..."
mkdir -p ~/.local/bin
cp ./bin/waltodo-bash ~/.local/bin/waltodo
chmod +x ~/.local/bin/waltodo

# Add to PATH if not already there
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
  export PATH="$HOME/.local/bin:$PATH"
fi

# Update the global installation
echo "Updating global installation..."
echo "Note: You may need to run the following commands manually with sudo:"
echo "sudo cp bin/waltodo-bash /usr/local/bin/waltodo"
echo "sudo chmod +x /usr/local/bin/waltodo"

echo "CLI updated successfully!"
echo "The CLI now uses the lowercase 'todos' directory."
echo "Any existing todos have been copied from 'Todos' to 'todos'."
echo "Try running 'waltodo --help' to verify it works."
