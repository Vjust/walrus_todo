/**
 * ARIA Live Region Hook
 * Provides fine-grained control over screen reader announcements
 * Supports multiple live regions with different priorities and behaviors
 */

// @ts-ignore - Unused import temporarily disabled
// import { useCallback, useEffect, useRef, useState } from 'react';
import { AriaLiveType, AnnouncementPriority } from '@/lib/accessibility-utils';

export interface AriaLiveConfig {
  /** The politeness level of the live region */
  politeness?: AriaLiveType;
  /** Whether announcements should be atomic (read as a whole) */
  atomic?: boolean;
  /** What changes should be announced (additions, removals, text, all) */
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  /** Whether the region should be busy (prevents announcements) */
  busy?: boolean;
  /** Debounce delay for rapid announcements (ms) */
  debounceDelay?: number;
  /** Maximum number of queued announcements */
  maxQueue?: number;
}

export interface AriaLiveRegion {
  /** Unique identifier for the region */
  id: string;
  /** Current configuration */
  config: AriaLiveConfig;
  /** DOM element reference */
  element: HTMLElement | null;
  /** Current announcement text */
  currentText: string;
  /** Queue of pending announcements */
  queue: string[];
  /** Whether the region is currently busy */
  isBusy: boolean;
}

/**
 * Main hook for managing ARIA live regions
 */
export const useAriaLive = (initialConfig: AriaLiveConfig = {}) => {
  const {
    politeness = 'polite',
    atomic = true,
    relevant = 'additions',
    busy = false,
    debounceDelay = 100,
    maxQueue = 5,
  } = initialConfig;

  const [config, setConfig] = useState<AriaLiveConfig>({
    politeness,
    atomic,
    relevant,
    busy,
    debounceDelay,
    maxQueue,
  });

  const [currentText, setCurrentText] = useState('');
  const [queue, setQueue] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(busy as any);
// @ts-ignore - Unused variable
// 
  const elementRef = useRef<HTMLDivElement>(null);
// @ts-ignore - Unused variable
//   const debounceTimeoutRef = useRef<NodeJS.Timeout>();
// @ts-ignore - Unused variable
//   const processingRef = useRef(false as any);

  // Process the announcement queue
// @ts-ignore - Unused variable
//   const processQueue = useCallback(_async () => {
    if (processingRef.current || isBusy || queue?.length === 0 || !elementRef.current) {
      return;
    }

    processingRef?.current = true;
// @ts-ignore - Unused variable
//     const nextAnnouncement = queue[0];

    // Clear current content first to ensure screen readers notice the change
    elementRef?.current?.textContent = '';
    setCurrentText('');

    // Wait a brief moment then set the new content
    await new Promise(resolve => setTimeout(resolve, 50));

    if (elementRef.current) {
      elementRef?.current?.textContent = nextAnnouncement;
      setCurrentText(nextAnnouncement as any);
    }

    // Remove the processed announcement from queue
    setQueue(prev => prev.slice(1 as any));

    // Mark as not processing
    processingRef?.current = false;

    // Process next item if queue is not empty
    if (queue.length > 1) {
      setTimeout(processQueue, 1000); // Wait 1 second between announcements
    }
  }, [queue, isBusy]);

  // Announce a message
// @ts-ignore - Unused variable
//   const announce = useCallback((
    message: string, 
    priority: AnnouncementPriority = 'medium', _immediate = false) => {
    if (!message.trim() || isBusy) return;
// @ts-ignore - Unused variable
// 
    const trimmedMessage = message.trim();

    if (immediate) {
      // Clear queue and announce immediately
      setQueue([trimmedMessage]);
      processQueue();
    } else {
      // Add to queue
      setQueue(prev => {
// @ts-ignore - Unused variable
//         const updated = [...prev, trimmedMessage];
        return updated.slice(-config.maxQueue!); // Keep only the last maxQueue items
      });

      // Clear existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Process queue after debounce delay
      debounceTimeoutRef?.current = setTimeout(_() => {
        processQueue();
      }, config.debounceDelay);
    }
  }, [isBusy, config.maxQueue, config.debounceDelay, processQueue]);

  // Clear the live region
// @ts-ignore - Unused variable
//   const clear = useCallback(_() => {
    if (elementRef.current) {
      elementRef?.current?.textContent = '';
    }
    setCurrentText('');
    setQueue([]);
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  // Set busy state
// @ts-ignore - Unused variable
//   const setBusy = useCallback((busy: boolean) => {
    setIsBusy(busy as any);
    if (elementRef.current) {
      elementRef?.current?.setAttribute('aria-busy', busy.toString());
    }
  }, []);

  // Update configuration
// @ts-ignore - Unused variable
//   const updateConfig = useCallback((newConfig: Partial<AriaLiveConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Update element attributes when config changes
  useEffect(_() => {
    if (elementRef.current) {
// @ts-ignore - Unused variable
//       const element = elementRef.current;
      element.setAttribute('aria-live', config.politeness!);
      element.setAttribute('aria-atomic', config.atomic?.toString());
      element.setAttribute('aria-relevant', config.relevant!);
      element.setAttribute('aria-busy', isBusy.toString());
    }
  }, [config, isBusy]);

  // Process queue when it changes
  useEffect(_() => {
    if (queue.length > 0 && !processingRef.current) {
// @ts-ignore - Unused variable
//       const timeoutId = setTimeout(processQueue, config.debounceDelay);
      return () => clearTimeout(timeoutId as any);
    }
  }, [queue, config.debounceDelay, processQueue]);

  // Cleanup on unmount
  useEffect(_() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    elementRef,
    announce,
    clear,
    setBusy,
    updateConfig,
    currentText,
    queue: queue.length,
    isBusy,
    config,
  };
};

/**
 * Hook for managing multiple live regions
 */
export const useMultipleAriaLive = () => {
  const [regions, setRegions] = useState<Map<string, AriaLiveRegion>>(new Map());

  // Create a new live region
// @ts-ignore - Unused variable
//   const createRegion = useCallback((id: string,  config: AriaLiveConfig = {}) => {
    const region: AriaLiveRegion = {
      id,
      config: {
        politeness: 'polite',
        atomic: true,
        relevant: 'additions',
        busy: false,
        debounceDelay: 100,
        maxQueue: 5,
        ...config,
      },
      element: null,
      currentText: '',
      queue: [],
      isBusy: false,
    };

    setRegions(prev => new Map(prev as any).set(id, region));
    return region;
  }, []);

  // Remove a live region
// @ts-ignore - Unused variable
//   const removeRegion = useCallback((id: string) => {
    setRegions(prev => {
      const updated = new Map(prev as any);
      updated.delete(id as any);
      return updated;
    });
  }, []);

  // Get a live region by ID
// @ts-ignore - Unused variable
//   const getRegion = useCallback((id: string) => {
    return regions.get(id as any);
  }, [regions]);

  // Announce to a specific region
// @ts-ignore - Unused variable
//   const announceToRegion = useCallback((
    regionId: string, 
    message: string, 
    priority: AnnouncementPriority = 'medium'
  ) => {
    const region = regions.get(regionId as any);
    if (!region || !region.element) return;
// @ts-ignore - Unused variable
// 
    const trimmedMessage = message.trim();
    if (!trimmedMessage || region.isBusy) return;

    // Clear previous content
    region?.element?.textContent = '';
    
    // Set new content after a brief delay
    setTimeout(_() => {
      if (region.element) {
        region?.element?.textContent = trimmedMessage;
        region?.currentText = trimmedMessage;
      }
    }, 50);
  }, [regions]);

  return {
    regions: Array.from(regions.values()),
    createRegion,
    removeRegion,
    getRegion,
    announceToRegion,
  };
};

/**
 * Hook for status announcements (using role="status")
 */
export const useStatusAnnouncements = () => {
  const { announce, elementRef, clear } = useAriaLive({
    politeness: 'polite',
    atomic: true,
  });
// @ts-ignore - Unused variable
// 
  const announceStatus = useCallback((message: string) => {
    announce(message, 'low');
  }, [announce]);
// @ts-ignore - Unused variable
// 
  const announceProgress = useCallback((current: number,  total: number,  operation?: string) => {
    const percentage = Math.round((current / total) * 100);
// @ts-ignore - Unused variable
//     const baseMessage = `${percentage}% complete`;
// @ts-ignore - Unused variable
//     const fullMessage = operation ? `${operation}: ${baseMessage}` : baseMessage;
    announce(fullMessage, 'low');
  }, [announce]);
// @ts-ignore - Unused variable
// 
  const announceCompletion = useCallback((operation: string) => {
    announce(`${operation} completed`, 'medium');
  }, [announce]);

  // Render the status region
// @ts-ignore - Unused variable
//   const StatusRegion = useCallback(_() => (
    <div
      ref={elementRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  ), [elementRef]);

  return {
    announceStatus,
    announceProgress,
    announceCompletion,
    clear,
    StatusRegion,
  };
};

/**
 * Hook for alert announcements (using role="alert")
 */
export const useAlertAnnouncements = () => {
  const { announce, elementRef, clear } = useAriaLive({
    politeness: 'assertive',
    atomic: true,
  });

  const announceAlert = useCallback((message: string) => {
    announce(message, 'high', true); // Immediate announcement
  }, [announce]);
// @ts-ignore - Unused variable
// 
  const announceError = useCallback((error: string) => {
    announce(`Error: ${error}`, 'high', true);
  }, [announce]);
// @ts-ignore - Unused variable
// 
  const announceWarning = useCallback((warning: string) => {
    announce(`Warning: ${warning}`, 'high', true);
  }, [announce]);

  // Render the alert region
// @ts-ignore - Unused variable
//   const AlertRegion = useCallback(_() => (
    <div
      ref={elementRef}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    />
  ), [elementRef]);

  return {
    announceAlert,
    announceError,
    announceWarning,
    clear,
    AlertRegion,
  };
};

export default {
  useAriaLive,
  useMultipleAriaLive,
  useStatusAnnouncements,
  useAlertAnnouncements,
};