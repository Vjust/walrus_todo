'use client';

import { useEffect, useState } from 'react';
import { useMounted } from './useMounted';

interface BrowserInfo {
  userAgent: string;
  isOnline: boolean;
  language: string;
  platform: string;
  cookieEnabled: boolean;
}

/**
 * Safe browser detection hook that prevents hydration mismatches
 * Always returns safe defaults on server-side, then updates on client
 */
export function useSafeBrowser() {
  const mounted = useMounted();
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo>({
    userAgent: '',
    isOnline: true,
    language: 'en',
    platform: '',
    cookieEnabled: false
  });

  // Initialize browser info after mount
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    try {
      setBrowserInfo({
        userAgent: navigator.userAgent || '',
        isOnline: navigator.onLine ?? true,
        language: navigator.language || 'en',
        platform: navigator.platform || '',
        cookieEnabled: navigator.cookieEnabled ?? false
      });

      // Listen for online/offline changes
      const handleOnline = () => setBrowserInfo(prev => ({ ...prev, isOnline: true }));
      const handleOffline = () => setBrowserInfo(prev => ({ ...prev, isOnline: false }));

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } catch (error) {
      console.warn('[useSafeBrowser] Failed to initialize browser info:', error);
    }
  }, [mounted]);

  return {
    ...browserInfo,
    isLoaded: mounted
  };
}