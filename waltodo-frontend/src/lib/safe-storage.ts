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

// Check if localStorage is available
export function isStorageAvailable(): boolean {
  if (!isBrowser()) return false;
  
  try {
    // First check if localStorage is defined
    if (window.localStorage === undefined) {
      return false;
    }
    
    // Then try storage access
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get item safely from storage with fallback to memory store
 */
export function getItem<T>(key: string, defaultValue?: T): T | null {
  try {
    // Return from memory store in SSR or if storage is unavailable
    if (!isStorageAvailable()) {
      const memoryValue = memoryStore[key];
      return memoryValue ? JSON.parse(memoryValue) : defaultValue ?? null;
    }
    
    // Get from localStorage with proper error handling
    const value = window.localStorage.getItem(key);
    
    // Return parsed value if it exists, otherwise return default or null
    return value !== null ? JSON.parse(value) : defaultValue ?? null;
  } catch (error) {
    // This could be a parsing error, storage access issue, or other
    console.warn(`Error getting item "${key}" from storage:`, error);
    
    // Return from memory store as fallback
    const memoryValue = memoryStore[key];
    return memoryValue ? JSON.parse(memoryValue) : defaultValue ?? null; 
  }
}

/**
 * Set item safely in storage with fallback to memory store
 */
export function setItem<T>(key: string, value: T): boolean {
  try {
    // Store as JSON string
    const valueString = JSON.stringify(value);
    
    // Always update memory store regardless of availability
    memoryStore[key] = valueString;
    
    // Skip localStorage in SSR or if unavailable
    if (!isStorageAvailable()) {
      return true; // Success using memory store
    }
    
    // Set in localStorage
    window.localStorage.setItem(key, valueString);
    return true;
  } catch (error) {
    console.warn(`Error setting item "${key}" in storage:`, error);
    
    // Still update memory store even if localStorage fails
    try {
      memoryStore[key] = JSON.stringify(value);
    } catch (e) {
      console.error(`Failed to save in memory store too:`, e);
      return false;
    }
    
    return true; // Success with fallback
  }
}

/**
 * Remove item safely from all storage
 */
export function removeItem(key: string): boolean {
  try {
    // Always remove from memory store
    delete memoryStore[key];
    
    // Skip localStorage in SSR or if unavailable
    if (!isStorageAvailable()) {
      return true;
    }
    
    // Remove from localStorage
    window.localStorage.removeItem(key);
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
    
    // Skip localStorage in SSR or if unavailable
    if (!isStorageAvailable()) {
      return true;
    }
    
    // Clear localStorage
    window.localStorage.clear();
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
    if (!isStorageAvailable()) {
      return Object.keys(memoryStore);
    }
    
    // Get keys from both localStorage and memory store
    const localStorageKeys = Object.keys(window.localStorage);
    const memoryStoreKeys = Object.keys(memoryStore);
    
    // Combine and remove duplicates
    return [...new Set([...localStorageKeys, ...memoryStoreKeys])];
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