'use client';

import React from 'react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import WalletConnectButton from '@/components/WalletConnectButton';
import Link from 'next/link';

/**
 * WalletDependentHeaderActions - Header actions that depend on wallet connection state
 */
export function WalletDependentHeaderActions() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();

  if (!account) {
    return (
      <WalletConnectButton 
        variant="outline" 
        size="sm"
      />
    );
  }

  return (
    <div className="flex items-center space-x-3">
      {/* Account info */}
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-sm text-gray-600">
          {account.address.slice(0, 6)}...{account.address.slice(-4)}
        </span>
      </div>

      {/* Navigation */}
      <Link
        href="/create-nft"
        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
      >
        Create NFT
      </Link>

      <Link
        href="/nft-gallery"
        className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
      >
        Gallery
      </Link>

      {/* Disconnect button */}
      <button
        onClick={() => disconnect()}
        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}