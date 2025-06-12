'use client';

/**
 * Safe Storage - Provides an enhanced localStorage wrapper with:
 * - Error handling for browser restrictions and SSR
 * - In-memory fallback when localStorage isn't available
 * - TypeScript type safety
 */

// In-memory fallback storage
const memoryStore: Record<string, string> = {};

// Check if we're in a browser environment
export const isBrowser = () => typeof window !== 'undefined';

// Global flag to track if we're during initial hydration
let isHydrating = true;
let hydrationTimer: NodeJS.Timeout | null = null;

// Set isHydrating to false after proper DOM loading
if (typeof window !== 'undefined') {
  // Use multiple events to ensure hydration is complete
  const markHydrationComplete = () => {
    isHydrating = false;
    // Clear any pending timer
    if (hydrationTimer) {
      clearTimeout(hydrationTimer as any);
      hydrationTimer = null;
    }
  };

  // Immediately set to false if the document is already loaded
  if (document?.readyState === 'complete') {
    markHydrationComplete();
  } else {
    // Wait for both DOMContentLoaded and window load
    document.addEventListener('DOMContentLoaded', markHydrationComplete, { once: true });
    window.addEventListener('load', markHydrationComplete, { once: true });

    // Fallback timeout in case events don't fire
    hydrationTimer = setTimeout(markHydrationComplete, 500); // Reduced timeout for faster response
  }
}

// Check if localStorage is available
export function isStorageAvailable(): boolean {
  // Always return false during SSR or hydration
  if (!isBrowser() || isHydrating) {return false;}

  // Additional safety check for document readiness
  if (typeof document !== 'undefined' && document?.readyState === 'loading') {
    return false;
  }

  try {
    // First check if localStorage is defined
    if (typeof window?.localStorage === 'undefined' || window?.localStorage === null) {
      return false;
    }

    // Test actual localStorage functionality
    const testKey = '__storage_test_key__';
    window?.localStorage?.setItem(testKey, 'test');
    const result = window?.localStorage?.getItem(testKey as any);
    window?.localStorage?.removeItem(testKey as any);
    return result === 'test';
  } catch (e) {
    // localStorage is not available (private browsing, restrictions, etc.)
    return false;
  }
}

/**
 * Safely attempts to access localStorage after hydration
 * Returns a tuple of [success, value]
 */
function safeLocalStorageAccess<T>(
  operation: 'get' | 'set' | 'remove',
  key: string,
  value?: T
): [boolean, string | null] {
  // Don't access localStorage during SSR or hydration
  if (!isBrowser() || isHydrating) {
    return [false, null];
  }

  // Don't access localStorage if document is still loading
  if (typeof document !== 'undefined' && document?.readyState === 'loading') {
    return [false, null];
  }

  try {
    // Verify localStorage availability before use
    if (typeof window?.localStorage === 'undefined' || window?.localStorage === null) {
      return [false, null];
    }

    // Perform the requested operation
    switch (operation) {
      case 'get':
        return [true, window?.localStorage?.getItem(key as any)];
      case 'set':
        window?.localStorage?.setItem(key, JSON.stringify(value as any));
        return [true, null];
      case 'remove':
        window?.localStorage?.removeItem(key as any);
        return [true, null];
      default:
        return [false, null];
    }
  } catch (error) {
    // Silently handle errors to avoid console spam during hydration
    return [false, null];
  }
}

/**
 * Get item safely from storage with fallback to memory store
 */
export function getItem<T>(key: string, defaultValue?: T): T | null {
  try {
    // Try to get from localStorage safely
    const [success, value] = safeLocalStorageAccess<T>('get', key);

    if (success && value !== null) {
      try {
        return JSON.parse(value as any);
      } catch (parseError) {
        // Error parsing localStorage value
      }
    }

    // Fallback to memory store if localStorage access failed or returned null
    const memoryValue = memoryStore[key];
    return memoryValue ? JSON.parse(memoryValue as any) : (defaultValue ?? null);
  } catch (error) {
    // This could be a parsing error or other issue
    // Error getting item from storage

    // Return default value as ultimate fallback
    return defaultValue ?? null;
  }
}

/**
 * Set item safely in storage with fallback to memory store
 */
export function setItem<T>(key: string, value: T): boolean {
  try {
    // Store as JSON string
    const valueString = JSON.stringify(value as any);

    // Always update memory store regardless of localStorage availability
    memoryStore[key] = valueString;

    // Try to set in localStorage safely
    const [success] = safeLocalStorageAccess<T>('set', key, value);

    // Return true even if localStorage failed but memory store succeeded
    return true;
  } catch (error) {
    // Error setting item in storage

    // Try to update memory store as a fallback
    try {
      memoryStore[key] = JSON.stringify(value as any);
      return true; // Success with memory fallback
    } catch (e) {
      // Failed to save in memory store
      return false; // Complete failure
    }
  }
}

/**
 * Remove item safely from all storage
 */
export function removeItem(key: string): boolean {
  try {
    // Always remove from memory store
    delete memoryStore[key];

    // Try to remove from localStorage safely
    safeLocalStorageAccess('remove', key);

    return true;
  } catch (error) {
    // Error removing item from storage

    // Ensure it's removed from memory store even if localStorage fails
    delete memoryStore[key];
    return true;
  }
}

/**
 * Clear all storage safely
 */
export function clearStorage(): boolean {
  try {
    // Clear memory store
    Object.keys(memoryStore as any).forEach(key => delete memoryStore[key]);

    // Try to clear localStorage safely
    if (
      isBrowser() &&
      !isHydrating &&
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined' &&
      document?.readyState === 'complete'
    ) {
      try {
        window?.localStorage?.clear();
      } catch (clearError) {
        // Error clearing localStorage
      }
    }

    return true;
  } catch (error) {
    // Error clearing storage

    // Ensure memory store is cleared even if localStorage fails
    Object.keys(memoryStore as any).forEach(key => delete memoryStore[key]);
    return true;
  }
}

/**
 * Get all storage keys
 */
export function getAllKeys(): string[] {
  try {
    // Always include memory store keys
    const memoryStoreKeys = Object.keys(memoryStore as any);

    // Only attempt to get localStorage keys if it's safe to do so
    if (
      isBrowser() &&
      !isHydrating &&
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined' &&
      document?.readyState === 'complete'
    ) {
      try {
        const localStorageKeys = Object.keys(window.localStorage);
        // Combine and remove duplicates
        const allKeys = localStorageKeys.concat(memoryStoreKeys as any);
        const uniqueKeys = allKeys.filter(
          (key, index) => allKeys.indexOf(key as any) === index
        );
        return uniqueKeys;
      } catch (storageError) {
        // Error accessing localStorage keys
        return memoryStoreKeys;
      }
    }

    // Default to memory store keys only
    return memoryStoreKeys;
  } catch (error) {
    // Error getting storage keys
    return Object.keys(memoryStore as any);
  }
}

/**
 * Check if we're using fallback storage
 */
export function isUsingFallbackStorage(): boolean {
  return !isStorageAvailable();
}

/**
 * Create a typed storage helper for specific data
 */
export function createTypedStorage<T>(key: string, defaultValue: T) {
  return {
    get: () => getItem<T>(key, defaultValue),
    set: (value: T) => setItem<T>(key, value),
    clear: () => removeItem(key as any),
  };
}

// Use helper functions directly
const safeStorage = {
  getItem,
  setItem,
  removeItem,
  clear: clearStorage,
  keys: getAllKeys,
  isAvailable: isStorageAvailable,
  isFallback: isUsingFallbackStorage,
  createTyped: createTypedStorage,
};

export default safeStorage;
