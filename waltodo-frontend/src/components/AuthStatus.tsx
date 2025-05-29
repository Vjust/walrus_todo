'use client';

import React, { useEffect, useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { apiClient } from '@/lib/api-client';
import toast from 'react-hot-toast';

interface AuthStatusProps {
  className?: string;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function AuthStatus({ 
  className = '', 
  showText = true,
  size = 'medium' 
}: AuthStatusProps) {
  const walletContext = useWalletContext();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

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

  useEffect(() => {
    const checkAuth = async () => {
      if (!walletContext?.connected) {
        setIsAuthenticated(false);
        return;
      }

      setIsChecking(true);
      try {
        const result = await apiClient.verify();
        setIsAuthenticated(result.valid);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
    
    // Check auth status every 30 seconds
    const interval = setInterval(checkAuth, 30000);
    
    return () => clearInterval(interval);
  }, [walletContext?.connected]);

  const getStatusColor = () => {
    if (isChecking) return 'bg-yellow-500';
    if (isAuthenticated) return 'bg-green-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (isChecking) return 'Checking...';
    if (isAuthenticated) return 'Authenticated';
    return 'Not authenticated';
  };

  const getTextColor = () => {
    if (isChecking) return 'text-yellow-600';
    if (isAuthenticated) return 'text-green-600';
    return 'text-red-600';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="relative">
        <div 
          className={`${sizeClasses[size]} rounded-full ${getStatusColor()}`}
        />
        {isAuthenticated && (
          <div 
            className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-green-500 animate-ping`}
          />
        )}
      </div>
      {showText && (
        <span className={`${textSizeClasses[size]} ${getTextColor()}`}>
          API {getStatusText()}
        </span>
      )}
    </div>
  );
}

// Minimal indicator for navbar
export function AuthIndicator({ className = '' }: { className?: string }) {
  const walletContext = useWalletContext();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      if (!walletContext?.connected) {
        setIsAuthenticated(false);
        return;
      }

      try {
        const result = await apiClient.verify();
        setIsAuthenticated(result.valid);
      } catch {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, [walletContext?.connected]);
  
  return (
    <div 
      className={`relative ${className}`} 
      title={`API ${isAuthenticated ? 'Authenticated' : 'Not authenticated'}`}
    >
      <div 
        className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`}
      />
      {isAuthenticated && (
        <div 
          className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping"
        />
      )}
    </div>
  );
}