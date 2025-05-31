'use client';

import React, { useEffect, useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Warning threshold in milliseconds (5 minutes before timeout)
const WARNING_THRESHOLD = 5 * 60 * 1000;

export function SessionTimeoutWarning() {
  const walletContext = useWalletContext();
  const connected = walletContext?.connected || false;
  const lastActivity = walletContext?.lastActivity || 0;
  const resetActivityTimer = walletContext?.resetActivityTimer || (() => {});
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!connected) {
      setShowWarning(false);
      return;
    }

    // Check every 30 seconds to see if we're approaching timeout
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      const timeUntilTimeout = SESSION_TIMEOUT - timeSinceLastActivity;

      // If we're within the warning threshold, show the warning
      if (timeUntilTimeout <= WARNING_THRESHOLD && timeUntilTimeout > 0) {
        setShowWarning(true);
        setTimeRemaining(timeUntilTimeout);
      } else {
        setShowWarning(false);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [connected, lastActivity]);

  // Update countdown timer every second when warning is shown
  useEffect(() => {
    if (!showWarning) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      const timeUntilTimeout = SESSION_TIMEOUT - timeSinceLastActivity;

      if (timeUntilTimeout <= 0) {
        setShowWarning(false);
        clearInterval(timer);
      } else {
        setTimeRemaining(timeUntilTimeout);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [showWarning, lastActivity]);

  // Format time remaining in minutes and seconds
  const formatTimeRemaining = () => {
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Stay active button handler
  const handleStayActive = () => {
    resetActivityTimer();
    setShowWarning(false);
  };

  if (!showWarning) return null;

  return (
    <div className='fixed bottom-4 right-4 w-80 bg-white dark:bg-slate-800 shadow-lg rounded-lg overflow-hidden border border-yellow-500 z-50'>
      <div className='bg-yellow-100 dark:bg-yellow-900/30 px-4 py-2 flex items-center gap-2'>
        <svg
          className='w-5 h-5 text-yellow-600 dark:text-yellow-500'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
          />
        </svg>
        <h3 className='font-medium text-yellow-800 dark:text-yellow-200'>
          Session Timeout Warning
        </h3>
      </div>
      <div className='p-4'>
        <p className='text-sm text-gray-700 dark:text-gray-300 mb-3'>
          Your wallet session will expire in{' '}
          <span className='font-bold'>{formatTimeRemaining()}</span> due to
          inactivity.
        </p>
        <div className='mt-3 flex justify-between'>
          <button
            onClick={handleStayActive}
            className='px-4 py-2 bg-ocean-deep text-white text-sm rounded hover:bg-ocean-deep/80 transition-colors'
          >
            Stay Active
          </button>
          <button
            onClick={() => setShowWarning(false)}
            className='px-4 py-2 bg-transparent text-gray-500 text-sm hover:text-gray-700 transition-colors'
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
