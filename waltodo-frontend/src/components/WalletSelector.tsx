'use client';

import React, { useState } from 'react';
import { useClientSafeWallet } from '@/hooks/useClientSafeWallet';
import { WalletType } from '@/types/wallet';
import { WalletErrorModal } from './WalletErrorModal';
import { WalletNotInstalledError, WalletError } from '@/lib/wallet-errors';

interface WalletOption {
  type: WalletType;
  name: string;
  icon: React.ReactNode;
  description: string;
}

export function WalletSelector() {
  const { connected, connecting, connect, error, clearError, isLoading } =
    useClientSafeWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);

  // Show loading state during initialization
  if (isLoading) {
    return (
      <div className='px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg'>
        <span className='text-sm text-gray-600 dark:text-gray-400'>Loading wallet...</span>
      </div>
    );
  }

  // Disable the selector if already connected or connecting
  if (connected || connecting) {
    return null;
  }

  // Define wallet options - simplified to Sui wallets primarily
  const walletOptions: WalletOption[] = [
    {
      type: 'sui',
      name: 'Sui Wallet',
      icon: (
        <svg
          className='w-6 h-6'
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M13.2 12L12 13.2L10.8 12L12 10.8L13.2 12Z'
            fill='currentColor'
          />
          <path d='M12 6L13.2 7.2L12 8.4L10.8 7.2L12 6Z' fill='currentColor' />
          <path
            d='M12 15.6L13.2 16.8L12 18L10.8 16.8L12 15.6Z'
            fill='currentColor'
          />
          <path
            d='M16.8 10.8L18 12L16.8 13.2L15.6 12L16.8 10.8Z'
            fill='currentColor'
          />
          <path
            d='M7.2 10.8L8.4 12L7.2 13.2L6 12L7.2 10.8Z'
            fill='currentColor'
          />
          <path
            d='M18 7.2L19.2 8.4L18 9.6L16.8 8.4L18 7.2Z'
            fill='currentColor'
          />
          <path
            d='M8.4 16.8L9.6 18L8.4 19.2L7.2 18L8.4 16.8Z'
            fill='currentColor'
          />
          <path
            d='M16.8 15.6L18 16.8L16.8 18L15.6 16.8L16.8 15.6Z'
            fill='currentColor'
          />
          <path
            d='M7.2 15.6L8.4 16.8L7.2 18L6 16.8L7.2 15.6Z'
            fill='currentColor'
          />
        </svg>
      ),
      description: 'Connect with any Sui-compatible wallet',
    },
  ];

  // Check if a wallet is installed before connecting
  const checkWalletInstalled = (walletType: WalletType): boolean => {
    if (typeof window === 'undefined') return false;

    switch (walletType) {
      case 'sui':
        // Check for any Sui wallet
        return true; // Always assume available since we support any Sui wallet
      default:
        return false;
    }
  };

  // Handle wallet selection
  const handleSelectWallet = async (walletType: WalletType) => {
    setSelectedWallet(walletType);
    setIsConnecting(true);
    setIsOpen(false);

    try {
      // First check if the wallet is installed
      const isInstalled = checkWalletInstalled(walletType);

      // Add diagnostic logging for wallet detection
      console.log(`Checking ${walletType} wallet availability:`, isInstalled);

      // If wallet is not installed, show error directly
      if (!isInstalled) {
        const walletName =
          walletType === 'sui'
            ? 'Sui'
            : walletType === 'slush'
              ? 'Slush'
              : walletType === 'phantom'
                ? 'Phantom'
                : walletType === 'backpack'
                  ? 'Backpack'
                  : 'Wallet';

        const error = new WalletNotInstalledError(walletName);
        console.error('Wallet not installed:', error);
        return;
      }

      // If Backpack, add extra diagnostic info
      if (walletType === 'backpack') {
        console.log('Trying to connect to Backpack wallet');
        console.log('Checking for Backpack availability:', {
          windowDefined: typeof window !== 'undefined',
          xnft: typeof window !== 'undefined' ? !!window.xnft : false,
          backpack: typeof window !== 'undefined' ? !!window.backpack : false,
          solana: typeof window !== 'undefined' ? !!window.solana : false,
          solanaIsBackpack:
            typeof window !== 'undefined' && window.solana
              ? !!window.solana.isBackpack
              : false,
        });
      }

      // Proceed with connection if wallet is installed
      if (walletType === 'sui') {
        connect(); // This opens the modal
      }
    } catch (err) {
      console.error(`Error connecting to ${walletType} wallet:`, err);
      // Error is already handled by the wallet context
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle error dismissal
  const handleDismissError = () => {
    clearError();
  };

  return (
    <ClientOnly fallback={<div className="px-4 py-2 bg-gray-200 animate-pulse rounded-lg">Loading...</div>}>
      <div className='relative'>
        {/* Show error modal when there's a wallet error */}
        {error && (
          <WalletErrorModal 
            error={typeof error === 'string' ? new WalletError(error) : error} 
            onDismiss={handleDismissError} 
          />
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isConnecting || !mounted}
          className='px-4 py-2 bg-ocean-deep text-white rounded-lg hover:bg-ocean-deep/80 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2'
          aria-expanded={isOpen}
        >
        {isConnecting ? (
          <>
            <svg
              className='animate-spin h-4 w-4'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
            >
              <circle
                className='opacity-25'
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='4'
              ></circle>
              <path
                className='opacity-75'
                fill='currentColor'
                d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
              ></path>
            </svg>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <svg
              className='h-5 w-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'
              ></path>
            </svg>
            <span>Connect Wallet</span>
          </>
        )}
      </button>

      {isOpen && (
        <div className='absolute z-10 mt-2 w-72 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 divide-y divide-gray-200 dark:divide-gray-700'>
          <div className='p-2'>
            <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100 p-2'>
              Select a wallet
            </h3>
            <div className='mt-1 divide-y divide-gray-200 dark:divide-gray-700'>
              {walletOptions.map(option => (
                <button
                  key={option.type}
                  className='w-full flex items-start p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
                  onClick={() => handleSelectWallet(option.type)}
                >
                  <div className='flex-shrink-0 text-ocean-deep dark:text-ocean-foam'>
                    {option.icon}
                  </div>
                  <div className='ml-3 text-left'>
                    <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                      {option.name}
                    </p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      {option.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </ClientOnly>
  );
}
