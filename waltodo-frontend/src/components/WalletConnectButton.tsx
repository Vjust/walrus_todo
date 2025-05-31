'use client';

import React, { useEffect, useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';

interface WalletConnectButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

function WalletConnectButton({ 
  className = '', 
  variant = 'primary',
  size = 'md'
}: WalletConnectButtonProps) {
  const walletContext = useWalletContext();
  const [showDropdown, setShowDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
    // Check for wallet availability only on client
    if (typeof window !== 'undefined') {
      // Import useWallets dynamically to avoid SSR issues
      import('@mysten/dapp-kit').then(({ useWallets }) => {
        // This won't work as hooks can't be called dynamically
        // We'll need to check for wallet differently
      }).catch(() => {
        setHasWallet(false);
      });
      
      // Check if any wallet extensions are installed
      const checkWallets = () => {
        // Check for common Sui wallet indicators
        const hasSuiWallet = typeof window !== 'undefined' && (
          (window as any).sui || 
          (window as any).suiWallet ||
          (window as any).martian
        );
        setHasWallet(!!hasSuiWallet);
      };
      
      checkWallets();
      // Also check after a small delay as some wallets inject asynchronously
      setTimeout(checkWallets, 500);
    }
  }, []);

  const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm':
        return 'text-xs px-3 py-1.5';
      case 'lg':
        return 'text-base px-6 py-3';
      default:
        return 'text-sm px-4 py-2';
    }
  };
  
  // Handle SSR and initialization phase
  if (!mounted || !walletContext) {
    return (
      <button 
        className={`
          inline-flex items-center justify-center
          bg-gray-500 text-white
          px-4 py-2 rounded-md
          text-sm font-medium
          cursor-not-allowed opacity-50
          ${getSizeClasses(size)}
          ${className}
        `}
        disabled
      >
        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
        Loading...
      </button>
    );
  }

  const { connected, connecting, address, connect, disconnect, error, name } = walletContext;

  const handleConnect = () => {
    if (!hasWallet) {
      window.open('https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil', '_blank');
      return;
    }
    connect();
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return connected 
          ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-300'
          : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300';
      case 'outline':
        return connected
          ? 'bg-transparent text-green-600 hover:bg-green-50 border border-green-600'
          : 'bg-transparent text-blue-600 hover:bg-blue-50 border border-blue-600';
      default: // primary
        return connected
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-blue-600 text-white hover:bg-blue-700';
    }
  };

  const buttonClasses = `
    inline-flex items-center justify-center
    font-medium rounded-md
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    focus:outline-none focus:ring-2 focus:ring-offset-2
    ${connected ? 'focus:ring-green-500' : 'focus:ring-blue-500'}
    ${getVariantClasses()}
    ${getSizeClasses(size)}
    ${className}
  `;

  if (connected && address) {
    return (
      <div className="relative">
        <button
          className={buttonClasses}
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={connecting}
        >
          <div className="flex items-center space-x-2">
            {/* Wallet Icon */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span>{formatAddress(address)}</span>
            {/* Dropdown Arrow */}
            <svg className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowDropdown(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
              <div className="p-4 border-b border-gray-100">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Connected Wallet</div>
                <div className="font-medium text-gray-900">{name || 'Sui Wallet'}</div>
                <div className="text-sm text-gray-500 mt-1 font-mono">{formatAddress(address)}</div>
              </div>
              
              <div className="p-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(address);
                    // You could add a toast notification here
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Address
                </button>
                
                <button
                  onClick={handleDisconnect}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center mt-1"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        className={buttonClasses}
        onClick={handleConnect}
        disabled={connecting}
      >
        {connecting ? (
          <>
            <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Connecting...
          </>
        ) : !hasWallet ? (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Install Wallet
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Connect Wallet
          </>
        )}
      </button>

      {/* Error Toast */}
      {error && mounted && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-start max-w-sm">
            <svg className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium">Connection Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => walletContext.clearError()}
              className="ml-3 text-red-400 hover:text-red-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default WalletConnectButton;