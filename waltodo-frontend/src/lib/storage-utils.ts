'use client';

/**
 * Enhanced storage utilities with context detection and fallbacks
 * Prevents errors in restricted contexts (extensions, iframes, etc.)
 */

// In-memory fallback when localStorage isn't available
const memoryStorage: Record<string, string> = {};

// Context types
export type StorageContext = 
  | 'browser'       // Standard browser context with storage access
  | 'extension'     // Browser extension context
  | 'iframe'        // Embedded in an iframe
  | 'insecure'      // Non-HTTPS context with restricted features
  | 'incognito'     // Private/incognito browsing mode
  | 'server'        // Server-side rendering context
  | 'unknown';      // Context could not be determined

// Check if we're in a browser environment without throwing errors
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// Detect current execution context
export function detectContext(): StorageContext {
  // Check for server-side rendering
  if (!isBrowser()) {
    return 'server';
  }

  // Safe check for extension context
  try {
    if (typeof (window as any).chrome !== 'undefined' && 
        (window as any).chrome.storage) {
      return 'extension';
    }
  } catch (e) {
    console.warn('Error checking for extension context:', e);
  }

  // Safe check for iframe
  try {
    if (window.top !== window.self) {
      return 'iframe';
    }
  } catch (e) {
    // If this errors, we're probably in a cross-origin iframe
    console.warn('Error checking for iframe context:', e);
    return 'iframe'; // Assume iframe with restrictions
  }

  // Check for insecure context (non-HTTPS except localhost)
  try {
    if (!window.isSecureContext) {
      return 'insecure';
    }
  } catch (e) {
    console.warn('Error checking for secure context:', e);
  }

  // Check for incognito/private mode or storage restrictions
  try {
    localStorage.setItem('__storage_test__', '__storage_test__');
    localStorage.removeItem('__storage_test__');
    sessionStorage.setItem('__storage_test__', '__storage_test__');
    sessionStorage.removeItem('__storage_test__');
    return 'browser';
  } catch (e) {
    // If storage test fails but browser isn't otherwise identified as a specific context
    return 'incognito';
  }
}

// Check if localStorage is available
export function isStorageAvailable(): boolean {
  if (!isBrowser()) return false;

  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

// Get the appropriate storage method based on context
function getStorage(): Storage | Record<string, string> {
  // Always use memory storage in server context
  if (!isBrowser()) {
    return memoryStorage;
  }

  // Try to detect the context, but use memory storage as fallback if detection fails
  try {
    const context = detectContext();

    switch (context) {
      case 'browser':
        // Double-check storage is available
        if (isStorageAvailable()) {
          return localStorage;
        }
        return memoryStorage;
      case 'extension':
      case 'iframe':
      case 'incognito':
      case 'insecure':
      case 'server':
      case 'unknown':
      default:
        return memoryStorage;
    }
  } catch (e) {
    console.warn('Error getting storage, using memory fallback:', e);
    return memoryStorage;
  }
}

/**
 * Safe getItem - retrieves an item from the appropriate storage
 * without throwing errors in any context
 */
export function safeGetItem(key: string): string | null {
  // Always use memory storage in server context
  if (!isBrowser()) {
    return memoryStorage[key] || null;
  }

  try {
    const storage = getStorage();
    
    if (storage === memoryStorage) {
      return memoryStorage[key] || null;
    }
    
    return (storage as Storage).getItem(key);
  } catch (e) {
    console.warn(`Safe storage getItem failed for key "${key}":`, e);
    return memoryStorage[key] || null;
  }
}

/**
 * Safe setItem - stores an item in the appropriate storage
 * without throwing errors in any context
 */
export function safeSetItem(key: string, value: string): boolean {
  // Always use memory storage in server context
  if (!isBrowser()) {
    memoryStorage[key] = value;
    return true;
  }

  try {
    const storage = getStorage();
    
    if (storage === memoryStorage) {
      memoryStorage[key] = value;
      return true;
    }
    
    (storage as Storage).setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`Safe storage setItem failed for key "${key}":`, e);
    // Fall back to memory storage
    memoryStorage[key] = value;
    return true;
  }
}

/**
 * Safe removeItem - removes an item from the appropriate storage
 * without throwing errors in any context
 */
export function safeRemoveItem(key: string): boolean {
  // Always use memory storage in server context
  if (!isBrowser()) {
    delete memoryStorage[key];
    return true;
  }

  try {
    const storage = getStorage();
    
    if (storage === memoryStorage) {
      delete memoryStorage[key];
      return true;
    }
    
    (storage as Storage).removeItem(key);
    return true;
  } catch (e) {
    console.warn(`Safe storage removeItem failed for key "${key}":`, e);
    // Still remove from memory storage
    delete memoryStorage[key];
    return true;
  }
}

/**
 * Safe clear - clears all items from the appropriate storage
 * without throwing errors in any context
 */
export function safeClear(): boolean {
  // Always use memory storage in server context
  if (!isBrowser()) {
    Object.keys(memoryStorage).forEach(key => {
      delete memoryStorage[key];
    });
    return true;
  }

  try {
    const storage = getStorage();
    
    if (storage === memoryStorage) {
      Object.keys(memoryStorage).forEach(key => {
        delete memoryStorage[key];
      });
      return true;
    }
    
    (storage as Storage).clear();
    return true;
  } catch (e) {
    console.warn('Safe storage clear failed:', e);
    // Still clear memory storage
    Object.keys(memoryStorage).forEach(key => {
      delete memoryStorage[key];
    });
    return true;
  }
}

// Additional utility for checking if we're using fallback storage
export function isUsingFallbackStorage(): boolean {
  if (!isBrowser()) return true;
  try {
    return getStorage() === memoryStorage;
  } catch (e) {
    return true;
  }
}

// Get all keys from current storage
export function getStorageKeys(): string[] {
  // Always use memory storage in server context
  if (!isBrowser()) {
    return Object.keys(memoryStorage);
  }

  try {
    const storage = getStorage();
    
    if (storage === memoryStorage) {
      return Object.keys(memoryStorage);
    }
    
    return Object.keys(storage);
  } catch (e) {
    console.warn('Failed to get storage keys:', e);
    return Object.keys(memoryStorage);
  }
}

// Get context-specific message for user feedback
export function getStorageContextMessage(): string {
  if (!isBrowser()) {
    return 'Server-side rendering detected. Using temporary storage.';
  }

  try {
    const context = detectContext();
    const usingFallback = isUsingFallbackStorage();
    
    if (usingFallback) {
      switch (context) {
        case 'extension':
          return 'Using extension storage mode. Your data will not persist between sessions.';
        case 'iframe':
          return 'Running in restricted iframe mode. Your data will not persist between sessions.';
        case 'incognito':
          return 'Private browsing detected. Your data will not persist between sessions.';
        case 'insecure':
          return 'Insecure context detected. For persistent storage, please use HTTPS.';
        case 'server':
          return 'Server-side rendering detected. Storage not available.';
        default:
          return 'Using temporary storage. Your data will not persist between sessions.';
      }
    }
    
    return 'Using persistent storage.';
  } catch (e) {
    return 'Using temporary storage due to browser restrictions.';
  }
}