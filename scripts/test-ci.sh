#!/usr/bin/env bash
# test-ci.sh - Build TypeScript and run tests with coverage
#
# This script ensures that TypeScript is built before running tests and
# generates coverage artifacts for CI. It handles errors properly and
# enforces the build-then-test workflow for consistent CI runs.
#
# Usage:
#   ./scripts/test-ci.sh [options] [test-pattern]
#
# Options:
#   --skip-typecheck        Skip TypeScript type checking
#   --no-clean              Skip cleaning previous build artifacts
#
# Example:
#   ./scripts/test-ci.sh               # Run all tests
#   ./scripts/test-ci.sh commands      # Run only command tests
#   ./scripts/test-ci.sh --skip-typecheck  # Skip TypeScript checking

set -eo pipefail  # Exit immediately if a command exits with non-zero status and propagate pipe failures

# Display script banner
echo "=========================================================="
echo "  WalTodo CI Test Runner"
echo "  Ensures build-then-test workflow for consistent testing"
echo "=========================================================="

# Parse arguments
SKIP_TYPECHECK=false
NO_CLEAN=false
TEST_PATTERN=""

for arg in "$@"; do
  case $arg in
    --skip-typecheck)
      SKIP_TYPECHECK=true
      shift
      ;;
    --no-clean)
      NO_CLEAN=true
      shift
      ;;
    *)
      TEST_PATTERN="$arg"
      ;;
  esac
done

# Step 1: Clean previous builds if needed
if [ "$NO_CLEAN" = "false" ]; then
  echo "Step 1: Cleaning previous build artifacts..."
  pnpm run clean
  if [ $? -ne 0 ]; then
    echo "Error: Failed to clean previous build artifacts"
    exit 1
  fi
else
  echo "Step 1: Skipping clean (--no-clean flag provided)"
fi

# Step 2: Build TypeScript
echo "Step 2: Building TypeScript..."
if [ "$SKIP_TYPECHECK" = "true" ]; then
  echo "Using fast build with TypeScript type checking disabled"
  # Instead of using build:dev which still has errors, skip building for testing
  echo "Skipping build step for --skip-typecheck mode"
else
  echo "Using full build with TypeScript type checking"
  pnpm run build
  if [ $? -ne 0 ]; then
    echo "Error: TypeScript build failed"
    exit 1
  fi
fi

# Step 3: Run tests with coverage
echo "Step 3: Running tests with coverage..."

# We can't rely on the npm pretest:coverage script when skipping type checking
# since it always runs the full build, so we'll run tests directly
if [ "$SKIP_TYPECHECK" = "true" ]; then
  # Run a dev build first
  echo "Running dev build before tests..."
  pnpm run build:dev
  
  # Then run tests with --no-typecheck
  echo "Running tests with --no-typecheck flag..."
  if [ -z "$TEST_PATTERN" ]; then
    # Run all tests if no pattern specified
    npx jest --coverage --no-typecheck
  else
    # Run tests matching the specified pattern
    npx jest --coverage --no-typecheck -t "$TEST_PATTERN"
  fi
else
  # Run normal coverage with type checking
  if [ -z "$TEST_PATTERN" ]; then
    # Run all tests if no pattern specified
    pnpm run test:coverage
  else
    # Run tests matching the specified pattern
    pnpm run test:coverage -- -t "$TEST_PATTERN"
  fi
fi

# Check if tests passed
TEST_RESULT=$?
if [ $TEST_RESULT -ne 0 ]; then
  echo "Error: Tests failed with exit code $TEST_RESULT"
  exit $TEST_RESULT
fi

# Step 4: Report success
echo "=========================================================="
echo "  CI Tests Completed Successfully"
echo "  Coverage reports are available in the ./coverage directory"
echo "=========================================================="

exit 0