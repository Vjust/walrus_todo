'use client';

import React, { useState } from 'react';
import { useWalletContext } from '@/lib/walletContext';
import { WalletType } from '@/types/wallet';
import { WalletErrorModal } from './WalletErrorModal';
import { WalletNotInstalledError } from '@/lib/wallet-errors';

interface WalletOption {
  type: WalletType;
  name: string;
  icon: React.ReactNode;
  description: string;
}

export function WalletSelector() {
  const { 
    connected,
    connecting,
    suiConnect,
    phantomConnect,
    slushConnect,
    backpackConnect,
    error,
    setError
  } = useWalletContext();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  
  // Disable the selector if already connected or connecting
  if (connected || connecting) {
    return null;
  }
  
  // Define wallet options
  const walletOptions: WalletOption[] = [
    {
      type: 'sui',
      name: 'Sui Wallet',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.2 12L12 13.2L10.8 12L12 10.8L13.2 12Z" fill="currentColor"/>
          <path d="M12 6L13.2 7.2L12 8.4L10.8 7.2L12 6Z" fill="currentColor"/>
          <path d="M12 15.6L13.2 16.8L12 18L10.8 16.8L12 15.6Z" fill="currentColor"/>
          <path d="M16.8 10.8L18 12L16.8 13.2L15.6 12L16.8 10.8Z" fill="currentColor"/>
          <path d="M7.2 10.8L8.4 12L7.2 13.2L6 12L7.2 10.8Z" fill="currentColor"/>
          <path d="M18 7.2L19.2 8.4L18 9.6L16.8 8.4L18 7.2Z" fill="currentColor"/>
          <path d="M8.4 16.8L9.6 18L8.4 19.2L7.2 18L8.4 16.8Z" fill="currentColor"/>
          <path d="M16.8 15.6L18 16.8L16.8 18L15.6 16.8L16.8 15.6Z" fill="currentColor"/>
          <path d="M7.2 15.6L8.4 16.8L7.2 18L6 16.8L7.2 15.6Z" fill="currentColor"/>
        </svg>
      ),
      description: 'Connect with Sui Wallet'
    },
    {
      type: 'slush',
      name: 'Slush',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 14L12 10L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      description: 'Connect with Slush Wallet (Sui)'
    },
    {
      type: 'phantom',
      name: 'Phantom',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="128" height="128" rx="64" fill="currentColor"/>
          <path d="M110.584 64.9142C110.584 58.5264 105.038 53.4541 98.1817 53.4541H74.3336V64.9142H98.1817C105.038 64.9142 110.584 59.8419 110.584 53.4541C110.584 47.0663 116.129 42 123 42H29.8183C22.9617 42 17.4161 47.0724 17.4161 53.4602C17.4161 59.848 22.9617 64.9203 29.8183 64.9203H53.6664V76.3804H29.8183C22.9617 76.3804 17.4161 81.4527 17.4161 87.8405C17.4161 94.2283 22.9617 99.3006 29.8183 99.3006H98.1878C105.044 99.3006 110.59 94.2283 110.59 87.8405V64.9203C110.584 70.7865 105.038 76.3804 98.1817 76.3804H74.3336V64.9203H98.1817C105.038 64.9142 110.584 70.5081 110.584 64.9142Z" fill="white"/>
        </svg>
      ),
      description: 'Connect with Phantom Wallet (Solana)'
    },
    {
      type: 'backpack',
      name: 'Backpack',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 7h-3V5.5A2.5 2.5 0 0 0 13.5 3h-3A2.5 2.5 0 0 0 8 5.5V7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-9-1.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V7h-4V5.5zM19 18H5V9h14v9z" fill="currentColor"/>
        </svg>
      ),
      description: 'Connect with Backpack Wallet (Solana)'
    }
  ];
  
  // Check if a wallet is installed before connecting
  const checkWalletInstalled = (walletType: WalletType): boolean => {
    if (typeof window === 'undefined') return false;
    
    switch (walletType) {
      case 'sui':
        // Check for Sui/Slush wallet
        return !!window.suiWallet;
      case 'slush':
        // Slush is the new name for the Sui wallet
        return !!window.suiWallet;
      case 'phantom':
        return !!(window.solana && window.solana.isPhantom);
      case 'backpack':
        // Check for Backpack wallet - multiple ways it might be available
        return !!(
          window.xnft || 
          window.backpack || 
          (window.solana && window.solana.isBackpack)
        );
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
          walletType === 'sui' ? 'Sui' :
          walletType === 'slush' ? 'Slush' :
          walletType === 'phantom' ? 'Phantom' :
          walletType === 'backpack' ? 'Backpack' : 'Wallet';
        
        const error = new WalletNotInstalledError(walletName);
        setError(error);
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
          solanaIsBackpack: typeof window !== 'undefined' && window.solana ? !!window.solana.isBackpack : false
        });
      }
      
      // Proceed with connection if wallet is installed
      switch (walletType) {
        case 'sui':
          await suiConnect();
          break;
        case 'slush':
          await slushConnect();
          break;
        case 'phantom':
          await phantomConnect();
          break;
        case 'backpack':
          await backpackConnect();
          break;
        default:
          // No default case needed
          break;
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
    setError(null);
  };

  return (
    <div className="relative">
      {/* Show error modal when there's a wallet error */}
      {error && <WalletErrorModal error={error} onDismiss={handleDismissError} />}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isConnecting}
        className="px-4 py-2 bg-ocean-deep text-white rounded-lg hover:bg-ocean-deep/80 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        aria-expanded={isOpen}
      >
        {isConnecting ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            <span>Connect Wallet</span>
          </>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-2 w-72 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 divide-y divide-gray-200 dark:divide-gray-700">
          <div className="p-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 p-2">
              Select a wallet
            </h3>
            <div className="mt-1 divide-y divide-gray-200 dark:divide-gray-700">
              {walletOptions.map((option) => (
                <button
                  key={option.type}
                  className="w-full flex items-start p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => handleSelectWallet(option.type)}
                >
                  <div className="flex-shrink-0 text-ocean-deep dark:text-ocean-foam">
                    {option.icon}
                  </div>
                  <div className="ml-3 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {option.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
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
  );
}