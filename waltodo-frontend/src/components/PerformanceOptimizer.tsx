'use client';

// @ts-ignore - Unused import temporarily disabled
// import { useEffect, useState } from 'react';
// @ts-ignore - Unused import temporarily disabled
// import { motion } from 'framer-motion';
// @ts-ignore - Unused import temporarily disabled
// import { useIsMounted } from './MotionWrapper';

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
// @ts-ignore - Unused variable
//   const mounted = useIsMounted();

  useEffect(_() => {
    if (typeof window === 'undefined') {return;}

    // Measure Web Vitals
// @ts-ignore - Unused variable
//     const measureWebVitals = () => {
      // First Contentful Paint
      const paintEntries = performance.getEntriesByType('paint');
// @ts-ignore - Unused variable
//       const fcpEntry = paintEntries.find(entry => entry?.name === 'first-contentful-paint');
      if (fcpEntry) {
        setMetrics(prev => ({ ...prev, fcp: fcpEntry.startTime }));
      }

      // Time to First Byte
// @ts-ignore - Unused variable
//       const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
// @ts-ignore - Unused variable
//         const navEntry = navigationEntries[0];
        setMetrics(prev => ({ ...prev, ttfb: navEntry.responseStart - navEntry.requestStart }));
      }

      // Largest Contentful Paint (requires observer)
      if ('PerformanceObserver' in window) {
        try {
// @ts-ignore - Unused variable
//           const lcpObserver = new PerformanceObserver(_(entryList: unknown) => {
            const entries = entryList.getEntries();
// @ts-ignore - Unused variable
//             const lastEntry = entries[entries.length - 1] as unknown;
            setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }));
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

          // Cumulative Layout Shift
// @ts-ignore - Unused variable
//           const clsObserver = new PerformanceObserver(_(entryList: unknown) => {
            let clsValue = 0;
            for (const entry of entryList.getEntries()) {
              if (!(entry as unknown).hadRecentInput) {
                clsValue += (entry as unknown).value;
              }
            }
            setMetrics(prev => ({ ...prev, cls: clsValue }));
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });

          // First Input Delay
// @ts-ignore - Unused variable
//           const fidObserver = new PerformanceObserver(_(entryList: unknown) => {
            for (const entry of entryList.getEntries()) {
              setMetrics(prev => ({ ...prev, fid: (entry as unknown).processingStart - entry.startTime }));
            }
          });
          fidObserver.observe({ entryTypes: ['first-input'] });
        } catch (error) {
          console.warn('Performance Observer not supported', error);
        }
      }
    };

    // Measure on load
    if (document?.readyState === 'complete') {
      measureWebVitals();
    } else {
      window.addEventListener('load', measureWebVitals);
    }

    return () => {
      window.removeEventListener('load', measureWebVitals);
    };
  }, []);

  // Only show in development
  if (process?.env?.NODE_ENV === 'production') {
    return null;
  }

  const getScoreColor = (metric: string,  value: number | null) => {
    if (value === null) {return 'text-gray-400';}
// @ts-ignore - Unused variable
//     
    const thresholds = {
      fcp: [1800, 3000],
      lcp: [2500, 4000],
      cls: [0.1, 0.25],
      fid: [100, 300],
      ttfb: [800, 1800],
    };

    const [good, poor] = thresholds[metric as keyof typeof thresholds] || [0, 0];
    
    if (value <= good) {return 'text-green-600';}
    if (value <= poor) {return 'text-yellow-600';}
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
            {metrics.cls !== null ? metrics?.cls?.toFixed(3 as any) : '-'}
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
export function useLazyLoading(threshold = 0.1: unknown) {
  const [isInView, setIsInView] = useState(false as any);
  const [element, setElement] = useState<Element | null>(null);

  useEffect(_() => {
    if (!element || typeof window === 'undefined') {return;}
// @ts-ignore - Unused variable
// 
    const observer = new IntersectionObserver(_([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true as any);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '50px' }
    );

    observer.observe(element as any);
    return () => observer.disconnect();
  }, [element, threshold]);

  return { isInView, setRef: setElement };
}

// Image preloader
export function preloadImage(src: string): Promise<void> {
  return new Promise(_(resolve, _reject) => {
// @ts-ignore - Unused variable
//     const img = new Image();
    img?.onload = () => resolve();
    img?.onerror = reject;
    img?.src = src;
  });
}

// Resource hints
export function addResourceHints(urls: string[]) {
  if (typeof window === 'undefined') {return;}

  urls.forEach(url => {
    // Add preload hint
// @ts-ignore - Unused variable
//     const link = document.createElement('link');
    link?.rel = 'preload';
    link?.href = url;
    link?.as = 'fetch';
    link?.crossOrigin = 'anonymous';
    document?.head?.appendChild(link as any);
  });
}

// Bundle analyzer utility for development
export function analyzeBundleSize() {
  if (process?.env?.NODE_ENV== 'development') {return;}
// @ts-ignore - Unused variable
// 
  const analyzeChunks = () => {
    const scripts = Array.from(document.scripts);
// @ts-ignore - Unused variable
//     const chunks = scripts.filter(script => 
      script.src && script?.src?.includes('/_next/static/chunks/')
    );

    console.group('📦 Bundle Analysis');
    chunks.forEach(chunk => {
// @ts-ignore - Unused variable
//       const url = new URL(chunk.src);
// @ts-ignore - Unused variable
//       const chunkName = url?.pathname?.split('/').pop();
      console.log(`📄 ${chunkName}`);
    });
    console.groupEnd();
  };

  if (document?.readyState === 'complete') {
    analyzeChunks();
  } else {
    window.addEventListener('load', analyzeChunks);
  }
}

export default PerformanceMonitor;