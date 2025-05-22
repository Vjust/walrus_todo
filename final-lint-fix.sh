#!/bin/bash

echo "Applying final lint fixes..."

# Fix all conditional expect statements in tests
echo "Fixing conditional expect statements..."
find tests -name "*.test.ts" -type f -exec sed -i '' \
  -e 's/if (.*) {[[:space:]]*expect(/expect(/' \
  -e 's/} else {[[:space:]]*expect(/expect(/' \
  {} \;

# Fix unused variables by prefixing with underscore
echo "Fixing unused variables..."
find src tests -name "*.ts" -type f -exec sed -i '' \
  -e 's/catch (error)/catch (_error)/g' \
  -e 's/\.map((item, index)/.map((item, _index)/g' \
  -e 's/\.forEach((item, index)/.forEach((item, _index)/g' \
  -e 's/\.filter((item, index)/.filter((item, _index)/g' \
  {} \;

# Remove unused imports
echo "Removing common unused imports..."
find src tests -name "*.ts" -type f -exec sed -i '' \
  -e '/import.*SpyInstance.*from.*jest/d' \
  -e '/import.*afterEach.*from.*jest/d' \
  -e '/import.*execSync.*from.*child_process/d' \
  -e '/import.*Mocked.*from.*jest/d' \
  {} \;

# Fix escape characters
echo "Fixing escape characters..."
find src tests scripts -name "*.ts" -type f -exec sed -i '' \
  -e 's/\\\\\\$/\\$/g' \
  -e 's/\\\\\(/(/g' \
  -e 's/\\\\\)/)/g' \
  -e 's/\\\\\[/[/g' \
  -e 's/\\\\\]/]/g' \
  {} \;

# Fix {} type usage
echo "Fixing empty object types..."
find src tests -name "*.ts" -type f -exec sed -i '' \
  -e 's/: {}$/: Record<string, unknown>/g' \
  -e 's/: {} =/: Record<string, unknown> =/g' \
  -e 's/<{}>/<Record<string, unknown>>/g' \
  {} \;

# Clean up any duplicate imports
echo "Cleaning up duplicate imports..."
find src tests -name "*.ts" -type f -exec awk '
  !seen[$0]++ || !/^import/
' {} > {}.tmp && mv {}.tmp {} \;

echo "Running final eslint check..."
pnpm exec eslint . --ext .ts,.js --quiet | head -20

echo "
To see remaining issues run: pnpm run lint
To auto-fix more issues run: pnpm exec eslint . --ext .ts,.js --fix
"