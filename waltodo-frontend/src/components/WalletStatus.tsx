'use client';

import React from 'react';
import { useClientSafeWallet } from '@/hooks/useClientSafeWallet';
import { WalletStatusSkeleton } from './WalletSkeleton';
import WalletErrorBoundary from './WalletErrorBoundary';

export function WalletStatus() {
  return (
    <WalletErrorBoundary
      fallback={<WalletStatusError />}
      showRetry={false}
      className="inline-block"
    >
      <WalletStatusContent />
    </WalletErrorBoundary>
  );
}

function WalletStatusContent() {
  const { connected, address, name, network, error, isLoading } = useClientSafeWallet();

  // Show loading state during hydration
  if (isLoading) {
    return <WalletStatusSkeleton />;
  }

  if (error) {
    return <WalletStatusError message={error} />;
  }

  if (!connected || !address) {
    return (
      <div className='inline-flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full'>
        <div className='w-2 h-2 rounded-full bg-gray-400' />
        <span className='text-sm text-gray-600 dark:text-gray-400'>
          Not Connected
        </span>
      </div>
    );
  }

  return (
    <div className='inline-flex items-center gap-2 px-3 py-1 bg-ocean-deep/10 dark:bg-ocean-foam/10 rounded-full'>
      <div className='w-2 h-2 rounded-full bg-green-500' />
      <span className='text-sm text-ocean-deep dark:text-ocean-foam'>
        {name || 'Sui Wallet'} • {network}
      </span>
    </div>
  );
}

function WalletStatusError({ message }: { message?: string }) {
  return (
    <div className='inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/20 rounded-full'>
      <div className='w-2 h-2 rounded-full bg-red-500' />
      <span className='text-sm text-red-700 dark:text-red-300'>
        {message || 'Wallet Error'}
      </span>
    </div>
  );
}
