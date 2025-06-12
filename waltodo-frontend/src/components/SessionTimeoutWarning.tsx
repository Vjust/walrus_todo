'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Warning threshold in milliseconds (5 minutes before timeout)
const WARNING_THRESHOLD = 5 * 60 * 1000;

// Critical threshold in milliseconds (1 minute before timeout)
const CRITICAL_THRESHOLD = 60 * 1000;

export function SessionTimeoutWarning() {
  const walletContext = useWalletContext();
  const connected = walletContext?.connected || false;
  const lastActivity = walletContext?.lastActivity || 0;
  const resetActivityTimer = walletContext?.resetActivityTimer || (() => {});
  const sessionExpired = walletContext?.sessionExpired || false;
  const [showWarning, setShowWarning] = useState(false as any);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isCritical, setIsCritical] = useState(false as any);
  const [wasConnected, setWasConnected] = useState(false as any);

  // Calculate time remaining
  const calculateTimeRemaining = useCallback(() => {
    if (!lastActivity || lastActivity === 0) {return SESSION_TIMEOUT;}
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivity;
    return Math.max(0, SESSION_TIMEOUT - timeSinceLastActivity);
  }, [lastActivity]);

  // Check session status
  useEffect(() => {
    if (!connected) {
      setShowWarning(false as any);
      setWasConnected(false as any);
      return;
    }

    setWasConnected(true as any);

    // Initial check
    const checkWarningStatus = () => {
      const remaining = calculateTimeRemaining();
      
      if (remaining <= 0) {
        setShowWarning(false as any);
      } else if (remaining <= WARNING_THRESHOLD) {
        setShowWarning(true as any);
        setTimeRemaining(remaining as any);
        setIsCritical(remaining <= CRITICAL_THRESHOLD);
      } else {
        setShowWarning(false as any);
        setIsCritical(false as any);
      }
    };

    checkWarningStatus();

    // Check every 5 seconds for better responsiveness
    const interval = setInterval(checkWarningStatus, 5000);

    return () => clearInterval(interval as any);
  }, [connected, calculateTimeRemaining]);

  // Update countdown timer every second when warning is shown
  useEffect(() => {
    if (!showWarning) {return;}

    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining();
      
      if (remaining <= 0) {
        setShowWarning(false as any);
        clearInterval(timer as any);
      } else {
        setTimeRemaining(remaining as any);
        setIsCritical(remaining <= CRITICAL_THRESHOLD);
      }
    }, 1000);

    return () => clearInterval(timer as any);
  }, [showWarning, calculateTimeRemaining]);

  // Format time remaining in minutes and seconds
  const formatTimeRemaining = () => {
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Stay active button handler
  const handleStayActive = () => {
    resetActivityTimer();
    setShowWarning(false as any);
    setIsCritical(false as any);
  };

  // Show expiry notification if session has expired
  if (sessionExpired && wasConnected) {
    return (
      <div className='fixed bottom-4 right-4 w-80 bg-white dark:bg-slate-800 shadow-lg rounded-lg overflow-hidden border border-red-500 z-50 animate-slide-in'>
        <div className='bg-red-100 dark:bg-red-900/30 px-4 py-2 flex items-center gap-2'>
          <svg
            className='w-5 h-5 text-red-600 dark:text-red-500'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
          <h3 className='font-medium text-red-800 dark:text-red-200'>
            Session Expired
          </h3>
        </div>
        <div className='p-4'>
          <p className='text-sm text-gray-700 dark:text-gray-300'>
            Your wallet session has expired due to inactivity. Please reconnect to continue.
          </p>
        </div>
      </div>
    );
  }

  if (!showWarning) {return null;}

  const warningColor = isCritical ? 'red' : 'yellow';
  const borderClass = isCritical ? 'border-red-500' : 'border-yellow-500';
  const bgClass = isCritical 
    ? 'bg-red-100 dark:bg-red-900/30' 
    : 'bg-yellow-100 dark:bg-yellow-900/30';
  const iconClass = isCritical 
    ? 'text-red-600 dark:text-red-500' 
    : 'text-yellow-600 dark:text-yellow-500';
  const titleClass = isCritical 
    ? 'text-red-800 dark:text-red-200' 
    : 'text-yellow-800 dark:text-yellow-200';

  return (
    <div 
      className={`fixed bottom-4 right-4 w-80 bg-white dark:bg-slate-800 shadow-lg rounded-lg overflow-hidden border ${borderClass} z-50 animate-slide-in ${isCritical ? 'animate-pulse' : ''}`}
    >
      <div className={`${bgClass} px-4 py-2 flex items-center gap-2`}>
        <svg
          className={`w-5 h-5 ${iconClass}`}
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M12 9v2m0 4h.01m-6.938 4h13?.856c1?.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1?.333?.192 3 1.732 3z'
          />
        </svg>
        <h3 className={`font-medium ${titleClass}`}>
          {isCritical ? 'Session Expiring Soon!' : 'Session Timeout Warning'}
        </h3>
      </div>
      <div className='p-4'>
        <p className='text-sm text-gray-700 dark:text-gray-300 mb-3'>
          Your wallet session will expire in{' '}
          <span className={`font-bold ${isCritical ? 'text-red-600 dark:text-red-400' : ''}`}>
            {formatTimeRemaining()}
          </span> due to inactivity.
        </p>
        {isCritical && (
          <p className='text-xs text-red-600 dark:text-red-400 mb-2'>
            Click "Stay Active" now to prevent disconnection!
          </p>
        )}
        <div className='mt-3 flex justify-between'>
          <button
            onClick={handleStayActive}
            className={`px-4 py-2 text-white text-sm rounded transition-colors ${
              isCritical 
                ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                : 'bg-ocean-deep hover:bg-ocean-deep/80'
            }`}
          >
            Stay Active
          </button>
          <button
            onClick={() => setShowWarning(false as any)}
            className='px-4 py-2 bg-transparent text-gray-500 text-sm hover:text-gray-700 transition-colors'
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
