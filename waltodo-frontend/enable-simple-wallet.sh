#!/bin/bash

# Script to enable simplified wallet context for development

echo "🔄 Switching to simplified wallet implementation..."

# Make sure we have the file
if [ ! -f src/contexts/SimpleWalletContext.tsx ]; then
  echo "❌ SimpleWalletContext.tsx not found. Aborting."
  exit 1
fi

# Add import statement to layout.tsx
echo "🔧 Updating app layout..."
sed -i '' 's/import { AppWalletProvider } from ".*"/import { SimpleWalletProvider } from "@\/contexts\/SimpleWalletContext"/' src/app/layout.tsx
sed -i '' 's/<AppWalletProvider>/<SimpleWalletProvider>/' src/app/layout.tsx
sed -i '' 's/<\/AppWalletProvider>/<\/SimpleWalletProvider>/' src/app/layout.tsx

# Update import in WalletConnectButton
echo "🔧 Updating WalletConnectButton..."
sed -i '' 's/import { useWalletContext } from ".*"/import { useWalletContext } from "@\/contexts\/SimpleWalletContext"/' src/components/WalletConnectButton.tsx

echo "✅ Switched to simplified wallet implementation."
echo "🔄 Please restart your development server now with:"
echo "   npm run dev:clean"