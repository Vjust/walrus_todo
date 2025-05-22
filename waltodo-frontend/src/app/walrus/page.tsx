/**
 * Walrus Storage Page
 * 
 * Demo page showcasing Walrus Protocol integration for decentralized todo storage.
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import WalrusStorageManager to prevent SSR issues with WASM
const WalrusStorageManager = dynamic(
  () => import('@/components/WalrusStorageManager'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Walrus Storage Manager...</p>
        </div>
      </div>
    )
  }
);

export default function WalrusPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c0-5-4-9-8-9s-8 4-8-5zm0 0V4a1 1 0 011-1h4a1 1 0 011 1v3M8 12l4 4 4-4m0 6H8" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Walrus Protocol Storage</h1>
                <p className="text-gray-600 mt-1">
                  Decentralized storage for your todos using Walrus Protocol
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Decentralized Storage</h3>
            <p className="text-gray-600 text-sm">
              Store your todos on Walrus Protocol's decentralized network for permanent, censorship-resistant storage.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Blockchain Ownership</h3>
            <p className="text-gray-600 text-sm">
              Create NFTs on Sui blockchain that reference your Walrus-stored todos for verifiable ownership.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">High Performance</h3>
            <p className="text-gray-600 text-sm">
              Enjoy fast uploads and downloads with built-in redundancy and availability guarantees.
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <WalrusStorageManager />
      </div>

      {/* Footer info */}
      <div className="bg-gray-50 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">How It Works</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 font-medium text-xs">1</span>
                  </div>
                  <p>Create a todo with your content, priority, and metadata</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 font-medium text-xs">2</span>
                  </div>
                  <p>Upload to Walrus Protocol for decentralized storage</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 font-medium text-xs">3</span>
                  </div>
                  <p>Optionally create an NFT on Sui blockchain for ownership</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 font-medium text-xs">4</span>
                  </div>
                  <p>Retrieve your todos anytime using the blob ID</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Storage Information</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  <strong>Network:</strong> Walrus Testnet
                </p>
                <p>
                  <strong>Storage Duration:</strong> 5 epochs (approximately 5 days)
                </p>
                <p>
                  <strong>Max File Size:</strong> 13 MB per todo
                </p>
                <p>
                  <strong>Redundancy:</strong> Multiple copies across decentralized nodes
                </p>
                <p>
                  <strong>Cost:</strong> Paid in WAL tokens (get testnet tokens from faucet)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}