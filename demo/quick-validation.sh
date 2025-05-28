#!/bin/bash

# Quick validation of demo setup
echo "🔍 Quick Demo Validation"
echo "======================="

# Check if files exist
echo "Checking demo files..."
if [ -f "complete-convergence-demo.sh" ]; then
    echo "✅ Demo script found"
else
    echo "❌ Demo script missing"
    exit 1
fi

if [ -f "test-scenarios.json" ]; then
    echo "✅ Test scenarios found"
else
    echo "❌ Test scenarios missing"
    exit 1
fi

if [ -f "../scripts/verify-acceptance-criteria.js" ]; then
    echo "✅ Validation script found"
else
    echo "❌ Validation script missing"
    exit 1
fi

# Check JSON syntax
echo "Validating JSON syntax..."
if jq empty test-scenarios.json 2>/dev/null; then
    echo "✅ test-scenarios.json syntax valid"
else
    echo "❌ test-scenarios.json syntax invalid"
    exit 1
fi

# Check script permissions
echo "Checking permissions..."
if [ -x "complete-convergence-demo.sh" ]; then
    echo "✅ Demo script executable"
else
    echo "❌ Demo script not executable"
    exit 1
fi

if [ -x "../scripts/verify-acceptance-criteria.js" ]; then
    echo "✅ Validation script executable"
else
    echo "❌ Validation script not executable"
    exit 1
fi

echo ""
echo "🎉 All demo files validated successfully!"
echo "Ready to run: ./complete-convergence-demo.sh"
