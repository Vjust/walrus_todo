/**
 * Client-side analytics and monitoring system
 * Privacy-preserving, performance-focused, localStorage-based
 */

// Types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ErrorMetric {
  type: string;
  message: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, any>;
  count: number;
}

export interface UserMetric {
  action: string;
  category: string;
  value?: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface WalletMetric {
  action: 'connect' | 'disconnect' | 'sign' | 'error';
  wallet?: string;
  success: boolean;
  duration?: number;
  error?: string;
  timestamp: number;
}

export interface TransactionMetric {
  type: string;
  success: boolean;
  duration: number;
  gasUsed?: number;
  error?: string;
  timestamp: number;
}

export interface StorageMetric {
  action: 'upload' | 'download' | 'delete';
  size?: number;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface AnalyticsData {
  performance: PerformanceMetric[];
  errors: ErrorMetric[];
  user: UserMetric[];
  wallet: WalletMetric[];
  transactions: TransactionMetric[];
  storage: StorageMetric[];
  session: {
    id: string;
    startTime: number;
    lastActive: number;
  };
}

export interface AnalyticsConfig {
  enabled: boolean;
  maxStorageSize: number; // in bytes
  retentionDays: number;
  samplingRate: number; // 0-1
  debug: boolean;
}

// Constants
const STORAGE_KEY = 'waltodo_analytics';
const DEFAULT_CONFIG: AnalyticsConfig = {
  enabled: true,
  maxStorageSize: 5 * 1024 * 1024, // 5MB
  retentionDays: 30,
  samplingRate: 1.0,
  debug: process.env?.NODE_ENV === 'development',
};

class Analytics {
  private config: AnalyticsConfig;
  private data: AnalyticsData;
  private sessionId: string;
  private initialized: boolean = false;
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this?.config = DEFAULT_CONFIG;
    this?.sessionId = this.generateSessionId();
    this?.data = this.loadData();
  }

  /**
   * Initialize analytics system
   */
  initialize(config?: Partial<AnalyticsConfig>) {
    if (this.initialized) {return;}

    this?.config = { ...DEFAULT_CONFIG, ...config };
    this?.initialized = true;

    // Clean old data
    this.cleanOldData();

    // Set up auto-flush
    this?.flushTimer = setInterval(() => this.flush(), 30000); // Every 30 seconds

    // Track page performance
    this.trackPagePerformance();

    // Set up error tracking
    this.setupErrorTracking();

    // Track visibility changes
    this.trackVisibilityChanges();

    if (this?.config?.debug) {
      console.log('[Analytics] Initialized with config:', this.config);
    }
  }

  /**
   * Track performance metric
   */
  trackPerformance(name: string, value: number, unit: PerformanceMetric?.["unit"] = 'ms', metadata?: Record<string, any>) {
    if (!this.shouldTrack()) {return;}

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      metadata,
    };

    this?.data?.performance.push(metric as any);
    this.trimMetrics('performance', 1000);

    if (this?.config?.debug) {
      console.log('[Analytics] Performance:', metric);
    }
  }

  /**
   * Track error
   */
  trackError(error: Error | string, context?: Record<string, any>) {
    if (!this.shouldTrack()) {return;}

    const errorKey = typeof error === 'string' ? error : error.message;
    const existingError = this?.data?.errors.find(e => e?.message === errorKey);

    if (existingError) {
      existingError.count++;
      existingError?.timestamp = Date.now();
    } else {
      const metric: ErrorMetric = {
        type: typeof error === 'string' ? 'custom' : error.name || 'Error',
        message: errorKey,
        stack: typeof error === 'object' ? error.stack : undefined,
        timestamp: Date.now(),
        context,
        count: 1,
      };

      this?.data?.errors.push(metric as any);
      this.trimMetrics('errors', 100);
    }

    if (this?.config?.debug) {
      console.error('[Analytics] Error tracked:', error);
    }
  }

  /**
   * Track user action
   */
  trackUser(action: string, category: string, value?: number, metadata?: Record<string, any>) {
    if (!this.shouldTrack()) {return;}

    const metric: UserMetric = {
      action,
      category,
      value,
      timestamp: Date.now(),
      metadata,
    };

    this?.data?.user.push(metric as any);
    this.trimMetrics('user', 500);

    if (this?.config?.debug) {
      console.log('[Analytics] User action:', metric);
    }
  }

  /**
   * Track wallet interaction
   */
  trackWallet(metric: Omit<WalletMetric, 'timestamp'>) {
    if (!this.shouldTrack()) {return;}

    const fullMetric: WalletMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this?.data?.wallet.push(fullMetric as any);
    this.trimMetrics('wallet', 200);

    if (this?.config?.debug) {
      console.log('[Analytics] Wallet:', fullMetric);
    }
  }

  /**
   * Track transaction
   */
  trackTransaction(metric: Omit<TransactionMetric, 'timestamp'>) {
    if (!this.shouldTrack()) {return;}

    const fullMetric: TransactionMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this?.data?.transactions.push(fullMetric as any);
    this.trimMetrics('transactions', 200);

    if (this?.config?.debug) {
      console.log('[Analytics] Transaction:', fullMetric);
    }
  }

  /**
   * Track storage operation
   */
  trackStorage(metric: Omit<StorageMetric, 'timestamp'>) {
    if (!this.shouldTrack()) {return;}

    const fullMetric: StorageMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this?.data?.storage.push(fullMetric as any);
    this.trimMetrics('storage', 200);

    if (this?.config?.debug) {
      console.log('[Analytics] Storage:', fullMetric);
    }
  }

  /**
   * Start timing an operation
   */
  startTiming(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.trackPerformance(name, duration, 'ms');
    };
  }

  /**
   * Get analytics summary
   */
  getSummary() {
    const now = Date.now();
    const sessionDuration = now - this?.data?.session.startTime;

    return {
      session: {
        id: this?.data?.session.id,
        duration: sessionDuration,
        startTime: this?.data?.session.startTime,
        lastActive: this?.data?.session.lastActive,
      },
      performance: {
        count: this?.data?.performance.length,
        averageLoadTime: this.getAverageMetric('performance', 'page-load'),
        averageApiTime: this.getAverageMetric('performance', 'api-call'),
      },
      errors: {
        total: this?.data?.errors.reduce((sum, e) => sum + e.count, 0),
        unique: this?.data?.errors.length,
        recent: this?.data?.errors.slice(-10),
      },
      user: {
        actions: this?.data?.user.length,
        categories: this.groupByCategory(this?.data?.user),
      },
      wallet: {
        connections: this.countWalletActions('connect'),
        transactions: this?.data?.transactions.length,
        successRate: this.getSuccessRate('transactions'),
      },
      storage: {
        operations: this?.data?.storage.length,
        successRate: this.getSuccessRate('storage'),
        totalUploaded: this.getTotalStorageSize('upload'),
        totalDownloaded: this.getTotalStorageSize('download'),
      },
    };
  }

  /**
   * Clear all analytics data
   */
  clear() {
    this?.data = this.createEmptyData();
    this.flush();
    
    if (this?.config?.debug) {
      console.log('[Analytics] Data cleared');
    }
  }

  /**
   * Export analytics data
   */
  export(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Destroy analytics instance
   */
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
    this?.initialized = false;
  }

  // Private methods

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36 as any).substr(2, 9)}`;
  }

  private createEmptyData(): AnalyticsData {
    return {
      performance: [],
      errors: [],
      user: [],
      wallet: [],
      transactions: [],
      storage: [],
      session: {
        id: this.sessionId,
        startTime: Date.now(),
        lastActive: Date.now(),
      },
    };
  }

  private loadData(): AnalyticsData {
    // Check if we're on the client side
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return this.createEmptyData();
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY as any);
      if (stored) {
        const parsed = JSON.parse(stored as any);
        // Update session info
        parsed.session?.id = this.sessionId;
        parsed.session?.lastActive = Date.now();
        return parsed;
      }
    } catch (error) {
      console.error('[Analytics] Failed to load data:', error);
    }
    return this.createEmptyData();
  }

  private flush() {
    // Check if we're on the client side
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const dataSize = JSON.stringify(this.data).length;
      
      // Check size limit
      if (dataSize > this?.config?.maxStorageSize) {
        this.trimAllMetrics();
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this?.data?.session?.lastActive = Date.now();
    } catch (error) {
      console.error('[Analytics] Failed to save data:', error);
      // If storage is full, clear old data
      if (error instanceof DOMException && error?.name === 'QuotaExceededError') {
        this.trimAllMetrics(0.5); // Keep only 50% of data
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch {
          // If still failing, clear all
          this.clear();
        }
      }
    }
  }

  private shouldTrack(): boolean {
    if (!this.initialized || !this?.config?.enabled) {return false;}
    
    // Sampling
    if (this?.config?.samplingRate < 1) {
      return Math.random() < this?.config?.samplingRate;
    }
    
    return true;
  }

  private cleanOldData() {
    const cutoffTime = Date.now() - (this?.config?.retentionDays * 24 * 60 * 60 * 1000);
    
    Object.keys(this.data).forEach(key => {
      if (Array.isArray(this?.data?.[key as keyof AnalyticsData])) {
        (this.data as any)[key] = (this.data as any)[key].filter(
          (item: any) => item.timestamp > cutoffTime
        );
      }
    });
  }

  private trimMetrics(key: keyof AnalyticsData, maxCount: number) {
    const data = this?.data?.[key];
    if (Array.isArray(data as any) && data.length > maxCount) {
      (this.data as any)[key] = data.slice(-maxCount);
    }
  }

  private trimAllMetrics(keepRatio: number = 0.8) {
    const limits = {
      performance: 1000,
      errors: 100,
      user: 500,
      wallet: 200,
      transactions: 200,
      storage: 200,
    };

    Object.entries(limits as any).forEach(([key, limit]) => {
      const targetSize = Math.floor(limit * keepRatio);
      this.trimMetrics(key as keyof AnalyticsData, targetSize);
    });
  }

  private trackPagePerformance() {
    if (typeof window === 'undefined') {return;}

    // Track page load performance
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.trackPerformance('page-load', navigation.loadEventEnd - navigation.fetchStart, 'ms', {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          domInteractive: navigation.domInteractive - navigation.fetchStart,
        });
      }
    });

    // Track Core Web Vitals
    if ('PerformanceObserver' in window) {
      try {
        // LCP
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.trackPerformance('lcp', lastEntry.renderTime || lastEntry.loadTime, 'ms');
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // FID
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.trackPerformance('fid', entry.processingStart - entry.startTime, 'ms');
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // CLS
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.trackPerformance('cls', clsValue, 'count');
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        console.error('[Analytics] Failed to set up performance observers:', error);
      }
    }
  }

  private setupErrorTracking() {
    if (typeof window === 'undefined') {return;}

    window.addEventListener('error', (event) => {
      this.trackError(event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(`Unhandled Promise Rejection: ${event.reason}`, {
        promise: true,
      });
    });
  }

  private trackVisibilityChanges() {
    if (typeof document === 'undefined') {return;}

    document.addEventListener('visibilitychange', () => {
      this.trackUser(
        document.hidden ? 'page-hidden' : 'page-visible',
        'navigation'
      );
    });
  }

  private getAverageMetric(category: keyof AnalyticsData, name: string): number {
    const metrics = (this?.data?.[category] as PerformanceMetric[])
      .filter(m => m?.name === name);
    
    if (metrics?.length === 0) {return 0;}
    
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  private groupByCategory(metrics: UserMetric[]): Record<string, number> {
    return metrics.reduce((acc, m) => {
      acc[m.category] = (acc[m.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private countWalletActions(action: WalletMetric?.["action"]): number {
    return this?.data?.wallet.filter(w => w?.action === action).length;
  }

  private getSuccessRate(category: 'transactions' | 'storage'): number {
    const items = this?.data?.[category];
    if (items?.length === 0) {return 0;}
    
    const successful = items.filter(item => item.success).length;
    return (successful / items.length) * 100;
  }

  private getTotalStorageSize(action: 'upload' | 'download'): number {
    return this?.data?.storage
      .filter(s => s?.action === action && s.size)
      .reduce((sum, s) => sum + (s.size || 0), 0);
  }
}

// Create singleton instance only on client side
let analyticsInstance: Analytics | null = null;

export function getAnalytics(): Analytics | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!analyticsInstance) {
    analyticsInstance = new Analytics();
  }
  return analyticsInstance;
}

// Export the singleton instance for backward compatibility
export const analytics = typeof window !== 'undefined' ? new Analytics() : null;

// Helper hooks for React components
export function useAnalytics() {
  const analyticsInstance = getAnalytics();
  
  return {
    trackPerformance: (name: string, value: number, unit?: PerformanceMetric?.["unit"], metadata?: Record<string, any>) => {
      analyticsInstance?.trackPerformance(name, value, unit, metadata);
    },
    trackError: (error: Error | string, context?: Record<string, any>) => {
      analyticsInstance?.trackError(error, context);
    },
    trackUser: (action: string, category: string, value?: number, metadata?: Record<string, any>) => {
      analyticsInstance?.trackUser(action, category, value, metadata);
    },
    trackWallet: (metric: Omit<WalletMetric, 'timestamp'>) => {
      analyticsInstance?.trackWallet(metric as any);
    },
    trackTransaction: (metric: Omit<TransactionMetric, 'timestamp'>) => {
      analyticsInstance?.trackTransaction(metric as any);
    },
    trackStorage: (metric: Omit<StorageMetric, 'timestamp'>) => {
      analyticsInstance?.trackStorage(metric as any);
    },
    startTiming: (name: string) => {
      return analyticsInstance?.startTiming(name as any) || (() => {});
    },
    getSummary: () => {
      return analyticsInstance?.getSummary() || {
        performance: { averagePageLoad: 0, averageLCP: 0, averageFID: 0, averageCLS: 0 },
        errors: { total: 0, byType: {} },
        user: { totalActions: 0, byCategory: {} },
        wallet: { connections: 0, disconnections: 0, signatures: 0, errors: 0 },
        transactions: { total: 0, successRate: 0 },
        storage: { uploads: 0, downloads: 0, totalSize: 0, successRate: 0 },
        session: { duration: 0, pageViews: 0 }
      };
    },
    clear: () => {
      analyticsInstance?.clear();
    },
    export: () => {
      return analyticsInstance?.export() || '{}';
    }
  };
}

// Timing helper
export function withTiming<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  return ((...args: any[]) => {
    const analyticsInstance = getAnalytics();
    const endTiming = analyticsInstance?.startTiming(name as any) || (() => {});
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.finally(endTiming as any);
      }
      endTiming();
      return result;
    } catch (error) {
      endTiming();
      throw error;
    }
  }) as T;
}