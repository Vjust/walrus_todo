'use client';

import React, { useState, useEffect } from 'react';
import { detectContext, isUsingFallbackStorage, StorageContext } from '@/lib/storage-utils';

interface WarningMessageProps {
  context: StorageContext;
  usingFallback: boolean;
}

const WarningMessage: React.FC<WarningMessageProps> = ({ context, usingFallback }) => {
  if (!usingFallback) return null;
  
  const getMessageForContext = (): { title: string; message: string } => {
    switch (context) {
      case 'extension':
        return {
          title: 'Extension Storage Mode',
          message: 'Your data will not persist between sessions in this extension context.'
        };
      case 'iframe':
        return {
          title: 'Restricted Storage',
          message: 'This app is running in an iframe with limited storage access. Your data will not persist.'
        };
      case 'incognito':
        return {
          title: 'Private Browsing Detected',
          message: 'In private/incognito mode, data will not persist between sessions.'
        };
      case 'insecure':
        return {
          title: 'Non-Secure Context',
          message: 'For full functionality including persistent storage, please use HTTPS.'
        };
      case 'server':
        return {
          title: 'Server Rendering',
          message: 'Storage is not available during server rendering.'
        };
      default:
        return {
          title: 'Limited Storage Access',
          message: 'Your preferences and data will not persist between sessions.'
        };
    }
  };
  
  const { title, message } = getMessageForContext();
  
  return (
    <div className="p-2 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-100 rounded mb-4">
      <h4 className="font-medium text-yellow-800 dark:text-yellow-200">{title}</h4>
      <p className="text-sm text-yellow-700 dark:text-yellow-300">{message}</p>
    </div>
  );
};

export function StorageContextWarning() {
  const [context, setContext] = useState<StorageContext>('unknown');
  const [usingFallback, setUsingFallback] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Use two-phase mounting to ensure complete client-side initialization
  useEffect(() => {
    // First phase - mark component as mounted
    setMounted(true);
    
    // Cleanup function to handle component unmounting
    return () => setMounted(false);
  }, []);
  
  // Second phase - only run detection logic after initial mount
  useEffect(() => {
    // Skip if not mounted or not in browser
    if (!mounted || typeof window === 'undefined') return;
    
    // Use setTimeout to ensure this runs after Next.js hydration is complete
    const timer = setTimeout(() => {
      try {
        // Safely detect context with error handling
        let detectedContext: StorageContext = 'unknown';
        try {
          detectedContext = detectContext();
        } catch (error) {
          console.warn('Error detecting storage context:', error);
          detectedContext = 'unknown';
        }
        setContext(detectedContext);
        
        // Safely check if using fallback storage
        let fallbackStatus = true; // Default to true for safety
        try {
          fallbackStatus = isUsingFallbackStorage();
        } catch (error) {
          console.warn('Error checking fallback storage status:', error);
        }
        setUsingFallback(fallbackStatus);
      } catch (e) {
        console.error('Error in StorageContextWarning useEffect:', e);
        // Set safe defaults
        setContext('unknown');
        setUsingFallback(true);
      }
    }, 100); // Short delay to ensure hydration is complete
    
    return () => clearTimeout(timer);
  }, [mounted]);
  
  if (!showWarning || typeof window === 'undefined') {
    return null;
  }
  
  return (
    <div className="relative">
      <WarningMessage context={context} usingFallback={usingFallback} />
      {usingFallback && (
        <button
          onClick={() => setShowWarning(false)}
          className="absolute top-2 right-2 text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}