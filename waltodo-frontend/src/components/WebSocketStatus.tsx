'use client';

import React from 'react';
import { useWebSocketStatus } from '@/contexts/WebSocketContext';

interface WebSocketStatusProps {
  className?: string;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function WebSocketStatus({ 
  className = '', 
  showText = true,
  size = 'medium' 
}: WebSocketStatusProps) {
  const { isConnected, statusText, statusColor } = useWebSocketStatus();

  const sizeClasses = {
    small: 'w-2 h-2',
    medium: 'w-3 h-3',
    large: 'w-4 h-4'
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="relative">
        <div 
          className={`${sizeClasses[size]} rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        {isConnected && (
          <div 
            className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-green-500 animate-ping`}
          />
        )}
      </div>
      {showText && (
        <span className={`${textSizeClasses[size]} ${statusColor}`}>
          WebSocket {statusText}
        </span>
      )}
    </div>
  );
}

// Minimal indicator for navbar
export function WebSocketIndicator({ className = '' }: { className?: string }) {
  const { isConnected } = useWebSocketStatus();
  
  return (
    <div className={`relative ${className}`} title={`WebSocket ${isConnected ? 'Connected' : 'Disconnected'}`}>
      <div 
        className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
      />
      {isConnected && (
        <div 
          className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping"
        />
      )}
    </div>
  );
}