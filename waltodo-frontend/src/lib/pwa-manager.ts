// PWA Manager for WalTodo
interface ToastAPI {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  custom: (component: any, options?: any) => any;
  dismiss: (id: string) => void;
}

// Dynamic import to avoid SSR issues
let toast: ToastAPI | null = null;
if (typeof window !== 'undefined') {
  import('react-hot-toast').then((module) => {
    toast = module.toast;
  });
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAMetrics {
  installPromptShown: number;
  installAccepted: number;
  installDismissed: number;
  notificationPermission: NotificationPermission;
  offlineUsage: number;
  cacheHits: number;
  cacheMisses: number;
}

class PWAManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private metrics: PWAMetrics = {
    installPromptShown: 0,
    installAccepted: 0,
    installDismissed: 0,
    notificationPermission: 'default',
    offlineUsage: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
      this.loadMetrics();
    }
  }

  private async init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('[PWA] Service Worker registered');

        // Check for updates
        this.swRegistration.addEventListener('updatefound', () => {
          const newWorker = this.swRegistration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdatePrompt();
              }
            });
          }
        });

        // Handle controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    }

    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.metrics.installPromptShown++;
      this.saveMetrics();
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed');
      this.deferredPrompt = null;
      if (toast) {
        toast.success('WalTodo installed successfully!');
      }
    });

    // Monitor online/offline status
    window.addEventListener('online', () => {
      if (toast) {
        toast.success('Back online! Syncing data...');
      }
      this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      if (toast) {
        toast.info('You\'re offline. Changes will sync when reconnected.');
      }
      this.metrics.offlineUsage++;
      this.saveMetrics();
    });

    // Request notification permission if needed
    if ('Notification' in window) {
      this.metrics.notificationPermission = Notification.permission;
      this.saveMetrics();
    }
  }

  // Show install prompt
  async showInstallPrompt(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        this.metrics.installAccepted++;
        console.log('[PWA] User accepted install prompt');
      } else {
        this.metrics.installDismissed++;
        console.log('[PWA] User dismissed install prompt');
      }
      
      this.saveMetrics();
      this.deferredPrompt = null;
      return outcome === 'accepted';
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      return false;
    }
  }

  // Check if app can be installed
  canInstall(): boolean {
    return this.deferredPrompt !== null;
  }

  // Check if app is installed
  isInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check for display-mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Check for iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isIOSStandalone = (window.navigator as any).standalone === true;
    
    return isStandalone || isIOSStandalone;
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.log('[PWA] Notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      this.metrics.notificationPermission = permission;
      this.saveMetrics();
      return permission;
    }

    return Notification.permission;
  }

  // Send notification
  async sendNotification(title: string, options?: NotificationOptions) {
    if (Notification.permission !== 'granted') {
      console.log('[PWA] Notifications not granted');
      return;
    }

    if (this.swRegistration) {
      await this.swRegistration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        ...options
      });
    }
  }

  // Cache NFT image
  async cacheNFTImage(url: string) {
    if (this.swRegistration && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_NFT',
        url
      });
    }
  }

  // Clear NFT cache
  async clearNFTCache() {
    if (this.swRegistration && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_NFT_CACHE'
      });
    }
  }

  // Register sync
  async registerSync(tag: string) {
    if (!this.swRegistration || !('sync' in this.swRegistration)) {
      console.log('[PWA] Background sync not supported');
      return;
    }

    try {
      await this.swRegistration.sync.register(tag);
      console.log(`[PWA] Sync registered: ${tag}`);
    } catch (error) {
      console.error('[PWA] Sync registration failed:', error);
    }
  }

  // Register periodic sync
  async registerPeriodicSync(tag: string, minInterval: number) {
    if (!this.swRegistration || !('periodicSync' in this.swRegistration)) {
      console.log('[PWA] Periodic sync not supported');
      return;
    }

    try {
      await (this.swRegistration as any).periodicSync.register(tag, {
        minInterval
      });
      console.log(`[PWA] Periodic sync registered: ${tag}`);
    } catch (error) {
      console.error('[PWA] Periodic sync registration failed:', error);
    }
  }

  // Share content
  async share(data: ShareData): Promise<boolean> {
    if (!navigator.share) {
      console.log('[PWA] Web Share API not supported');
      return false;
    }

    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('[PWA] Share failed:', error);
      }
      return false;
    }
  }

  // Check if can share
  canShare(data?: ShareData): boolean {
    if (!navigator.share) return false;
    if (!data) return true;
    
    // Check if navigator.canShare exists (newer API)
    if ('canShare' in navigator && typeof navigator.canShare === 'function') {
      return navigator.canShare(data);
    }
    
    return true;
  }

  // Get PWA metrics
  getMetrics(): PWAMetrics {
    return { ...this.metrics };
  }

  // Track cache performance
  trackCacheHit() {
    this.metrics.cacheHits++;
    this.saveMetrics();
  }

  trackCacheMiss() {
    this.metrics.cacheMisses++;
    this.saveMetrics();
  }

  // Private methods
  private showUpdatePrompt() {
    if (!toast) {
      console.log('[PWA] Update available but toast not ready');
      return;
    }
    
    // Show a simple toast notification for update
    toast('A new version of WalTodo is available.', {
      duration: Infinity,
      position: 'bottom-center',
      icon: '🔄',
      style: {
        borderRadius: '10px',
        background: '#333',
        color: '#fff',
      },
    });
    
    // Auto-update after 10 seconds
    setTimeout(() => {
      this.updateServiceWorker();
    }, 10000);
  }

  private updateServiceWorker() {
    if (this.swRegistration && this.swRegistration.waiting) {
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  private async syncOfflineData() {
    await this.registerSync('sync-todos');
    await this.registerSync('sync-nfts');
  }

  private loadMetrics() {
    try {
      const stored = localStorage.getItem('pwa-metrics');
      if (stored) {
        this.metrics = { ...this.metrics, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[PWA] Failed to load metrics:', error);
    }
  }

  private saveMetrics() {
    try {
      localStorage.setItem('pwa-metrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.error('[PWA] Failed to save metrics:', error);
    }
  }
}

// Export singleton instance
export const pwaManager = new PWAManager();