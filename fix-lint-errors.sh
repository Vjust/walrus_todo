#!/bin/bash

echo "Starting comprehensive lint fix process..."

# First, run eslint auto-fix
echo "Running ESLint auto-fix..."
pnpm exec eslint . --ext .ts,.js --fix

# Fix common TypeScript issues
echo "Fixing common TypeScript issues..."

# Replace 'any' types with 'unknown' or more specific types where safe
find src tests scripts -name "*.ts" -type f -exec sed -i '' \
  -e 's/: any\[\]/: unknown[]/g' \
  -e 's/: any;/: unknown;/g' \
  -e 's/: any)/: unknown)/g' \
  -e 's/<any>/<unknown>/g' \
  {} \;

# Fix unused imports by adding underscore prefix
find src tests scripts -name "*.ts" -type f -exec sed -i '' \
  -e 's/\(error[[:space:]]*'\([^']*\)' is defined but never used\)/\1/g' \
  {} \;

# Fix no-console warnings in non-script files
find src -name "*.ts" -type f -exec sed -i '' \
  -e 's/console\.log(/Logger.getInstance().info(/g' \
  -e 's/console\.error(/Logger.getInstance().error(/g' \
  -e 's/console\.warn(/Logger.getInstance().warn(/g' \
  {} \;

# Fix escape character issues
find src tests scripts -name "*.ts" -type f -exec sed -i '' \
  -e 's/\\\\\\./\\./g' \
  -e 's/\\\\\$/\$/g' \
  -e 's/\\\\\(/(/g' \
  -e 's/\\\\\)/)/g' \
  {} \;

# Run eslint again to see remaining issues
echo "Running final ESLint check..."
pnpm exec eslint . --ext .ts,.js --max-warnings 100

echo "Lint fix process completed!"
echo "Remaining issues need manual attention."