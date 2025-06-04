'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
// import { useUIStore } from '@/stores/ui-store'; // Disabled to prevent infinite loops

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingConfig {
  /** Minimum loading time in ms to prevent flash */
  minLoadingTime?: number;
  /** Maximum loading time before timeout */
  maxLoadingTime?: number;
  /** Whether to persist success state briefly */
  persistSuccess?: boolean;
  /** Success state duration in ms */
  successDuration?: number;
  /** Whether to automatically reset to idle after success */
  autoReset?: boolean;
  /** Error state duration in ms before auto-reset */
  errorDuration?: number;
}

export interface UseLoadingStatesReturn {
  /** Current loading state */
  state: LoadingState;
  /** Whether currently loading */
  isLoading: boolean;
  /** Whether in success state */
  isSuccess: boolean;
  /** Whether in error state */
  isError: boolean;
  /** Whether in idle state */
  isIdle: boolean;
  /** Set loading state */
  setLoading: () => void;
  /** Set success state */
  setSuccess: () => void;
  /** Set error state */
  setError: () => void;
  /** Reset to idle state */
  reset: () => void;
  /** Execute async operation with automatic state management */
  execute: <T>(operation: () => Promise<T>) => Promise<T>;
  /** Loading progress (0-100) for determinate operations */
  progress: number;
  /** Set loading progress */
  setProgress: (progress: number) => void;
}

const DEFAULT_CONFIG: Required<LoadingConfig> = {
  minLoadingTime: 300,
  maxLoadingTime: 30000,
  persistSuccess: true,
  successDuration: 2000,
  autoReset: true,
  errorDuration: 5000,
};

/**
 * useLoadingStates Hook
 * 
 * A comprehensive hook for managing loading states with intelligent timing,
 * progress tracking, and integration with the global UI store.
 */
export function useLoadingStates(
  /** Unique identifier for this loading state */
  key?: string,
  /** Configuration options */
  config: LoadingConfig = {}
): UseLoadingStatesReturn {
  // TEMPORARILY DISABLED TO PREVENT INFINITE LOOPS
  console.warn('useLoadingStates temporarily disabled to fix infinite loops');
  // Return a simple stable object to prevent crashes
  return useMemo(() => ({
    state: 'idle' as LoadingState,
    isLoading: false,
    isSuccess: false,
    isError: false,
    isIdle: true,
    setLoading: () => {},
    setSuccess: () => {},
    setError: () => {},
    reset: () => {},
    execute: async <T>(operation: () => Promise<T>) => operation(),
    progress: 0,
    setProgress: () => {},
  }), []);
}

/**
 * useMultipleLoadingStates Hook
 * 
 * Manages multiple loading states with individual control
 */
export interface MultipleLoadingStatesReturn {
  /** Get loading state for a specific key */
  getState: (key: string) => LoadingState;
  /** Check if any state is loading */
  isAnyLoading: boolean;
  /** Check if all states are idle */
  isAllIdle: boolean;
  /** Get all loading states */
  getAllStates: () => Record<string, LoadingState>;
  /** Set loading for a specific key */
  setLoading: (key: string) => void;
  /** Set success for a specific key */
  setSuccess: (key: string) => void;
  /** Set error for a specific key */
  setError: (key: string) => void;
  /** Reset a specific key */
  reset: (key: string) => void;
  /** Reset all states */
  resetAll: () => void;
  /** Execute operation with automatic state management */
  execute: <T>(key: string, operation: () => Promise<T>) => Promise<T>;
}

export function useMultipleLoadingStates(
  config: LoadingConfig = {}
): MultipleLoadingStatesReturn {
  const [states, setStates] = useState<Record<string, LoadingState>>({});
  const loadingInstances = useRef<Record<string, UseLoadingStatesReturn>>({});

  const getOrCreateInstance = useCallback((key: string) => {
    if (!loadingInstances.current[key]) {
      // Create a new loading state instance for this key
      loadingInstances.current[key] = {
        state: 'idle',
        isLoading: false,
        isSuccess: false,
        isError: false,
        isIdle: true,
        progress: 0,
        setLoading: () => {
          setStates(prev => ({ ...prev, [key]: 'loading' }));
        },
        setSuccess: () => {
          setStates(prev => ({ ...prev, [key]: 'success' }));
        },
        setError: () => {
          setStates(prev => ({ ...prev, [key]: 'error' }));
        },
        reset: () => {
          setStates(prev => {
            const newStates = { ...prev };
            delete newStates[key];
            return newStates;
          });
        },
        setProgress: () => {},
        execute: async <T>(operation: () => Promise<T>) => {
          loadingInstances.current[key]?.setLoading();
          try {
            const result = await operation();
            loadingInstances.current[key]?.setSuccess();
            return result;
          } catch (error) {
            loadingInstances.current[key]?.setError();
            throw error;
          }
        },
      };
    }
    return loadingInstances.current[key];
  }, [setStates]);

  const getState = useCallback((key: string): LoadingState => {
    return states[key] || 'idle';
  }, [states]);

  const isAnyLoading = Object.values(states).some(state => state === 'loading');
  const isAllIdle = Object.values(states).every(state => state === 'idle');

  const setLoading = useCallback((key: string) => {
    getOrCreateInstance(key).setLoading();
  }, [getOrCreateInstance]);

  const setSuccess = useCallback((key: string) => {
    getOrCreateInstance(key).setSuccess();
  }, [getOrCreateInstance]);

  const setError = useCallback((key: string) => {
    getOrCreateInstance(key).setError();
  }, [getOrCreateInstance]);

  const reset = useCallback((key: string) => {
    getOrCreateInstance(key).reset();
  }, [getOrCreateInstance]);

  const resetAll = useCallback(() => {
    setStates({});
    loadingInstances.current = {};
  }, []);

  const execute = useCallback(async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
    return getOrCreateInstance(key).execute(operation);
  }, [getOrCreateInstance]);

  return {
    getState,
    isAnyLoading,
    isAllIdle,
    getAllStates: () => states,
    setLoading,
    setSuccess,
    setError,
    reset,
    resetAll,
    execute,
  };
}

/**
 * useAsyncOperation Hook
 * 
 * Simplified hook for single async operations with loading states
 */
export function useAsyncOperation<T = any>(
  config: LoadingConfig = {}
) {
  const loadingState = useLoadingStates(undefined, config);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (operation: () => Promise<T>): Promise<T> => {
    setError(null);
    setData(null);

    try {
      const result = await loadingState.execute(operation);
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, [loadingState]);

  const reset = useCallback(() => {
    loadingState.reset();
    setData(null);
    setError(null);
  }, [loadingState]);

  return {
    ...loadingState,
    data,
    error,
    execute,
    reset,
  };
}

export default useLoadingStates;