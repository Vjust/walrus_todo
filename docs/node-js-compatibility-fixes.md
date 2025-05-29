# Node.js Compatibility Fixes

This document outlines the Node.js compatibility improvements made to ensure the WalTodo CLI works reliably across different Node.js versions, particularly addressing issues like "replaceAll is not a function" in CI environments.

## Problem Statement

The CLI was experiencing compatibility issues with older Node.js versions, particularly in CI environments using Node.js 18-20. The main issue was missing modern JavaScript features like `String.prototype.replaceAll` that were introduced in later Node.js versions.

## Solutions Implemented

### 1. Comprehensive Polyfills System

Created a robust polyfill system in `apps/cli/src/utils/polyfills/` that provides compatibility for:

#### String Methods
- `String.prototype.replaceAll` (Node.js 15.0.0+)
- `String.prototype.at` (Node.js 16.6.0+)
- `String.prototype.trimStart`/`trimEnd` aliases

#### Array Methods
- `Array.prototype.at` (Node.js 16.6.0+)
- `Array.prototype.findLast` (Node.js 18.0.0+)
- `Array.prototype.findLastIndex` (Node.js 18.0.0+)
- `Array.prototype.toReversed` (Node.js 20.0.0+)
- `Array.prototype.toSorted` (Node.js 20.0.0+)
- `Array.prototype.with` (Node.js 20.0.0+)

#### Global Methods
- `Object.hasOwn` (Node.js 16.9.0+)
- `structuredClone` (Node.js 17.0.0+)
- `AbortSignal.timeout` (Node.js 16.14.0+)
- `AbortSignal.abort` (Node.js 15.12.0+)

#### Error Types
- `AggregateError` (Node.js 15.0.0+)

### 2. Early Loading Strategy

Polyfills are loaded at the very beginning of the application lifecycle:

```typescript
// apps/cli/src/index.ts
// Import polyfills first - ensures compatibility with older Node.js versions
import './utils/polyfills';
```

This ensures all polyfills are available before any other code executes.

### 3. Node.js Version Checking

Added runtime version validation with helpful error messages:

```typescript
// apps/cli/src/utils/node-version-check.ts
export function checkNodeVersion(): void {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  const minVersion = 18;

  if (majorVersion < minVersion) {
    console.error(`❌ Node.js version ${nodeVersion} is not supported.`);
    // ... helpful upgrade instructions
    process.exit(1);
  }
}
```

### 4. CI Integration

Updated GitHub Actions workflow to test Node.js compatibility:

```yaml
- name: Test Node.js compatibility
  run: ./scripts/test-node-compatibility.sh
```

### 5. Comprehensive Testing

Created test scripts to verify polyfill functionality:

- `test-node-compatibility.js` - Basic compatibility tests
- `scripts/test-node-compatibility.sh` - Full CI-ready test suite

## File Structure

```
apps/cli/src/utils/polyfills/
├── index.ts                 # Central polyfill loader
├── aggregate-error.ts       # AggregateError polyfill
├── string-methods.ts        # String method polyfills
├── array-methods.ts         # Array method polyfills
└── global-methods.ts        # Global method polyfills
```

## Testing

Run the compatibility test suite:

```bash
# Test basic compatibility
node test-node-compatibility.js

# Full CI-style testing
./scripts/test-node-compatibility.sh

# Build and test CLI
pnpm build:dev && ./bin/waltodo --version
```

## Benefits

1. **Backward Compatibility**: CLI now works with Node.js 18+ instead of requiring latest features
2. **CI Reliability**: Eliminates "replaceAll is not a function" and similar errors
3. **Future Proofing**: Polyfill system can easily be extended for new compatibility issues
4. **Clear Error Messages**: Users get helpful feedback if their Node.js version is too old
5. **Zero Runtime Impact**: Polyfills only add methods that don't exist natively

## Package.json Configuration

The `engines` field specifies minimum requirements:

```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

## CI Environment

GitHub Actions uses Node.js 20 which has native support for most features, but the polyfills ensure compatibility with older CI environments or local development setups.

## Monitoring

The CLI includes optional debug logging to show which features are native vs polyfilled:

```bash
DEBUG=* waltodo --version
# Shows: "Running on Node.js v20.x.x"
# Shows: "Features: String.replaceAll (native), Array.at (native), ..."
```

## Future Maintenance

When adding new JavaScript features:

1. Check Node.js compatibility matrix
2. Add polyfill if needed for Node.js 18 compatibility
3. Update test scripts
4. Test across different Node.js versions

This ensures the CLI remains compatible with the specified Node.js version range while taking advantage of modern JavaScript features where available.