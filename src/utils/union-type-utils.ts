/**
 * Union Type Utilities
 * 
 * This module provides utilities for working with union types and discriminated unions
 * to achieve superior type safety throughout the application.
 */

/**
 * Generic discriminated union type guard creator
 */
export function createDiscriminatedTypeGuard<T extends { kind: string }>(
  kind: T['kind']
): (obj: unknown) => obj is T {
  return (obj: unknown): obj is T => {
    return (
      obj &&
      typeof obj === 'object' &&
      obj !== null &&
      'kind' in obj &&
      (obj as Record<string, unknown>).kind === kind
    );
  };
}

/**
 * Type predicate for optional properties in union types
 */
export function hasProperty<T, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return obj != null && typeof obj === 'object' && key in (obj as object);
}

/**
 * Type predicate for optional properties with specific types
 */
export function hasPropertyOfType<T, K extends PropertyKey, V>(
  obj: T,
  key: K,
  typeGuard: (val: unknown) => val is V
): obj is T & Record<K, V> {
  return hasProperty(obj, key) && typeGuard((obj as Record<PropertyKey, unknown>)[key]);
}

/**
 * Safe property access with type narrowing
 */
export function safeAccess<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K
): T[K] | undefined {
  return obj?.[key];
}

/**
 * Safe property access with default value
 */
export function safeAccessWithDefault<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue: T[K]
): T[K] {
  return obj?.[key] ?? defaultValue;
}

/**
 * Type guard for non-null/undefined values
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for arrays with specific element types
 */
export function isArrayOf<T>(
  value: unknown,
  elementGuard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(elementGuard);
}

/**
 * Exhaustive switch helper for discriminated unions
 */
export function exhaustiveCheck(value: never): never {
  throw new Error(`Exhaustive check failed: ${JSON.stringify(value)}`);
}

/**
 * Pattern matching utility for discriminated unions
 */
export function match<T extends { kind: string }, R>(
  value: T,
  matchers: { [K in T['kind']]: (val: Extract<T, { kind: K }>) => R }
): R {
  const matcher = matchers[value.kind as T['kind']];
  if (!matcher) {
    throw new Error(`No matcher found for kind: ${value.kind}`);
  }
  return matcher(value as Extract<T, { kind: typeof value.kind }>);
}

/**
 * Partial pattern matching utility
 */
export function partialMatch<T extends { kind: string }, R>(
  value: T,
  matchers: Partial<{ [K in T['kind']]: (val: Extract<T, { kind: K }>) => R }>,
  defaultHandler: (val: T) => R
): R {
  const matcher = matchers[value.kind as T['kind']];
  if (matcher) {
    return matcher(value as Extract<T, { kind: typeof value.kind }>);
  }
  return defaultHandler(value);
}

/**
 * Union type reducer
 */
export function reduceUnion<T extends { kind: string }, R>(
  values: T[],
  reducers: { [K in T['kind']]: (acc: R, val: Extract<T, { kind: K }>) => R },
  initialValue: R
): R {
  return values.reduce((acc, value) => {
    const reducer = reducers[value.kind as T['kind']];
    if (!reducer) {
      throw new Error(`No reducer found for kind: ${value.kind}`);
    }
    return reducer(acc, value as Extract<T, { kind: typeof value.kind }>);
  }, initialValue);
}

/**
 * Filter union types by kind
 */
export function filterByKind<T extends { kind: string }, K extends T['kind']>(
  values: T[],
  kind: K
): Extract<T, { kind: K }>[] {
  return values.filter((value): value is Extract<T, { kind: K }> => value.kind === kind);
}

/**
 * Group union types by kind
 */
export function groupByKind<T extends { kind: string }>(
  values: T[]
): { [K in T['kind']]: Extract<T, { kind: K }>[] } {
  const result = {} as { [K in T['kind']]: Extract<T, { kind: K }>[] };
  
  for (const value of values) {
    const kind = value.kind;
    if (!result[kind]) {
      result[kind] = [];
    }
    (result[kind] as Extract<T, { kind: typeof kind }>[]).push(value as Extract<T, { kind: typeof kind }>);
  }
  
  return result;
}

/**
 * Transform union types with kind-specific transformers
 */
export function transformUnion<T extends { kind: string }, R>(
  value: T,
  transformers: { [K in T['kind']]: (val: Extract<T, { kind: K }>) => R }
): R {
  const transformer = transformers[value.kind];
  if (!transformer) {
    throw new Error(`No transformer found for kind: ${value.kind}`);
  }
  return transformer(value as Extract<T, { kind: typeof value.kind }>);
}

/**
 * Map over union array with kind-specific mappers
 */
export function mapUnion<T extends { kind: string }, R>(
  values: T[],
  mappers: { [K in T['kind']]: (val: Extract<T, { kind: K }>) => R }
): R[] {
  return values.map(value => transformUnion(value, mappers));
}

/**
 * Type predicate for checking if value is one of specific union members
 */
export function isOneOf<T extends { kind: string }, K extends T['kind']>(
  value: T,
  kinds: K[]
): value is Extract<T, { kind: K }> {
  return kinds.includes(value.kind as K);
}

/**
 * Safe union type assertion with runtime checking
 */
export function assertUnionType<T extends { kind: string }, K extends T['kind']>(
  value: T,
  expectedKind: K,
  message?: string
): asserts value is Extract<T, { kind: K }> {
  if (value.kind !== expectedKind) {
    throw new Error(
      message || `Expected kind '${expectedKind}' but got '${value.kind}'`
    );
  }
}

/**
 * Conditional type helper for optional union members
 */
export type OptionalMember<T, K extends keyof T> = T extends Record<K, infer U> ? U : never;

/**
 * Extract optional properties from union type
 */
export function extractOptional<T, K extends keyof T>(
  obj: T,
  key: K
): OptionalMember<T, K> | undefined {
  return hasProperty(obj, key) ? (obj as Record<PropertyKey, unknown>)[key] as OptionalMember<T, K> : undefined;
}

/**
 * Merge union types safely
 */
export function mergeUnionSafe<T extends object, U extends object>(
  first: T,
  second: U
): T & U {
  return { ...first, ...second };
}