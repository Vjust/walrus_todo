'use client';

import React from 'react';
import { ClientOnly } from '@/components/ClientOnly';
import { TodoNFTGrid } from '@/components/TodoNFTGrid';
import { useCurrentAccount } from '@mysten/dapp-kit';

// Allow dynamic rendering for client-side wallet features
export const dynamic = 'force-dynamic';

export default function NFTGalleryPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            My Todo NFT Gallery
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View and manage your Todo NFTs with advanced filtering and sorting options
          </p>
        </div>

        <ClientOnly fallback={
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Loading Gallery
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we prepare your NFT collection...
              </p>
            </div>
          </div>
        }>
          <WalletDependentGallery />
        </ClientOnly>
      </div>
    </div>
  );
}

function WalletDependentGallery() {
  const currentAccount = useCurrentAccount();
  const connectionStatus = currentAccount ? 'connected' : 'disconnected';

  return (
    <>
      {connectionStatus === 'connected' ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm" style={{ height: 'calc(100vh - 200px)' }}>
          <TodoNFTGrid className="h-full" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              Wallet Not Connected
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Please connect your wallet to view your Todo NFT collection
            </p>
            <div className="mt-6">
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => {
                  // This would typically trigger wallet connection
                  // The wallet connection is handled by the WalletConnectButton in the navbar
                  window.location.href = '/';
                }}
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature highlights */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Advanced Filtering</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Filter by status, priority, and date</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Smart Sorting</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sort by date, title, or priority</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">View Modes</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Toggle between grid and list views</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">High Performance</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Virtualized for large collections</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}