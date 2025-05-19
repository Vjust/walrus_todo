'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardError, getClipboardCapabilities } from '@/lib/clipboard';

interface ClipboardErrorModalProps {
  error: ClipboardError | null;
  onDismiss: () => void;
  onTryAlternative?: () => void;
}

export function ClipboardErrorModal({ 
  error, 
  onDismiss,
  onTryAlternative 
}: ClipboardErrorModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (error) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [error]);
  
  if (!error || !isVisible) {
    return null;
  }
  
  const capabilities = getClipboardCapabilities();
  
  // Determine title and message based on error type
  const getErrorInfo = () => {
    const errorName = error.name;
    
    if (errorName === 'ClipboardApiNotSupportedError') {
      return {
        title: 'Clipboard Not Supported',
        message: 'Your browser does not support clipboard operations.',
        suggestion: capabilities.hasLegacySupport 
          ? 'Try using keyboard shortcuts instead (Ctrl+C/Cmd+C)'
          : 'Try using a different browser with clipboard support.'
      };
    }
    
    if (errorName === 'ClipboardPermissionDeniedError') {
      return {
        title: 'Permission Denied',
        message: 'The browser denied permission to access the clipboard.',
        suggestion: 'Try again after clicking somewhere on the page, or use keyboard shortcuts instead.'
      };
    }
    
    if (errorName === 'InsecureContextError') {
      return {
        title: 'Secure Context Required',
        message: 'Clipboard access requires a secure context (HTTPS).',
        suggestion: 'Try accessing this site over HTTPS instead.'
      };
    }
    
    if (errorName === 'ClipboardPolyfillError') {
      return {
        title: 'Clipboard Fallback Failed',
        message: 'The clipboard fallback mechanism failed.',
        suggestion: 'Try using keyboard shortcuts to copy text manually.'
      };
    }
    
    // Default case
    return {
      title: 'Clipboard Error',
      message: error.message || 'An error occurred while accessing the clipboard.',
      suggestion: 'Try using keyboard shortcuts instead (Ctrl+C/Cmd+C).'
    };
  };
  
  const { title, message, suggestion } = getErrorInfo();
  
  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };
  
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 z-50">
      <div className="max-w-md w-full rounded-lg bg-white dark:bg-gray-800 shadow-lg overflow-hidden transform transition-all">
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {message}
                </p>
                {suggestion && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    <strong>Suggestion:</strong> {suggestion}
                  </p>
                )}
              </div>
              <div className="mt-4 flex justify-end space-x-3">
                {onTryAlternative && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDismiss();
                      onTryAlternative();
                    }}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-ocean-deep bg-ocean-light/30 rounded-md hover:bg-ocean-light/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ocean-light"
                  >
                    Try Alternative
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-ocean-medium rounded-md hover:bg-ocean-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ocean-light"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}