'use client';

import React, { ReactNode } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { useSSRSafeMounted } from '@/hooks/useSSRSafe';

interface HydrationGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireWallet?: boolean;
  requireConnection?: boolean;
  minLoadingTime?: number; // Minimum time to show loading to prevent flash
}

/**
 * HydrationGuard component that prevents hydration mismatches and ensures
 * wallet-dependent content renders only when appropriate conditions are met.
 * 
 * This component addresses common SSR/hydration issues with wallet integrations:
 * - Prevents wallet state differences between server and client
 * - Provides consistent loading states
 * - Handles wallet connection requirements gracefully
 * - Optionally enforces minimum loading time to prevent UI flash
 */
export function HydrationGuard({
  children,
  fallback,
  requireWallet = false,
  requireConnection = false,
  minLoadingTime = 0,
}: HydrationGuardProps) {
  const { mounted, isReady } = useSSRSafeMounted({ minMountTime: minLoadingTime });
  const walletContext = useWalletContext();

  // Determine if we should show content
  const shouldShowContent = (() => {
    // Must be hydrated and minimum time elapsed
    if (!isReady) {
      return false;
    }

    // If wallet is required, context must exist
    if (requireWallet && !walletContext) {
      return false;
    }

    // If connection is required, wallet must be connected
    if (requireConnection && !walletContext?.connected) {
      return false;
    }

    return true;
  })();

  // Explicit return value handling for all code paths

  // Show loading state (but not during static generation)
  if (!shouldShowContent) {
    // During static generation, render children to avoid hydration mismatch
    if (typeof window === 'undefined') {
      return <>{children}</>;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    // Default loading component
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <div className="text-sm text-gray-600">
            {!mounted 
              ? 'Initializing...'
              : !isReady
              ? 'Loading...'
              : requireWallet && !walletContext
              ? 'Loading wallet...'
              : requireConnection && !walletContext?.connected
              ? 'Waiting for wallet connection...'
              : 'Loading...'
            }
          </div>
        </div>
      </div>
    );
  }

  // Show wallet connection prompt if needed
  if (requireConnection && walletContext && !walletContext.connected && !walletContext.connecting) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-center max-w-md">
          <svg
            className="w-12 h-12 text-blue-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            Connect Your Wallet
          </h3>
          <p className="text-blue-700 mb-4">
            This feature requires a wallet connection to access your todos and NFTs.
          </p>
          <button
            onClick={() => walletContext.connect()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Show connecting state
  if (requireConnection && walletContext?.connecting) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            Connecting Wallet
          </h3>
          <p className="text-yellow-700">
            Please check your wallet and approve the connection request.
          </p>
        </div>
      </div>
    );
  }

  // All conditions met, render children
  return <>{children}</>;
}

/**
 * Higher-order component that wraps components with HydrationGuard
 */
export function withHydrationGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardOptions: Omit<HydrationGuardProps, 'children'> = {}
) {
  const GuardedComponent = (props: P) => (
    <HydrationGuard {...guardOptions}>
      <Component {...props} />
    </HydrationGuard>
  );

  GuardedComponent.displayName = `withHydrationGuard(${Component.displayName || Component.name})`;
  
  return GuardedComponent;
}

/**
 * Custom hook that provides hydration-safe wallet state
 */
export function useHydrationSafeWallet() {
  const { mounted, isReady } = useSSRSafeMounted();
  const walletContext = useWalletContext();

  return {
    isHydrated: mounted,
    wallet: isReady ? walletContext : null,
    isReady: isReady && walletContext !== null,
    isConnected: isReady && walletContext?.connected === true,
    isConnecting: isReady && walletContext?.connecting === true,
    hasError: isReady && walletContext?.error !== null,
  };
}

export default HydrationGuard;