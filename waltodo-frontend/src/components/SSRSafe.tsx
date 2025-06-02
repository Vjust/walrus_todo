'use client';

import React, { 
  useState, 
  useEffect, 
  ReactNode, 
  ComponentType, 
  ReactElement 
} from 'react';

// TypeScript types for SSR-safe patterns
export interface SSRSafeProps {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}

export interface NoSSRProps extends SSRSafeProps {
  defer?: boolean;
}

export interface ConditionalRenderProps extends SSRSafeProps {
  condition: () => boolean;
  serverFallback?: ReactNode;
}

export interface SafeBrowserAPIProps {
  onMount?: () => void;
  onUnmount?: () => void;
}

export type MountingState = 'server' | 'mounting' | 'mounted';

// Custom hook for safe mounting detection
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  return mounted;
}

// Custom hook for mounting state with more granular control
export function useMountingState(): MountingState {
  const [state, setState] = useState<MountingState>('server');

  useEffect(() => {
    setState('mounting');
    const timer = setTimeout(() => setState('mounted'), 0);
    return () => {
      clearTimeout(timer);
      setState('server');
    };
  }, []);

  return state;
}

// Safe browser API access hook
export function useSafeBrowserAPI<T>(
  apiCall: () => T,
  fallback: T,
  deps: React.DependencyList = []
): { data: T; isLoaded: boolean; error: Error | null } {
  const [data, setData] = useState<T>(fallback);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useMounted();

  useEffect(() => {
    if (!mounted) return;

    try {
      const result = apiCall();
      setData(result);
      setIsLoaded(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setData(fallback);
      setIsLoaded(false);
    }
  }, [mounted, fallback, apiCall, deps]);

  return { data, isLoaded, error };
}

// Main SSR-safe component wrapper
export function SSRSafeComponent({ 
  children, 
  fallback = null, 
  className 
}: SSRSafeProps): ReactElement {
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className={className} suppressHydrationWarning>
        {fallback}
      </div>
    );
  }

  return (
    <div className={className}>
      {children}
    </div>
  );
}

// Component for client-only content
export function NoSSR({ 
  children, 
  fallback = null, 
  defer = false,
  className 
}: NoSSRProps): ReactElement {
  const mountingState = useMountingState();

  // If defer is true, wait for full mount
  const shouldRender = defer ? mountingState === 'mounted' : mountingState !== 'server';

  if (!shouldRender) {
    return (
      <div className={className} suppressHydrationWarning>
        {fallback}
      </div>
    );
  }

  return (
    <div className={className}>
      {children}
    </div>
  );
}

// Component for server-only content
export function SSROnly({ 
  children, 
  fallback = null, 
  className 
}: SSRSafeProps): ReactElement {
  const mounted = useMounted();

  if (mounted) {
    return (
      <div className={className}>
        {fallback}
      </div>
    );
  }

  return (
    <div className={className} suppressHydrationWarning>
      {children}
    </div>
  );
}

// Conditional render based on mounting state and custom condition
export function ConditionalRender({ 
  children, 
  condition, 
  fallback = null, 
  serverFallback = null,
  className 
}: ConditionalRenderProps): ReactElement {
  const mounted = useMounted();
  const [conditionMet, setConditionMet] = useState(false);

  useEffect(() => {
    if (mounted) {
      try {
        setConditionMet(condition());
      } catch {
        setConditionMet(false);
      }
    }
  }, [mounted, condition]);

  if (!mounted) {
    return (
      <div className={className} suppressHydrationWarning>
        {serverFallback || fallback}
      </div>
    );
  }

  if (!conditionMet) {
    return (
      <div className={className}>
        {fallback}
      </div>
    );
  }

  return (
    <div className={className}>
      {children}
    </div>
  );
}

// HOC for making any component SSR-safe
export function withSSRSafety<P extends object>(
  Component: ComponentType<P>,
  fallback?: ReactNode
) {
  const SSRSafeWrapper = (props: P) => {
    const mounted = useMounted();

    if (!mounted) {
      return <div suppressHydrationWarning>{fallback}</div>;
    }

    return <Component {...props} />;
  };

  SSRSafeWrapper.displayName = `SSRSafe(${Component.displayName || Component.name})`;
  return SSRSafeWrapper;
}

// Safe localStorage hook
export function useSafeLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    if (!mounted) return;

    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
      setIsLoaded(true);
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      setIsLoaded(true);
    }
  }, [key, mounted]);

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (mounted && typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, isLoaded];
}

// Safe sessionStorage hook
export function useSafeSessionStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    if (!mounted) return;

    try {
      const item = window.sessionStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
      setIsLoaded(true);
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error);
      setIsLoaded(true);
    }
  }, [key, mounted]);

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (mounted && typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.warn(`Error setting sessionStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, isLoaded];
}

// Safe window size hook
export function useSafeWindowSize(): { 
  width: number; 
  height: number; 
  isLoaded: boolean 
} {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    if (!mounted) return;

    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    handleResize();
    setIsLoaded(true);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mounted]);

  return { ...windowSize, isLoaded };
}

// Safe media query hook
export function useSafeMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query, mounted]);

  return matches;
}

// Safe feature detection hook
export function useSafeFeatureDetection(
  feature: string,
  detector: () => boolean
): boolean {
  const [hasFeature, setHasFeature] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    if (!mounted) return;

    try {
      setHasFeature(detector());
    } catch {
      setHasFeature(false);
    }
  }, [mounted, detector]);

  return hasFeature;
}

// Loading skeleton component for SSR fallbacks
export function LoadingSkeleton({ 
  className = '', 
  height = '20px',
  width = '100%' 
}: {
  className?: string;
  height?: string;
  width?: string;
}): ReactElement {
  return (
    <div 
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      style={{ height, width }}
      aria-label="Loading..."
    />
  );
}

// Error boundary for SSR-safe components
export class SSRSafeErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('SSR-safe component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong.</div>;
    }

    return this.props.children;
  }
}

// Utility for safe JSON parsing with fallback
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// Utility for safe date formatting
export function safeDateFormat(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    return dateObj.toLocaleDateString(undefined, options);
  } catch {
    return 'Invalid Date';
  }
}

// Utility for safe number formatting
export function safeNumberFormat(
  num: number,
  options?: Intl.NumberFormatOptions
): string {
  try {
    if (typeof num !== 'number' || isNaN(num)) {
      return '0';
    }
    return num.toLocaleString(undefined, options);
  } catch {
    return num.toString();
  }
}

// Export all components and hooks
const SSRSafeExports = {
  SSRSafeComponent,
  NoSSR,
  SSROnly,
  ConditionalRender,
  withSSRSafety,
  LoadingSkeleton,
  SSRSafeErrorBoundary,
  useMounted,
  useMountingState,
  useSafeBrowserAPI,
  useSafeLocalStorage,
  useSafeSessionStorage,
  useSafeWindowSize,
  useSafeMediaQuery,
  useSafeFeatureDetection,
  safeJsonParse,
  safeDateFormat,
  safeNumberFormat,
};

export default SSRSafeExports;