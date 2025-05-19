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

// Detect current execution context
export function detectContext(): StorageContext {
  // Check for server-side rendering
  if (typeof window === 'undefined') {
    return 'server';
  }

  // Check for extension context
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return 'extension';
  }

  // Check for iframe
  if (window.top !== window.self) {
    return 'iframe';
  }

  // Check for insecure context (non-HTTPS except localhost)
  if (!window.isSecureContext) {
    return 'insecure';
  }

  // Check for incognito/private mode
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

  return 'unknown';
}

// Check if localStorage is available
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;

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
  const context = detectContext();

  switch (context) {
    case 'browser':
      return localStorage;
    case 'extension':
      // Extension storage could be accessed via chrome.storage API
      // but for simplicity, we'll use memory storage for this implementation
      return memoryStorage;
    case 'iframe':
    case 'incognito':
    case 'insecure':
    case 'server':
    case 'unknown':
    default:
      return memoryStorage;
  }
}

/**
 * Safe getItem - retrieves an item from the appropriate storage
 * without throwing errors in any context
 */
export function safeGetItem(key: string): string | null {
  try {
    const storage = getStorage();
    
    if (storage === memoryStorage) {
      return memoryStorage[key] || null;
    }
    
    return (storage as Storage).getItem(key);
  } catch (e) {
    console.warn(`Safe storage getItem failed for key "${key}":`, e);
    return null;
  }
}

/**
 * Safe setItem - stores an item in the appropriate storage
 * without throwing errors in any context
 */
export function safeSetItem(key: string, value: string): boolean {
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
    return false;
  }
}

/**
 * Safe removeItem - removes an item from the appropriate storage
 * without throwing errors in any context
 */
export function safeRemoveItem(key: string): boolean {
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
    return false;
  }
}

/**
 * Safe clear - clears all items from the appropriate storage
 * without throwing errors in any context
 */
export function safeClear(): boolean {
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
    return false;
  }
}

// Additional utility for checking if we're using fallback storage
export function isUsingFallbackStorage(): boolean {
  return getStorage() === memoryStorage;
}

// Get all keys from current storage
export function getStorageKeys(): string[] {
  try {
    const storage = getStorage();
    
    if (storage === memoryStorage) {
      return Object.keys(memoryStorage);
    }
    
    return Object.keys(storage);
  } catch (e) {
    console.warn('Failed to get storage keys:', e);
    return [];
  }
}

// Get context-specific message for user feedback
export function getStorageContextMessage(): string {
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
}