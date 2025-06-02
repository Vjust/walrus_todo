'use client';

/**
 * LoadingLayout - App-wide loading states during hydration and initialization
 * 
 * Provides consistent loading experiences for different app states:
 * - Initial app hydration
 * - Wallet initialization
 * - Network connection
 * - Component mounting
 */

import React, { useEffect, useState } from 'react';
import { WalletSkeleton } from './WalletSkeleton';

interface LoadingLayoutProps {
  children: React.ReactNode;
  loading?: boolean;
  type?: 'hydration' | 'wallet' | 'network' | 'content';
  message?: string;
  showProgress?: boolean;
  className?: string;
}

export function LoadingLayout({
  children,
  loading = false,
  type = 'hydration',
  message,
  showProgress = false,
  className = '',
}: LoadingLayoutProps) {
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    if (showProgress && loading) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 20;
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [loading, showProgress]);

  // Handle SSR - don't show loading during initial render
  if (!mounted) {
    return (
      <div className={`min-h-screen bg-gray-50 ${className}`}>
        <AppSkeleton />
      </div>
    );
  }

  if (!loading) {
    return <>{children}</>;
  }

  const getLoadingContent = () => {
    switch (type) {
      case 'wallet':
        return (
          <WalletLoadingState 
            message={message || 'Connecting to wallet...'}
            showProgress={showProgress}
            progress={progress}
          />
        );
      case 'network':
        return (
          <NetworkLoadingState 
            message={message || 'Connecting to Sui network...'}
            showProgress={showProgress}
            progress={progress}
          />
        );
      case 'content':
        return (
          <ContentLoadingState 
            message={message || 'Loading content...'}
            showProgress={showProgress}
            progress={progress}
          />
        );
      default: // hydration
        return (
          <HydrationLoadingState 
            message={message || 'Initializing application...'}
            showProgress={showProgress}
            progress={progress}
          />
        );
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {getLoadingContent()}
    </div>
  );
}

// App skeleton for initial SSR state
function AppSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="flex items-center space-x-4">
              <WalletSkeleton variant="button" size="md" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hydration loading state
function HydrationLoadingState({ 
  message, 
  showProgress, 
  progress 
}: { 
  message: string; 
  showProgress: boolean; 
  progress: number; 
}) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md mx-auto px-6">
        {/* App Logo/Icon */}
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-3">WalTodo</h2>
        <p className="text-gray-600 mb-6">{message}</p>

        {/* Loading spinner */}
        <div className="flex justify-center mb-6">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>

        {showProgress && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        <p className="text-sm text-gray-500">
          Setting up your blockchain todo experience...
        </p>
      </div>
    </div>
  );
}

// Wallet loading state
function WalletLoadingState({ 
  message, 
  showProgress, 
  progress 
}: { 
  message: string; 
  showProgress: boolean; 
  progress: number; 
}) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>

        <h3 className="text-lg font-medium text-gray-900 mb-3">Connecting Wallet</h3>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex justify-center mb-6">
          <div className="w-6 h-6 border-2 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        </div>

        {showProgress && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        <p className="text-sm text-gray-500">
          Please check your wallet extension for any prompts...
        </p>
      </div>
    </div>
  );
}

// Network loading state
function NetworkLoadingState({ 
  message, 
  showProgress, 
  progress 
}: { 
  message: string; 
  showProgress: boolean; 
  progress: number; 
}) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        </div>

        <h3 className="text-lg font-medium text-gray-900 mb-3">Connecting to Network</h3>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex justify-center mb-6">
          <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        </div>

        {showProgress && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        <p className="text-sm text-gray-500">
          Establishing connection to Sui blockchain...
        </p>
      </div>
    </div>
  );
}

// Content loading state
function ContentLoadingState({ 
  message, 
  showProgress, 
  progress 
}: { 
  message: string; 
  showProgress: boolean; 
  progress: number; 
}) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2m-5 4h2m-2 4h6m-2 4h2" />
          </svg>
        </div>

        <h3 className="text-lg font-medium text-gray-900 mb-3">Loading Content</h3>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex justify-center mb-6">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
        </div>

        {showProgress && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-gray-600 h-2 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        <p className="text-sm text-gray-500">
          Fetching your todos and NFTs...
        </p>
      </div>
    </div>
  );
}

// Hook for managing loading states
export function useLoadingState(initialLoading = true) {
  const [loading, setLoading] = useState(initialLoading);
  const [type, setType] = useState<'hydration' | 'wallet' | 'network' | 'content'>('hydration');
  const [message, setMessage] = useState<string>();

  const startLoading = (loadingType?: typeof type, loadingMessage?: string) => {
    setLoading(true);
    if (loadingType) setType(loadingType);
    if (loadingMessage) setMessage(loadingMessage);
  };

  const stopLoading = () => {
    setLoading(false);
  };

  return {
    loading,
    type,
    message,
    startLoading,
    stopLoading,
    setType,
    setMessage,
  };
}

export default LoadingLayout;