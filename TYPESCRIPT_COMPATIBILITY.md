# TypeScript Compatibility Guide

This document provides a comprehensive guide for resolving TypeScript compatibility issues in the Walrus Todo project.

## Background

The project uses TypeScript 5.0.4 and integrates with several external libraries including:
- `@mysten/sui` (v1.29.1)
- `@mysten/sui.js` (v0.54.1)
- `@mysten/walrus` (v0.0.21)
- Jest for testing

Different library versions and TypeScript's strict type checking can create compatibility challenges. This guide outlines strategies for addressing common TypeScript errors encountered in this codebase.

## Build Process

For normal development, use:
```bash
pnpm build
```

For bypassing type checking (useful when you need to see the JavaScript output despite errors):
```bash
npx ts-node --transpileOnly ./build-helper.ts
```

## Common Error Patterns

### 1. BigInt to String Conversions

**Problem**: Many APIs expect string representations of numbers, but code uses BigInt values.

**Solution**: Convert BigInt values to strings using `.toString()` or `String()`.

```typescript
// Error
totalBalance: BigInt(1000),

// Fix
totalBalance: BigInt(1000).toString(),
```

### 2. Interface Compatibility Issues

**Problem**: Objects passed to functions don't match the expected interface structure.

**Solution**: Use adapter patterns or update the object to match the required interface.

```typescript
// Error
mockSuiClient.getOwnedObjects.mockResolvedValue({
  hasNextPage: false,
  data: [],
  nextCursor: null,
  pageNumber: 1  // This property doesn't exist in PaginatedObjectsResponse
});

// Fix
mockSuiClient.getOwnedObjects.mockResolvedValue({
  hasNextPage: false,
  data: [],
  nextCursor: null
  // Remove extra properties
});
```

### 3. Jest Mock Type Arguments

**Problem**: Jest's `fn()` function has specific type parameter requirements that have changed across versions.

**Solution**: Either use no type parameters or use the correct format with function signature and parameters array.

```typescript
// Error
const operation = jest.fn<Promise<string>, []>()

// Fix
const operation = jest.fn() // Let TypeScript infer types
// OR
const operation = jest.fn<() => Promise<string>, []>() // Explicit function type
```

### 4. ESModule Interop Issues

**Problem**: Direct imports from CommonJS modules when `esModuleInterop` is enabled.

**Solution**: Use namespace imports with default fallback or enable `allowSyntheticDefaultImports`.

```typescript
// Error
import chalk from 'chalk';

// Fix
import * as chalkModule from 'chalk';
const chalk = chalkModule.default || chalkModule;
```

### 5. Missing Methods on Interface Extensions

**Problem**: Using methods that don't exist on base interface types.

**Solution**: Update interface definitions to include all required methods, or use property existence checks.

```typescript
// Error
this.walrusClient.getBlobInfo(blobId); // getBlobInfo doesn't exist on WalrusClient

// Fix - Add to interface
export interface WalrusClient {
  getBlobInfo(blobId: string): Promise<any>;
  // Other methods...
}

// OR use property existence check
if ('getBlobInfo' in this.walrusClient && typeof this.walrusClient.getBlobInfo === 'function') {
  return await this.walrusClient.getBlobInfo(blobId);
}
```

### 6. Incompatible Mock Implementations

**Problem**: Mock implementations missing required properties or methods.

**Solution**: Ensure mocks implement all required properties and methods of the original interface.

```typescript
// Error - Missing keypair, keyScheme, suiClient properties
mockKeystoreSigner.mockImplementation(() => ({
  getAddress: jest.fn().mockResolvedValue('0xtest-address'),
  // Missing properties...
}));

// Fix - Add all required properties
mockKeystoreSigner.mockImplementation(() => ({
  getAddress: jest.fn().mockResolvedValue('0xtest-address'),
  keypair: {} as any, // Add with type assertion
  keyScheme: 'ED25519',
  suiClient: mockSuiClient as unknown as SuiClient
  // Other properties...
}));
```

### 7. Type Assertion for Complex Objects

**Problem**: Complex objects need to conform to specific interfaces but have slightly different structures.

**Solution**: Use type assertions with `as` and `unknown` to bridge the interface gap.

```typescript
// Error
return mockWalrusClient as WalrusClient; // Incompatible properties

// Fix
return mockWalrusClient as unknown as WalrusClient;
```

### 8. Private Identifiers in Library Definitions

**Problem**: Some libraries use private class fields (#private) which require ES2015+ target.

**Solution**: Use the `--skipLibCheck` flag to bypass checking library definition files.

```bash
npx tsc --skipLibCheck
```

### 9. Array vs Object Literal Errors

**Problem**: Type mismatches between array and object literal notations.

**Solution**: Ensure consistent type usage and avoid mixing array literals and object literals.

```typescript
// Error
const data = { 0: 'value1', 1: 'value2' }; // Object literal
someFunction(data); // Function expects string[]

// Fix
const data = ['value1', 'value2']; // Array literal
someFunction(data);
```

### 10. Missing or Incompatible Properties

**Problem**: Objects missing required properties or having incompatible property types.

**Solution**: Add missing properties or convert property types to match the expected interface.

```typescript
// Error - Missing packageConfig property
const config = {
  network: 'testnet',
  fullnode: 'https://fullnode.testnet.sui.io:443'
};

// Fix - Add required property
const config = {
  network: 'testnet',
  fullnode: 'https://fullnode.testnet.sui.io:443',
  packageConfig: {
    packageId: '',
    storage: '',
    blob: ''
  }
};
```

## Best Practices

1. **Use Type Guards**: Check property existence before accessing potentially undefined properties.

   ```typescript
   if (result && typeof result === 'object' && 'blobId' in result) {
     return result.blobId;
   }
   ```

2. **Create Adapter Patterns**: For incompatible interfaces, create adapter classes to bridge the gap.

   ```typescript
   export class WalrusClientAdapter implements UnifiedWalrusClient {
     constructor(private walrusClient: OriginalWalrusClient) {}
     
     // Implement methods that adapt from one interface to another
   }
   ```

3. **Consistent Type Assertions**: When using type assertions, be consistent in your approach.

   ```typescript
   // Preferred pattern for complex type assertions
   return complexObject as unknown as ExpectedType;
   ```

4. **Document Non-Obvious Type Assertions**: When using type assertions that aren't immediately obvious, include a comment explaining why.

   ```typescript
   // Assert as unknown first because the mock doesn't implement all KeystoreSigner methods
   // but is compatible with how it's used in the test
   return keystoreSigner as unknown as Signer;
   ```

5. **Minimal Type Assertions**: Only use type assertions when necessary and try to keep them minimal.

6. **Update Interface Definitions**: When possible, update interface definitions rather than using type assertions.

## Library-Specific Issues

### @mysten/sui and @mysten/walrus

- These libraries use private class fields that require ES2015+ target
- Use `--skipLibCheck` when building
- The WalrusClient interface has changed across versions - use adapter patterns to bridge gaps
- Object properties can change between string and bigint types - convert as needed

### Jest Type Issues

- Jest mock functions have specific type parameter requirements
- Use either no type parameters or both function signature and parameter types
- Jest globals like `jest`, `expect`, etc., need to be imported from `@jest/globals`

## Development Workflow

1. Run `pnpm build` first to identify TypeScript errors
2. Address errors in priority order:
   - Interface compatibility issues
   - Missing properties
   - Type conversion issues
   - Library-specific type issues
3. Use `--skipLibCheck` for library-related errors that can't be fixed directly
4. For stubborn type issues, use the transpile-only option: `npx ts-node --transpileOnly ./build-helper.ts`

## Debugging Type Errors

For difficult type errors:

1. Look at the interface definition in the library (check node_modules if necessary)
2. Use explicit type annotations to narrow down the issue
3. Break down complex expressions into smaller, typed variables
4. Use the `typeof` and `instanceof` operators to check types at runtime

```typescript
// Debug complex type error
console.log('Type of result:', typeof result);
console.log('Has blobId property:', 'blobId' in result);
console.log('Structure:', JSON.stringify(result, null, 2));
```

By following these guidelines, you can maintain TypeScript compatibility across the project and handle integration with external libraries more smoothly.