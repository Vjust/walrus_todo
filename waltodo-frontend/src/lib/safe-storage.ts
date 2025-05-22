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

// Set isHydrating to false after proper DOM loading
if (typeof window !== 'undefined') {
  // Use multiple events to ensure hydration is complete
  const markHydrationComplete = () => {
    isHydrating = false;
  };

  // Immediately set to false if the document is already loaded
  if (document.readyState === 'complete') {
    markHydrationComplete();
  } else {
    // Wait for both DOMContentLoaded and window load
    document.addEventListener('DOMContentLoaded', markHydrationComplete);
    window.addEventListener('load', markHydrationComplete);
    
    // Fallback timeout in case events don't fire
    setTimeout(markHydrationComplete, 1000);
  }
}

// Check if localStorage is available
export function isStorageAvailable(): boolean {
  // Always return false during SSR or hydration
  if (!isBrowser() || isHydrating) return false;
  
  // Delay access to localStorage until after hydration
  if (typeof document !== 'undefined' && document.readyState !== 'complete') {
    return false;
  }
  
  try {
    // First check if localStorage is defined
    if (window.localStorage === undefined) {
      return false;
    }
    
    // Use a safer detection method that doesn't cause errors
    try {
      // Check if we're in a private browsing context
      // This is a safe way to test without triggering errors
      if ('localStorage' in window && window.localStorage !== null) {
        // Don't actually access localStorage during this check
        return true;
      }
      return false;
    } catch (privateBrowsingError) {
      return false;
    }
  } catch (e) {
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
  
  // Don't access localStorage if document isn't fully loaded
  if (typeof document !== 'undefined' && document.readyState !== 'complete') {
    return [false, null];
  }

  // Additional safety check for iframe/restricted contexts
  try {
    // Quick test to see if localStorage is actually accessible
    // This will throw if we're in a restricted context
    if (!window.localStorage) {
      return [false, null];
    }
    
    // Test write access (this will fail in private browsing)
    // Skip this test to avoid console errors
    // const testKey = '__test_storage_access__';
    // window.localStorage.setItem(testKey, 'test');
    // window.localStorage.removeItem(testKey);
  } catch (accessError) {
    // Silently return false instead of logging error
    return [false, null];
  }
  
  try {
    // First verify that localStorage is available
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return [false, null];
    }
    
    // Perform the requested operation
    switch (operation) {
      case 'get':
        return [true, window.localStorage.getItem(key)];
      case 'set':
        window.localStorage.setItem(key, JSON.stringify(value));
        return [true, null];
      case 'remove':
        window.localStorage.removeItem(key);
        return [true, null];
      default:
        return [false, null];
    }
  } catch (error) {
    // Silently handle errors to avoid console spam
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
        return JSON.parse(value);
      } catch (parseError) {
        console.warn(`Error parsing localStorage value for key "${key}":`, parseError);
      }
    }
    
    // Fallback to memory store if localStorage access failed or returned null
    const memoryValue = memoryStore[key];
    return memoryValue ? JSON.parse(memoryValue) : defaultValue ?? null;
  } catch (error) {
    // This could be a parsing error or other issue
    console.warn(`Error getting item "${key}" from storage:`, error);
    
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
    const valueString = JSON.stringify(value);
    
    // Always update memory store regardless of localStorage availability
    memoryStore[key] = valueString;
    
    // Try to set in localStorage safely
    const [success] = safeLocalStorageAccess<T>('set', key, value);
    
    // Return true even if localStorage failed but memory store succeeded
    return true;
  } catch (error) {
    console.warn(`Error setting item "${key}" in storage:`, error);
    
    // Try to update memory store as a fallback
    try {
      memoryStore[key] = JSON.stringify(value);
      return true; // Success with memory fallback
    } catch (e) {
      console.error(`Failed to save in memory store:`, e);
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
    console.warn(`Error removing item "${key}" from storage:`, error);
    
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
    Object.keys(memoryStore).forEach(key => delete memoryStore[key]);
    
    // Try to clear localStorage safely
    if (isBrowser() && !isHydrating && typeof window !== 'undefined' && 
        typeof window.localStorage !== 'undefined' && 
        document.readyState === 'complete') {
      try {
        window.localStorage.clear();
      } catch (clearError) {
        console.warn('Error clearing localStorage:', clearError);
      }
    }
    
    return true;
  } catch (error) {
    console.warn(`Error clearing storage:`, error);
    
    // Ensure memory store is cleared even if localStorage fails
    Object.keys(memoryStore).forEach(key => delete memoryStore[key]);
    return true;
  }
}

/**
 * Get all storage keys
 */
export function getAllKeys(): string[] {
  try {
    // Always include memory store keys
    const memoryStoreKeys = Object.keys(memoryStore);
    
    // Only attempt to get localStorage keys if it's safe to do so
    if (isBrowser() && !isHydrating && typeof window !== 'undefined' && 
        typeof window.localStorage !== 'undefined' && 
        document.readyState === 'complete') {
      try {
        const localStorageKeys = Object.keys(window.localStorage);
        // Combine and remove duplicates
        const allKeys = localStorageKeys.concat(memoryStoreKeys);
        const uniqueKeys = allKeys.filter((key, index) => allKeys.indexOf(key) === index);
        return uniqueKeys;
      } catch (storageError) {
        console.warn('Error accessing localStorage keys:', storageError);
        return memoryStoreKeys;
      }
    }
    
    // Default to memory store keys only
    return memoryStoreKeys;
  } catch (error) {
    console.warn(`Error getting storage keys:`, error);
    return Object.keys(memoryStore);
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
    clear: () => removeItem(key)
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
  createTyped: createTypedStorage
};

export default safeStorage;