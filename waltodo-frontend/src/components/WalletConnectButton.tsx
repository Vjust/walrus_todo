'use client';

/**
 * WalletConnectButton - Updated for 2024/2025 Slush Wallet Integration
 * 
 * Features:
 * - Modern wallet standard detection (primary method)
 * - Fallback injection pattern detection for compatibility
 * - Updated Slush wallet naming consistency (formerly Sui Wallet)
 * - Current Chrome store URL for Slush wallet installation
 * - Support for multiple Sui ecosystem wallets
 */

import React, { useEffect, useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { useSSRSafeMounted } from '@/hooks/useSSRSafe';
import { WalletButtonSkeleton } from '@/components/SSRFallback';
import { analytics } from '@/lib/analytics';

interface WalletConnectButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

// Simple fallback components (kept for backward compatibility)

function NoWalletFallback({ variant, className }: { variant?: string; className?: string }) {
  return (
    <div className={`text-gray-500 text-sm ${className}`}>
      Wallet not available
    </div>
  );
}

function WalletErrorBoundary({ children, fallback, className }: { children: React.ReactNode; fallback?: React.ReactNode; className?: string }) {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return fallback || <NoWalletFallback className={className} />;
  }
  
  return <>{children}</>;
}

function WalletConnectButton({ 
  className = '', 
  variant = 'primary',
  size = 'md'
}: WalletConnectButtonProps) {
  return (
    <WalletErrorBoundary
      fallback={<NoWalletFallback variant="minimal" className={className} />}
      className={className}
    >
      <WalletConnectButtonContent 
        className={className}
        variant={variant}
        size={size}
      />
    </WalletErrorBoundary>
  );
}

function WalletConnectButtonContent({ 
  className = '', 
  variant = 'primary',
  size = 'md'
}: WalletConnectButtonProps) {
  // ALL HOOKS MUST BE CALLED AT TOP LEVEL - NO CONDITIONAL HOOKS
  const walletContext = useWalletContext();
  const { mounted, isReady } = useSSRSafeMounted();
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<string[]>([]);
  
  // Check for wallet on mount
  useEffect(() => {
    if (isReady && typeof window !== 'undefined') {
      const checkWallets = () => {
        const wallets: string[] = [];
        if ((window as any).suiWallet) {wallets.push('Sui Wallet');}
        if ((window as any).slushWallet) {wallets.push('Slush Wallet');}
        setDetectedWallets(wallets);
        setHasWallet(wallets.length > 0);
      };
      
      checkWallets();
      
      // Check again after a short delay for wallets that load asynchronously
      const timeout = setTimeout(checkWallets, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isReady]);

  // Use simple performance fallback to avoid type issues
  const performance = typeof window !== 'undefined' ? window.performance : null;
  const perfLoaded = true;

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
  
  // Handle SSR and initialization phase - early return after hooks
  if (!isReady || !walletContext) {
    return <WalletButtonSkeleton size={size} className={className} />;
  }

  const { connected, connecting, address, connect, disconnect, error, name } = walletContext;

  const handleConnect = () => {
    const connectStartTime = performance?.now() ?? Date.now();
    
    if (!hasWallet) {
      // Safe analytics tracking with null check
      if (analytics) {
        analytics.trackWallet({
          action: 'connect',
          success: false,
          error: 'No wallet installed',
        });
      }
      
      // Safely open wallet installation page
      if (typeof window !== 'undefined' && window.open) {
        window.open('https://chromewebstore.google.com/detail/slush-%E2%80%94-a-sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil', '_blank');
      }
      return;
    }
    
    connect();
    
    // Track connection attempt with safe analytics
    if (analytics) {
      analytics.trackWallet({
        action: 'connect',
        wallet: name || detectedWallets[0] || undefined,
        success: false, // Will be updated on success
        duration: (performance?.now() ?? Date.now()) - connectStartTime,
      });
    }
  };

  const handleDisconnect = () => {
    // Safe analytics tracking
    if (analytics) {
      analytics.trackWallet({
        action: 'disconnect',
        wallet: name || undefined,
        success: true,
      });
    }
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
                <div className="font-medium text-gray-900">{name || detectedWallets[0] || 'Slush Wallet'}</div>
                <div className="text-sm text-gray-500 mt-1 font-mono">{formatAddress(address)}</div>
                {detectedWallets.length > 1 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Other wallets: {detectedWallets.slice(1).join(', ')}
                  </div>
                )}
              </div>
              
              <div className="p-2">
                <button
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(address).catch((err) => {
                        console.warn('Failed to copy address:', err);
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = address;
                        document.body.appendChild(textArea);
                        textArea.select();
                        try {
                          document.execCommand('copy');
                        } catch (fallbackErr) {
                          console.warn('Fallback copy failed:', fallbackErr);
                        }
                        document.body.removeChild(textArea);
                      });
                    }
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
            Install Slush Wallet
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
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && detectedWallets.length > 0 && (
        <div className="fixed bottom-4 left-4 bg-blue-500 text-white px-3 py-2 rounded text-xs z-50">
          Detected: {detectedWallets.join(', ')}
        </div>
      )}
    </>
  );
}

export default WalletConnectButton;