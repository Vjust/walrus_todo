'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useIsMounted } from './MotionWrapper';

interface PerformanceMetrics {
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  fid: number | null;
  ttfb: number | null;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    cls: null,
    fid: null,
    ttfb: null,
  });
  const mounted = useIsMounted();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Measure Web Vitals
    const measureWebVitals = () => {
      // First Contentful Paint
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        setMetrics(prev => ({ ...prev, fcp: fcpEntry.startTime }));
      }

      // Time to First Byte
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const navEntry = navigationEntries[0];
        setMetrics(prev => ({ ...prev, ttfb: navEntry.responseStart - navEntry.requestStart }));
      }

      // Largest Contentful Paint (requires observer)
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1] as any;
            setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }));
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

          // Cumulative Layout Shift
          const clsObserver = new PerformanceObserver((entryList) => {
            let clsValue = 0;
            for (const entry of entryList.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
            setMetrics(prev => ({ ...prev, cls: clsValue }));
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });

          // First Input Delay
          const fidObserver = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              setMetrics(prev => ({ ...prev, fid: (entry as any).processingStart - entry.startTime }));
            }
          });
          fidObserver.observe({ entryTypes: ['first-input'] });
        } catch (error) {
          console.warn('Performance Observer not supported', error);
        }
      }
    };

    // Measure on load
    if (document.readyState === 'complete') {
      measureWebVitals();
    } else {
      window.addEventListener('load', measureWebVitals);
    }

    return () => {
      window.removeEventListener('load', measureWebVitals);
    };
  }, []);

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const getScoreColor = (metric: string, value: number | null) => {
    if (value === null) return 'text-gray-400';
    
    const thresholds = {
      fcp: [1800, 3000],
      lcp: [2500, 4000],
      cls: [0.1, 0.25],
      fid: [100, 300],
      ttfb: [800, 1800],
    };

    const [good, poor] = thresholds[metric as keyof typeof thresholds] || [0, 0];
    
    if (value <= good) return 'text-green-600';
    if (value <= poor) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <motion.div
      className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-xs z-50"
      initial={mounted ? { opacity: 0, y: 20 } : false}
      animate={mounted ? { opacity: 1, y: 0 } : false}
      transition={mounted ? { delay: 2, duration: 0.5 } : undefined}
    >
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Performance Metrics</h3>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span>FCP:</span>
          <span className={getScoreColor('fcp', metrics.fcp)}>
            {metrics.fcp ? `${Math.round(metrics.fcp)}ms` : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>LCP:</span>
          <span className={getScoreColor('lcp', metrics.lcp)}>
            {metrics.lcp ? `${Math.round(metrics.lcp)}ms` : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>CLS:</span>
          <span className={getScoreColor('cls', metrics.cls)}>
            {metrics.cls !== null ? metrics.cls.toFixed(3) : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>FID:</span>
          <span className={getScoreColor('fid', metrics.fid)}>
            {metrics.fid ? `${Math.round(metrics.fid)}ms` : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>TTFB:</span>
          <span className={getScoreColor('ttfb', metrics.ttfb)}>
            {metrics.ttfb ? `${Math.round(metrics.ttfb)}ms` : '-'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// Lazy loading utility
export function useLazyLoading(threshold = 0.1) {
  const [isInView, setIsInView] = useState(false);
  const [element, setElement] = useState<Element | null>(null);

  useEffect(() => {
    if (!element || typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '50px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [element, threshold]);

  return { isInView, setRef: setElement };
}

// Image preloader
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

// Resource hints
export function addResourceHints(urls: string[]) {
  if (typeof window === 'undefined') return;

  urls.forEach(url => {
    // Add preload hint
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = 'fetch';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

// Bundle analyzer utility for development
export function analyzeBundleSize() {
  if (process.env.NODE_ENV !== 'development') return;

  const analyzeChunks = () => {
    const scripts = Array.from(document.scripts);
    const chunks = scripts.filter(script => 
      script.src && script.src.includes('/_next/static/chunks/')
    );

    console.group('📦 Bundle Analysis');
    chunks.forEach(chunk => {
      const url = new URL(chunk.src);
      const chunkName = url.pathname.split('/').pop();
      console.log(`📄 ${chunkName}`);
    });
    console.groupEnd();
  };

  if (document.readyState === 'complete') {
    analyzeChunks();
  } else {
    window.addEventListener('load', analyzeChunks);
  }
}

export default PerformanceMonitor;