/**
 * React component for displaying blockchain event connection status
 * Shows real-time connection state with visual indicators
 */

'use client';

import React, { useState } from 'react';
import { useEventConnectionStatus } from '@/hooks/useBlockchainEvents';

interface BlockchainEventStatusProps {
  className?: string;
  showReconnectButton?: boolean;
  showDetails?: boolean;
  compact?: boolean;
}

export function BlockchainEventStatus({ 
  className = '',
  showReconnectButton = true,
  showDetails = false,
  compact = false
}: BlockchainEventStatusProps) {
  const { 
    connectionState, 
    statusColor, 
    statusText, 
    canReconnect, 
    reconnect 
  } = useEventConnectionStatus();
  
  const [showDetailsState, setShowDetailsState] = useState(showDetails);

  const getIndicatorClasses = () => {
    const baseClasses = 'inline-block w-2 h-2 rounded-full mr-2';
    switch (statusColor) {
      case 'green':
        return `${baseClasses} bg-green-500`;
      case 'yellow':
        return `${baseClasses} bg-yellow-500 animate-pulse`;
      case 'red':
        return `${baseClasses} bg-red-500`;
      default:
        return `${baseClasses} bg-gray-400`;
    }
  };

  const handleReconnect = async () => {
    try {
      await reconnect();
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center text-sm ${className}`}>
        <span className={getIndicatorClasses()}></span>
        <span className="text-gray-600 dark:text-gray-300">
          {connectionState.connected ? 'Live' : 'Offline'}
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className={getIndicatorClasses()}></span>
          <div>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Blockchain Events
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {statusText}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {!compact && (
            <button
              onClick={() => setShowDetailsState(!showDetailsState)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {showDetailsState ? 'Hide' : 'Details'}
            </button>
          )}
          
          {showReconnectButton && canReconnect && (
            <button
              onClick={handleReconnect}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>

      {showDetailsState && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-900 dark:text-gray-100">
                Status
              </dt>
              <dd className="text-gray-600 dark:text-gray-400">
                {connectionState.connected ? 'Connected' : 'Disconnected'}
              </dd>
            </div>
            
            <div>
              <dt className="font-medium text-gray-900 dark:text-gray-100">
                Reconnect Attempts
              </dt>
              <dd className="text-gray-600 dark:text-gray-400">
                {connectionState.reconnectAttempts}
              </dd>
            </div>
            
            {connectionState.lastReconnectAttempt > 0 && (
              <div className="col-span-2">
                <dt className="font-medium text-gray-900 dark:text-gray-100">
                  Last Reconnect Attempt
                </dt>
                <dd className="text-gray-600 dark:text-gray-400">
                  {new Date(connectionState.lastReconnectAttempt).toLocaleString()}
                </dd>
              </div>
            )}
            
            {connectionState.error && (
              <div className="col-span-2">
                <dt className="font-medium text-red-600 dark:text-red-400">
                  Error
                </dt>
                <dd className="text-red-600 dark:text-red-400 font-mono text-xs">
                  {connectionState.error.message}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

/**
 * Simple status indicator for nav bars or headers
 */
export function BlockchainEventIndicator({ className = '' }: { className?: string }) {
  return (
    <BlockchainEventStatus 
      className={className}
      compact={true}
      showReconnectButton={false}
      showDetails={false}
    />
  );
}