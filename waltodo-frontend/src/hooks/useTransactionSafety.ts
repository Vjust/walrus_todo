/**
 * Hook for safe transaction execution with gas estimation and simulation
 */

import { useState, useCallback, useMemo } from 'react';
import { TransactionBlock } from '@mysten/sui/transactions';
import { Transaction } from '@mysten/sui/transactions';
import { useWalletContext } from '@/contexts/WalletContext';
import { useSuiClient } from '@/hooks/useSuiClient';
import { 
  TransactionSafetyManager, 
  TransactionSafetyConfig,
  GasEstimation,
  TransactionSimulationResult,
} from '@/lib/transaction-safety';
import toast from 'react-hot-toast';

interface UseTransactionSafetyOptions {
  safetyConfig?: Partial<TransactionSafetyConfig>;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

interface TransactionSafetyState {
  isLoading: boolean;
  error: Error | null;
  gasEstimation: GasEstimation | null;
  simulationResult: TransactionSimulationResult | null;
}

export function useTransactionSafety(options: UseTransactionSafetyOptions = {}) {
  const walletContext = useWalletContext();
  const { suiClient } = useSuiClient();
  
  const [state, setState] = useState<TransactionSafetyState>({
    isLoading: false,
    error: null,
    gasEstimation: null,
    simulationResult: null,
  });

  const connected = walletContext?.connected || false;
  const address = walletContext?.address;
  const signAndExecuteTransaction = walletContext?.signAndExecuteTransaction;

  // Initialize safety manager
  const safetyManager = useMemo(() => {
    if (!suiClient) return null;
    return new TransactionSafetyManager(suiClient, options.safetyConfig);
  }, [suiClient, options.safetyConfig]);

  /**
   * Estimate gas for a transaction
   */
  const estimateGas = useCallback(
    async (transaction: TransactionBlock | Transaction): Promise<GasEstimation | null> => {
      if (!safetyManager || !address) {
        toast.error('Cannot estimate gas: wallet not connected');
        return null;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const estimation = await safetyManager.estimateGas(
          transaction as TransactionBlock,
          address
        );
        
        setState(prev => ({ ...prev, gasEstimation: estimation, isLoading: false }));
        
        if (!estimation.isSafe) {
          toast.warning('Transaction may have issues. Check gas estimation warnings.');
        }
        
        return estimation;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Gas estimation failed');
        setState(prev => ({ ...prev, error: err, isLoading: false }));
        toast.error(err.message);
        options.onError?.(err);
        return null;
      }
    },
    [safetyManager, address, options]
  );

  /**
   * Simulate a transaction
   */
  const simulateTransaction = useCallback(
    async (transaction: TransactionBlock | Transaction): Promise<TransactionSimulationResult | null> => {
      if (!safetyManager || !address) {
        toast.error('Cannot simulate: wallet not connected');
        return null;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await safetyManager.simulateTransaction(
          transaction as TransactionBlock,
          address
        );
        
        setState(prev => ({ ...prev, simulationResult: result, isLoading: false }));
        
        if (!result.success) {
          toast.error(`Simulation failed: ${result.error}`);
        } else if (result.warnings.length > 0) {
          toast.warning('Simulation completed with warnings');
        } else {
          toast.success('Simulation successful');
        }
        
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Simulation failed');
        setState(prev => ({ ...prev, error: err, isLoading: false }));
        toast.error(err.message);
        options.onError?.(err);
        return null;
      }
    },
    [safetyManager, address, options]
  );

  /**
   * Execute a transaction with full safety checks
   */
  const executeTransactionSafely = useCallback(
    async (
      transaction: TransactionBlock | Transaction,
      operation: string,
      details?: Record<string, any>
    ): Promise<boolean> => {
      if (!safetyManager || !address || !signAndExecuteTransaction) {
        const error = new Error('Wallet not connected');
        setState(prev => ({ ...prev, error }));
        toast.error(error.message);
        options.onError?.(error);
        return false;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await safetyManager.executeTransactionSafely(
          transaction as TransactionBlock,
          address,
          signAndExecuteTransaction,
          {
            operation,
            details,
          }
        );

        setState(prev => ({ ...prev, isLoading: false }));

        if (result.success) {
          options.onSuccess?.(result.result);
          return true;
        } else {
          const error = new Error(result.error || 'Transaction failed');
          setState(prev => ({ ...prev, error }));
          options.onError?.(error);
          return false;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Transaction failed');
        setState(prev => ({ ...prev, error: err, isLoading: false }));
        toast.error(err.message);
        options.onError?.(err);
        return false;
      }
    },
    [safetyManager, address, signAndExecuteTransaction, options]
  );

  /**
   * Handle transaction errors with recovery suggestions
   */
  const handleTransactionError = useCallback(
    async (error: Error) => {
      if (!safetyManager) return;

      const recovery = await safetyManager.handleTransactionError(error);
      
      if (recovery.action) {
        await recovery.action();
      }
      
      return recovery;
    },
    [safetyManager]
  );

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      gasEstimation: null,
      simulationResult: null,
    });
  }, []);

  return {
    ...state,
    connected,
    estimateGas,
    simulateTransaction,
    executeTransactionSafely,
    handleTransactionError,
    reset,
  };
}

/**
 * Hook for creating safe todo NFT transactions
 */
export function useSafeTodoTransaction(options: UseTransactionSafetyOptions = {}) {
  const transactionSafety = useTransactionSafety(options);
  const walletContext = useWalletContext();
  const address = walletContext?.address;

  const createTodoNFT = useCallback(
    async (params: {
      title: string;
      description: string;
      imageUrl?: string;
      metadata?: string;
      isPrivate?: boolean;
    }) => {
      if (!address) {
        toast.error('Wallet not connected');
        return false;
      }

      // Import transaction creator
      const { createTodoNFTTransaction } = await import('@/lib/sui-client');
      
      // Create transaction
      const tx = createTodoNFTTransaction(params, address);

      // Execute with safety
      return transactionSafety.executeTransactionSafely(
        tx as unknown as TransactionBlock,
        `Create TodoNFT: ${params.title}`,
        params
      );
    },
    [address, transactionSafety]
  );

  const updateTodoNFT = useCallback(
    async (params: {
      objectId: string;
      title?: string;
      description?: string;
      imageUrl?: string;
      metadata?: string;
    }) => {
      if (!address) {
        toast.error('Wallet not connected');
        return false;
      }

      // Import transaction creator
      const { updateTodoNFTTransaction } = await import('@/lib/sui-client');
      
      // Create transaction
      const tx = updateTodoNFTTransaction(params, address);

      // Execute with safety
      return transactionSafety.executeTransactionSafely(
        tx as unknown as TransactionBlock,
        `Update TodoNFT: ${params.title || 'Untitled'}`,
        params
      );
    },
    [address, transactionSafety]
  );

  const completeTodoNFT = useCallback(
    async (objectId: string) => {
      if (!address) {
        toast.error('Wallet not connected');
        return false;
      }

      // Import transaction creator
      const { completeTodoNFTTransaction } = await import('@/lib/sui-client');
      
      // Create transaction
      const tx = completeTodoNFTTransaction(objectId, address);

      // Execute with safety
      return transactionSafety.executeTransactionSafely(
        tx as unknown as TransactionBlock,
        'Complete TodoNFT',
        { objectId }
      );
    },
    [address, transactionSafety]
  );

  const transferTodoNFT = useCallback(
    async (objectId: string, recipientAddress: string) => {
      if (!address) {
        toast.error('Wallet not connected');
        return false;
      }

      // Import transaction creator
      const { transferTodoNFTTransaction } = await import('@/lib/sui-client');
      
      // Create transaction
      const tx = transferTodoNFTTransaction(objectId, recipientAddress, address);

      // Execute with safety
      return transactionSafety.executeTransactionSafely(
        tx as unknown as TransactionBlock,
        `Transfer TodoNFT to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
        { objectId, recipient: recipientAddress }
      );
    },
    [address, transactionSafety]
  );

  const deleteTodoNFT = useCallback(
    async (objectId: string) => {
      if (!address) {
        toast.error('Wallet not connected');
        return false;
      }

      // Import transaction creator
      const { deleteTodoNFTTransaction } = await import('@/lib/sui-client');
      
      // Create transaction
      const tx = deleteTodoNFTTransaction(objectId, address);

      // Execute with safety
      return transactionSafety.executeTransactionSafely(
        tx as unknown as TransactionBlock,
        'Delete TodoNFT',
        { objectId }
      );
    },
    [address, transactionSafety]
  );

  return {
    ...transactionSafety,
    createTodoNFT,
    updateTodoNFT,
    completeTodoNFT,
    transferTodoNFT,
    deleteTodoNFT,
  };
}