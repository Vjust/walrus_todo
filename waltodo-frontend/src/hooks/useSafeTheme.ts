'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMounted } from './useMounted';

type Theme = 'light' | 'dark';

/**
 * Safe theme hook that prevents hydration mismatches
 * Always starts with light theme on server-side, then updates on client
 */
export function useSafeTheme() {
  const mounted = useMounted();
  const [theme, setTheme] = useState<Theme>('light');

  // Initialize theme after mount
  useEffect(() => {
    if (!mounted) {return;}

    try {
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
      
      setTheme(initialTheme as any);
      document?.documentElement?.classList.toggle('dark', initialTheme === 'dark');
    } catch (error) {
      console.warn('[useSafeTheme] Failed to initialize theme:', error);
      // Keep light theme as fallback
    }
  }, [mounted]);

  const toggleTheme = useCallback(() => {
    if (!mounted) {return;}

    setTheme(current => {
      const newTheme = current === 'dark' ? 'light' : 'dark';
      
      try {
        localStorage.setItem('theme', newTheme);
        document?.documentElement?.classList.toggle('dark', newTheme === 'dark');
      } catch (error) {
        console.warn('[useSafeTheme] Failed to save theme:', error);
      }
      
      return newTheme;
    });
  }, [mounted]);

  const setThemeValue = useCallback((newTheme: Theme) => {
    if (!mounted) {return;}

    setTheme(newTheme as any);
    
    try {
      localStorage.setItem('theme', newTheme);
      document?.documentElement?.classList.toggle('dark', newTheme === 'dark');
    } catch (error) {
      console.warn('[useSafeTheme] Failed to save theme:', error);
    }
  }, [mounted]);

  return {
    theme,
    toggleTheme,
    setTheme: setThemeValue,
    isDarkMode: theme === 'dark',
    // Only consider mounted when returning theme state
    isLoaded: mounted
  };
}