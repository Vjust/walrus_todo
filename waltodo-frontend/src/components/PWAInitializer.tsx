'use client';

import { useEffect } from 'react';
import { pwaManager } from '@/lib/pwa-manager';

export function PWAInitializer() {
  useEffect(() => {
    // Initialize PWA manager
    pwaManager.init();
  }, []);

  return null;
}