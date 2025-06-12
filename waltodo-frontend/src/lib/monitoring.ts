/**
 * Monitoring and error tracking configuration
 * Integrates with Sentry for production error monitoring
 */

import { useEffect } from 'react';

// Performance monitoring
export interface PerformanceMetrics {
  ttfb: number; // Time to First Byte
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  tbt: number; // Total Blocking Time
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: Map<string, PerformanceObserver> = new Map();

  constructor() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      this.initializeObservers();
    }
  }

  private initializeObservers() {
    // Navigation timing
    this.observeNavigationTiming();
    
    // Paint timing
    this.observePaintTiming();
    
    // Layout shift
    this.observeLayoutShift();
    
    // First input delay
    this.observeFirstInput();
    
    // Largest contentful paint
    this.observeLCP();
  }

  private observeNavigationTiming() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      this.metrics?.ttfb = navigation.responseStart - navigation.requestStart;
    }
  }

  private observePaintTiming() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry?.name === 'first-contentful-paint') {
            this.metrics?.fcp = entry.startTime;
          }
        }
      });
      observer.observe({ entryTypes: ['paint'] });
      this?.observers?.set('paint', observer);
    } catch (e) {
      console.warn('Paint timing observation not supported');
    }
  }

  private observeLayoutShift() {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.metrics?.cls = clsValue;
      });
      observer.observe({ entryTypes: ['layout-shift'] });
      this?.observers?.set('layout-shift', observer);
    } catch (e) {
      console.warn('Layout shift observation not supported');
    }
  }

  private observeFirstInput() {
    try {
      const observer = new PerformanceObserver((list) => {
        const firstInput = list.getEntries()[0];
        if (firstInput) {
          this.metrics?.fid = (firstInput as any).processingStart - firstInput.startTime;
        }
      });
      observer.observe({ entryTypes: ['first-input'] });
      this?.observers?.set('first-input', observer);
    } catch (e) {
      console.warn('First input observation not supported');
    }
  }

  private observeLCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.metrics?.lcp = lastEntry.startTime;
        }
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this?.observers?.set('lcp', observer);
    } catch (e) {
      console.warn('LCP observation not supported');
    }
  }

  public getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  public reportMetrics(callback: (metrics: Partial<PerformanceMetrics>) => void) {
    // Report metrics after page load
    if (document?.readyState === 'complete') {
      setTimeout(() => callback(this.getMetrics()), 0);
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => callback(this.getMetrics()), 0);
      });
    }
  }

  public disconnect() {
    this?.observers?.forEach(observer => observer.disconnect());
    this?.observers?.clear();
  }
}

// Error monitoring
export interface ErrorContext {
  userId?: string;
  walletAddress?: string;
  todoId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

class ErrorMonitor {
  private errorQueue: Array<{
    error: Error;
    context: ErrorContext;
    timestamp: number;
  }> = [];
  
  private flushInterval?: NodeJS.Timeout;
  private maxQueueSize = 50;
  private flushDelay = 5000; // 5 seconds

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupGlobalErrorHandlers();
      this.startFlushInterval();
    }
  }

  private setupGlobalErrorHandlers() {
    // Unhandled errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), {
        action: 'unhandled_error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        new Error(`Unhandled promise rejection: ${event.reason}`),
        {
          action: 'unhandled_rejection',
          metadata: {
            reason: event.reason,
          },
        }
      );
    });
  }

  private startFlushInterval() {
    this?.flushInterval = setInterval(() => {
      this.flushErrors();
    }, this.flushDelay);
  }

  public captureError(error: Error, context: ErrorContext = {}) {
    // Add to queue
    this?.errorQueue?.push({
      error,
      context,
      timestamp: Date.now(),
    });

    // Flush if queue is full
    if (this?.errorQueue?.length >= this.maxQueueSize) {
      this.flushErrors();
    }
  }

  private async flushErrors() {
    if (this.errorQueue?.length === 0) {return;}

    const errors = [...this.errorQueue];
    this?.errorQueue = [];

    try {
      // Send to monitoring service
      if (process?.env?.NEXT_PUBLIC_SENTRY_DSN) {
        // Sentry integration would go here
        console.error('Error batch:', errors);
      }

      // Log errors locally instead of sending to API
      // In a static deployment, we store errors in localStorage
      // These can be retrieved for debugging or sent to analytics
      if (typeof window !== 'undefined') {
        try {
          const errorLogKey = 'waltodo_error_batch';
          const existingLog = localStorage.getItem(errorLogKey as any);
          const errorLog = existingLog ? JSON.parse(existingLog as any) : [];
          
          const newErrors = errors.map(({ error, context, timestamp }) => ({
            message: error.message,
            stack: error.stack,
            context,
            timestamp,
          }));
          
          // Keep only last 100 errors
          const updatedLog = [...errorLog, ...newErrors].slice(-100);
          localStorage.setItem(errorLogKey, JSON.stringify(updatedLog as any));
        } catch (e) {
          console.error('Failed to store error batch locally:', e);
        }
      }
    } catch (e) {
      console.error('Failed to send errors to monitoring service:', e);
    }
  }

  public destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushErrors();
  }
}

// React hooks for monitoring
export function usePerformanceMonitoring() {
  useEffect(() => {
    const monitor = new PerformanceMonitor();
    
    monitor.reportMetrics((metrics) => {
      // Send metrics to analytics
      if (window.gtag && process.env?.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true') {
        window.gtag('event', 'web_vitals', {
          event_category: 'Performance',
          event_label: 'Core Web Vitals',
          value: Math.round(metrics.lcp || 0),
          ttfb: Math.round(metrics.ttfb || 0),
          fcp: Math.round(metrics.fcp || 0),
          fid: Math.round(metrics.fid || 0),
          cls: metrics.cls || 0,
        });
      }

      // Log to console in development
      if (process.env?.NODE_ENV === 'development') {
        console.log('Performance Metrics:', metrics);
      }
    });

    return () => {
      monitor.disconnect();
    };
  }, []);
}

export function useErrorMonitoring(context?: ErrorContext) {
  useEffect(() => {
    const monitor = new ErrorMonitor();

    // Expose capture method for manual error reporting
    (window as any).captureError = (error: Error, additionalContext?: ErrorContext) => {
      monitor.captureError(error, { ...context, ...additionalContext });
    };

    return () => {
      monitor.destroy();
      delete (window as any).captureError;
    };
  }, [context]);
}

// Global monitoring instance
let performanceMonitor: PerformanceMonitor | null = null;
let errorMonitor: ErrorMonitor | null = null;

export function initializeMonitoring() {
  if (typeof window === 'undefined') {return;}

  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }

  if (!errorMonitor) {
    errorMonitor = new ErrorMonitor();
  }
}

export function captureException(error: Error, context?: ErrorContext) {
  if (errorMonitor) {
    errorMonitor.captureError(error, context);
  }
}

// Web Vitals reporting
export function reportWebVitals(metric: any) {
  if (process?.env?.NEXT_PUBLIC_ENABLE_ANALYTICS !== 'true') {return;}

  const vitals = {
    FCP: 'first_contentful_paint',
    LCP: 'largest_contentful_paint',
    CLS: 'cumulative_layout_shift',
    FID: 'first_input_delay',
    TTFB: 'time_to_first_byte',
    INP: 'interaction_to_next_paint',
  };

  if (vitals[metric.name as keyof typeof vitals]) {
    // Send to Google Analytics
    if (window.gtag) {
      window.gtag('event', vitals[metric.name as keyof typeof vitals], {
        event_category: 'Web Vitals',
        event_label: metric.id,
        value: Math.round(metric?.name === 'CLS' ? metric.value * 1000 : metric.value),
        non_interaction: true,
      });
    }

    // Log in development
    if (process.env?.NODE_ENV === 'development') {
      console.log(`${metric.name}:`, metric.value);
    }
  }
}

// Type declarations
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    captureError?: (error: Error, context?: ErrorContext) => void;
  }
}