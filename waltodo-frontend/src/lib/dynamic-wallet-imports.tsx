'use client';

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

/**
 * Dynamic import utility for wallet-dependent components
 * Ensures components are only loaded and rendered client-side
 */

// Loading component for dynamic imports
const WalletLoadingFallback = () => (
  <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
    <span className="ml-3 text-sm text-gray-600">Loading wallet features...</span>
  </div>
);

// Error component for failed dynamic imports
const WalletErrorFallback = () => (
  <div className="flex items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
    <div className="text-center">
      <svg
        className="w-8 h-8 text-red-500 mx-auto mb-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-sm text-red-600">Failed to load wallet component</p>
    </div>
  </div>
);

/**
 * Creates a client-side only dynamic import for wallet components
 */
export function createWalletDynamicImport<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options?: {
    loading?: ComponentType;
    error?: ComponentType;
  }
) {
  return dynamic(() => importFn(), {
    ssr: false, // Critical: disable SSR for wallet components
    loading: () => {
      const LoadingComponent = options?.loading || WalletLoadingFallback;
      return <LoadingComponent />;
    },
    // Note: Next.js dynamic doesn't have built-in error handling
    // Error boundaries should be used at the component level
  });
}

// Pre-configured dynamic imports for common wallet components
export const DynamicWalletConnectButton = createWalletDynamicImport(
  () => import('../components/WalletConnectButton')
);

export const DynamicCreateTodoForm = createWalletDynamicImport(
  () => import('../components/create-todo-form')
);

export const DynamicTodoList = createWalletDynamicImport(
  () => import('../components/todo-list')
);

export const DynamicBlockchainTodoManager = createWalletDynamicImport(
  () => import('../components/BlockchainTodoManager')
);

export const DynamicTodoNFTListView = createWalletDynamicImport(
  () => import('../components/TodoNFTListView').then(mod => ({ default: mod.TodoNFTListView }))
);

export const DynamicTransactionHistory = createWalletDynamicImport(
  () => import('../components/TransactionHistory').then(mod => ({ default: mod.TransactionHistory }))
);

export const DynamicNFTAnalytics = createWalletDynamicImport(
  () => import('../components/NFTAnalytics').then(mod => ({ default: mod.NFTAnalytics }))
);

export const DynamicTodoNFTSearch = createWalletDynamicImport(
  () => import('../components/TodoNFTSearch')
);

export const DynamicTodoNFTStats = createWalletDynamicImport(
  () => import('../components/TodoNFTStats').then(mod => ({ default: mod.TodoNFTStats }))
);

// Utility to create wallet-safe pages
export function createWalletSafePage<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>
) {
  return dynamic(() => importFn(), {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Loading Page</h2>
          <p className="text-sm text-gray-500">Initializing wallet features...</p>
        </div>
      </div>
    ),
  });
}

export default createWalletDynamicImport;