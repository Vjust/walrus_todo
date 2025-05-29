'use client';

import React, { useState, useEffect } from 'react';
import safeStorage, {
  isBrowser,
  isUsingFallbackStorage,
} from '@/lib/safe-storage';

// Simple hydration check hook
function useIsHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

// Define context types for storage environments
type StorageContext =
  | 'browser' // Standard browser context with storage access
  | 'extension' // Browser extension context
  | 'iframe' // Embedded in an iframe
  | 'insecure' // Non-HTTPS context with restricted features
  | 'incognito' // Private/incognito browsing mode
  | 'server' // Server-side rendering context
  | 'hydrating' // During hydration phase of React
  | 'unknown'; // Context could not be determined

interface WarningMessageProps {
  context: StorageContext;
  usingFallback: boolean;
}

const WarningMessage: React.FC<WarningMessageProps> = ({
  context,
  usingFallback,
}) => {
  if (!usingFallback) return null;

  const getMessageForContext = (): { title: string; message: string } => {
    switch (context) {
      case 'extension':
        return {
          title: 'Extension Storage Mode',
          message:
            'Your data will not persist between sessions in this extension context.',
        };
      case 'iframe':
        return {
          title: 'Restricted Storage',
          message:
            'This app is running in an iframe with limited storage access. Your data will not persist.',
        };
      case 'incognito':
        return {
          title: 'Private Browsing Detected',
          message:
            'In private/incognito mode, data will not persist between sessions.',
        };
      case 'insecure':
        return {
          title: 'Non-Secure Context',
          message:
            'For full functionality including persistent storage, please use HTTPS.',
        };
      case 'server':
        return {
          title: 'Server Rendering',
          message: 'Storage is not available during server rendering.',
        };
      case 'hydrating':
        return {
          title: 'App is Initializing',
          message:
            'Storage access is temporarily restricted during app initialization.',
        };
      default:
        return {
          title: 'Limited Storage Access',
          message:
            'Your preferences and data will not persist between sessions.',
        };
    }
  };

  const { title, message } = getMessageForContext();

  return (
    <div className='p-2 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-100 rounded mb-4'>
      <h4 className='font-medium text-yellow-800 dark:text-yellow-200'>
        {title}
      </h4>
      <p className='text-sm text-yellow-700 dark:text-yellow-300'>{message}</p>
    </div>
  );
};

// Helper function to detect current context
function detectStorageContext(): StorageContext {
  // Check for server-side rendering
  if (!isBrowser()) {
    return 'server';
  }

  // Check for hydration phase
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    return 'hydrating';
  }

  // Safe check for extension context
  try {
    if (
      typeof (window as any).chrome !== 'undefined' &&
      (window as any).chrome.storage
    ) {
      return 'extension';
    }
  } catch (e) {
    // Silently handle extension check errors
  }

  // Safe check for iframe
  try {
    if (window.top !== window.self) {
      return 'iframe';
    }
  } catch (e) {
    // If this errors, we're probably in a cross-origin iframe
    return 'iframe'; // Assume iframe with restrictions
  }

  // Check for insecure context (non-HTTPS except localhost)
  try {
    if (!window.isSecureContext) {
      return 'insecure';
    }
  } catch (e) {
    // Silently handle secure context check errors
  }

  // Check for incognito/private mode or storage restrictions
  try {
    if (typeof window.localStorage !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      window.sessionStorage.setItem(testKey, testKey);
      window.sessionStorage.removeItem(testKey);
      return 'browser';
    }
    return 'unknown';
  } catch (e) {
    // If storage test fails but browser isn't otherwise identified as a specific context
    return 'incognito';
  }
}

export function StorageContextWarning() {
  const [context, setContext] = useState<StorageContext>('server'); // Start with server context
  const [usingFallback, setUsingFallback] = useState(true); // Start with safe default
  const [showWarning, setShowWarning] = useState(true);
  const hydrated = useIsHydrated();

  // Initialize after hydration is complete
  useEffect(() => {
    if (!hydrated) return;

    // Small delay to ensure all other components have also hydrated
    const timerId = setTimeout(() => {
      try {
        // Safely detect context
        let detectedContext: StorageContext = 'unknown';
        try {
          detectedContext = detectStorageContext();
        } catch (error) {
          console.warn('Error detecting storage context:', error);
          detectedContext = 'unknown';
        }
        
        // Safely check fallback status
        let fallbackStatus = true; // Safe default
        try {
          fallbackStatus = isUsingFallbackStorage();
        } catch (error) {
          console.warn('Error checking fallback storage status:', error);
        }
        
        // Update state
        setContext(detectedContext);
        setUsingFallback(fallbackStatus);
      } catch (e) {
        console.error('Error in StorageContextWarning initialization:', e);
        // Set safe defaults
        setContext('unknown');
        setUsingFallback(true);
      }
    }, 100);

    return () => clearTimeout(timerId);
  }, [hydrated]);

  // Don't render during SSR or before hydration
  if (!hydrated || !showWarning) {
    return null;
  }

  return (
    <div className='relative'>
      <WarningMessage context={context} usingFallback={usingFallback} />
      {usingFallback && (
        <button
          onClick={() => setShowWarning(false)}
          className='absolute top-2 right-2 text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100'
          aria-label='Dismiss'
        >
          <svg className='w-4 h-4' viewBox='0 0 20 20' fill='currentColor'>
            <path
              fillRule='evenodd'
              d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
              clipRule='evenodd'
            />
          </svg>
        </button>
      )}
    </div>
  );
}
