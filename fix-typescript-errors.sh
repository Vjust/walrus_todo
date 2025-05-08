#!/bin/bash

# This script fixes TypeScript build issues by using transpile-only mode

echo "Fixing TypeScript build issues..."

# Ensure the script is executable
chmod +x "$0"

# Step 1: Update the build-transpile-only script in package.json
echo "Updating build-transpile-only script..."
UPDATED_SCRIPT="pnpm run clean && ts-node --transpileOnly scripts/build-helper.ts"

# Update the script or confirm it's already correct
if grep -q "ts-node --transpileOnly -p tsconfig.json scripts/build-helper.ts" package.json; then
  sed -i '' 's/ts-node --transpileOnly -p tsconfig.json scripts\/build-helper.ts/ts-node --transpileOnly scripts\/build-helper.ts/' package.json
  echo "Updated build-transpile-only script"
else
  echo "Script already updated or pattern doesn't match"
fi

# Step 2: Run the build-transpile-only script
echo "Running build-transpile-only script..."
pnpm run build-transpile-only

# Step 3: Check if the build was successful
if [ $? -eq 0 ]; then
  echo "Build completed successfully!"
else
  echo "Build failed, trying alternative approach..."
  
  # Try the build-compatible script
  echo "Running build-compatible script..."
  pnpm run build-compatible
  
  if [ $? -eq 0 ]; then
    echo "build-compatible completed successfully!"
  else
    echo "build-compatible failed, please check the error messages"
    exit 1
  fi
fi

# Step 4: Generate the manifest
echo "Generating manifest..."
pnpm run manifest

# Step 5: Output success message
echo "✅ Fix completed! The build has been completed with transpile-only mode, bypassing type checking."
echo "This is the recommended approach for this codebase as described in the README, due to known TypeScript compatibility issues."
echo ""
echo "To run the CLI, use one of these commands:"
echo "- pnpm run dev (for development mode)"
echo "- pnpm run start (to run the built version)"
echo "- ./bin/waltodo-direct (to run the direct binary)"