/**
 * SSR Validation and Safety Guidelines
 * 
 * This module provides utilities and guidelines for maintaining SSR safety
 * across the TodoNFT application.
 */

// Validation checklist for SSR safety
export const SSR_SAFETY_CHECKLIST = {
  // Browser API Access
  browserAPI: {
    rules: [
      'Always check for typeof window !== "undefined" before accessing window',
      'Use useSafeBrowserAPI hook for all browser API access',
      'Provide fallbacks for all browser-dependent functionality',
      'Never access document, navigator, or localStorage directly in components',
    ],
    violations: [
      'window.',
      'document.',
      'navigator.',
      'localStorage.',
      'sessionStorage.',
      'performance.now()',
      'location.href',
    ],
  },

  // State Initialization
  stateInit: {
    rules: [
      'Initialize state with SSR-safe default values',
      'Use useMounted hook to determine if component is hydrated',
      'Avoid Date.now() or random values in initial state',
      'Use suppressHydrationWarning only when necessary',
    ],
    patterns: [
      'useState(null) // Safe for SSR',
      'useState(false) // Safe for SSR',
      'useState([]) // Safe for SSR',
      'useState({}) // Safe for SSR',
    ],
  },

  // Component Patterns
  componentPatterns: {
    rules: [
      'Wrap browser-dependent components with NoSSR',
      'Use SSRSafeComponent for conditional rendering',
      'Provide meaningful fallbacks for loading states',
      'Handle hydration mismatches gracefully',
    ],
    examples: [
      '<NoSSR fallback={<Skeleton />}><BrowserOnlyComponent /></NoSSR>',
      '<ConditionalRender condition={() => hasFeature}><Feature /></ConditionalRender>',
      'const mounted = useMounted(); if (!mounted) return <Loading />;',
    ],
  },

  // Event Handlers
  eventHandlers: {
    rules: [
      'Check for event availability before attaching listeners',
      'Use useSafeBrowserAPI for event-dependent functionality',
      'Clean up event listeners in useEffect cleanup',
      'Handle missing event APIs gracefully',
    ],
    patterns: [
      'useEffect(() => { if (typeof window !== "undefined") { ... } }, [])',
      'const { data: api, isLoaded } = useSafeBrowserAPI(() => window.someAPI, null)',
    ],
  },
};

// Validation functions
export function validateSSRSafety(componentCode: string): {
  isValid: boolean;
  violations: string[];
  suggestions: string[];
} {
  const violations: string[] = [];
  const suggestions: string[] = [];

  // Check for direct browser API access
  SSR_SAFETY_CHECKLIST.browserAPI.violations.forEach(violation => {
    if (componentCode.includes(violation)) {
      violations.push(`Direct access to ${violation} found`);
      suggestions.push(`Use useSafeBrowserAPI hook instead of direct ${violation} access`);
    }
  });

  // Check for unsafe state initialization
  const unsafeStatePatterns = [
    'useState(new Date())',
    'useState(Date.now())',
    'useState(Math.random())',
    'useState(window.',
    'useState(document.',
    'useState(navigator.',
  ];

  unsafeStatePatterns.forEach(pattern => {
    if (componentCode.includes(pattern)) {
      violations.push(`Unsafe state initialization: ${pattern}`);
      suggestions.push('Initialize state with SSR-safe default values');
    }
  });

  // Check for missing SSR wrappers
  const browserOnlyComponents = [
    'MediaQuery',
    'IntersectionObserver',
    'Clipboard',
    'Geolocation',
  ];

  browserOnlyComponents.forEach(component => {
    if (componentCode.includes(`<${component}`) && !componentCode.includes('<NoSSR')) {
      violations.push(`Browser-only component ${component} not wrapped with NoSSR`);
      suggestions.push(`Wrap ${component} with <NoSSR> component`);
    }
  });

  return {
    isValid: violations.length === 0,
    violations,
    suggestions,
  };
}

// SSR-safe utilities
export const SSRUtils = {
  // Safe JSON parsing
  parseJSON: <T>(json: string, fallback: T): T => {
    if (typeof window === 'undefined') {return fallback;}
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  },

  // Safe date formatting
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
    if (typeof window === 'undefined') {return 'Loading...';}
    try {
      const dateObj = typeof date === 'string' || typeof date === 'number' 
        ? new Date(date) 
        : date;
      return dateObj.toLocaleDateString(undefined, options);
    } catch {
      return 'Invalid Date';
    }
  },

  // Safe number formatting
  formatNumber: (num: number, options?: Intl.NumberFormatOptions): string => {
    if (typeof window === 'undefined') {return '0';}
    try {
      return num.toLocaleString(undefined, options);
    } catch {
      return num.toString();
    }
  },

  // Safe localStorage access
  getLocalStorage: <T>(key: string, fallback: T): T => {
    if (typeof window === 'undefined' || !window.localStorage) {return fallback;}
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },

  // Safe sessionStorage access
  getSessionStorage: <T>(key: string, fallback: T): T => {
    if (typeof window === 'undefined' || !window.sessionStorage) {return fallback;}
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },

  // Safe URL creation
  createSafeURL: (url: string, base?: string): string => {
    if (typeof window === 'undefined') {return url;}
    try {
      return new URL(url, base || window.location.origin).href;
    } catch {
      return url;
    }
  },

  // Safe clipboard access
  copyToClipboard: async (text: string): Promise<boolean> => {
    if (typeof window === 'undefined' || !navigator.clipboard) {
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      } catch {
        return false;
      }
    }
  },

  // Safe share API access
  shareContent: async (data: ShareData): Promise<boolean> => {
    if (typeof window === 'undefined' || !navigator.share) {
      return false;
    }
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      // User cancelled or share failed
      return false;
    }
  },

  // Safe media query
  matchMedia: (query: string): boolean => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  },

  // Safe intersection observer
  createIntersectionObserver: (
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ): IntersectionObserver | null => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      return null;
    }
    try {
      return new IntersectionObserver(callback, options);
    } catch {
      return null;
    }
  },

  // Safe resize observer
  createResizeObserver: (
    callback: ResizeObserverCallback
  ): ResizeObserver | null => {
    if (typeof window === 'undefined' || !window.ResizeObserver) {
      return null;
    }
    try {
      return new ResizeObserver(callback);
    } catch {
      return null;
    }
  },
};

// SSR-safe constants
export const SSR_CONSTANTS = {
  DEFAULT_VIEWPORT: { width: 1024, height: 768 },
  DEFAULT_USER_AGENT: 'SSR',
  DEFAULT_LOCALE: 'en-US',
  DEFAULT_TIMEZONE: 'UTC',
  FALLBACK_IMAGE: '/images/placeholder.png',
  FALLBACK_AVATAR: '/images/default-avatar.png',
} as const;

// Development helpers
export const DevHelpers = {
  logSSRWarning: (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[SSR Safety Warning]: ${message}`);
    }
  },

  logHydrationMismatch: (componentName: string, serverValue: any, clientValue: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[Hydration Mismatch] ${componentName}:`,
        { server: serverValue, client: clientValue }
      );
    }
  },

  validateComponent: (componentName: string, componentCode: string) => {
    if (process.env.NODE_ENV === 'development') {
      const validation = validateSSRSafety(componentCode);
      if (!validation.isValid) {
        console.group(`[SSR Validation] ${componentName}`);
        validation.violations.forEach(violation => {
          console.warn('❌', violation);
        });
        validation.suggestions.forEach(suggestion => {
          console.info('💡', suggestion);
        });
        console.groupEnd();
      }
    }
  },
};

// Error boundaries for SSR
export class SSRSafeErrorBoundary extends Error {
  constructor(
    message: string,
    public componentName: string,
    public ssrContext: 'server' | 'client' | 'hydration'
  ) {
    super(`[${ssrContext.toUpperCase()}] ${componentName}: ${message}`);
    this.name = 'SSRSafeError';
  }
}

// Performance monitoring for SSR
export const SSRPerformance = {
  markHydrationStart: (componentName: string) => {
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark(`hydration-start-${componentName}`);
    }
  },

  markHydrationEnd: (componentName: string) => {
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark(`hydration-end-${componentName}`);
      window.performance.measure(
        `hydration-${componentName}`,
        `hydration-start-${componentName}`,
        `hydration-end-${componentName}`
      );
    }
  },

  getHydrationMetrics: (): PerformanceEntry[] => {
    if (typeof window === 'undefined' || !window.performance) {return [];}
    return window.performance.getEntriesByType('measure')
      .filter(entry => entry.name.startsWith('hydration-'));
  },
};

const SSRValidationExports = {
  SSR_SAFETY_CHECKLIST,
  validateSSRSafety,
  SSRUtils,
  SSR_CONSTANTS,
  DevHelpers,
  SSRSafeErrorBoundary,
  SSRPerformance,
};

export default SSRValidationExports;