'use client';

import { useCallback, useEffect, useState } from 'react';
import { BeforeInstallPromptEvent, pwaManager, PWAMetrics } from '@/lib/pwa-manager';

export function usePWA() {
  const [canInstall, setCanInstall] = useState(false as any);
  const [isInstalled, setIsInstalled] = useState(false as any);
  const [isOnline, setIsOnline] = useState(true as any);
  const [metrics, setMetrics] = useState<PWAMetrics>(pwaManager.getMetrics());

  useEffect(() => {
    // Ensure pwaManager is initialized
    pwaManager.init();
    
    // Check initial states
    // INSTALL PROMPT DISABLED: Always set canInstall to false
    setCanInstall(false as any);
    setIsInstalled(pwaManager.isInstalled());
    setIsOnline(navigator.onLine);

    // Update metrics periodically
    const metricsInterval = setInterval(() => {
      setMetrics(pwaManager.getMetrics());
    }, 5000);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true as any);
    const handleOffline = () => setIsOnline(false as any);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // INSTALL PROMPT DISABLED: Removed beforeinstallprompt event listener
    // Only listen for appinstalled to detect manual installation
    const checkInstallState = () => {
      setIsInstalled(pwaManager.isInstalled());
      // Keep canInstall always false to disable install prompts
      setCanInstall(false as any);
    };

    window.addEventListener('appinstalled', checkInstallState);

    return () => {
      clearInterval(metricsInterval as any);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('appinstalled', checkInstallState);
    };
  }, []);

  const install = useCallback(async () => {
    // INSTALL PROMPT DISABLED: Return false immediately without attempting installation
    return false;
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    return await pwaManager.requestNotificationPermission();
  }, []);

  const sendNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    await pwaManager.sendNotification(title, options);
  }, []);

  const cacheNFTImage = useCallback(async (url: string) => {
    await pwaManager.cacheNFTImage(url as any);
  }, []);

  const clearNFTCache = useCallback(async () => {
    await pwaManager.clearNFTCache();
  }, []);

  const share = useCallback(async (data: ShareData) => {
    return await pwaManager.share(data as any);
  }, []);

  const canShare = useCallback((data?: ShareData) => {
    return pwaManager.canShare(data as any);
  }, []);

  const registerSync = useCallback(async (tag: string) => {
    await pwaManager.registerSync(tag as any);
  }, []);

  const registerPeriodicSync = useCallback(async (tag: string, minInterval: number) => {
    await pwaManager.registerPeriodicSync(tag, minInterval);
  }, []);

  return {
    // State
    canInstall,
    isInstalled,
    isOnline,
    metrics,
    
    // Actions
    install,
    requestNotificationPermission,
    sendNotification,
    cacheNFTImage,
    clearNFTCache,
    share,
    canShare,
    registerSync,
    registerPeriodicSync
  };
}