/**
 * Transaction and Signer Compatibility Adapter
 * 
 * This module provides compatibility wrappers for transaction signing
 * that changed between different versions of @mysten/sui library.
 */

import { Logger } from '../Logger';

const logger = new Logger('transaction-compatibility');

/**
 * Creates a compatible signer that works with both old and new API versions
 */
export function createCompatibleSigner(signer: any) {
  if (!signer) {
    throw new Error('Signer is required');
  }

  return {
    ...signer,
    
    // Provide both old and new method names for transaction signing
    async signTransaction(transaction: any) {
      // Try new method first
      if (typeof signer.signTransaction === 'function') {
        return await signer.signTransaction(transaction);
      }
      
      // Fallback to old method
      if (typeof signer.signTransactionBlock === 'function') {
        return await signer.signTransactionBlock(transaction);
      }
      
      throw new Error('No compatible signing method found on signer');
    },
    
    async signTransactionBlock(transaction: any) {
      // Try old method first for backward compatibility
      if (typeof signer.signTransactionBlock === 'function') {
        return await signer.signTransactionBlock(transaction);
      }
      
      // Fallback to new method
      if (typeof signer.signTransaction === 'function') {
        return await signer.signTransaction(transaction);
      }
      
      throw new Error('No compatible signing method found on signer');
    },
    
    // Pass through other signer methods
    getPublicKey() {
      return signer.getPublicKey?.() || signer.publicKey;
    },
    
    getAddress() {
      return signer.getAddress?.() || signer.address;
    }
  };
}

/**
 * Helper function to sign a transaction with compatibility handling
 */
export async function signTransactionCompatible(signer: any, transaction: any) {
  const compatibleSigner = createCompatibleSigner(signer);
  
  try {
    // Try the new method first
    return await compatibleSigner.signTransaction(transaction);
  } catch (error) {
    logger.warn('signTransaction failed, trying signTransactionBlock:', error);
    
    try {
      // Fallback to old method
      return await compatibleSigner.signTransactionBlock(transaction);
    } catch (fallbackError) {
      logger.error('Both signing methods failed:', { error, fallbackError });
      throw new Error(`Transaction signing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Compatibility wrapper for transaction execution
 */
export async function executeTransactionCompatible(client: any, options: {
  transaction?: any;
  transactionBlock?: any;
  signature: any;
  requestType?: string;
  options?: any;
}) {
  if (!client || typeof client.executeTransactionBlock !== 'function') {
    throw new Error('Invalid client or executeTransactionBlock method not available');
  }

  // Normalize the transaction parameter
  const transactionBlock = options.transaction || options.transactionBlock;
  
  if (!transactionBlock) {
    throw new Error('Transaction block is required');
  }

  const executeOptions = {
    transactionBlock,
    signature: options.signature,
    requestType: options.requestType || 'WaitForLocalExecution',
    options: options.options || {
      showEffects: true,
      showEvents: true,
    }
  };

  try {
    return await client.executeTransactionBlock(executeOptions);
  } catch (error) {
    logger.error('Transaction execution failed:', error);
    throw new Error(`Transaction execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function to check if a signer has a specific method
 */
export function hasSigningMethod(signer: any, methodName: string): boolean {
  return signer && typeof signer[methodName] === 'function';
}

/**
 * Get the appropriate signing method name for the given signer
 */
export function getSigningMethodName(signer: any): string | null {
  if (hasSigningMethod(signer, 'signTransaction')) {
    return 'signTransaction';
  }
  
  if (hasSigningMethod(signer, 'signTransactionBlock')) {
    return 'signTransactionBlock';
  }
  
  return null;
}

export default {
  createCompatibleSigner,
  signTransactionCompatible,
  executeTransactionCompatible,
  hasSigningMethod,
  getSigningMethodName
};