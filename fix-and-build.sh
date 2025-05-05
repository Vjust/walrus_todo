#!/bin/bash

# This script fixes permission issues and builds the project

# Remove the dist directory if it exists
echo "Removing dist directory..."
sudo rm -rf dist

# Create a new dist directory with the correct permissions
echo "Creating new dist directory with correct permissions..."
mkdir -p dist
sudo chown -R $(whoami) dist
sudo chmod -R 755 dist

# Build the project
echo "Building the project..."
npm run build

# Generate the manifest
echo "Generating the manifest..."
npx oclif manifest

# Install the CLI globally
echo "Installing the CLI globally..."
sudo npm link

echo "Done! You can now use the 'waltodo' command."
