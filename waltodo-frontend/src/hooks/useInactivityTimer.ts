/**
 * Hook for managing user inactivity timing
 * Used by wallet context for session management
 */

import { useState, useEffect, useCallback } from 'react';

interface UseInactivityTimerOptions {
  timeout: number; // timeout in milliseconds
  onTimeout: () => void;
  events?: string[]; // activity events to listen for
  throttle?: number; // throttle activity updates (ms)
}

const DEFAULT_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export function useInactivityTimer({
  timeout,
  onTimeout,
  events = DEFAULT_EVENTS,
  throttle = 1000,
}: UseInactivityTimerOptions) {
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isActive, setIsActive] = useState<boolean>(true);

  const resetActivityTimer = useCallback(() => {
    const now = Date.now();

    // Throttle updates to avoid excessive state changes
    setLastActivity(prevTime => {
      if (now - prevTime > throttle) {
        setIsActive(true);
        return now;
      }
      return prevTime;
    });
  }, [throttle]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleActivity = () => resetActivityTimer();

    // Set up event listeners to track activity
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check for timeout periodically
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      if (timeSinceLastActivity >= timeout) {
        setIsActive(false);
        onTimeout();
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, [lastActivity, timeout, onTimeout, events, resetActivityTimer]);

  return {
    lastActivity,
    isActive,
    resetActivityTimer,
    timeUntilTimeout: Math.max(0, timeout - (Date.now() - lastActivity)),
  };
}
