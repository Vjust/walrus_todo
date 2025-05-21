'use client';

import React from 'react';
import { useWalletContext } from '@/lib/walletContext';
import { WalletType } from '@/types/wallet';

export function WalletStatus() {
  const { connected, publicKey, walletType } = useWalletContext();

  if (!connected || !publicKey) {
    return null;
  }
  
  // Helper function to get wallet display info
  const getWalletDisplayInfo = (type: WalletType) => {
    switch (type) {
      case 'sui':
        return { 
          name: 'Sui',
          color: 'bg-blue-500',
          textColor: 'text-blue-700 dark:text-blue-300'
        };
      case 'slush':
        return { 
          name: 'Slush',
          color: 'bg-cyan-500',
          textColor: 'text-cyan-700 dark:text-cyan-300'
        };
      case 'phantom':
        return { 
          name: 'Phantom',
          color: 'bg-purple-500',
          textColor: 'text-purple-700 dark:text-purple-300'
        };
      case 'backpack':
        return { 
          name: 'Backpack',
          color: 'bg-orange-500',
          textColor: 'text-orange-700 dark:text-orange-300'
        };
      default:
        return { 
          name: 'Unknown',
          color: 'bg-gray-500',
          textColor: 'text-gray-700 dark:text-gray-300'
        };
    }
  };
  
  const { name, color, textColor } = getWalletDisplayInfo(walletType);

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-ocean-deep/10 dark:bg-ocean-foam/10 rounded-full">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className={`text-sm ${textColor}`}>
        {name}
      </span>
    </div>
  );
}