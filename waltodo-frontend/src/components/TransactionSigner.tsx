'use client';

import React, { useMemo, useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { useSuiClient } from '@/hooks/useSuiClient';
import { TransactionSafetyConfig, TransactionSafetyManager } from '@/lib/transaction-safety';
import { Transaction } from '@mysten/sui/transactions';
import toast from 'react-hot-toast';
import { analytics } from '@/lib/analytics';

interface TransactionSignerProps {
  transactionData: any;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  operation?: string;
  safetyConfig?: Partial<TransactionSafetyConfig>;
  skipSafetyChecks?: boolean;
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
  operation = 'Execute Transaction',
  safetyConfig,
  skipSafetyChecks = false,
  children,
}: TransactionSignerProps) {
  const walletContext = useWalletContext();
  const connected = walletContext?.connected || false;
  const address = walletContext?.address;
  const signAndExecuteTransaction = walletContext?.signAndExecuteTransaction;
  const trackTransaction = walletContext?.trackTransaction;
  const suiClientHook = useSuiClient();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize safety manager - temporarily disabled due to async client pattern
  const safetyManager = useMemo(() => {
    // TODO: Update TransactionSafetyManager to work with async client pattern
    return null;
  }, []);

  const signAndExecute = async () => {
    if (!connected || !signAndExecuteTransaction || !address) {
      const err = new Error(
        "Wallet not connected or doesn't support transaction signing"
      );
      setError(err);
      onError?.(err);
      return;
    }

    setIsLoading(true);
    setError(null);

    const transactionStartTime = performance.now();
    
    try {
      let result;

      // Execute transaction directly (safety checks temporarily disabled)
      result = await signAndExecuteTransaction(transactionData);

      // Track the transaction if trackTransaction is available
      if (trackTransaction) {
        await trackTransaction(Promise.resolve(result), operation);
      }
      
      // Track successful transaction in analytics
      if (analytics) {
        analytics.trackTransaction({
          type: operation,
          success: true,
          duration: performance.now() - transactionStartTime,
          gasUsed: result?.effects?.gasUsed?.computationCost,
        });
      }

      onSuccess?.(result);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Transaction failed');
      setError(error);
      onError?.(error);
      
      // Track failed transaction in analytics
      if (analytics) {
        analytics.trackTransaction({
          type: operation,
          success: false,
          duration: performance.now() - transactionStartTime,
          error: error.message,
        });
      }

      // Error recovery temporarily disabled with safety manager
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
             />
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
             />
          </svg>
        )}
        {isLoading ? 'Signing...' : 'Sign Transaction'}
      </button>
    </div>
  );
}
