'use client';

import React from 'react';
import { TodoNFTStats } from '../../components/TodoNFTStats';
import WalletConnectButton from '../../components/WalletConnectButton';
import { ClientOnly } from '../../components/ClientOnly';

export default function NFTStatsPage() {
  return (
    <ClientOnly>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">NFT Statistics Dashboard</h1>
              <WalletConnectButton />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          <TodoNFTStats />
        </div>
      </div>
    </ClientOnly>
  );
}