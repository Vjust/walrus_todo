'use client';

import React from 'react';
import { useWalletContext } from '@/lib/walletContext';

export function WalletStatus() {
  const { connected, publicKey, walletType } = useWalletContext();

  if (!connected || !publicKey) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-ocean-deep/10 dark:bg-ocean-foam/10 rounded-full">
      <div 
        className={`w-2 h-2 rounded-full ${
          walletType === 'sui' ? 'bg-blue-500' : 'bg-purple-500'
        }`}
      />
      <span className="text-sm text-ocean-deep dark:text-ocean-foam">
        {walletType === 'sui' ? 'Sui' : 'Phantom'}
      </span>
    </div>
  );
}