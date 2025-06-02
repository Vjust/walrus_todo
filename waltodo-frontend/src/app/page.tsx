'use client';

import { useWalletContext } from '@/contexts/WalletContext';
import WalletConnectButton from '@/components/WalletConnectButton';
import Link from 'next/link';

export default function Home() {
  const walletContext = useWalletContext();
  const connected = walletContext?.connected || false;
  const address = walletContext?.address;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Walrus Todo
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {connected && (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Dashboard
                </Link>
              )}
              <WalletConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-12 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-6xl">
              Walrus Todo
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              A Web3 task management experience powered by Sui blockchain and Walrus decentralized storage
            </p>
            
            {connected ? (
              <div className="mt-10">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md mx-auto">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">
                        Wallet Connected
                      </h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>Address: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    Go to Dashboard
                    <svg className="ml-2 -mr-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-10">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
                  <h3 className="text-lg font-medium text-blue-900 mb-4">
                    Get Started
                  </h3>
                  <p className="text-blue-700 mb-6">
                    Connect your Sui wallet to start managing your tasks on the blockchain.
                  </p>
                  <WalletConnectButton 
                    variant="primary" 
                    size="lg"
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Features */}
            <div className="mt-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                <div className="text-center">
                  <div className="bg-blue-100 rounded-lg p-3 w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Blockchain Powered</h3>
                  <p className="text-gray-600">Your tasks are stored securely on the Sui blockchain as NFTs</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-green-100 rounded-lg p-3 w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Decentralized Storage</h3>
                  <p className="text-gray-600">Task data stored on Walrus for permanent, decentralized access</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-purple-100 rounded-lg p-3 w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Truly Yours</h3>
                  <p className="text-gray-600">Own your data completely - no central authority can access or delete it</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
