'use client';

import React, { ReactNode } from 'react';
import { QueryProvider } from '@/providers/QueryProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProviderErrorBoundary } from '@/components/ProviderErrorBoundary';
import LoadingLayout from '@/components/LoadingLayout';
import { ToastProvider } from '@/components/ToastProvider';
import { SuiWalletProvider } from '@/providers/SuiWalletProvider';
import { AppInitializationProvider } from '@/contexts/AppInitializationContext';

interface ClientProvidersProps {
  children: ReactNode;
}

/**
 * ClientProviders - Wraps the app with all necessary providers in the correct order
 * 
 * This component ensures:
 * - No SSR/hydration mismatches using proper SSR-safe patterns
 * - Proper provider hierarchy (QueryClient → Wallet → App)
 * - Graceful fallbacks when providers fail
 * - Client-side only provider mounting for static export compatibility
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR/static generation, render children with a loading wrapper
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {children}
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-red-600 mb-4">
              <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              There was an error loading the application. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      }
    >
      <AppInitializationProvider>
        <ProviderErrorBoundary providerName="Query Client">
          <QueryProvider>
            <ProviderErrorBoundary providerName="Sui Wallet">
              <SuiWalletProvider
                defaultNetwork="testnet"
                autoConnect
                enableNetworkSwitching
                enableSlushWallet
              >
                <ProviderErrorBoundary providerName="Toast">
                  <ToastProvider />
                  {children}
                </ProviderErrorBoundary>
              </SuiWalletProvider>
            </ProviderErrorBoundary>
          </QueryProvider>
        </ProviderErrorBoundary>
      </AppInitializationProvider>
    </ErrorBoundary>
  );
}