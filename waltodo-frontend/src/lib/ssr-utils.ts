/**
 * SSR/Hydration Utilities
 * 
 * Provides utilities for handling server-side rendering and hydration issues
 * without causing layout shifts or hydration mismatches.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';

// Types
export interface SSRState {
  isServer: boolean;
  isClient: boolean;
  isHydrated: boolean;
  isHydrating: boolean;
}

export interface SSRFallbackConfig {
  showSkeleton?: boolean;
  skeletonClassName?: string;
  minLoadingTime?: number;
  enableProgressiveHydration?: boolean;
}

// Core SSR state management
export function useSSRState(): SSRState {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);

  useEffect(() => {
    setIsHydrating(true);
    const timer = setTimeout(() => {
      setIsHydrated(true);
      setIsHydrating(false);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return {
    isServer: typeof window === 'undefined',
    isClient: typeof window !== 'undefined',
    isHydrated,
    isHydrating,
  };
}

// Safe mounting hook with progressive enhancement
export function useProgressiveMount(config: SSRFallbackConfig = {}) {
  const { minLoadingTime = 0, enableProgressiveHydration = false } = config;
  const [mounted, setMounted] = useState(false);
  const [loadingTimeElapsed, setLoadingTimeElapsed] = useState(minLoadingTime === 0);
  const [progressiveStage, setProgressiveStage] = useState(0);
  const mountTimeRef = useRef<number>();

  useEffect(() => {
    mountTimeRef.current = Date.now();
    
    // Handle minimum loading time
    if (minLoadingTime > 0) {
      const timer = setTimeout(() => {
        setLoadingTimeElapsed(true);
      }, minLoadingTime);

      return () => clearTimeout(timer);
    }
  }, [minLoadingTime]);

  useEffect(() => {
    if (loadingTimeElapsed) {
      setMounted(true);
      
      // Progressive hydration stages
      if (enableProgressiveHydration) {
        const stages = [100, 200, 300]; // Staggered hydration
        stages.forEach((delay, index) => {
          setTimeout(() => {
            setProgressiveStage(index + 1);
          }, delay);
        });
      }
    }
  }, [loadingTimeElapsed, enableProgressiveHydration]);

  return {
    mounted,
    progressiveStage,
    hydrationTime: mountTimeRef.current ? Date.now() - mountTimeRef.current : 0,
    isReady: mounted && loadingTimeElapsed,
  };
}

// Safe client-only content hook
export function useClientOnly(fallback?: () => JSX.Element | null) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return {
    isClient,
    ClientOnlyWrapper: ({ children }: { children: React.ReactNode }) => {
      if (!isClient) {
        return fallback ? fallback() : null;
      }
      return React.createElement(React.Fragment, null, children);
    },
  };
}

// Safe browser API access
export function useSafeBrowserFeature<T>(
  detector: () => T,
  fallback: T,
  deps: React.DependencyList = []
): { value: T; isLoaded: boolean; error: Error | null } {
  const [value, setValue] = useState<T>(fallback);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { isClient } = useClientOnly();

  useEffect(() => {
    if (!isClient) return;

    try {
      const result = detector();
      setValue(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setValue(fallback);
    } finally {
      setIsLoaded(true);
    }
  }, [isClient, fallback, ...deps]);

  return { value, isLoaded, error };
}

// Safe storage hooks
export function useSafeStorage<T>(
  key: string,
  initialValue: T,
  storageType: 'localStorage' | 'sessionStorage' = 'localStorage'
): [T, (value: T | ((prev: T) => T)) => void, { isLoaded: boolean; error: Error | null }] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { isClient } = useClientOnly();

  // Load from storage on mount
  useEffect(() => {
    if (!isClient) return;

    try {
      const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
      const item = storage.getItem(key);
      
      if (item !== null) {
        const parsed = JSON.parse(item);
        setStoredValue(parsed);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Storage read error'));
    } finally {
      setIsLoaded(true);
    }
  }, [key, storageType, isClient]);

  // Update storage and state
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const newValue = value instanceof Function ? value(storedValue) : value;
      setStoredValue(newValue);
      
      if (isClient) {
        const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
        storage.setItem(key, JSON.stringify(newValue));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Storage write error'));
    }
  }, [key, storageType, isClient, storedValue]);

  return [storedValue, setValue, { isLoaded, error }];
}

// Safe window size hook
export function useSafeWindowSize() {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const { isClient } = useClientOnly();

  useEffect(() => {
    if (!isClient) return;

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    setIsLoaded(true);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isClient]);

  return { ...windowSize, isLoaded };
}

// Safe media query hook
export function useSafeMediaQuery(query: string): { matches: boolean; isLoaded: boolean } {
  const [matches, setMatches] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { isClient } = useClientOnly();

  useEffect(() => {
    if (!isClient) return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);
    setIsLoaded(true);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query, isClient]);

  return { matches, isLoaded };
}

// Hydration-safe localStorage hook specifically for theme/preferences
export function useHydrationSafePreferences<T>(
  key: string,
  defaultValue: T,
  validator?: (value: unknown) => value is T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const { isClient } = useClientOnly();

  // Load from localStorage on client mount
  useEffect(() => {
    if (!isClient) return;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Use validator if provided, otherwise trust the stored value
        if (!validator || validator(parsed)) {
          setValue(parsed);
        }
      }
    } catch (error) {
      console.warn(`Failed to load preference "${key}":`, error);
    }
  }, [key, isClient, validator]);

  // Update both state and localStorage
  const updateValue = useCallback((newValue: T) => {
    setValue(newValue);
    if (isClient) {
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch (error) {
        console.warn(`Failed to save preference "${key}":`, error);
      }
    }
  }, [key, isClient]);

  return [value, updateValue];
}

// Utility for handling progressive enhancement
export function useProgressiveEnhancement(features: string[]) {
  const [availableFeatures, setAvailableFeatures] = useState<Set<string>>(new Set());
  const { isClient } = useClientOnly();

  useEffect(() => {
    if (!isClient) return;

    const detected = new Set<string>();
    
    features.forEach(feature => {
      try {
        switch (feature) {
          case 'localStorage':
            if (typeof Storage !== 'undefined') detected.add(feature);
            break;
          case 'webgl':
            const canvas = document.createElement('canvas');
            if (canvas.getContext('webgl')) detected.add(feature);
            break;
          case 'serviceWorker':
            if ('serviceWorker' in navigator) detected.add(feature);
            break;
          case 'intersection-observer':
            if ('IntersectionObserver' in window) detected.add(feature);
            break;
          case 'resize-observer':
            if ('ResizeObserver' in window) detected.add(feature);
            break;
          default:
            // Generic feature detection for window properties
            if (feature in window) detected.add(feature);
        }
      } catch {
        // Feature not available
      }
    });

    setAvailableFeatures(detected);
  }, [features, isClient]);

  return {
    hasFeature: (feature: string) => availableFeatures.has(feature),
    availableFeatures: Array.from(availableFeatures),
    isEnhanced: availableFeatures.size > 0,
  };
}

// Utility for preventing layout shift during hydration
export function useLayoutStableHydration() {
  const [isStable, setIsStable] = useState(false);
  const stabilityRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Ensure layout stability after multiple animation frames
    let frameCount = 0;
    const checkStability = () => {
      frameCount++;
      if (frameCount >= 3) {
        setIsStable(true);
      } else {
        requestAnimationFrame(checkStability);
      }
    };

    requestAnimationFrame(checkStability);

    // Fallback timeout
    stabilityRef.current = setTimeout(() => {
      setIsStable(true);
    }, 100);

    return () => {
      if (stabilityRef.current) {
        clearTimeout(stabilityRef.current);
      }
    };
  }, []);

  return isStable;
}

// Utility for safe JSON operations
export const safeJSON = {
  parse: <T>(str: string, fallback: T): T => {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  },
  stringify: (obj: unknown, fallback = '{}'): string => {
    try {
      if (obj === undefined) return fallback;
      return JSON.stringify(obj) || fallback;
    } catch {
      return fallback;
    }
  },
};

// Default export with all utilities
export default {
  useSSRState,
  useProgressiveMount,
  useClientOnly,
  useSafeBrowserFeature,
  useSafeStorage,
  useSafeWindowSize,
  useSafeMediaQuery,
  useHydrationSafePreferences,
  useProgressiveEnhancement,
  useLayoutStableHydration,
  safeJSON,
};