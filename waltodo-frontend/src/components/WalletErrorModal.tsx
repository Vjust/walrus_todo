'use client';

import React, { useEffect, useState } from 'react';
import {
  getWalletErrorMessage,
  WalletError,
  WalletNotInstalledError,
} from '@/lib/wallet-errors';

interface WalletErrorModalProps {
  error: WalletError | null;
  onDismiss: () => void;
}

export function WalletErrorModal({ error, onDismiss }: WalletErrorModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (error) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [error]);

  if (!error || !isVisible) {
    return null;
  }

  const { message, suggestion } = getWalletErrorMessage(error);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  // Determine icon and color based on error type
  const getIconAndColor = () => {
    const errorName = error.name;

    if (errorName === 'WalletNotInstalledError') {
      return {
        icon: (
          <svg
            className='w-6 h-6 text-yellow-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            />
          </svg>
        ),
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-400',
        textColor: 'text-yellow-700 dark:text-yellow-200',
      };
    }

    if (errorName === 'WalletConnectionRejectedError') {
      return {
        icon: (
          <svg
            className='w-6 h-6 text-red-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
        ),
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-400',
        textColor: 'text-red-700 dark:text-red-200',
      };
    }

    // Default case
    return {
      icon: (
        <svg
          className='w-6 h-6 text-blue-400'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
          />
        </svg>
      ),
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-400',
      textColor: 'text-blue-700 dark:text-blue-200',
    };
  };

  const { icon, bgColor, borderColor, textColor } = getIconAndColor();

  return (
    <div className='fixed inset-0 flex items-center justify-center p-4 bg-black/50 z-50'>
      <div
        className={`max-w-md w-full rounded-lg ${bgColor} border ${borderColor} shadow-lg overflow-hidden transform transition-all`}
      >
        <div className='p-4'>
          <div className='flex items-start'>
            <div className='flex-shrink-0'>{icon}</div>
            <div className='ml-3 flex-1'>
              <h3 className={`text-lg font-medium ${textColor}`}>{message}</h3>
              <div className='mt-2'>
                <p className={`text-sm ${textColor}`}>{suggestion}</p>
              </div>

              {/* Installation links for wallet not installed errors */}
              {error instanceof WalletNotInstalledError && (
                <div className='mt-3'>
                  {error.walletName.includes('Phantom') && (
                    <a
                      href='https://phantom.app/download'
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700'
                    >
                      Install Phantom
                    </a>
                  )}

                  {(error.walletName.includes('Sui') ||
                    error.walletName.includes('Slush')) && (
                    <a
                      href='https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil'
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700'
                    >
                      Install Sui/Slush
                    </a>
                  )}

                  {error.walletName.includes('Backpack') && (
                    <a
                      href='https://www.backpack.app/download'
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center px-4 py-2 text-sm text-white bg-orange-600 rounded-md hover:bg-orange-700'
                    >
                      Install Backpack
                    </a>
                  )}
                </div>
              )}

              <div className='mt-4 flex justify-end'>
                <button
                  type='button'
                  onClick={handleDismiss}
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-ocean-medium rounded-md hover:bg-ocean-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ocean-light"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
