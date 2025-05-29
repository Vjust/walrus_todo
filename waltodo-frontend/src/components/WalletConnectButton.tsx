'use client';

import React, { useState, useCallback, memo, useEffect } from 'react';
import { useClientSafeWallet } from '@/hooks/useClientSafeWallet';
import {
  copyToClipboard,
  getClipboardCapabilities,
  ClipboardError,
} from '@/lib/clipboard';
import { WalletErrorModal } from './WalletErrorModal';
import { ClipboardErrorModal } from './ClipboardErrorModal';
import { WalletError } from '@/lib/wallet-errors';
import { ErrorBoundary } from './ErrorBoundary';
import { WalletSelector } from './WalletSelector';
import { ClientOnly } from '@/components/ClientOnly';
import toast from 'react-hot-toast';

function WalletConnectButton() {
  const {
    connected,
    connecting,
    disconnect,
    account,
    currentNetwork,
    error,
    clearError,
    switchNetwork,
    connect,
    isLoading,
  } = useClientSafeWallet();

  const address = account?.address || null;
  const chainId = currentNetwork;

  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const [copyError, setCopyError] = useState<string | null>(null);
  const [clipboardError, setClipboardError] = useState<ClipboardError | null>(
    null
  );
  const [showNetworkOptions, setShowNetworkOptions] = useState(false);
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper function to truncate address
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle copying address to clipboard
  const handleCopyAddress = useCallback(async () => {
    // Prevent function execution if no address exists
    if (!address) {
      console.warn('Attempted to copy address but no address is available');
      setCopyStatus('error');
      setCopyError('No wallet address available');
      return;
    }

    // Prevent multiple simultaneous copy operations
    if (copyStatus === 'success') return;

    setCopyStatus('idle');
    setCopyError(null);
    setClipboardError(null);

    try {
      const result = await copyToClipboard(address || '');

      if (result.success) {
        setCopyStatus('success');
        toast.success('Address copied to clipboard!', {
          duration: 2000,
        });
        // Reset success status after 2 seconds
        const timeoutId = setTimeout(() => {
          setCopyStatus('idle');
        }, 2000);
        
        // Cleanup on unmount
        return () => clearTimeout(timeoutId);
      } else {
        setCopyStatus('error');
        setCopyError(result.error?.message || 'Unknown error');

        // If it's a ClipboardError, show the modal
        if (result.error instanceof ClipboardError) {
          setClipboardError(result.error);
        }

        toast.error('Failed to copy address', {
          duration: 3000,
        });
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

      toast.error(message, {
        duration: 4000,
      });
      console.error('Copy operation failed:', error);
    }
  }, [address, copyStatus]);

  // Add clipboard manual fallback option
  const handleManualCopy = useCallback(() => {
    try {
      // Prevent function execution if no address exists or not on client
      if (!address || typeof window === 'undefined' || typeof document === 'undefined') {
        console.warn('Attempted manual copy but no address is available or not on client');
        return;
      }

      // Create a temporary input element to display the address for manual copying
      const tempInput = document.createElement('textarea');
      tempInput.value = address || '';
      tempInput.setAttribute('readonly', '');
      tempInput.style.position = 'fixed';
      tempInput.style.top = '0';
      tempInput.style.opacity = '1'; // Make visible but out of normal flow
      tempInput.style.zIndex = '1000';
      document.body.appendChild(tempInput);

      try {
        tempInput.focus();
        tempInput.select();

        // Show instructions
        toast(
          'Use keyboard shortcut to copy: ' +
            (navigator.platform.includes('Mac') ? 'Cmd+C' : 'Ctrl+C'),
          {
            duration: 5000,
            icon: '📋',
          }
        );
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
  }, [address]);

  // Handle network switching
  const handleNetworkSwitch = useCallback(async (
    network: 'mainnet' | 'testnet' | 'devnet'
  ) => {
    if (isNetworkSwitching) return; // Prevent multiple clicks

    setIsNetworkSwitching(true);

    try {
      await switchNetwork(network);
      setShowNetworkOptions(false);
      toast.success(`Switched to ${network}`, {
        duration: 2000,
      });
    } catch (error) {
      console.error(`Failed to switch to ${network}:`, error);
      toast.error(`Failed to switch to ${network}`, {
        duration: 4000,
      });
    } finally {
      setIsNetworkSwitching(false);
    }
  }, [isNetworkSwitching, switchNetwork]);

  // Convert network string to display name
  const getNetworkDisplayName = useCallback((networkId: string | null) => {
    if (networkId === null) return 'Unknown';

    // Convert network ID to readable name as needed
    const networkMap: Record<string, string> = {
      mainnet: 'Mainnet',
      testnet: 'Testnet',
      devnet: 'Devnet',
    };

    // Return formatted name or the original if not in our map
    return networkMap[String(networkId)] || String(networkId);
  }, []);

  // Render the connected wallet UI
  const renderConnectedUI = () => {
    if (!connected || !address || !mounted) return null;

    // Get clipboard capabilities to determine what UI to show (only on client)
    const clipboardCapabilities = getClipboardCapabilities();
    const showClipboardButton =
      clipboardCapabilities.hasModernApi ||
      clipboardCapabilities.hasLegacySupport;

    return (
      <div className='flex items-center gap-4'>
        <div className='px-4 py-2 bg-ocean-deep/20 dark:bg-ocean-foam/20 rounded-lg flex items-center gap-2 relative'>
          <div className='flex flex-col'>
            <p className='text-sm text-ocean-deep dark:text-ocean-foam'>
              Wallet: {truncateAddress(address)}
            </p>
            <p className='text-xs text-ocean-medium dark:text-ocean-light'>
              {getNetworkDisplayName(chainId)}
              {!isNetworkSwitching ? (
                <button
                  onClick={() => setShowNetworkOptions(!showNetworkOptions)}
                  className='ml-2 text-xs text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam'
                  disabled={isNetworkSwitching}
                >
                  (change)
                </button>
              ) : (
                <span className='ml-2 text-xs text-yellow-500 animate-pulse'>
                  (switching...)
                </span>
              )}
            </p>

            {/* Network selection dropdown */}
            {showNetworkOptions && !isNetworkSwitching && (
              <div className='absolute top-full left-0 mt-2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg z-10 w-full min-w-[150px]'>
                <div className='flex flex-col gap-2'>
                  <button
                    onClick={() => handleNetworkSwitch('mainnet')}
                    disabled={isNetworkSwitching || chainId === 'mainnet'}
                    className={`text-sm px-3 py-1 rounded-md ${
                      chainId === 'mainnet'
                        ? 'bg-ocean-deep text-white'
                        : isNetworkSwitching
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'hover:bg-ocean-light/20 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Mainnet
                  </button>
                  <button
                    onClick={() => handleNetworkSwitch('testnet')}
                    disabled={isNetworkSwitching || chainId === 'testnet'}
                    className={`text-sm px-3 py-1 rounded-md ${
                      chainId === 'testnet'
                        ? 'bg-ocean-deep text-white'
                        : isNetworkSwitching
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'hover:bg-ocean-light/20 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Testnet
                  </button>
                  <button
                    onClick={() => handleNetworkSwitch('devnet')}
                    disabled={isNetworkSwitching || chainId === 'devnet'}
                    className={`text-sm px-3 py-1 rounded-md ${
                      chainId === 'devnet'
                        ? 'bg-ocean-deep text-white'
                        : isNetworkSwitching
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'hover:bg-ocean-light/20 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Devnet
                  </button>
                </div>
              </div>
            )}
          </div>

          {showClipboardButton && (
            <button
              onClick={handleCopyAddress}
              className={`text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam transition-colors ${
                copyStatus === 'error'
                  ? 'text-red-500 dark:text-red-400'
                  : copyStatus === 'success'
                    ? 'text-green-500 dark:text-green-400'
                    : ''
              }`}
              title={
                copyStatus === 'error'
                  ? 'Copy failed'
                  : copyStatus === 'success'
                    ? 'Copied!'
                    : 'Copy address'
              }
            >
              {copyStatus === 'success' ? (
                <svg
                  className='w-4 h-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              ) : copyStatus === 'error' ? (
                <svg
                  className='w-4 h-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              ) : (
                <svg
                  className='w-4 h-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                  />
                </svg>
              )}
            </button>
          )}

          {/* Error tooltip */}
          {copyStatus === 'error' && copyError && (
            <div className='absolute top-full left-0 mt-2 p-2 bg-red-100 text-red-800 text-xs rounded shadow-md z-10'>
              {copyError}
            </div>
          )}

          {/* Success tooltip */}
          {copyStatus === 'success' && (
            <div className='absolute top-full left-0 mt-2 p-2 bg-green-100 text-green-800 text-xs rounded shadow-md z-10'>
              Address copied to clipboard!
            </div>
          )}
        </div>
        <button
          onClick={() => {
            try {
              disconnect();
            } catch (error) {
              console.error('Error in disconnect handler:', error);
            }
          }}
          disabled={isNetworkSwitching}
          className='px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:bg-red-300 disabled:cursor-not-allowed'
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
      <div className='px-4 py-2 bg-ocean-deep/20 dark:bg-ocean-foam/20 rounded-lg'>
        <p className='text-sm text-ocean-deep dark:text-ocean-foam flex items-center'>
          <svg
            className='animate-spin -ml-1 mr-2 h-4 w-4 text-ocean-deep dark:text-ocean-foam'
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
          Connecting...
        </p>
      </div>
    );
  };

  // Render the connect button UI with wallet selector
  const renderConnectUI = () => {
    if (connected || connecting) return null;

    // Use the WalletSelector component instead of a simple button
    return <WalletSelector />;
  };

  // Wrap the entire component in an ErrorBoundary and ClientOnly
  return (
    <ErrorBoundary>
      <ClientOnly fallback={<div className="px-4 py-2 bg-gray-200 animate-pulse rounded-lg">Loading...</div>}>
        <div>
          {renderConnectedUI() || renderConnectingUI() || renderConnectUI()}

          <WalletErrorModal
            error={error ? new WalletError(error) : null}
            onDismiss={clearError}
          />
          <ClipboardErrorModal
            error={clipboardError}
            onDismiss={() => setClipboardError(null)}
            onTryAlternative={handleManualCopy}
          />
        </div>
      </ClientOnly>
    </ErrorBoundary>
  );
}

const MemoizedWalletConnectButton = memo(WalletConnectButton);

export { MemoizedWalletConnectButton as WalletConnectButton };
export default MemoizedWalletConnectButton;
