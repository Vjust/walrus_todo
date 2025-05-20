'use client';

import React, { useEffect, useState } from 'react';
import { useWalletContext } from '@/lib/walletContext';
import { 
  copyToClipboard, 
  getClipboardCapabilities,
  ClipboardError
} from '@/lib/clipboard';
import { WalletErrorModal } from './WalletErrorModal';
import { ClipboardErrorModal } from './ClipboardErrorModal';
import { WalletError } from '@/lib/wallet-errors';

export function WalletConnectButton() {
  const {
    connected,
    connecting,
    disconnect,
    publicKey,
    walletType,
    error,
    suiConnect,
    phantomConnect,
    slushConnect,
    slushAccount,
    setError
  } = useWalletContext();

  const [hasSuiWallet, setHasSuiWallet] = useState(false);
  const [hasPhantomWallet, setHasPhantomWallet] = useState(false);
  const [hasSlushWallet, setHasSlushWallet] = useState(false);
  const [walletSelected, setWalletSelected] = useState<'sui' | 'phantom' | 'slush' | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [copyError, setCopyError] = useState<string | null>(null);
  const [clipboardError, setClipboardError] = useState<ClipboardError | null>(null);
  
  // Function to handle wallet button clicks with enhanced error handling
  const handleWalletSelection = async (type: 'sui' | 'phantom' | 'slush') => {
    setWalletSelected(type);
    try {
      // Use async/await to properly handle rejected promises
      if (type === 'sui') {
        try {
          await suiConnect();
        } catch (error) {
          console.error('Failed to connect Sui wallet:', error);
          setWalletSelected(null);
          // Error already handled by context
        }
      } else if (type === 'phantom') {
        try {
          await phantomConnect();
        } catch (error) {
          console.error('Failed to connect Phantom wallet:', error);
          setWalletSelected(null);
          // Error already handled by context
        }
      } else if (type === 'slush') {
        try {
          await slushConnect();
        } catch (error) {
          console.error('Failed to connect Slush wallet:', error);
          setWalletSelected(null);
          // Error already handled by context
        }
      }
    } catch (error) {
      console.error('Unexpected error in wallet selection:', error);
      setWalletSelected(null);
      // Handle synchronous errors too
      if (setError && error instanceof Error) {
        setError(error);
      }
    }
  };

  // Check for wallet availability
  useEffect(() => {
    const checkWallets = () => {
      try {
        // Check for Sui wallet (based on @mysten/dapp-kit standard)
        const suiWalletAvailable = typeof window !== 'undefined' && (
          window.suiWallet ||
          window.ethereum?.isSuiWallet || 
          window.martian?.sui ||
          window.suiet
        );
        setHasSuiWallet(!!suiWalletAvailable);

        // Check for Phantom wallet
        const phantomAvailable = typeof window !== 'undefined' && 
          window.solana?.isPhantom;
        setHasPhantomWallet(!!phantomAvailable);
        
        // Check for Slush wallet (formerly Stashed)
        // Detection pattern based on StashedWalletAdapter
        const slushAvailable = typeof window !== 'undefined' && (
          window.stashedProvider || 
          window.slushProvider ||
          window.stashed
        );
        setHasSlushWallet(!!slushAvailable);
      } catch (error) {
        console.error('Error checking wallet availability:', error);
        // Ensure we don't break the component if there's an error
        setHasSuiWallet(false);
        setHasPhantomWallet(false);
        setHasSlushWallet(false);
      }
    };

    try {
      checkWallets();
      
      // Check again after a delay in case wallets inject late
      const timer = setTimeout(checkWallets, 100);
      return () => clearTimeout(timer);
    } catch (error) {
      console.error('Error in wallet detection effect:', error);
      return undefined;
    }
  }, []);

  // Helper function to truncate address
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle copying address to clipboard
  const handleCopyAddress = async () => {
    // Prevent function execution if no publicKey exists
    if (!publicKey) {
      console.warn('Attempted to copy address but no public key is available');
      setCopyStatus('error');
      setCopyError('No wallet address available');
      return;
    }
    
    setCopyStatus('idle');
    setCopyError(null);
    setClipboardError(null);
    
    try {
      const result = await copyToClipboard(publicKey || '');
      
      if (result.success) {
        setCopyStatus('success');
        // Reset success status after 2 seconds
        const timer = setTimeout(() => {
          setCopyStatus('idle');
        }, 2000);
        // Note: we can't return a cleanup function from an async function 
        // The cleanup needs to happen in a useEffect if needed
      } else {
        setCopyStatus('error');
        setCopyError(result.error?.message || 'Unknown error');
        
        // If it's a ClipboardError, show the modal
        if (result.error instanceof ClipboardError) {
          setClipboardError(result.error);
        }
        
        console.error('Failed to copy address:', result.error);
      }
    } catch (error) {
      setCopyStatus('error');
      const message = error instanceof Error ? error.message : 'Failed to copy';
      setCopyError(message);
      
      // If it's a ClipboardError, show the modal
      if (error instanceof ClipboardError) {
        setClipboardError(error);
      }
      
      console.error('Copy operation failed:', error);
    }
  };

  // Add clipboard manual fallback option
  const handleManualCopy = () => {
    try {
      // Prevent function execution if no publicKey exists
      if (!publicKey) {
        console.warn('Attempted manual copy but no public key is available');
        return;
      }

      // Create a temporary input element to display the address for manual copying
      const tempInput = document.createElement('textarea');
      tempInput.value = publicKey || '';
      tempInput.setAttribute('readonly', '');
      tempInput.style.position = 'fixed';
      tempInput.style.top = '0';
      tempInput.style.opacity = '1'; // Make visible but out of normal flow
      tempInput.style.zIndex = '1000'; 
      document.body.appendChild(tempInput);
      
      try {
        tempInput.focus();
        tempInput.select();
        
        // Show instructions (in real app, you might want a modal with better UX)
        alert('Please use keyboard shortcut to copy:\n' + 
              '• Windows/Linux: Press Ctrl+C\n' + 
              '• Mac: Press Command+C\n\n' +
              'Then click OK to continue.');
      } finally {
        // Always clean up, even if there's an error
        try {
          document.body.removeChild(tempInput);
        } catch (err) {
          console.error('Error removing temporary input element:', err);
        }
      }
    } catch (error) {
      console.error('Error in manual copy function:', error);
    }
  };

  // Render the connected wallet UI
  const renderConnectedUI = () => {
    if (!connected || !publicKey) return null;
    
    // Get clipboard capabilities to determine what UI to show
    const clipboardCapabilities = getClipboardCapabilities();
    const showClipboardButton = clipboardCapabilities.hasModernApi || clipboardCapabilities.hasLegacySupport;

    return (
      <div className="flex items-center gap-4">
        <div className="px-4 py-2 bg-ocean-deep/20 dark:bg-ocean-foam/20 rounded-lg flex items-center gap-2 relative">
          <p className="text-sm text-ocean-deep dark:text-ocean-foam">
            {walletType === 'sui' ? 'Sui' : walletType === 'phantom' ? 'Phantom' : 'Slush'}: {truncateAddress(publicKey)}
          </p>
          
          {showClipboardButton && (
            <button
              onClick={handleCopyAddress}
              className={`text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam transition-colors ${
                copyStatus === 'error' ? 'text-red-500 dark:text-red-400' : 
                copyStatus === 'success' ? 'text-green-500 dark:text-green-400' : ''
              }`}
              title={
                copyStatus === 'error' ? 'Copy failed' : 
                copyStatus === 'success' ? 'Copied!' : 
                'Copy address'
              }
            >
              {copyStatus === 'success' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : copyStatus === 'error' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
          
          {/* Error tooltip */}
          {copyStatus === 'error' && copyError && (
            <div className="absolute top-full left-0 mt-2 p-2 bg-red-100 text-red-800 text-xs rounded shadow-md z-10">
              {copyError}
            </div>
          )}
          
          {/* Success tooltip */}
          {copyStatus === 'success' && (
            <div className="absolute top-full left-0 mt-2 p-2 bg-green-100 text-green-800 text-xs rounded shadow-md z-10">
              Address copied to clipboard!
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            try {
              disconnect().catch(err => {
                console.error('Error disconnecting wallet:', err);
                if (setError && err instanceof Error) {
                  setError(err);
                }
              });
            } catch (error) {
              console.error('Error in disconnect handler:', error);
              if (setError && error instanceof Error) {
                setError(error);
              }
            }
          }}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  };

  // Render the connecting UI
  const renderConnectingUI = () => {
    if (!connecting) return null;
    
    return (
      <div className="px-4 py-2 bg-ocean-deep/20 dark:bg-ocean-foam/20 rounded-lg">
        <p className="text-sm text-ocean-deep dark:text-ocean-foam">
          Connecting...
        </p>
      </div>
    );
  };

  // Render the wallet selection UI
  const renderWalletSelectionUI = () => {
    if (connected || connecting) return null;
    
    return (
      <div className="space-y-2">
        <div className="flex gap-4 flex-wrap">
          {hasSuiWallet && (
            <button
              onClick={() => handleWalletSelection('sui')}
              disabled={connecting || walletSelected !== null}
              className={`px-4 py-2 rounded-lg transition-colors ${
                walletSelected === 'sui' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-ocean-deep text-white hover:bg-ocean-deep/80'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {walletSelected === 'sui' && connecting ? 'Connecting...' : 'Connect Sui Wallet'}
            </button>
          )}
          
          {hasPhantomWallet && (
            <button
              onClick={() => handleWalletSelection('phantom')}
              disabled={connecting || walletSelected !== null}
              className={`px-4 py-2 rounded-lg transition-colors ${
                walletSelected === 'phantom'
                  ? 'bg-green-500 text-white'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {walletSelected === 'phantom' && connecting ? 'Connecting...' : 'Connect Phantom'}
            </button>
          )}
          
          {hasSlushWallet && (
            <button
              onClick={() => handleWalletSelection('slush')}
              disabled={connecting || walletSelected !== null}
              className={`px-4 py-2 rounded-lg transition-colors ${
                walletSelected === 'slush'
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {walletSelected === 'slush' && connecting ? 'Connecting...' : 'Connect Slush Wallet'}
            </button>
          )}
          
          {!hasSuiWallet && !hasPhantomWallet && !hasSlushWallet && (
            <div className="px-4 py-2 bg-gray-500 text-white rounded-lg">
              No wallets detected
            </div>
          )}
        </div>
      
        {/* Show wallet selection error message inline */}
        {error && (
          <div className="text-red-500 text-sm mt-2">
            {error.message}
          </div>
        )}
      </div>
    );
  };

  // Main render function
  return (
    <>
      {renderConnectedUI() || renderConnectingUI() || renderWalletSelectionUI()}
      
      <WalletErrorModal 
        error={error instanceof WalletError ? error : null} 
        onDismiss={() => setError(null)} 
      />
      <ClipboardErrorModal
        error={clipboardError}
        onDismiss={() => setClipboardError(null)}
        onTryAlternative={handleManualCopy}
      />
    </>
  );
}