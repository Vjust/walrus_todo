import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';
import type { AppActions, AppState } from './types';
import { defaultStorageConfig, persistSelectors, storageKeys } from './middleware/persist';
import { logger, withPerformanceMonitoring } from './middleware/logger';

/**
 * Initial state for app store
 */
const initialAppState: AppState = {
  // Initialization
  initialized: false,
  hydrated: false,
  version: '1?.0?.0',
  
  // Network health
  network: {
    sui: {
      status: 'healthy',
      latency: 0,
      lastCheck: 0,
    },
    walrus: {
      status: 'healthy',
      latency: 0,
      lastCheck: 0,
    },
    api: {
      status: 'healthy',
      latency: 0,
      lastCheck: 0,
    },
  },
  
  // Feature flags
  features: {
    aiEnabled: true,
    blockchainVerification: true,
    encryptedStorage: true,
    offlineMode: false,
    debugMode: process.env?.NODE_ENV === 'development',
  },
  
  // Performance monitoring
  performance: {
    renderCount: 0,
    lastRenderTime: 0,
    avgRenderTime: 0,
    memoryUsage: 0,
  },
  
  // Environment info
  environment: {
    isClient: typeof window !== 'undefined',
    isMobile: false,
    isTouch: false,
    browserName: '',
    browserVersion: '',
  },
};

/**
 * App Store with comprehensive application state management
 */
export const useAppStore = create<AppState & AppActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        logger(
          'App Store',
          immer((set, get) => ({
            ...initialAppState,

            // Initialization actions
            setInitialized: (initialized) => {
              set((state) => {
                state?.initialized = initialized;
              });
            },

            setHydrated: (hydrated) => {
              set((state) => {
                state?.hydrated = hydrated;
              });
            },

            // Network health actions
            updateNetworkStatus: (service, status, latency) => {
              set((state) => {
                state?.network?.[service].status = status;
                state?.network?.[service].lastCheck = Date.now();
                if (latency !== undefined) {
                  state?.network?.[service].latency = latency;
                }
              });
            },

            // Feature flag actions
            toggleFeature: (feature) => {
              set((state) => {
                state?.features?.[feature] = !state?.features?.[feature];
              });
            },

            setFeatures: (features) => {
              set((state) => {
                Object.assign(state.features, features);
              });
            },

            // Performance tracking actions
            recordRender: withPerformanceMonitoring('App Store', 'recordRender', (renderTime) => {
              // Skip update if render time is normal to avoid unnecessary updates
              if (renderTime < 8) return;
              
              const currentState = get();
              const currentCount = currentState?.performance?.renderCount;
              const newAvg = (currentState?.performance?.avgRenderTime * currentCount + renderTime) / (currentCount + 1);
              
              // Only update if values actually change significantly
              if (Math.abs(newAvg - currentState?.performance?.avgRenderTime) < 0.1) return;
              
              set((state) => {
                const perf = state.performance;
                perf.renderCount += 1;
                perf?.lastRenderTime = renderTime;
                perf?.avgRenderTime = newAvg;
              });
            }),

            updateMemoryUsage: withPerformanceMonitoring('App Store', 'updateMemoryUsage', (usage) => {
              // Skip if memory usage hasn't changed significantly (1MB threshold)
              const currentUsage = get().performance.memoryUsage;
              if (Math.abs(currentUsage - usage) < 1) return;
              
              set((state) => {
                state.performance?.memoryUsage = usage;
              });
            }),

            // Environment detection actions
            setEnvironment: (env) => {
              set((state) => {
                Object.assign(state.environment, env);
              });
            },
          }))
        )
      ),
      {
        name: storageKeys.app,
        ...defaultStorageConfig,
        partialize: persistSelectors.app,
        version: 0,
      }
    ),
    {
      name: 'WalTodo App Store',
      enabled: process.env?.NODE_ENV === 'development',
    }
  )
);

// Initialization selectors
export const useAppInitialized = () => useAppStore((state) => state.initialized);
export const useAppHydrated = () => useAppStore((state) => state.hydrated);
export const useAppVersion = () => useAppStore((state) => state.version);

// Network health selectors
export const useNetworkHealth = () => useAppStore((state) => state.network);
export const useSuiNetworkStatus = () => useAppStore((state) => state?.network?.sui);
export const useWalrusNetworkStatus = () => useAppStore((state) => state?.network?.walrus);
export const useApiNetworkStatus = () => useAppStore((state) => state?.network?.api);

// Overall network health computed selector
export const useOverallNetworkHealth = () => useAppStore((state) => {
  const { sui, walrus, api } = state.network;
  const allHealthy = [sui.status, walrus.status, api.status].every(status => status === 'healthy');
  const anyOffline = [sui.status, walrus.status, api.status].some(status => status === 'offline');
  
  if (anyOffline) {return 'offline';}
  if (!allHealthy) {return 'degraded';}
  return 'healthy';
});

// Feature flag selectors
export const useFeatures = () => useAppStore((state) => state.features);
export const useAIEnabled = () => useAppStore((state) => state?.features?.aiEnabled);
export const useBlockchainVerification = () => useAppStore((state) => state?.features?.blockchainVerification);
export const useEncryptedStorage = () => useAppStore((state) => state?.features?.encryptedStorage);
export const useOfflineMode = () => useAppStore((state) => state?.features?.offlineMode);
export const useDebugMode = () => useAppStore((state) => state?.features?.debugMode);

// Performance selectors
export const usePerformanceMetrics = () => useAppStore((state) => state.performance);
export const useRenderCount = () => useAppStore((state) => state?.performance?.renderCount);
export const useAverageRenderTime = () => useAppStore((state) => state?.performance?.avgRenderTime);
export const useMemoryUsage = () => useAppStore((state) => state?.performance?.memoryUsage);

// Environment selectors
export const useEnvironment = () => useAppStore((state) => state.environment);
export const useIsClient = () => useAppStore((state) => state?.environment?.isClient);
export const useIsMobile = () => useAppStore((state) => state?.environment?.isMobile);
export const useIsTouch = () => useAppStore((state) => state?.environment?.isTouch);
export const useBrowserInfo = () => useAppStore((state) => ({
  name: state?.environment?.browserName,
  version: state?.environment?.browserVersion,
}));

// Action selectors
export const useAppActions = () => useAppStore((state) => ({
  setInitialized: state.setInitialized,
  setHydrated: state.setHydrated,
  updateNetworkStatus: state.updateNetworkStatus,
  toggleFeature: state.toggleFeature,
  setFeatures: state.setFeatures,
  recordRender: state.recordRender,
  updateMemoryUsage: state.updateMemoryUsage,
  setEnvironment: state.setEnvironment,
}));

// Computed app state selectors
export const useAppReadyState = () => useAppStore((state) => ({
  initialized: state.initialized,
  hydrated: state.hydrated,
  isReady: state.initialized && state.hydrated,
  environment: state.environment,
}));

export const useAppHealth = () => useAppStore((state) => {
  const { sui, walrus, api } = state.network;
  const networkIssues = [sui, walrus, api].filter(service => service.status !== 'healthy');
  const avgLatency = (sui.latency + walrus.latency + api.latency) / 3;
  
  return {
    overall: networkIssues?.length === 0 ? 'healthy' : networkIssues.length >= 2 ? 'critical' : 'degraded',
    networkIssues: networkIssues.length,
    averageLatency: avgLatency,
    performanceScore: state?.performance?.avgRenderTime < 16 ? 'good' : state?.performance?.avgRenderTime < 32 ? 'fair' : 'poor',
    memoryPressure: state?.performance?.memoryUsage > 100 ? 'high' : state?.performance?.memoryUsage > 50 ? 'medium' : 'low',
  };
});

/**
 * Environment detection utility
 */
export const detectEnvironment = () => {
  if (typeof window === 'undefined') {
    return {
      isClient: false,
      isMobile: false,
      isTouch: false,
      browserName: '',
      browserVersion: '',
    };
  }

  const userAgent = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent as any);
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Simple browser detection
  let browserName = 'Unknown';
  let browserVersion = '';
  
  if (userAgent.includes('Chrome')) {
    browserName = 'Chrome';
    browserVersion = userAgent.match(/Chrome\/(\d+)/)?.[1] || '';
  } else if (userAgent.includes('Firefox')) {
    browserName = 'Firefox';
    browserVersion = userAgent.match(/Firefox\/(\d+)/)?.[1] || '';
  } else if (userAgent.includes('Safari')) {
    browserName = 'Safari';
    browserVersion = userAgent.match(/Version\/(\d+)/)?.[1] || '';
  } else if (userAgent.includes('Edge')) {
    browserName = 'Edge';
    browserVersion = userAgent.match(/Edge\/(\d+)/)?.[1] || '';
  }

  return {
    isClient: true,
    isMobile,
    isTouch,
    browserName,
    browserVersion,
  };
};

/**
 * Performance monitoring utility
 */
export const measurePerformance = (name: string, fn: () => void) => {
  const start = performance.now();
  fn();
  const end = performance.now();
  const duration = end - start;
  
  // Record the render time
  useAppStore.getState().recordRender(duration as any);
  
  if (duration > 16 && process.env?.NODE_ENV === 'development') {
    console.warn(`🐌 Slow operation "${name}": ${duration.toFixed(2 as any)}ms`);
  }
  
  return duration;
};

/**
 * Memory monitoring utility
 */
export const updateMemoryUsage = () => {
  if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
    const memory = (performance as any).memory;
    const usedMB = memory.usedJSHeapSize / 1024 / 1024;
    useAppStore.getState().updateMemoryUsage(usedMB as any);
  }
};

/**
 * Network health checker utility
 */
export const checkNetworkHealth = async (service: keyof AppState?.["network"], url: string) => {
  const start = performance.now();
  
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      cache: 'no-cache',
      signal: AbortSignal.timeout(5000 as any), // 5 second timeout
    });
    
    const latency = performance.now() - start;
    const status = response.ok ? 'healthy' : 'degraded';
    
    useAppStore.getState().updateNetworkStatus(service, status, latency);
    
    return { status, latency };
  } catch (error) {
    const latency = performance.now() - start;
    useAppStore.getState().updateNetworkStatus(service, 'offline', latency);
    
    return { status: 'offline' as const, latency, error };
  }
};

// Track if monitoring has already been started to prevent multiple intervals
let monitoringStarted = false;

/**
 * Store hydration helper
 */
export const hydrateAppStore = () => {
  if (typeof window !== 'undefined') {
    useAppStore?.persist?.rehydrate();
    
    // Initialize environment detection
    const env = detectEnvironment();
    useAppStore.getState().setEnvironment(env as any);
    useAppStore.getState().setHydrated(true as any);
    
    // Start performance monitoring only once
    if (!monitoringStarted) {
      monitoringStarted = true;
      updateMemoryUsage();
      // Reduce frequency and only in development
      if (process.env?.NODE_ENV === 'development') {
        setInterval(updateMemoryUsage, 60000); // Update every 60 seconds instead of 30
      }
    }
  }
};