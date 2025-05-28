'use client';

/**
 * Hydration-safe utilities to prevent server/client rendering mismatches
 * 
 * These utilities ensure consistent behavior between SSR and client-side rendering
 * by providing safe defaults during hydration and proper client-side detection.
 */

import { useEffect, useState } from 'react';

// Track hydration state globally
let isClientHydrated = false;

if (typeof window !== 'undefined') {
  // Use multiple indicators to detect when hydration is complete
  const markHydrationComplete = () => {
    isClientHydrated = true;
  };

  if (document.readyState === 'complete') {
    markHydrationComplete();
  } else {
    document.addEventListener('DOMContentLoaded', markHydrationComplete, { once: true });
    window.addEventListener('load', markHydrationComplete, { once: true });
    // Fallback timeout
    setTimeout(markHydrationComplete, 300);
  }
}

/**
 * Check if we're in a browser environment (not SSR)
 */
export const isBrowser = (): boolean => typeof window !== 'undefined';

/**
 * Check if hydration is complete
 */
export const isHydrated = (): boolean => isBrowser() && isClientHydrated;

/**
 * Hook that returns true only after hydration is complete
 * Useful for preventing hydration mismatches
 */
export function useIsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // This effect only runs on the client side after hydration
    setHydrated(true);
  }, []);

  return hydrated;
}

/**
 * Hook that safely returns a value only after hydration
 * Returns fallback value during SSR and initial render
 */
export function useHydrationSafeValue<T>(
  getValue: () => T,
  fallbackValue: T
): T {
  const [value, setValue] = useState<T>(fallbackValue);
  const hydrated = useIsHydrated();

  useEffect(() => {
    if (hydrated) {
      try {
        setValue(getValue());
      } catch (error) {
        console.warn('Error getting hydration-safe value:', error);
        setValue(fallbackValue);
      }
    }
  }, [hydrated, getValue, fallbackValue]);

  return value;
}

/**
 * Safely access localStorage with fallback
 */
export function safeLocalStorageGet(key: string, fallback: string | null = null): string | null {
  if (!isHydrated()) {
    return fallback;
  }

  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return fallback;
  }
}

/**
 * Safely set localStorage value
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (!isHydrated()) {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Safely remove localStorage value
 */
export function safeLocalStorageRemove(key: string): boolean {
  if (!isHydrated()) {
    return false;
  }

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Hook for consistent environment detection
 */
export function useEnvironment() {
  return useHydrationSafeValue(
    () => {
      // Only access process.env on client side after hydration
      return {
        network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
        isDevelopment: process.env.NODE_ENV === 'development',
        isProduction: process.env.NODE_ENV === 'production',
      };
    },
    {
      network: 'testnet',
      isDevelopment: false,
      isProduction: true,
    }
  );
}

/**
 * Hook for safe localStorage usage
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const hydrated = useIsHydrated();

  // Load value from localStorage after hydration
  useEffect(() => {
    if (hydrated) {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          setStoredValue(JSON.parse(item));
        }
      } catch (error) {
        console.warn(`Error loading localStorage key "${key}":`, error);
      }
    }
  }, [key, hydrated]);

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (hydrated) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  const removeValue = () => {
    try {
      setStoredValue(initialValue);
      if (hydrated) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, removeValue];
}

/**
 * Create a component that only renders on the client side
 */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const hydrated = useIsHydrated();

  if (!hydrated) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Force a re-render after hydration is complete
 * Useful for components that need to access browser APIs
 */
export function useForceRenderAfterHydration() {
  const [, setForceRender] = useState(0);
  const hydrated = useIsHydrated();

  useEffect(() => {
    if (hydrated) {
      setForceRender(prev => prev + 1);
    }
  }, [hydrated]);

  return hydrated;
}