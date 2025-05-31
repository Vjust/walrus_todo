'use client';

import React, { useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';

interface TransactionSignerProps {
  transactionData: any;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  children?: (props: {
    isLoading: boolean;
    error: Error | null;
    signAndExecute: () => Promise<void>;
  }) => React.ReactNode;
}

export function TransactionSigner({
  transactionData,
  onSuccess,
  onError,
  children,
}: TransactionSignerProps) {
  const walletContext = useWalletContext();
  const connected = walletContext?.connected || false;
  const signAndExecuteTransaction = walletContext?.signAndExecuteTransaction;
  const trackTransaction = walletContext?.trackTransaction;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signAndExecute = async () => {
    if (!connected || !signAndExecuteTransaction) {
      const err = new Error(
        "Wallet not connected or doesn't support transaction signing"
      );
      setError(err);
      onError?.(err);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Sign and execute the transaction
      const result = await signAndExecuteTransaction(transactionData);

      // Track the transaction if trackTransaction is available
      if (trackTransaction) {
        await trackTransaction(Promise.resolve(result), 'Custom Transaction');
      }

      onSuccess?.(result);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Transaction failed');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  // If children function is provided, use render props pattern
  if (children) {
    return children({ isLoading, error, signAndExecute }) as React.ReactElement;
  }

  // Default UI
  return (
    <div className='space-y-4'>
      {error && (
        <div className='p-4 bg-red-50 border border-red-200 rounded-lg'>
          <p className='text-red-800 font-medium'>Transaction Error</p>
          <p className='text-red-600 text-sm'>{error.message}</p>
        </div>
      )}

      <button
        onClick={signAndExecute}
        disabled={!connected || isLoading}
        className='px-4 py-2 bg-ocean-deep text-white rounded-lg hover:bg-ocean-deep/80 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2'
      >
        {isLoading && (
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
        )}
        {isLoading ? 'Signing...' : 'Sign Transaction'}
      </button>
    </div>
  );
}
