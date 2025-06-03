'use client';

import React from 'react';

interface WalletButtonSkeletonProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function WalletButtonSkeleton({ 
  size = 'md', 
  className = '' 
}: WalletButtonSkeletonProps) {
  const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm':
        return 'text-xs px-3 py-1.5 h-7';
      case 'lg':
        return 'text-base px-6 py-3 h-12';
      default:
        return 'text-sm px-4 py-2 h-10';
    }
  };

  return (
    <div
      className={`
        inline-flex items-center justify-center
        font-medium rounded-md
        bg-gray-200 text-gray-400
        animate-pulse
        ${getSizeClasses(size)}
        ${className}
      `}
      suppressHydrationWarning
    >
      <div className="flex items-center space-x-2">
        {/* Skeleton icon */}
        <div className="w-4 h-4 bg-gray-300 rounded" />
        <span>Loading...</span>
      </div>
    </div>
  );
}

interface NoWalletFallbackProps {
  variant?: 'minimal' | 'full';
  className?: string;
}

export function NoWalletFallback({ 
  variant = 'full', 
  className = '' 
}: NoWalletFallbackProps) {
  if (variant === 'minimal') {
    return (
      <button
        className={`
          inline-flex items-center justify-center
          px-4 py-2 text-sm font-medium rounded-md
          bg-gray-200 text-gray-500
          cursor-not-allowed
          ${className}
        `}
        disabled
        suppressHydrationWarning
      >
        Wallet Loading...
      </button>
    );
  }

  return (
    <div className={`text-center p-4 ${className}`} suppressHydrationWarning>
      <p className="text-gray-500 mb-2">Wallet not available</p>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        onClick={() => window.open('https://chromewebstore.google.com/detail/slush-%E2%80%94-a-sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil', '_blank')}
      >
        Install Slush Wallet
      </button>
    </div>
  );
}