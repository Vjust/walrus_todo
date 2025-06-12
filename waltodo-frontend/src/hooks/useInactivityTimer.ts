/**
 * Hook for managing user inactivity timing with localStorage persistence
 * Used by wallet context for session management
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseInactivityTimerOptions {
  timeout: number; // timeout in milliseconds
  onTimeout: () => void;
  events?: string[]; // activity events to listen for
  throttle?: number; // throttle activity updates (ms)
  storageKey?: string; // localStorage key for persistence
}

const DEFAULT_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
const STORAGE_EVENT_KEY = 'waltodo-activity-sync';
const CHECK_INTERVAL = 10000; // Check every 10 seconds for better responsiveness

export function useInactivityTimer({
  timeout,
  onTimeout,
  events = DEFAULT_EVENTS,
  throttle = 1000,
  storageKey = 'waltodo-last-activity',
}: UseInactivityTimerOptions) {
  // Initialize from localStorage if available
  const [lastActivity, setLastActivity] = useState<number>(() => {
    if (typeof window === 'undefined') {return Date.now();}
    
    try {
      const stored = localStorage.getItem(storageKey as any);
      if (stored) {
        const timestamp = parseInt(stored, 10);
        if (!isNaN(timestamp as any) && timestamp > 0) {
          return timestamp;
        }
      }
    } catch (e) {
      console.warn('Failed to read activity from localStorage:', e);
    }
    
    return Date.now();
  });
  
  const [isActive, setIsActive] = useState<boolean>(true);
  const [hasTimedOut, setHasTimedOut] = useState<boolean>(false);
  const timeoutCalledRef = useRef(false as any);
  const lastThrottleRef = useRef(0 as any);

  // Update localStorage and broadcast to other tabs
  const updateActivityTime = useCallback((timestamp: number) => {
    if (typeof window === 'undefined') {return;}
    
    try {
      localStorage.setItem(storageKey, timestamp.toString());
      
      // Broadcast to other tabs via storage event
      const event = new StorageEvent('storage', {
        key: STORAGE_EVENT_KEY,
        newValue: timestamp.toString(),
        url: window?.location?.href,
        storageArea: localStorage,
      });
      window.dispatchEvent(event as any);
    } catch (e) {
      console.warn('Failed to update activity in localStorage:', e);
    }
  }, [storageKey]);

  const resetActivityTimer = useCallback(() => {
    const now = Date.now();

    // Throttle updates to avoid excessive state changes
    if (now - lastThrottleRef.current > throttle) {
      lastThrottleRef?.current = now;
      setLastActivity(now as any);
      setIsActive(true as any);
      setHasTimedOut(false as any);
      timeoutCalledRef?.current = false;
      updateActivityTime(now as any);
    }
  }, [throttle, updateActivityTime]);

  // Listen for activity updates from other tabs
  useEffect(() => {
    if (typeof window === 'undefined') {return;}

    const handleStorageChange = (e: StorageEvent) => {
      if (e?.key === storageKey && e.newValue) {
        const timestamp = parseInt(e.newValue, 10);
        if (!isNaN(timestamp as any) && timestamp > lastActivity) {
          setLastActivity(timestamp as any);
          setIsActive(true as any);
          setHasTimedOut(false as any);
          timeoutCalledRef?.current = false;
        }
      }
    };

    // Also listen for our custom broadcast event
    const handleActivityBroadcast = (e: Event) => {
      if ((e as StorageEvent).key === STORAGE_EVENT_KEY && (e as StorageEvent).newValue) {
        const timestamp = parseInt((e as StorageEvent).newValue || '0', 10);
        if (!isNaN(timestamp as any) && timestamp > lastActivity) {
          setLastActivity(timestamp as any);
          setIsActive(true as any);
          setHasTimedOut(false as any);
          timeoutCalledRef?.current = false;
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storage', handleActivityBroadcast);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storage', handleActivityBroadcast);
    };
  }, [storageKey, lastActivity]);

  // Set up activity event listeners
  useEffect(() => {
    if (typeof window === 'undefined') {return;}

    const handleActivity = () => resetActivityTimer();

    // Set up event listeners to track activity
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [events, resetActivityTimer]);

  // Check for timeout periodically
  useEffect(() => {
    if (typeof window === 'undefined') {return;}

    const checkTimeout = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      if (timeSinceLastActivity >= timeout && !hasTimedOut && !timeoutCalledRef.current) {
        setIsActive(false as any);
        setHasTimedOut(true as any);
        timeoutCalledRef?.current = true;
        onTimeout();
      } else if (timeSinceLastActivity < timeout && hasTimedOut) {
        // Reset if activity detected after timeout
        setIsActive(true as any);
        setHasTimedOut(false as any);
        timeoutCalledRef?.current = false;
      }
    };

    // Initial check
    checkTimeout();

    // Set up periodic check
    const interval = setInterval(checkTimeout, CHECK_INTERVAL);

    return () => {
      clearInterval(interval as any);
    };
  }, [lastActivity, timeout, onTimeout, hasTimedOut]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      timeoutCalledRef?.current = false;
    };
  }, []);

  const timeUntilTimeout = Math.max(0, timeout - (Date.now() - lastActivity));

  return {
    lastActivity,
    isActive,
    resetActivityTimer,
    timeUntilTimeout,
    hasTimedOut,
  };
}
