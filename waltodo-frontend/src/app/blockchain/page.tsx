'use client';

import { useState, useEffect, Suspense } from 'react';
// import Navbar from '@/components/navbar';
import BlockchainTodoManager from '@/components/BlockchainTodoManager';
import { useWalletContext } from '@/contexts/WalletContext';
import { useSuiTodos } from '@/hooks/useSuiTodos';
import { OfflineNFTGallery } from '@/components/OfflineNFTGallery';
import { usePWA } from '@/hooks/usePWA';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';

function BlockchainPageContent() {
  const walletContext = useWalletContext();
  const connected = walletContext?.connected || false;
  const connecting = walletContext?.connecting || false;
  const account = walletContext?.account || null;
  const connect = walletContext?.connect || (() => {});
  const { state, network, isWalletReady } = useSuiTodos();
  const [showFullManager, setShowFullManager] = useState(false);
  const [showOfflineGallery, setShowOfflineGallery] = useState(false);
  const { isOnline } = usePWA();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Handle share target for NFT creation
    const action = searchParams.get('action');
    const shared = searchParams.get('shared');
    const title = searchParams.get('title');
    
    if (action === 'create-nft' && shared === 'true') {
      toast.success(`Ready to create NFT from shared content: ${title}`);
      // Here you would open the NFT creation modal with pre-filled data
    }
  }, [searchParams]);

  // Wallet connection component
  const WalletConnectionSection = () => {
    if (connected) {
      return (
        <div className='ocean-card mb-6'>
          <div className='flex justify-between items-center'>
            <div>
              <h3 className='text-lg font-semibold text-ocean-deep dark:text-ocean-foam mb-2'>
                Wallet Connected
              </h3>
              <p className='text-sm text-ocean-medium dark:text-ocean-light'>
                Address:{' '}
                <code className='bg-white/20 px-2 py-1 rounded text-xs'>
                  {account?.address}
                </code>
              </p>
              <p className='text-sm text-ocean-medium dark:text-ocean-light'>
                Network: {network} {state.networkHealth ? '✅' : '⚠️'}
              </p>
            </div>
            <div className='flex gap-2'>
              <button
                onClick={() => setShowFullManager(!showFullManager)}
                className='ocean-button text-sm'
              >
                {showFullManager ? 'Simple View' : 'Advanced Manager'}
              </button>
              <button
                onClick={() => setShowOfflineGallery(!showOfflineGallery)}
                className='ocean-button text-sm'
              >
                {showOfflineGallery ? 'Hide' : 'Show'} Offline Gallery
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className='ocean-card mb-6'>
        <div className='text-center py-8'>
          <div className='mb-4'>
            <svg
              className='w-16 h-16 mx-auto text-ocean-medium'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={1.5}
                d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
              />
            </svg>
          </div>
          <h3 className='text-xl font-semibold text-ocean-deep dark:text-ocean-foam mb-2'>
            Connect Your Wallet
          </h3>
          <p className='text-ocean-medium dark:text-ocean-light mb-6 max-w-md mx-auto'>
            Connect your Sui wallet to create, manage, and transfer TodoNFTs on
            the blockchain.
          </p>
          <button
            onClick={connect}
            disabled={connecting}
            className='ocean-button inline-flex items-center gap-2'
          >
            {connecting ? (
              <>
                <div className='w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin'></div>
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className='max-w-6xl mx-auto'>
      

      <div className='mb-8'>
        <h1 className='text-3xl font-bold mb-4 text-ocean-deep dark:text-ocean-foam'>
          Blockchain Todos
        </h1>
        <p className='text-ocean-medium dark:text-ocean-light'>
          Create, manage, and transfer your TodoNFTs on the Sui blockchain
        </p>
      </div>

      <WalletConnectionSection />

      {connected && (
        <>
          {showFullManager ? (
            <BlockchainTodoManager />
          ) : (
            <div className='ocean-card'>
              <div className='text-center py-12'>
                <h3 className='text-xl font-semibold text-ocean-deep dark:text-ocean-foam mb-2'>
                  Simple Todo View
                </h3>
                <p className='text-ocean-medium dark:text-ocean-light mb-6 max-w-md mx-auto'>
                  Switch to Advanced Manager to create and manage TodoNFTs.
                </p>
                <button
                  onClick={() => setShowFullManager(true)}
                  className='ocean-button'
                >
                  Open Advanced Manager
                </button>
              </div>
            </div>
          )}

          {/* Offline NFT Gallery */}
          {showOfflineGallery && (
            <div className='ocean-card mb-6'>
              <div className='flex justify-between items-center mb-6'>
                <h2 className='text-xl font-semibold text-ocean-deep dark:text-ocean-foam'>
                  {isOnline ? 'NFT Gallery' : 'Offline NFT Gallery'}
                </h2>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  isOnline 
                    ? 'bg-emerald-500/20 text-emerald-600' 
                    : 'bg-amber-500/20 text-amber-600'
                }`}>
                  {isOnline ? '🟢 Online' : '🟡 Offline'}
                </span>
              </div>
              <OfflineNFTGallery />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function BlockchainPage() {
  return (
    <Suspense fallback={<div className="ocean-background min-h-screen" />}>
      <BlockchainPageContent />
    </Suspense>
  );
}
