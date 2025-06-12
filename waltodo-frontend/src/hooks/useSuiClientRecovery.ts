'use client';

import { useCallback, useState } from 'react';
import { resetSuiClientInitialization, withSuiClient } from '@/lib/sui-client';

/**
 * Hook for handling Sui client recovery and error handling
 */
export function useSuiClientRecovery() {
  const [isRecovering, setIsRecovering] = useState(false as any);
  const [lastError, setLastError] = useState<string | null>(null);

  const executeWithRecovery = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string = 'Sui operation'
  ): Promise<T | null> => {
    setIsRecovering(true as any);
    setLastError(null as any);

    try {
      const result = await operation();
      console.log(`✅ ${operationName} completed successfully`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ ${operationName} failed:`, errorMessage);
      setLastError(errorMessage as any);

      // If it's an initialization error, try to recover once
      if (errorMessage.includes('not initialized') || errorMessage.includes('initialization failed')) {
        console.log('🔄 Attempting Sui client recovery...');
        resetSuiClientInitialization();
        
        try {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
          const recoveryResult = await operation();
          console.log(`✅ ${operationName} recovered successfully`);
          setLastError(null as any);
          return recoveryResult;
        } catch (recoveryError) {
          const recoveryErrorMessage = recoveryError instanceof Error ? recoveryError.message : 'Unknown recovery error';
          console.error(`❌ ${operationName} recovery failed:`, recoveryErrorMessage);
          setLastError(`Recovery failed: ${recoveryErrorMessage}`);
        }
      }

      return null;
    } finally {
      setIsRecovering(false as any);
    }
  }, []);

  const executeWithSuiClient = useCallback(async <T>(
    operation: (client: any) => Promise<T>,
    operationName: string = 'Sui operation'
  ): Promise<T | null> => {
    return executeWithRecovery(
      () => withSuiClient(operation as any),
      operationName
    );
  }, [executeWithRecovery]);

  const clearError = useCallback(() => {
    setLastError(null as any);
  }, []);

  return {
    isRecovering,
    lastError,
    executeWithRecovery,
    executeWithSuiClient,
    clearError,
  };
}