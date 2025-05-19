# Testnet Test Utilities

This directory contains utilities for testing with testnet environments and cleaning up test data.

## Cleanup Utility

The `cleanup.ts` file provides utilities for cleaning up test data after test runs.

### Features

1. **Local File Cleanup**
   - Removes temporary test files
   - Cleans up mock data files
   - Deletes test images
   - Removes test logs and cache files

2. **Todo Storage Cleanup**
   - Filters out test todos from local storage
   - Identifies test todos by ID patterns
   - Preserves real user data

3. **Network Data Cleanup**
   - Cleans up test blobs from Walrus storage
   - Removes test NFTs from Sui blockchain
   - Handles testnet-specific cleanup

### Usage

The cleanup utility can be used in several ways:

#### 1. Command Line

```bash
# Preview what would be cleaned (dry run)
npm run test:cleanup:dry

# Clean up local test files only
npm run test:cleanup

# Clean up both local and network test data
npm run test:cleanup:network
```

#### 2. In Test Files

```typescript
import { cleanupTestFiles } from './tests/testnet/cleanup';

// In afterAll hook
afterAll(async () => {
  await cleanupTestFiles({
    cleanNetwork: true
  });
});
```

#### 3. Automated Post-Test

The cleanup runs automatically after tests in dry-run mode:

```json
{
  "scripts": {
    "posttest": "ts-node tests/testnet/cleanup.ts --dry-run"
  }
}
```

### Configuration

The cleanup utility can be configured with:

```typescript
interface CleanupConfig {
  paths: string[];       // File paths/patterns to clean
  patterns: string[];    // ID patterns for test data
  dryRun?: boolean;      // Preview mode without deletion
  cleanNetwork?: boolean; // Clean network data
}
```

### Default Patterns

The utility cleans up files matching these patterns by default:

- `temp-test-*`
- `test-temp-*`
- `*.tmp`
- `test-*.json`
- `mock-*.json`
- `test-*.png/jpg/jpeg`
- `test-todos*.db`
- `test-storage*`
- `.test-cache*`
- `test-*.log`

### Best Practices

1. **Use Consistent Naming**: Always prefix test data with `test-` or `mock-`
2. **Dry Run First**: Test cleanup in dry-run mode before actual deletion
3. **Network Cleanup**: Only clean network data when necessary (costs gas)
4. **Test Isolation**: Each test should clean up its own data
5. **Global Cleanup**: Use the utility for periodic full cleanup

### Examples

#### Basic Cleanup

```typescript
// Clean local test files
await cleanupTestFiles({
  dryRun: false
});
```

#### Network Cleanup

```typescript
// Clean local and network data
await cleanupTestFiles({
  cleanNetwork: true,
  dryRun: false
});
```

#### Custom Patterns

```typescript
// Clean specific patterns
await cleanupTestFiles({
  paths: ['custom-test-*.json'],
  patterns: ['custom-pattern-*'],
  dryRun: false
});
```

### Safety Features

1. **Dry Run Mode**: Preview deletions without actual removal
2. **Pattern Matching**: Only removes files matching test patterns
3. **Error Handling**: Continues cleanup even if some files fail
4. **Logging**: Detailed logs of all cleanup operations

### Environment Variables

- `CLEANUP_NETWORK`: Set to `true` to enable network cleanup in automated scripts
- `NODE_ENV`: Used to determine test environment

### Extending the Utility

To add new cleanup patterns:

1. Edit `DEFAULT_CONFIG` in `cleanup.ts`
2. Add new patterns to `paths` or `patterns` arrays
3. Test with dry run mode first
4. Document new patterns in this README

### Troubleshooting

1. **Permission Errors**: Ensure write permissions for test directories
2. **Network Errors**: Check network connectivity for blockchain cleanup
3. **Pattern Mismatches**: Verify patterns match actual test file names
4. **Missing Files**: Normal - utility handles non-existent files gracefully