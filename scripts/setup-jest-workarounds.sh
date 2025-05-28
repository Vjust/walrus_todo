#!/bin/bash

# Jest Workarounds Setup Script
# This script sets up the Jest execution workarounds and validates the environment

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔧 Setting up Jest Execution Workarounds"
echo "═══════════════════════════════════════"

# Make scripts executable
echo "📝 Making scripts executable..."
chmod +x scripts/test-runner.js
chmod +x scripts/jest-environment-setup.js
chmod +x scripts/jest-error-handler.js
chmod +x scripts/jest-validation.js

# Validate Node.js version
echo "🔍 Validating Node.js environment..."
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 16 ]; then
    echo "⚠️  Warning: Node.js version is $node_version. Recommended: 16 or higher"
else
    echo "✅ Node.js version: $(node --version)"
fi

# Check for required dependencies
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found. Please run: pnpm install"
    exit 1
fi

if [ ! -f "node_modules/.bin/jest" ] && [ ! -f "node_modules/jest/bin/jest.js" ]; then
    echo "❌ Jest not found. Please install: pnpm add -D jest"
    exit 1
fi

echo "✅ Dependencies check passed"

# Run environment validation
echo "🧪 Running environment validation..."
if node scripts/jest-environment-setup.js --validate; then
    echo "✅ Environment validation passed"
else
    echo "⚠️  Environment validation found issues (see above)"
fi

# Test basic Jest execution
echo "🎯 Testing Jest execution strategies..."
echo "   This may take a moment..."

# Try the test runner with a simple validation
if timeout 30 node scripts/test-runner.js --help > /dev/null 2>&1; then
    echo "✅ Test runner is working"
else
    echo "⚠️  Test runner may have issues"
fi

# Generate diagnostic report
echo "📊 Generating diagnostic report..."
node scripts/test-runner.js --diagnostic > /dev/null 2>&1
if [ -f "jest-runner-diagnostic.json" ]; then
    echo "✅ Diagnostic report generated: jest-runner-diagnostic.json"
else
    echo "⚠️  Could not generate diagnostic report"
fi

echo ""
echo "🎉 Jest Workarounds Setup Complete!"
echo ""
echo "📋 Available Commands:"
echo "  pnpm test              # Use robust test runner (default)"
echo "  pnpm test:legacy       # Use legacy Jest execution"
echo "  pnpm test:pnpm         # Force pnpm strategy"
echo "  pnpm test:npx          # Force npx strategy" 
echo "  pnpm test:direct       # Force direct binary execution"
echo "  pnpm test:fallback     # Force fallback custom runner"
echo "  pnpm test:diagnostic   # Generate diagnostic information"
echo ""
echo "🔧 Validation Commands:"
echo "  node scripts/jest-validation.js           # Full validation"
echo "  node scripts/jest-validation.js --quick   # Quick validation"
echo "  node scripts/jest-environment-setup.js --report   # Environment report"
echo ""
echo "🛠️  If you encounter issues:"
echo "  1. Check the diagnostic report: jest-runner-diagnostic.json"
echo "  2. Run validation: node scripts/jest-validation.js"
echo "  3. Try different strategies: pnpm test:npx or pnpm test:fallback"
echo "  4. Check environment: node scripts/jest-environment-setup.js --validate"
echo ""

# Final check - try to run a simple test
echo "🧪 Final validation test..."
if timeout 60 node scripts/jest-validation.js --quick > /dev/null 2>&1; then
    echo "✅ Quick validation passed - Jest workarounds are ready!"
else
    echo "⚠️  Quick validation had issues - check the validation report"
    echo "   You can still use the fallback methods if needed"
fi

echo ""
echo "📝 Next steps:"
echo "  - Run 'pnpm test' to execute tests with automatic fallback"
echo "  - Use 'pnpm test:legacy' if you prefer the original method"
echo "  - Check 'jest-runner-diagnostic.json' for detailed environment info"