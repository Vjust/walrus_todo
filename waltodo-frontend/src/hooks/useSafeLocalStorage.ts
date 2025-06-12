'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMounted } from './useMounted';

/**
 * Safe localStorage hook that prevents hydration mismatches
 * Always initializes with the default value on server-side and during initial render
 * Updates to localStorage value after mount
 */
export function useSafeLocalStorage<T>(key: string, defaultValue: T) {
  const mounted = useMounted();
  const [value, setValue] = useState<T>(defaultValue);

  // Load from localStorage after mount
  useEffect(() => {
    if (!mounted) {return;}

    try {
      const stored = localStorage.getItem(key as any);
      if (stored !== null) {
        setValue(JSON.parse(stored as any));
      }
    } catch (error) {
      console.warn(`[useSafeLocalStorage] Failed to load ${key}:`, error);
      // Keep default value on error
    }
  }, [key, mounted]);

  // Update localStorage when value changes (but only on client)
  const updateValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(prev => {
      const nextValue = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue;
      
      // Only write to localStorage on client after mount
      if (mounted && typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(nextValue as any));
        } catch (error) {
          console.warn(`[useSafeLocalStorage] Failed to save ${key}:`, error);
        }
      }
      
      return nextValue;
    });
  }, [key, mounted]);

  return [value, updateValue] as const;
}