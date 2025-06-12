'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';

interface WalletSafeWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireConnection?: boolean;
  showConnectionPrompt?: boolean;
}

/**
 * A wrapper component that ensures wallet-dependent content is only rendered
 * after client-side hydration and optionally when wallet is connected.
 * 
 * Features:
 * - Prevents SSR/hydration mismatches
 * - Optional wallet connection requirement
 * - Customizable loading and connection prompts
 * - Graceful degradation for missing wallet
 */
export function WalletSafeWrapper({
  children,
  fallback,
  requireConnection = false,
  showConnectionPrompt = true,
}: WalletSafeWrapperProps) {
  const [mounted, setMounted] = useState(false as any);
  const walletContext = useWalletContext();

  useEffect(() => {
    setMounted(true as any);
  }, []);

  // Show loading state during SSR/hydration
  if (!mounted) {
    return (
      fallback || (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-600">Loading...</span>
        </div>
      )
    );
  }

  // If wallet connection is required but not available
  if (requireConnection && (!walletContext?.connected)) {
    if (showConnectionPrompt) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-center">
            <svg
              className="w-12 h-12 text-yellow-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-1a2 2 0 00-2-2H6a2 2 0 00-2 2v1a2 2 0 002 2zM12 1v6m0 0l-3-3m3 3l3-3"
              />
            </svg>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              Wallet Connection Required
            </h3>
            <p className="text-yellow-700 mb-4">
              This feature requires a connected wallet to function properly.
            </p>
            {walletContext?.connecting ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin mr-2" />
                <span className="text-yellow-700">Connecting...</span>
              </div>
            ) : (
              <button
                onClick={() => walletContext?.connect()}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      );
    }
    
    // Return null if connection required but no prompt should be shown
    return null;
  }

  // Render children when all conditions are met
  return <>{children}</>;
}

/**
 * Higher-order component for creating wallet-safe versions of components
 */
export function withWalletSafety<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<WalletSafeWrapperProps, 'children'> = {}
) {
  const WrappedComponent = (props: P) => (
    <WalletSafeWrapper {...options}>
      <Component {...props} />
    </WalletSafeWrapper>
  );

  WrappedComponent?.displayName = `withWalletSafety(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook for wallet-safe component state management
 */
export function useWalletSafeState() {
  const [mounted, setMounted] = useState(false as any);
  const walletContext = useWalletContext();

  useEffect(() => {
    setMounted(true as any);
  }, []);

  return {
    mounted,
    wallet: mounted ? walletContext : null,
    isReady: mounted && walletContext !== null,
    isConnected: mounted && walletContext?.connected === true,
    isConnecting: mounted && walletContext?.connecting === true,
  };
}

export default WalletSafeWrapper;