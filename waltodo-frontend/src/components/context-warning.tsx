'use client';

import { useEffect, useState } from 'react';

export function ContextWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    const detectedWarnings: string[] = [];

    // Check if storage is blocked - using safer approach
    try {
      const testKey = '__test__';
      // Try-catch each storage operation individually
      try {
        localStorage.setItem(testKey, testKey);
        try {
          localStorage.removeItem(testKey);
        } catch (removeErr) {
          console.warn('Error removing test key from localStorage:', removeErr);
        }
      } catch (e) {
        detectedWarnings.push('Storage access is restricted. Some features may not work properly.');
      }
    } catch (outerErr) {
      // Catch any errors from accessing localStorage itself
      console.warn('Error accessing localStorage:', outerErr);
      detectedWarnings.push('Storage access is restricted. Some features may not work properly.');
    }

    // Check if in secure context - using safer approach
    try {
      if (!window.isSecureContext) {
        detectedWarnings.push('This app is not running in a secure context (HTTPS). Some features like clipboard access may be limited.');
      }
    } catch (e) {
      console.warn('Error checking for secure context:', e);
    }

    // Check if in iframe - using safer approach
    try {
      let isInIframe = false;
      try {
        isInIframe = window.self !== window.top;
      } catch (frameErr) {
        // If this errors, we're probably in a cross-origin iframe
        isInIframe = true;
      }
      
      if (isInIframe) {
        detectedWarnings.push('This app is running in an iframe. Some features may be restricted.');
      }
    } catch (e) {
      console.warn('Error checking for iframe context:', e);
    }

    if (detectedWarnings.length > 0) {
      setWarnings(detectedWarnings);
      setShowWarning(true);
    }
  }, []);

  if (!showWarning || warnings.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 dark:bg-yellow-900 border-b border-yellow-200 dark:border-yellow-700">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Security Context Warning
            </p>
            <ul className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              {warnings.map((warning, index) => (
                <li key={index} className="list-disc list-inside">
                  {warning}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
              For the best experience, access this app via HTTPS at{' '}
              <code>https://localhost:3001</code> or deploy to a secure domain.
            </p>
          </div>
          <button
            onClick={() => setShowWarning(false)}
            className="ml-4 text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}