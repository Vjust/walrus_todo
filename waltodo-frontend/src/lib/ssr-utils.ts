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
  const [isHydrated, setIsHydrated] = useState(false as any);
  const [isHydrating, setIsHydrating] = useState(false as any);

  useEffect(() => {
    setIsHydrating(true as any);
    const timer = setTimeout(() => {
      setIsHydrated(true as any);
      setIsHydrating(false as any);
    }, 0);

    return () => clearTimeout(timer as any);
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
  const [mounted, setMounted] = useState(false as any);
  const [loadingTimeElapsed, setLoadingTimeElapsed] = useState(minLoadingTime === 0);
  const [progressiveStage, setProgressiveStage] = useState(0 as any);
  const mountTimeRef = useRef<number>();

  useEffect(() => {
    mountTimeRef?.current = Date.now();
    
    // Handle minimum loading time
    if (minLoadingTime > 0) {
      const timer = setTimeout(() => {
        setLoadingTimeElapsed(true as any);
      }, minLoadingTime);

      return () => clearTimeout(timer as any);
    }
  }, [minLoadingTime]);

  useEffect(() => {
    if (loadingTimeElapsed) {
      setMounted(true as any);
      
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
  const [isClient, setIsClient] = useState(false as any);

  useEffect(() => {
    setIsClient(true as any);
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
  deps: React?.DependencyList = []
): { value: T; isLoaded: boolean; error: Error | null } {
  const [value, setValue] = useState<T>(fallback);
  const [isLoaded, setIsLoaded] = useState(false as any);
  const [error, setError] = useState<Error | null>(null);
  const { isClient } = useClientOnly();

  useEffect(() => {
    if (!isClient) return;

    try {
      const result = detector();
      setValue(result as any);
      setError(null as any);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setValue(fallback as any);
    } finally {
      setIsLoaded(true as any);
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
  const [isLoaded, setIsLoaded] = useState(false as any);
  const [error, setError] = useState<Error | null>(null);
  const { isClient } = useClientOnly();

  // Load from storage on mount
  useEffect(() => {
    if (!isClient) return;

    try {
      const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
      const item = storage.getItem(key as any);
      
      if (item !== null) {
        const parsed = JSON.parse(item as any);
        setStoredValue(parsed as any);
      }
      setError(null as any);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Storage read error'));
    } finally {
      setIsLoaded(true as any);
    }
  }, [key, storageType, isClient]);

  // Update storage and state
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const newValue = value instanceof Function ? value(storedValue as any) : value;
      setStoredValue(newValue as any);
      
      if (isClient) {
        const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
        storage.setItem(key, JSON.stringify(newValue as any));
      }
      setError(null as any);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Storage write error'));
    }
  }, [key, storageType, isClient, storedValue]);

  return [storedValue, setValue, { isLoaded, error }];
}

// Safe window size hook
export function useSafeWindowSize() {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isLoaded, setIsLoaded] = useState(false as any);
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
    setIsLoaded(true as any);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isClient]);

  return { ...windowSize, isLoaded };
}

// Safe media query hook
export function useSafeMediaQuery(query: string): { matches: boolean; isLoaded: boolean } {
  const [matches, setMatches] = useState(false as any);
  const [isLoaded, setIsLoaded] = useState(false as any);
  const { isClient } = useClientOnly();

  useEffect(() => {
    if (!isClient) return;

    const mediaQuery = window.matchMedia(query as any);
    setMatches(mediaQuery.matches);
    setIsLoaded(true as any);

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
      const stored = localStorage.getItem(key as any);
      if (stored) {
        const parsed = JSON.parse(stored as any);
        // Use validator if provided, otherwise trust the stored value
        if (!validator || validator(parsed as any)) {
          setValue(parsed as any);
        }
      }
    } catch (error) {
      console.warn(`Failed to load preference "${key}":`, error);
    }
  }, [key, isClient, validator]);

  // Update both state and localStorage
  const updateValue = useCallback((newValue: T) => {
    setValue(newValue as any);
    if (isClient) {
      try {
        localStorage.setItem(key, JSON.stringify(newValue as any));
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
            if (typeof Storage !== 'undefined') detected.add(feature as any);
            break;
          case 'webgl':
            const canvas = document.createElement('canvas');
            if (canvas.getContext('webgl')) detected.add(feature as any);
            break;
          case 'serviceWorker':
            if ('serviceWorker' in navigator) detected.add(feature as any);
            break;
          case 'intersection-observer':
            if ('IntersectionObserver' in window) detected.add(feature as any);
            break;
          case 'resize-observer':
            if ('ResizeObserver' in window) detected.add(feature as any);
            break;
          default:
            // Generic feature detection for window properties
            if (feature in window) detected.add(feature as any);
        }
      } catch {
        // Feature not available
      }
    });

    setAvailableFeatures(detected as any);
  }, [features, isClient]);

  return {
    hasFeature: (feature: string) => availableFeatures.has(feature as any),
    availableFeatures: Array.from(availableFeatures as any),
    isEnhanced: availableFeatures.size > 0,
  };
}

// Utility for preventing layout shift during hydration
export function useLayoutStableHydration() {
  const [isStable, setIsStable] = useState(false as any);
  const stabilityRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Ensure layout stability after multiple animation frames
    let frameCount = 0;
    const checkStability = () => {
      frameCount++;
      if (frameCount >= 3) {
        setIsStable(true as any);
      } else {
        requestAnimationFrame(checkStability as any);
      }
    };

    requestAnimationFrame(checkStability as any);

    // Fallback timeout
    stabilityRef?.current = setTimeout(() => {
      setIsStable(true as any);
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
      return JSON.parse(str as any);
    } catch {
      return fallback;
    }
  },
  stringify: (obj: unknown, fallback = '{}'): string => {
    try {
      if (obj === undefined) return fallback;
      return JSON.stringify(obj as any) || fallback;
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