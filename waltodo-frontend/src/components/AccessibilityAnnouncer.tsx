/**
 * AccessibilityAnnouncer Component
 * Provides live region announcements for screen readers
 * Manages dynamic content updates and user notifications
 */

'use client';

import React, { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { AriaLiveType, AnnouncementPriority } from '@/lib/accessibility-utils';

interface Announcement {
  id: string;
  message: string;
  priority: AnnouncementPriority;
  timestamp: number;
  duration?: number;
}

interface AccessibilityAnnouncerContextType {
  announce: (message: string, priority?: AnnouncementPriority, duration?: number) => void;
  clearAnnouncements: () => void;
  announcements: Announcement[];
}

const AccessibilityAnnouncerContext = createContext<AccessibilityAnnouncerContextType | null>(null);

export const useAccessibilityAnnouncer = () => {
  const context = useContext(AccessibilityAnnouncerContext);
  if (!context) {
    throw new Error('useAccessibilityAnnouncer must be used within an AccessibilityAnnouncerProvider');
  }
  return context;
};

interface AccessibilityAnnouncerProps {
  children: React.ReactNode;
  /** Maximum number of announcements to keep in history */
  maxAnnouncements?: number;
  /** Default duration for announcements (ms) */
  defaultDuration?: number;
  /** Whether to show visual announcements (for debugging) */
  showVisualAnnouncements?: boolean;
}

/**
 * Provider component that manages accessibility announcements
 */
export const AccessibilityAnnouncerProvider: React.FC<AccessibilityAnnouncerProps> = ({
  children,
  maxAnnouncements = 10,
  defaultDuration = 5000,
  showVisualAnnouncements = false,
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<string>('');
  const [currentPriority, setCurrentPriority] = useState<AriaLiveType>('polite');
  
  const politeRegionRef = useRef<HTMLDivElement>(null);
  const assertiveRegionRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const announcementCounter = useRef(0);

  // Generate unique ID for announcements
  const generateId = useCallback(() => {
    return `announcement-${Date.now()}-${++announcementCounter.current}`;
  }, []);

  // Announce message to screen readers
  const announce = useCallback((
    message: string,
    priority: AnnouncementPriority = 'medium',
    duration = defaultDuration
  ) => {
    if (!message.trim()) return;

    const announcement: Announcement = {
      id: generateId(),
      message: message.trim(),
      priority,
      timestamp: Date.now(),
      duration,
    };

    // Add to announcements history
    setAnnouncements(prev => {
      const updated = [announcement, ...prev];
      return updated.slice(0, maxAnnouncements);
    });

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Determine which live region to use
    const liveType: AriaLiveType = priority === 'high' ? 'assertive' : 'polite';
    const targetRegion = liveType === 'assertive' ? assertiveRegionRef.current : politeRegionRef.current;

    if (targetRegion) {
      // Clear the region first to ensure screen readers pick up the change
      targetRegion.textContent = '';
      setCurrentAnnouncement('');
      setCurrentPriority(liveType);

      // Use setTimeout to ensure screen readers detect the change
      setTimeout(() => {
        targetRegion.textContent = message;
        setCurrentAnnouncement(message);
      }, 100);

      // Clear the announcement after duration
      if (duration > 0) {
        timeoutRef.current = setTimeout(() => {
          if (targetRegion.textContent === message) {
            targetRegion.textContent = '';
            setCurrentAnnouncement('');
          }
        }, duration);
      }
    }
  }, [defaultDuration, maxAnnouncements, generateId]);

  // Clear all announcements
  const clearAnnouncements = useCallback(() => {
    setAnnouncements([]);
    setCurrentAnnouncement('');
    
    if (politeRegionRef.current) {
      politeRegionRef.current.textContent = '';
    }
    if (assertiveRegionRef.current) {
      assertiveRegionRef.current.textContent = '';
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const contextValue: AccessibilityAnnouncerContextType = {
    announce,
    clearAnnouncements,
    announcements,
  };

  return (
    <AccessibilityAnnouncerContext.Provider value={contextValue}>
      {children}
      
      {/* Live regions for screen readers */}
      <div
        ref={politeRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      />
      
      <div
        ref={assertiveRegionRef}
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      />

      {/* Visual announcements for debugging */}
      {showVisualAnnouncements && currentAnnouncement && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <div className={`
            p-4 rounded-lg shadow-lg border-l-4 transition-all duration-300
            ${currentPriority === 'assertive' 
              ? 'bg-red-50 border-red-400 text-red-800' 
              : 'bg-blue-50 border-blue-400 text-blue-800'
            }
          `}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {currentPriority === 'assertive' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">
                  Screen Reader Announcement
                </p>
                <p className="text-sm mt-1">
                  {currentAnnouncement}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AccessibilityAnnouncerContext.Provider>
  );
};

/**
 * Hook for creating announcement shortcuts
 */
export const useAnnouncementShortcuts = () => {
  const { announce } = useAccessibilityAnnouncer();

  const announceSuccess = useCallback((message: string) => {
    announce(`Success: ${message}`, 'medium');
  }, [announce]);

  const announceError = useCallback((message: string) => {
    announce(`Error: ${message}`, 'high');
  }, [announce]);

  const announceWarning = useCallback((message: string) => {
    announce(`Warning: ${message}`, 'medium');
  }, [announce]);

  const announceInfo = useCallback((message: string) => {
    announce(`Information: ${message}`, 'low');
  }, [announce]);

  const announceLoading = useCallback((message: string) => {
    announce(`Loading: ${message}`, 'medium');
  }, [announce]);

  const announceComplete = useCallback((message: string) => {
    announce(`Complete: ${message}`, 'medium');
  }, [announce]);

  const announceNavigation = useCallback((location: string) => {
    announce(`Navigated to ${location}`, 'low');
  }, [announce]);

  const announceSelection = useCallback((item: string, position?: string) => {
    const message = position ? `Selected ${item}, ${position}` : `Selected ${item}`;
    announce(message, 'low');
  }, [announce]);

  return {
    announceSuccess,
    announceError,
    announceWarning,
    announceInfo,
    announceLoading,
    announceComplete,
    announceNavigation,
    announceSelection,
  };
};

/**
 * Component for manual announcements (for testing)
 */
export const AnnouncementTester: React.FC = () => {
  const { announce, clearAnnouncements, announcements } = useAccessibilityAnnouncer();
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('medium');

  const handleAnnounce = () => {
    if (message.trim()) {
      announce(message, priority);
      setMessage('');
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-4">Accessibility Announcement Tester</h3>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="announcement-message" className="block text-sm font-medium mb-1">
            Message
          </label>
          <input
            id="announcement-message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter announcement message"
            className="w-full px-3 py-2 border rounded-md"
            onKeyDown={(e) => e.key === 'Enter' && handleAnnounce()}
          />
        </div>
        
        <div>
          <label htmlFor="announcement-priority" className="block text-sm font-medium mb-1">
            Priority
          </label>
          <select
            id="announcement-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="low">Low (Polite)</option>
            <option value="medium">Medium (Polite)</option>
            <option value="high">High (Assertive)</option>
          </select>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleAnnounce}
            disabled={!message.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Announce
          </button>
          <button
            onClick={clearAnnouncements}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Clear All
          </button>
        </div>
      </div>
      
      {announcements.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Recent Announcements</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="text-xs p-2 bg-white dark:bg-gray-700 rounded border"
              >
                <div className="flex justify-between items-start">
                  <span className="flex-1">{announcement.message}</span>
                  <span className={`
                    ml-2 px-1 py-0.5 rounded text-xs
                    ${announcement.priority === 'high' 
                      ? 'bg-red-100 text-red-800' 
                      : announcement.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                    }
                  `}>
                    {announcement.priority}
                  </span>
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {new Date(announcement.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessibilityAnnouncerProvider;