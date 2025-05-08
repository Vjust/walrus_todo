# TypeScript Compatibility Guide

This document explains the approach to handling TypeScript compatibility issues in the Walrus Todo project.

## Background

The project has dependencies on multiple versions of libraries, particularly:
- @mysten/sui (v1.29.1)
- @mysten/sui.js (v0.54.1)
- @mysten/walrus (v0.0.21)

These different versions have incompatible TypeScript interfaces, making it challenging to maintain type safety across the entire codebase.

## Recommended Build Approach

As mentioned in CLAUDE.md, there are several build options:

1. **Standard Build**: `pnpm run build`
   - Uses TypeScript type checking
   - Will skip emitting on errors
   - Not recommended with the current compatibility issues

2. **Force Build**: `pnpm run build-force`
   - Uses TypeScript type checking but emit files even with errors
   - Provides warning about type issues but still completes the build

3. **Compatible Build**: `pnpm run build-compatible`
   - Uses transpile-only mode to skip type checking entirely
   - Most reliable approach with the current compatibility issues
   - Successfully builds the project despite interface incompatibilities

4. **Type Check Only**: `pnpm run typecheck`
   - Runs TypeScript type checking without emitting JavaScript
   - Useful for identifying issues but will show many errors

## Compatibility Strategy

The project uses adapter patterns to bridge incompatibilities between different library versions:

1. **SignerAdapter**: Adapts between different Signer interfaces
2. **TransactionBlockAdapter**: Provides compatibility between Transaction and TransactionBlock 
3. **WalrusClientAdapter**: Handles compatibility for Walrus client operations

## Pragmatic Approach to Type Safety

For this project, we recommend:

1. Use `pnpm run build-compatible` for development and production builds
2. Add targeted `@ts-ignore` comments only when absolutely necessary
3. Use TypeScript assertions (`as`) cautiously and only when adapter patterns aren't sufficient
4. Document any compatibility workarounds in code comments

## Future Improvements

To improve type safety in the future:

1. Standardize on a single version of each library
2. Update adapter interfaces as libraries evolve
3. Create dedicated type definition files for incompatible interfaces
4. Consider a more comprehensive approach to dependency management

## Additional Resources

- Review the TypeScript configuration in `tsconfig.json`
- See `src/utils/adapters` for adapter pattern implementations
- Refer to CLAUDE.md for more guidance