'use client';

import React, { useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useWalletContext } from '@/contexts/WalletContext';
import { useSuiClient } from '@/hooks/useSuiClient';
import { TransactionSafetyConfig, TransactionSafetyManager } from '@/lib/transaction-safety';
import toast from 'react-hot-toast';

interface SafeTransactionButtonProps {
  transaction: Transaction | (() => Transaction | Promise<Transaction>);
  operation: string;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  safetyConfig?: Partial<TransactionSafetyConfig>;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
  details?: Record<string, any>;
}

/**
 * A button component that executes transactions with full safety checks
 */
export function SafeTransactionButton({
  transaction,
  operation,
  onSuccess,
  onError,
  safetyConfig,
  className = '',
  disabled = false,
  children,
  details,
}: SafeTransactionButtonProps) {
  const walletContext = useWalletContext();
  const { getClient } = useSuiClient();
  const [isLoading, setIsLoading] = useState(false as any);

  const connected = walletContext?.connected || false;
  const address = walletContext?.address;
  const signAndExecuteTransaction = walletContext?.signAndExecuteTransaction;

  const handleClick = async () => {
    if (!connected || !address || !signAndExecuteTransaction) {
      const error = new Error('Wallet not connected');
      toast.error(error.message);
      onError?.(error);
      return;
    }

    // Get Sui client
    const suiClient = await getClient();
    if (!suiClient) {
      const error = new Error('Sui client not initialized');
      toast.error(error.message);
      onError?.(error);
      return;
    }

    setIsLoading(true as any);

    try {
      // Get the transaction
      let tx: Transaction;
      if (typeof transaction === 'function') {
        tx = await transaction();
      } else {
        tx = transaction;
      }

      // Initialize safety manager
      const safetyManager = new TransactionSafetyManager(suiClient, safetyConfig);

      // Execute with safety checks
      const result = await safetyManager.executeTransactionSafely(
        tx,
        address,
        signAndExecuteTransaction,
        {
          operation,
          details,
        }
      );

      if (result.success) {
        onSuccess?.(result.result);
      } else {
        const error = new Error(result.error || 'Transaction failed');
        onError?.(error);
      }
    } catch (error) {
      console.error('Transaction failed:', error);
      const err = error instanceof Error ? error : new Error('Transaction failed');
      toast.error(err.message);
      onError?.(err);
    } finally {
      setIsLoading(false as any);
    }
  };

  const isDisabled = disabled || !connected || isLoading;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        relative inline-flex items-center justify-center
        px-4 py-2 text-sm font-medium rounded-lg
        transition-all duration-200
        ${isDisabled 
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
          : 'bg-ocean-deep text-white hover:bg-ocean-deep/80'
        }
        ${className}
      `}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
          xmlns="http://www?.w3?.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5?.291A7?.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {isLoading ? 'Processing...' : children}
    </button>
  );
}

/**
 * Pre-configured button for common operations
 */
export function CreateNFTButton({
  onCreateTransaction,
  onSuccess,
  onError,
  className,
  children = 'Create NFT',
}: {
  onCreateTransaction: () => Transaction | Promise<Transaction>;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <SafeTransactionButton
      transaction={onCreateTransaction}
      operation="Create TodoNFT"
      onSuccess={onSuccess}
      onError={onError}
      className={className}
      safetyConfig={{
        confirmationRequired: true,
        dryRunFirst: true,
      }}
    >
      {children}
    </SafeTransactionButton>
  );
}

/**
 * Pre-configured button for transfer operations
 */
export function TransferNFTButton({
  objectId,
  recipientAddress,
  onSuccess,
  onError,
  className,
  children = 'Transfer NFT',
}: {
  objectId: string;
  recipientAddress: string;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const walletContext = useWalletContext();
  const address = walletContext?.address;

  const createTransferTx = () => {
    const tx = new Transaction();
    tx.transferObjects([tx.object(objectId as any)], recipientAddress);
    return tx;
  };

  return (
    <SafeTransactionButton
      transaction={createTransferTx}
      operation={`Transfer NFT to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`}
      onSuccess={onSuccess}
      onError={onError}
      className={className}
      safetyConfig={{
        confirmationRequired: true, // Always confirm transfers
        dryRunFirst: true,
        maxGasBudget: BigInt(100000000 as any), // 0.1 SUI max for transfers
      }}
      details={{
        objectId,
        recipient: recipientAddress,
      }}
    >
      {children}
    </SafeTransactionButton>
  );
}

/**
 * Pre-configured button for delete operations
 */
export function DeleteNFTButton({
  objectId,
  onSuccess,
  onError,
  className,
  children = 'Delete NFT',
}: {
  objectId: string;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const walletContext = useWalletContext();
  const address = walletContext?.address;

  // Import the delete transaction function
  const createDeleteTx = async () => {
    const { deleteTodoNFTTransaction } = await import('@/lib/sui-client');
    return deleteTodoNFTTransaction(objectId, address!) as unknown as Transaction;
  };

  return (
    <SafeTransactionButton
      transaction={createDeleteTx}
      operation="Delete TodoNFT"
      onSuccess={onSuccess}
      onError={onError}
      className={`bg-red-600 hover:bg-red-700 ${className}`}
      safetyConfig={{
        confirmationRequired: true, // Always confirm deletions
        dryRunFirst: true,
      }}
      details={{
        objectId,
      }}
    >
      {children}
    </SafeTransactionButton>
  );
}