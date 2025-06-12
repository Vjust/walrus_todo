/**
 * Performance configuration for the application
 * Centralizes all performance-related settings and thresholds
 */

// Environment variable to completely disable performance monitoring
const PERFORMANCE_MONITORING_DISABLED = process.env?.NEXT_PUBLIC_DISABLE_PERFORMANCE_MONITORING === 'true';

// Performance monitoring configuration
export const PERFORMANCE_CONFIG = {
  // Enable/disable performance monitoring based on environment
  monitoring: {
    enabled: process.env?.NODE_ENV === 'development' && !PERFORMANCE_MONITORING_DISABLED,
    enableInProduction: false, // Disabled by default in production
  },

  // Action execution thresholds
  thresholds: {
    slowActionMs: process.env?.NODE_ENV === 'production' ? 100 : 50, // Increased from 16ms
    criticalActionMs: 200, // Actions over 200ms are critical
  },

  // Memory tracking configuration
  memory: {
    trackingEnabled: process.env?.NODE_ENV === 'development' && !PERFORMANCE_MONITORING_DISABLED,
    trackingIntervalMs: 5 * 60 * 1000, // 5 minutes (300s) instead of 60s
    warningThresholdMB: 200, // Warn if heap size exceeds 200MB
    criticalThresholdMB: 400, // Critical if heap size exceeds 400MB
  },

  // Metrics storage configuration
  metrics: {
    maxStoredMetrics: process.env?.NODE_ENV === 'production' ? 50 : 200,
    enableDetailedLogging: process.env?.NODE_ENV === 'development',
  },

  // Optimization settings
  optimization: {
    // Throttle settings for high-frequency updates
    defaultThrottleMs: 32, // ~30fps for non-critical updates
    criticalThrottleMs: 16, // 60fps for critical updates
    
    // Debounce settings
    defaultDebounceMs: 300,
    searchDebounceMs: 500,
    
    // Batch processing
    defaultBatchSize: 10,
    defaultBatchDelayMs: 50,
  },

  // Feature flags
  features: {
    useThrottling: true,
    useDebouncing: true,
    useBatching: true,
    useSelectors: true,
    logSlowActions: process.env?.NODE_ENV === 'development',
  },
};

// Export individual constants for backward compatibility
export const SLOW_ACTION_THRESHOLD = PERFORMANCE_CONFIG?.thresholds?.slowActionMs;
export const MEMORY_TRACKING_INTERVAL = PERFORMANCE_CONFIG?.memory?.trackingIntervalMs;
export const PERFORMANCE_MONITORING_ENABLED = PERFORMANCE_CONFIG?.monitoring?.enabled;
export const MAX_STORED_METRICS = PERFORMANCE_CONFIG?.metrics?.maxStoredMetrics;

// Helper to check if performance monitoring is enabled
export function isPerformanceMonitoringEnabled(): boolean {
  if (PERFORMANCE_MONITORING_DISABLED) return false;
  
  if (process.env?.NODE_ENV === 'production') {
    return PERFORMANCE_CONFIG?.monitoring?.enableInProduction;
  }
  
  return PERFORMANCE_CONFIG?.monitoring?.enabled;
}

// Helper to get environment-specific configuration
export function getPerformanceConfig() {
  return {
    ...PERFORMANCE_CONFIG,
    monitoring: {
      ...PERFORMANCE_CONFIG.monitoring,
      enabled: isPerformanceMonitoringEnabled(),
    },
  };
}