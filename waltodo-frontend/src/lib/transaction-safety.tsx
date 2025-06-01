/**
 * Transaction Safety Module
 * 
 * Provides comprehensive safety measures for blockchain transactions including:
 * - Gas estimation before execution
 * - Transaction simulation
 * - Proper error handling and recovery
 * - User confirmation dialogs
 */

import React from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import toast from 'react-hot-toast';

export interface TransactionSafetyConfig {
  maxGasPrice?: bigint;
  maxGasBudget?: bigint;
  simulationRetries?: number;
  confirmationRequired?: boolean;
  dryRunFirst?: boolean;
}

export interface GasEstimation {
  computationCost: string;
  storageCost: string;
  storageRebate: string;
  totalCost: string;
  gasBudget: string;
  gasPrice: string;
  isSafe: boolean;
  warnings: string[];
}

export interface TransactionSimulationResult {
  success: boolean;
  error?: string;
  effects?: any;
  gasUsed?: string;
  warnings: string[];
}

export interface UserConfirmationData {
  operation: string;
  estimatedGas: GasEstimation;
  details: Record<string, any>;
  warnings: string[];
}

const DEFAULT_CONFIG: TransactionSafetyConfig = {
  maxGasPrice: BigInt(1000), // 1000 MIST per gas unit
  maxGasBudget: BigInt(100000000), // 0.1 SUI
  simulationRetries: 3,
  confirmationRequired: true,
  dryRunFirst: true,
};

export class TransactionSafetyManager {
  private config: TransactionSafetyConfig;
  private suiClient: SuiClient;

  constructor(suiClient: SuiClient, config: Partial<TransactionSafetyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.suiClient = suiClient;
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(
    tx: Transaction,
    sender: string
  ): Promise<GasEstimation> {
    try {
      // Get current gas price
      const gasPrice = await this.suiClient.getReferenceGasPrice();
      const gasPriceBigInt = BigInt(gasPrice);

      // Build transaction
      const txBytes = await tx.build({ client: this.suiClient });

      // Dry run to get gas estimation
      const dryRunResult = await this.suiClient.dryRunTransactionBlock({
        transactionBlock: txBytes,
      });

      const computationCost = BigInt(dryRunResult.effects.gasUsed.computationCost);
      const storageCost = BigInt(dryRunResult.effects.gasUsed.storageCost);
      const storageRebate = BigInt(dryRunResult.effects.gasUsed.storageRebate);

      // Calculate total cost
      const totalGasUnits = computationCost + storageCost - storageRebate;
      const totalCost = totalGasUnits * gasPriceBigInt;

      // Calculate recommended gas budget (with 20% buffer)
      const recommendedBudget = (totalCost * BigInt(120)) / BigInt(100);

      // Check safety
      const warnings: string[] = [];
      let isSafe = true;

      if (gasPriceBigInt > this.config.maxGasPrice!) {
        warnings.push(`Gas price (${gasPriceBigInt} MIST) exceeds maximum (${this.config.maxGasPrice} MIST)`);
        isSafe = false;
      }

      if (recommendedBudget > this.config.maxGasBudget!) {
        warnings.push(`Recommended gas budget exceeds maximum allowed`);
        isSafe = false;
      }

      // Check if sender has enough balance
      const balance = await this.suiClient.getBalance({
        owner: sender,
        coinType: '0x2::sui::SUI',
      });

      const totalBalance = BigInt(balance.totalBalance);
      if (totalBalance < recommendedBudget) {
        warnings.push(`Insufficient balance. Need ${this.formatSui(recommendedBudget)} SUI, have ${this.formatSui(totalBalance)} SUI`);
        isSafe = false;
      }

      return {
        computationCost: computationCost.toString(),
        storageCost: storageCost.toString(),
        storageRebate: storageRebate.toString(),
        totalCost: totalCost.toString(),
        gasBudget: recommendedBudget.toString(),
        gasPrice: gasPriceBigInt.toString(),
        isSafe,
        warnings,
      };
    } catch (error) {
      console.error('Gas estimation failed:', error);
      throw new Error(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Simulate transaction execution
   */
  async simulateTransaction(
    tx: Transaction,
    sender: string
  ): Promise<TransactionSimulationResult> {
    const warnings: string[] = [];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < (this.config.simulationRetries || 3); attempt++) {
      try {
        // Build transaction
        const txBytes = await tx.build({ client: this.suiClient });

        // Dry run the transaction
        const result = await this.suiClient.dryRunTransactionBlock({
          transactionBlock: txBytes,
        });

        // Check if simulation was successful
        if (result.effects.status.status === 'failure') {
          const error = result.effects.status.error || 'Transaction would fail';
          warnings.push(`Simulation failed: ${error}`);
          
          return {
            success: false,
            error,
            effects: result.effects,
            gasUsed: result.effects.gasUsed.computationCost,
            warnings,
          };
        }

        // Check for any warnings in effects
        if (result.effects.dependencies && result.effects.dependencies.length > 10) {
          warnings.push('Transaction has many dependencies, may take longer to execute');
        }

        const gasUsed = BigInt(result.effects.gasUsed.computationCost) + 
                       BigInt(result.effects.gasUsed.storageCost) - 
                       BigInt(result.effects.gasUsed.storageRebate);

        return {
          success: true,
          effects: result.effects,
          gasUsed: gasUsed.toString(),
          warnings,
        };
      } catch (error) {
        lastError = error as Error;
        warnings.push(`Simulation attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Wait before retry
        if (attempt < (this.config.simulationRetries || 3) - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Simulation failed after retries',
      warnings,
    };
  }

  /**
   * Show user confirmation dialog
   */
  async requestUserConfirmation(data: UserConfirmationData): Promise<boolean> {
    if (!this.config.confirmationRequired) {
      return true;
    }

    return new Promise((resolve) => {
      const confirmationId = `tx-confirm-${Date.now()}`;
      
      // Create custom confirmation toast
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  Confirm Transaction
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {data.operation}
                </p>
                
                {/* Gas estimation details */}
                <div className="mt-3 bg-gray-50 rounded p-2 text-xs">
                  <p className="font-semibold text-gray-700 mb-1">Gas Estimation:</p>
                  <p>Total Cost: {this.formatSui(BigInt(data.estimatedGas.totalCost))} SUI</p>
                  <p>Gas Budget: {this.formatSui(BigInt(data.estimatedGas.gasBudget))} SUI</p>
                </div>

                {/* Warnings */}
                {data.warnings.length > 0 && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-2">
                    <p className="text-xs font-semibold text-yellow-800 mb-1">Warnings:</p>
                    {data.warnings.map((warning, i) => (
                      <p key={i} className="text-xs text-yellow-700">• {warning}</p>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      toast.dismiss(t.id);
                      resolve(true);
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-ocean-deep hover:bg-ocean-deep/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-deep"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      toast.dismiss(t.id);
                      resolve(false);
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-deep"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ), {
        id: confirmationId,
        duration: Infinity,
      });
    });
  }

  /**
   * Execute transaction with full safety checks
   */
  async executeTransactionSafely(
    tx: Transaction,
    sender: string,
    signAndExecuteTransaction: (tx: any) => Promise<any>,
    options: {
      operation: string;
      details?: Record<string, any>;
      skipSimulation?: boolean;
      skipConfirmation?: boolean;
    }
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Step 1: Estimate gas
      const gasEstimation = await this.estimateGas(tx, sender);
      
      if (!gasEstimation.isSafe) {
        const shouldProceed = await this.requestUserConfirmation({
          operation: options.operation,
          estimatedGas: gasEstimation,
          details: options.details || {},
          warnings: gasEstimation.warnings,
        });

        if (!shouldProceed) {
          return { 
            success: false, 
            error: 'Transaction cancelled by user' 
          };
        }
      }

      // Step 2: Simulate transaction (unless skipped)
      if (!options.skipSimulation && this.config.dryRunFirst) {
        const simulation = await this.simulateTransaction(tx, sender);
        
        if (!simulation.success) {
          toast.error(`Transaction simulation failed: ${simulation.error}`, {
            duration: 5000,
          });
          
          return { 
            success: false, 
            error: simulation.error 
          };
        }

        // If simulation has warnings, ask for confirmation
        if (simulation.warnings.length > 0) {
          const shouldProceed = await this.requestUserConfirmation({
            operation: options.operation,
            estimatedGas: gasEstimation,
            details: options.details || {},
            warnings: [...gasEstimation.warnings, ...simulation.warnings],
          });

          if (!shouldProceed) {
            return { 
              success: false, 
              error: 'Transaction cancelled by user' 
            };
          }
        }
      }

      // Step 3: Request user confirmation (unless skipped)
      if (!options.skipConfirmation && gasEstimation.isSafe) {
        const shouldProceed = await this.requestUserConfirmation({
          operation: options.operation,
          estimatedGas: gasEstimation,
          details: options.details || {},
          warnings: gasEstimation.warnings,
        });

        if (!shouldProceed) {
          return { 
            success: false, 
            error: 'Transaction cancelled by user' 
          };
        }
      }

      // Step 4: Set gas budget on transaction
      tx.setGasBudget(BigInt(gasEstimation.gasBudget));

      // Step 5: Execute transaction
      toast.loading('Executing transaction...', { id: 'tx-execution' });
      
      const result = await signAndExecuteTransaction({
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      toast.success('Transaction executed successfully!', { 
        id: 'tx-execution',
        duration: 3000,
      });

      return { 
        success: true, 
        result 
      };

    } catch (error) {
      console.error('Transaction execution failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Transaction failed: ${errorMessage}`, {
        id: 'tx-execution',
        duration: 5000,
      });

      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Format SUI amount for display
   */
  private formatSui(mist: bigint): string {
    const sui = Number(mist) / 1_000_000_000;
    return sui.toFixed(6).replace(/\.?0+$/, '');
  }

  /**
   * Error recovery strategies
   */
  async handleTransactionError(error: Error): Promise<{
    recoverable: boolean;
    suggestion: string;
    action?: () => Promise<void>;
  }> {
    const errorMessage = error.message.toLowerCase();

    // Insufficient gas
    if (errorMessage.includes('insufficient gas') || errorMessage.includes('gas budget')) {
      return {
        recoverable: true,
        suggestion: 'Increase gas budget and retry',
        action: async () => {
          toast('Please increase the gas budget in transaction settings', {
            icon: 'ℹ️',
          });
        },
      };
    }

    // Insufficient balance
    if (errorMessage.includes('insufficient balance') || errorMessage.includes('not enough sui')) {
      return {
        recoverable: false,
        suggestion: 'You need more SUI tokens to execute this transaction',
      };
    }

    // Network issues
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return {
        recoverable: true,
        suggestion: 'Network issue detected. Please try again',
        action: async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
        },
      };
    }

    // Object not found
    if (errorMessage.includes('object not found') || errorMessage.includes('does not exist')) {
      return {
        recoverable: false,
        suggestion: 'The requested object no longer exists on the blockchain',
      };
    }

    // Default
    return {
      recoverable: false,
      suggestion: 'Transaction failed. Please check the error details',
    };
  }
}

// Export convenience functions
export async function estimateGas(
  suiClient: SuiClient,
  tx: Transaction,
  sender: string
): Promise<GasEstimation> {
  const manager = new TransactionSafetyManager(suiClient);
  return manager.estimateGas(tx, sender);
}

export async function simulateTransaction(
  suiClient: SuiClient,
  tx: Transaction,
  sender: string
): Promise<TransactionSimulationResult> {
  const manager = new TransactionSafetyManager(suiClient);
  return manager.simulateTransaction(tx, sender);
}

export async function executeTransactionSafely(
  suiClient: SuiClient,
  tx: Transaction,
  sender: string,
  signAndExecuteTransaction: (tx: any) => Promise<any>,
  options: {
    operation: string;
    details?: Record<string, any>;
    skipSimulation?: boolean;
    skipConfirmation?: boolean;
  }
): Promise<{ success: boolean; result?: any; error?: string }> {
  const manager = new TransactionSafetyManager(suiClient);
  return manager.executeTransactionSafely(tx, sender, signAndExecuteTransaction, options);
}