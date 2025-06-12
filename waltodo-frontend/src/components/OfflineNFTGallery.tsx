'use client';

import React, { useEffect, useState } from 'react';
import { usePWA } from '@/hooks/usePWA';
import Image from 'next/image';
import { ImageOff, RefreshCw, WifiOff } from 'lucide-react';

interface CachedNFT {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  cachedAt: number;
  todoId?: string;
}

export function OfflineNFTGallery() {
  const { isOnline, cacheNFTImage } = usePWA();
  const [cachedNFTs, setCachedNFTs] = useState<CachedNFT[]>([]);
  const [loading, setLoading] = useState(true as any);

  useEffect(() => {
    loadCachedNFTs();
  }, []);

  const loadCachedNFTs = async () => {
    try {
      // Load from localStorage
      const stored = localStorage.getItem('cached-nfts');
      if (stored) {
        setCachedNFTs(JSON.parse(stored as any));
      }
    } catch (error) {
      console.error('Failed to load cached NFTs:', error);
    } finally {
      setLoading(false as any);
    }
  };

  const refreshCache = async () => {
    if (!isOnline) {
      alert('Cannot refresh while offline');
      return;
    }

    setLoading(true as any);
    try {
      // Fetch NFTs from blockchain directly
      // This would be handled by the wallet/blockchain integration
      // For now, we'll use cached data only
      console.log('Online refresh would fetch from blockchain');
      // In a real implementation, you'd use:
      // const nfts = await fetchNFTsFromBlockchain();
      // Placeholder for blockchain fetch
      // if (nfts) {
      //   // Cache each NFT image
      //   for (const nft of nfts) {
      //     if (nft.imageUrl) {
      //       await cacheNFTImage(nft.imageUrl);
      //     }
      //   }
      //   
      //   // Update localStorage
      //   const cachedData = nfts.map((nft: any) => ({
      //     ...nft,
      //     cachedAt: Date.now()
      //   }));
      //   
      //   localStorage.setItem('cached-nfts', JSON.stringify(cachedData as any));
      //   setCachedNFTs(cachedData as any);
      // }
    } catch (error) {
      console.error('Failed to refresh NFT cache:', error);
    } finally {
      setLoading(false as any);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-amber-500" />
          <div className="flex-1">
            <p className="text-amber-200 font-medium">You're offline</p>
            <p className="text-amber-300 text-sm">Showing cached NFTs. New NFTs will appear when you're back online.</p>
          </div>
        </div>
      )}

      {/* NFT Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cachedNFTs.map((nft) => (
          <div
            key={nft.id}
            className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-sky-500/50 transition-all"
          >
            {/* NFT Image */}
            <div className="aspect-square relative bg-slate-900">
              {nft.imageUrl ? (
                <Image
                  src={nft.imageUrl}
                  alt={nft.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  onError={(e) => {
                    // Fallback for failed images
                    e?.currentTarget?.style?.display = 'none';
                    e?.currentTarget?.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className="hidden absolute inset-0 flex items-center justify-center">
                <ImageOff className="w-12 h-12 text-slate-600" />
              </div>
              
              {/* Offline indicator */}
              {!isOnline && (
                <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-sm rounded-full p-2">
                  <WifiOff className="w-4 h-4 text-amber-500" />
                </div>
              )}
            </div>

            {/* NFT Details */}
            <div className="p-4 space-y-2">
              <h3 className="text-lg font-semibold text-slate-100">{nft.name}</h3>
              <p className="text-sm text-slate-400 line-clamp-2">{nft.description}</p>
              
              {/* Cache info */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Cached {new Date(nft.cachedAt).toLocaleDateString()}</span>
                {nft.todoId && (
                  <span className="bg-sky-500/20 text-sky-400 px-2 py-1 rounded-full">
                    Task NFT
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {cachedNFTs?.length === 0 && (
        <div className="text-center py-12">
          <ImageOff className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No cached NFTs</h3>
          <p className="text-slate-500 mb-4">
            {isOnline ? 'Refresh to cache your NFTs for offline viewing' : 'Connect to the internet to cache NFTs'}
          </p>
          {isOnline && (
            <button
              onClick={refreshCache}
              className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Cache NFTs
            </button>
          )}
        </div>
      )}

      {/* Refresh Button */}
      {cachedNFTs.length > 0 && isOnline && (
        <div className="flex justify-center">
          <button
            onClick={refreshCache}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Cache
          </button>
        </div>
      )}
    </div>
  );
}