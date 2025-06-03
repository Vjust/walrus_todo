/**
 * ARIA Live Region Hook
 * Provides fine-grained control over screen reader announcements
 * Supports multiple live regions with different priorities and behaviors
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [isBusy, setIsBusy] = useState(busy);

  const elementRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const processingRef = useRef(false);

  // Process the announcement queue
  const processQueue = useCallback(async () => {
    if (processingRef.current || isBusy || queue.length === 0 || !elementRef.current) {
      return;
    }

    processingRef.current = true;
    const nextAnnouncement = queue[0];

    // Clear current content first to ensure screen readers notice the change
    elementRef.current.textContent = '';
    setCurrentText('');

    // Wait a brief moment then set the new content
    await new Promise(resolve => setTimeout(resolve, 50));

    if (elementRef.current) {
      elementRef.current.textContent = nextAnnouncement;
      setCurrentText(nextAnnouncement);
    }

    // Remove the processed announcement from queue
    setQueue(prev => prev.slice(1));

    // Mark as not processing
    processingRef.current = false;

    // Process next item if queue is not empty
    if (queue.length > 1) {
      setTimeout(processQueue, 1000); // Wait 1 second between announcements
    }
  }, [queue, isBusy]);

  // Announce a message
  const announce = useCallback((
    message: string,
    priority: AnnouncementPriority = 'medium',
    immediate = false
  ) => {
    if (!message.trim() || isBusy) return;

    const trimmedMessage = message.trim();

    if (immediate) {
      // Clear queue and announce immediately
      setQueue([trimmedMessage]);
      processQueue();
    } else {
      // Add to queue
      setQueue(prev => {
        const updated = [...prev, trimmedMessage];
        return updated.slice(-config.maxQueue!); // Keep only the last maxQueue items
      });

      // Clear existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Process queue after debounce delay
      debounceTimeoutRef.current = setTimeout(() => {
        processQueue();
      }, config.debounceDelay);
    }
  }, [isBusy, config.maxQueue, config.debounceDelay, processQueue]);

  // Clear the live region
  const clear = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.textContent = '';
    }
    setCurrentText('');
    setQueue([]);
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  // Set busy state
  const setBusy = useCallback((busy: boolean) => {
    setIsBusy(busy);
    if (elementRef.current) {
      elementRef.current.setAttribute('aria-busy', busy.toString());
    }
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<AriaLiveConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Update element attributes when config changes
  useEffect(() => {
    if (elementRef.current) {
      const element = elementRef.current;
      element.setAttribute('aria-live', config.politeness!);
      element.setAttribute('aria-atomic', config.atomic!.toString());
      element.setAttribute('aria-relevant', config.relevant!);
      element.setAttribute('aria-busy', isBusy.toString());
    }
  }, [config, isBusy]);

  // Process queue when it changes
  useEffect(() => {
    if (queue.length > 0 && !processingRef.current) {
      const timeoutId = setTimeout(processQueue, config.debounceDelay);
      return () => clearTimeout(timeoutId);
    }
  }, [queue, config.debounceDelay, processQueue]);

  // Cleanup on unmount
  useEffect(() => {
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
  const createRegion = useCallback((id: string, config: AriaLiveConfig = {}) => {
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

    setRegions(prev => new Map(prev).set(id, region));
    return region;
  }, []);

  // Remove a live region
  const removeRegion = useCallback((id: string) => {
    setRegions(prev => {
      const updated = new Map(prev);
      updated.delete(id);
      return updated;
    });
  }, []);

  // Get a live region by ID
  const getRegion = useCallback((id: string) => {
    return regions.get(id);
  }, [regions]);

  // Announce to a specific region
  const announceToRegion = useCallback((
    regionId: string,
    message: string,
    priority: AnnouncementPriority = 'medium'
  ) => {
    const region = regions.get(regionId);
    if (!region || !region.element) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage || region.isBusy) return;

    // Clear previous content
    region.element.textContent = '';
    
    // Set new content after a brief delay
    setTimeout(() => {
      if (region.element) {
        region.element.textContent = trimmedMessage;
        region.currentText = trimmedMessage;
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

  const announceStatus = useCallback((message: string) => {
    announce(message, 'low');
  }, [announce]);

  const announceProgress = useCallback((current: number, total: number, operation?: string) => {
    const percentage = Math.round((current / total) * 100);
    const baseMessage = `${percentage}% complete`;
    const fullMessage = operation ? `${operation}: ${baseMessage}` : baseMessage;
    announce(fullMessage, 'low');
  }, [announce]);

  const announceCompletion = useCallback((operation: string) => {
    announce(`${operation} completed`, 'medium');
  }, [announce]);

  // Render the status region
  const StatusRegion = useCallback(() => (
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

  const announceError = useCallback((error: string) => {
    announce(`Error: ${error}`, 'high', true);
  }, [announce]);

  const announceWarning = useCallback((warning: string) => {
    announce(`Warning: ${warning}`, 'high', true);
  }, [announce]);

  // Render the alert region
  const AlertRegion = useCallback(() => (
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