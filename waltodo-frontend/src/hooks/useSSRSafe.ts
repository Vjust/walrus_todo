/**
 * SSR-Safe Hooks
 * 
 * Collection of hooks that provide safe server-side rendering patterns
 * and prevent hydration mismatches.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

// Re-export core utilities for convenience
export { 
  useSSRState, 
  useProgressiveMount, 
  useClientOnly,
  useSafeBrowserFeature,
  useSafeStorage,
  useSafeWindowSize,
  useSafeMediaQuery,
  useHydrationSafePreferences,
  useProgressiveEnhancement,
  useLayoutStableHydration 
} from '@/lib/ssr-utils';

/**
 * Enhanced mounted hook with stability guarantees
 */
export function useSSRSafeMounted(options: {
  minMountTime?: number;
  stabilityFrames?: number;
} = {}) {
  const { minMountTime = 0, stabilityFrames = 2 } = options;
  const [mounted, setMounted] = useState(false);
  const [stable, setStable] = useState(false);
  const mountTimeRef = useRef<number>();

  useEffect(() => {
    mountTimeRef.current = Date.now();
    
    // Handle minimum mount time
    const mountTimer = minMountTime > 0 
      ? setTimeout(() => setMounted(true), minMountTime)
      : (setMounted(true), null);

    return () => {
      if (mountTimer) clearTimeout(mountTimer);
    };
  }, [minMountTime]);

  // Separate effect for stability to prevent infinite loop
  useEffect(() => {
    if (!mounted) return;
    
    let frameCount = 0;
    const checkStability = () => {
      frameCount++;
      if (frameCount >= stabilityFrames) {
        setStable(true);
      } else {
        requestAnimationFrame(checkStability);
      }
    };
    
    requestAnimationFrame(checkStability);
  }, [mounted, stabilityFrames]);

  return {
    mounted,
    stable,
    mountTime: mountTimeRef.current ? Date.now() - mountTimeRef.current : 0,
    isReady: mounted && stable,
  };
}

/**
 * Hook for safely rendering client-only components with proper fallbacks
 */
export function useSSRSafeComponent<T = Record<string, unknown>>(
  component: () => T,
  fallback: T,
  deps: React.DependencyList = []
) {
  const [result, setResult] = useState<T>(fallback);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { mounted } = useSSRSafeMounted();

  useEffect(() => {
    if (!mounted) return;

    try {
      const componentResult = component();
      setResult(componentResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Component rendering error'));
      setResult(fallback);
    } finally {
      setIsLoaded(true);
    }
  }, [mounted, component, fallback, ...deps]);

  return { result, isLoaded, error, isReady: mounted && isLoaded };
}

/**
 * Hook for managing theme state without hydration issues
 */
export function useSSRSafeTheme(defaultTheme: 'light' | 'dark' = 'light') {
  const [theme, setTheme] = useState<'light' | 'dark'>(defaultTheme);
  const [isLoaded, setIsLoaded] = useState(false);
  const { mounted } = useSSRSafeMounted();

  useEffect(() => {
    if (!mounted) return;

    // Check system preference first
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' 
      : 'light';

    // Check localStorage for saved preference
    try {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
      setTheme(savedTheme || systemTheme);
    } catch {
      setTheme(systemTheme);
    }

    setIsLoaded(true);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if no saved preference exists
      try {
        const savedTheme = localStorage.getItem('theme');
        if (!savedTheme) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      } catch {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mounted]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    if (mounted) {
      try {
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
      } catch (error) {
        console.warn('Failed to save theme preference:', error);
      }
    }
  }, [theme, mounted]);

  // Apply theme to document
  useEffect(() => {
    if (mounted && isLoaded) {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme, mounted, isLoaded]);

  return {
    theme,
    toggleTheme,
    isLoaded,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };
}

/**
 * Hook for safely managing wallet state without hydration issues
 */
export function useSSRSafeWallet() {
  const [isWalletAvailable, setIsWalletAvailable] = useState(false);
  const [walletType, setWalletType] = useState<string | null>(null);
  const { mounted } = useSSRSafeMounted();

  useEffect(() => {
    if (!mounted) return;

    // Check for wallet availability
    const checkWalletAvailability = () => {
      const hasMetaMask = typeof window.ethereum !== 'undefined';
      const hasSuiWallet = typeof window.suiWallet !== 'undefined';
      
      setIsWalletAvailable(hasMetaMask || hasSuiWallet);
      
      if (hasMetaMask) setWalletType('metamask');
      else if (hasSuiWallet) setWalletType('sui');
      else setWalletType(null);
    };

    checkWalletAvailability();

    // Listen for wallet installation
    const handleWalletInstall = () => checkWalletAvailability();
    window.addEventListener('ethereum#initialized', handleWalletInstall);
    
    return () => {
      window.removeEventListener('ethereum#initialized', handleWalletInstall);
    };
  }, [mounted]);

  return {
    isWalletAvailable,
    walletType,
    isLoaded: mounted,
    hasMetaMask: walletType === 'metamask',
    hasSuiWallet: walletType === 'sui',
  };
}

/**
 * Hook for preventing layout shift with dynamic content
 */
export function useSSRSafeLayout(options: {
  measurementDelay?: number;
  preserveHeight?: boolean;
} = {}) {
  const { measurementDelay = 100, preserveHeight = false } = options;
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isStable, setIsStable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { mounted, stable } = useSSRSafeMounted();

  useEffect(() => {
    if (!mounted || !stable || !containerRef.current) return;

    const measureDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
        setIsStable(true);
      }
    };

    // Delay measurement to allow content to render
    const timer = setTimeout(measureDimensions, measurementDelay);
    return () => clearTimeout(timer);
  }, [mounted, stable, measurementDelay]);

  const containerProps = {
    ref: containerRef,
    style: preserveHeight && isStable ? { minHeight: dimensions.height } : undefined,
  };

  return {
    containerProps,
    dimensions,
    isStable,
    isReady: mounted && stable && isStable,
  };
}

/**
 * Hook for progressive image loading without layout shift
 */
export function useSSRSafeImage(src: string, options: {
  fallbackSrc?: string;
  lowQualitySrc?: string;
  preserveAspectRatio?: boolean;
} = {}) {
  const { fallbackSrc, lowQualitySrc, preserveAspectRatio = true } = options;
  const [loadedSrc, setLoadedSrc] = useState<string>(lowQualitySrc || fallbackSrc || '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { mounted } = useSSRSafeMounted();

  useEffect(() => {
    if (!mounted || !src) return;

    const img = new Image();
    
    img.onload = () => {
      setLoadedSrc(src);
      setIsLoading(false);
      setError(null);
      if (preserveAspectRatio) {
        setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    
    img.onerror = () => {
      setError('Failed to load image');
      if (fallbackSrc) {
        setLoadedSrc(fallbackSrc);
      }
      setIsLoading(false);
    };
    
    img.src = src;
  }, [src, fallbackSrc, preserveAspectRatio, mounted]);

  const aspectRatio = dimensions.width && dimensions.height 
    ? dimensions.width / dimensions.height 
    : undefined;

  return {
    src: loadedSrc,
    isLoading,
    error,
    dimensions,
    aspectRatio,
    style: preserveAspectRatio && aspectRatio 
      ? { aspectRatio: aspectRatio.toString() } 
      : undefined,
  };
}

/**
 * Hook for managing form state without hydration issues
 */
export function useSSRSafeForm<T extends Record<string, any>>(
  initialState: T,
  storageKey?: string
) {
  const [formState, setFormState] = useState<T>(initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const { mounted } = useSSRSafeMounted();

  // Load from storage on mount
  useEffect(() => {
    if (!mounted || !storageKey) {
      setIsLoaded(true);
      return;
    }

    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsedState = JSON.parse(stored);
        setFormState({ ...initialState, ...parsedState });
      }
    } catch (error) {
      console.warn('Failed to load form state:', error);
    }
    
    setIsLoaded(true);
  }, [mounted, storageKey, initialState]);

  // Save to storage on changes
  useEffect(() => {
    if (!mounted || !storageKey || !isLoaded) return;

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(formState));
    } catch (error) {
      console.warn('Failed to save form state:', error);
    }
  }, [formState, storageKey, mounted, isLoaded]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(initialState);
    if (mounted && storageKey) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch (error) {
        console.warn('Failed to clear form state:', error);
      }
    }
  }, [initialState, mounted, storageKey]);

  return {
    formState,
    updateField,
    resetForm,
    isLoaded,
    setFormState,
  };
}

// Export all hooks for convenience
export default {
  useSSRSafeMounted,
  useSSRSafeComponent,
  useSSRSafeTheme,
  useSSRSafeWallet,
  useSSRSafeLayout,
  useSSRSafeImage,
  useSSRSafeForm,
};