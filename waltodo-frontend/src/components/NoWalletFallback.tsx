'use client';

/**
 * NoWalletFallback - Graceful fallback UI when wallet features are unavailable
 * 
 * Provides an informative and actionable interface for users who don't have
 * wallets installed or when wallet features are disabled/unavailable
 */

import React from 'react';
import { analytics } from '@/lib/analytics';

interface NoWalletFallbackProps {
  variant?: 'full' | 'inline' | 'minimal';
  title?: string;
  description?: string;
  showInstallButton?: boolean;
  showBrowseMode?: boolean;
  className?: string;
  onBrowseMode?: () => void;
}

export function NoWalletFallback({
  variant = 'full',
  title,
  description,
  showInstallButton = true,
  showBrowseMode = true,
  className = '',
  onBrowseMode,
}: NoWalletFallbackProps) {
  const handleInstallWallet = () => {
    // Track install button click
    if (analytics) {
      analytics.trackWallet({
        action: 'install_click',
        source: 'no_wallet_fallback',
      });
    }

    // Open Slush wallet installation page
    window.open('https://chromewebstore.google.com/detail/slush-%E2%80%94-a-sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil', '_blank');
  };

  const handleBrowseMode = () => {
    if (analytics) {
      analytics.trackEvent({
        name: 'browse_mode_enabled',
        source: 'no_wallet_fallback',
      });
    }

    if (onBrowseMode) {
      onBrowseMode();
    }
  };

  if (variant === 'minimal') {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-sm text-gray-600 mb-3">
          {description || 'Wallet required for this feature'}
        </p>
        {showInstallButton && (
          <button
            onClick={handleInstallWallet}
            className="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Install Wallet
          </button>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-800">
              {title || 'Wallet Required'}
            </h4>
            <p className="text-sm text-blue-700">
              {description || 'Connect a Sui wallet to access blockchain features'}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          {showBrowseMode && (
            <button
              onClick={handleBrowseMode}
              className="px-3 py-2 text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors"
            >
              Browse Mode
            </button>
          )}
          {showInstallButton && (
            <button
              onClick={handleInstallWallet}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Install Wallet
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full variant (default)
  return (
    <div className={`text-center py-12 px-6 ${className}`}>
      <div className="max-w-md mx-auto">
        {/* Wallet Icon */}
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">
          {title || 'Wallet Not Connected'}
        </h3>
        
        <p className="text-gray-600 mb-6 leading-relaxed">
          {description || (
            <>
              To access blockchain features like creating NFTs and managing todos on the Sui network, 
              you'll need to install and connect a Sui wallet.
            </>
          )}
        </p>

        {/* Features that require wallet */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Features requiring a wallet:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Create and manage Todo NFTs
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Store data on Walrus network
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Interact with smart contracts
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {showInstallButton && (
            <button
              onClick={handleInstallWallet}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Install Slush Wallet
            </button>
          )}

          {showBrowseMode && (
            <button
              onClick={handleBrowseMode}
              className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Continue in Browse Mode
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 text-xs text-gray-500">
          <p>
            New to crypto wallets?{' '}
            <a 
              href="https://docs.sui.io/guides/developer/getting-started/sui-install"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              Learn more about Sui wallets
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Specialized variants for common use cases
export function ConnectWalletPrompt({ className = '' }: { className?: string }) {
  return (
    <NoWalletFallback
      variant="inline"
      title="Connect Your Wallet"
      description="Connect your Sui wallet to access all features"
      className={className}
    />
  );
}

export function WalletRequiredBanner({ className = '' }: { className?: string }) {
  return (
    <NoWalletFallback
      variant="minimal"
      description="A Sui wallet is required for this action"
      className={className}
    />
  );
}

export function InstallWalletCard({ className = '' }: { className?: string }) {
  return (
    <NoWalletFallback
      variant="full"
      title="Get Started with Sui"
      description="Install the Slush wallet to create todos, mint NFTs, and interact with the Sui blockchain."
      showBrowseMode={false}
      className={className}
    />
  );
}

export default NoWalletFallback;