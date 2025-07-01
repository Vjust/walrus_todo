/**
 * Type Assertion Utilities
 *
 * This module provides safe type assertion utilities to replace unsafe
 * `as unknown as` conversions throughout the codebase.
 */

/**
 * Safe assertion for objects with specific methods
 *
 * @param obj - The object to assert
 * @param methodName - The method name to check for
 * @returns The object cast to have the method, or throws if invalid
 */
export function assertHasMethod<T extends Record<string, unknown>>(
  obj: unknown,
  methodName: string
): obj is T & { [K in string]: (...args: any[]) => any } {
  if (!obj || typeof obj !== 'object' || !(methodName in obj)) {
    throw new Error(`Object does not have required method: ${methodName}`);
  }

  const objRecord = obj as Record<string, unknown>;
  if (typeof objRecord[methodName] !== 'function') {
    throw new Error(`Property ${methodName} is not a function`);
  }

  return true;
}

/**
 * Safe assertion for objects implementing BaseSigner interface
 *
 * @param obj - The object to check
 * @returns Type guard for BaseSigner
 */
export function assertBaseSigner(obj: unknown): obj is {
  signPersonalMessage: (message: Uint8Array) => Promise<unknown>;
  signWithIntent: (message: Uint8Array, intent: unknown) => Promise<unknown>;
  getKeyScheme: () => string;
  toSuiAddress: () => string;
} {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Object is not a valid BaseSigner');
  }

  const signerObj = obj as Record<string, unknown>;
  const requiredMethods = [
    'signPersonalMessage',
    'signWithIntent',
    'getKeyScheme',
    'toSuiAddress',
  ];

  for (const method of requiredMethods) {
    if (!(method in signerObj) || typeof signerObj[method] !== 'function') {
      throw new Error(`BaseSigner missing required method: ${method}`);
    }
  }

  return true;
}

/**
 * Safe assertion for objects with string properties
 *
 * @param obj - The object to check
 * @param propertyName - The property name to check for
 * @returns The value if it's a string, or throws
 */
export function assertStringProperty(
  obj: unknown,
  propertyName: string
): string {
  if (!obj || typeof obj !== 'object' || !(propertyName in obj)) {
    throw new Error(`Object does not have property: ${propertyName}`);
  }

  const objRecord = obj as Record<string, unknown>;
  const value = objRecord[propertyName];

  if (typeof value !== 'string') {
    throw new Error(`Property ${propertyName} is not a string`);
  }

  return value;
}

/**
 * Safe assertion for objects with number properties
 *
 * @param obj - The object to check
 * @param propertyName - The property name to check for
 * @returns The value if it's a number, or throws
 */
export function assertNumberProperty(
  obj: unknown,
  propertyName: string
): number {
  if (!obj || typeof obj !== 'object' || !(propertyName in obj)) {
    throw new Error(`Object does not have property: ${propertyName}`);
  }

  const objRecord = obj as Record<string, unknown>;
  const value = objRecord[propertyName];

  if (typeof value !== 'number') {
    throw new Error(`Property ${propertyName} is not a number`);
  }

  return value;
}

/**
 * Safe assertion for TransactionObjectArgument-like objects
 *
 * @param obj - The object to check
 * @returns Type guard for TransactionObjectArgument
 */
export function assertTransactionObjectArgument(
  obj: unknown
): obj is { kind: string } {
  if (!obj || typeof obj !== 'object' || !('kind' in obj)) {
    throw new Error('Object is not a valid TransactionObjectArgument');
  }

  const argObj = obj as Record<string, unknown>;
  if (typeof argObj.kind !== 'string') {
    throw new Error('TransactionObjectArgument.kind must be a string');
  }

  return true;
}

/**
 * Safe conversion from unknown to Record<string, unknown>
 *
 * @param obj - The object to convert
 * @returns The object as Record<string, unknown>
 */
export function toRecord(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Value is not an object');
  }

  return obj as Record<string, unknown>;
}

/**
 * Safe conversion from unknown to function
 *
 * @param fn - The value to convert
 * @param fnName - Optional function name for error messages
 * @returns The function
 */
export function toFunction(
  fn: unknown,
  fnName = 'unknown'
): (...args: any[]) => any {
  if (typeof fn !== 'function') {
    throw new Error(`${fnName} is not a function`);
  }

  return fn as (...args: any[]) => any;
}

/**
 * Safe conversion for signature responses that may have different formats
 *
 * @param signature - The signature object to normalize
 * @returns Normalized signature object
 */
export function normalizeSignatureResponse(signature: unknown): {
  signature: string;
  bytes?: string;
} {
  if (!signature || typeof signature !== 'object') {
    throw new Error('Invalid signature object');
  }

  const sigObj = signature as Record<string, unknown>;

  // Handle string signatures
  if (typeof signature === 'string') {
    return { signature };
  }

  // Handle object signatures
  if (!('signature' in sigObj)) {
    throw new Error('Signature object missing signature property');
  }

  let sigValue = sigObj.signature;
  if (sigValue instanceof Uint8Array) {
    sigValue = Buffer.from(sigValue).toString('base64');
  } else if (typeof sigValue !== 'string') {
    throw new Error('Signature property must be string or Uint8Array');
  }

  const result: { signature: string; bytes?: string } = { signature: sigValue };

  // Handle bytes if present
  if ('bytes' in sigObj) {
    const bytesValue = sigObj.bytes;
    if (bytesValue instanceof Uint8Array) {
      result?.bytes = Buffer.from(bytesValue).toString('base64');
    } else if (typeof bytesValue === 'string') {
      result?.bytes = bytesValue;
    }
  }

  return result;
}

/**
 * Safe conversion to Uint8Array from various formats
 *
 * @param data - The data to convert
 * @returns Uint8Array
 */
export function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (typeof data === 'string') {
    // Try base64 decode first, then UTF-8
    try {
      return Uint8Array.from(atob(data), c => c.charCodeAt(0));
    } catch {
      return new TextEncoder().encode(data);
    }
  }

  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }

  throw new Error('Cannot convert data to Uint8Array');
}
