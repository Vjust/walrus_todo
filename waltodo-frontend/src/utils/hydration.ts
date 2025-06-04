'use client';

import { ReactNode, useEffect, useState } from 'react';

/**
 * Hydration utilities for Next.js applications
 * Provides safe hydration patterns and error recovery
 */

/**
 * Hook to detect hydration state
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  
  useEffect(() => {
    setHydrated(true);
  }, []);
  
  return hydrated;
}

/**
 * Hook to handle hydration errors with recovery
 */
export function useHydrationRecovery() {
  const [hasHydrationError, setHasHydrationError] = useState(false);
  
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('Hydration') || event.message.includes('hydration')) {
        console.warn('Hydration error detected, attempting recovery:', event.message);
        setHasHydrationError(true);
        
        // Attempt recovery after a brief delay
        setTimeout(() => {
          setHasHydrationError(false);
        }, 100);
      }
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  return { hasHydrationError };
}

/**
 * Progressive enhancement wrapper
 * Renders minimal content during SSR and enhances on client
 */
export function withProgressiveEnhancement<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  fallback?: ReactNode
) {
  return function EnhancedComponent(props: T) {
    const hydrated = useHydrated();
    
    if (!hydrated) {
      return fallback || null;
    }
    
    return <Component {...props} />;
  };
}

/**
 * Safe hydration boundary that prevents mismatches
 */
export interface HydrationBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  suppressWarning?: boolean;
}

export function HydrationBoundary({ 
  children, 
  fallback, 
  suppressWarning = true 
}: HydrationBoundaryProps) {
  const hydrated = useHydrated();
  const { hasHydrationError } = useHydrationRecovery();
  
  // During SSR or hydration error, show fallback
  if (!hydrated || hasHydrationError) {
    return <div suppressHydrationWarning={suppressWarning}>{fallback}</div>;
  }
  
  return <>{children}</>;
}

/**
 * Deferred hydration for heavy components
 * Delays hydration to improve initial page load
 */
export function useDeferredHydration(delay: number = 0): boolean {
  const [shouldHydrate, setShouldHydrate] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldHydrate(true);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [delay]);
  
  return shouldHydrate;
}

/**
 * Client-only wrapper that ensures content only renders on client
 * Prevents any SSR/SSG rendering to avoid hydration mismatches
 */
export function ClientOnly({ 
  children, 
  fallback = null 
}: { 
  children: ReactNode; 
  fallback?: ReactNode;
}) {
  const hydrated = useHydrated();
  
  if (!hydrated) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Safe state initializer that prevents hydration mismatches
 * Use this for state that depends on client-side values
 */
export function useSafeState<T>(
  clientValue: T | (() => T),
  serverValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(serverValue);
  const hydrated = useHydrated();
  
  useEffect(() => {
    if (hydrated) {
      setState(typeof clientValue === 'function' ? (clientValue as () => T)() : clientValue);
    }
  }, [hydrated, clientValue]);
  
  return [state, setState];
}

/**
 * Hook for progressive hydration of lists
 * Hydrates items incrementally to improve performance
 */
export function useProgressiveHydration<T>(
  items: T[],
  batchSize: number = 10,
  delay: number = 50
): T[] {
  const [hydratedCount, setHydratedCount] = useState(0);
  const hydrated = useHydrated();
  
  useEffect(() => {
    if (!hydrated || hydratedCount >= items.length) return;
    
    const timer = setTimeout(() => {
      setHydratedCount(prev => Math.min(prev + batchSize, items.length));
    }, delay);
    
    return () => clearTimeout(timer);
  }, [hydrated, hydratedCount, items.length, batchSize, delay]);
  
  return hydrated ? items.slice(0, hydratedCount) : [];
}