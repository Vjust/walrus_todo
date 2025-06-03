/**
 * Error recovery and retry utilities for frontend operations
 */

export enum ErrorType {
  NETWORK = 'network',
  AUTH = 'auth',
  STORAGE = 'storage',
  WALRUS = 'walrus',
  BLOCKCHAIN = 'blockchain',
  UNKNOWN = 'unknown'
}

export interface ErrorPersistenceEntry {
  id: string;
  timestamp: number;
  type: ErrorType;
  message: string;
  stack?: string;
  retryCount: number;
  recovered: boolean;
  recoveryAttempts: string[];
}

export interface RetryOptions {
  errorType: ErrorType;
  customStrategy?: {
    maxRetries: number;
    baseDelay: number;
  };
  silent?: boolean;
}

/**
 * Classify error type based on error message and properties
 */
export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return ErrorType.NETWORK;
  }
  
  if (message.includes('wallet') || message.includes('auth') || message.includes('permission')) {
    return ErrorType.AUTH;
  }
  
  if (message.includes('storage') || message.includes('localStorage') || message.includes('sessionStorage')) {
    return ErrorType.STORAGE;
  }
  
  if (message.includes('walrus') || message.includes('blob')) {
    return ErrorType.WALRUS;
  }
  
  if (message.includes('blockchain') || message.includes('sui') || message.includes('transaction')) {
    return ErrorType.BLOCKCHAIN;
  }
  
  return ErrorType.UNKNOWN;
}

/**
 * Retry operation with recovery strategy
 */
export async function retryWithRecovery<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const maxRetries = options.customStrategy?.maxRetries || 3;
  const baseDelay = options.customStrategy?.baseDelay || 1000;
  let lastError: Error = new Error('Retry failed after maximum attempts');
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        break;
      }
      
      if (!options.silent) {
        console.warn(`Retry attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Error persistence utilities
 */
export const errorPersistence = {
  async saveError(entry: ErrorPersistenceEntry): Promise<void> {
    try {
      if (typeof window === 'undefined') {return;}
      
      const key = `error_log_${entry.id}`;
      localStorage.setItem(key, JSON.stringify(entry));
      
      // Clean up old entries (keep last 50)
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith('error_log_'));
      if (allKeys.length > 50) {
        const sortedKeys = allKeys.sort();
        const toRemove = sortedKeys.slice(0, allKeys.length - 50);
        toRemove.forEach(key => localStorage.removeItem(key));
      }
    } catch (error) {
      // Ignore persistence errors
      console.warn('Failed to persist error:', error);
    }
  },

  async getErrors(): Promise<ErrorPersistenceEntry[]> {
    try {
      if (typeof window === 'undefined') {return [];}
      
      const errors: ErrorPersistenceEntry[] = [];
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith('error_log_'));
      
      for (const key of allKeys) {
        try {
          const entry = JSON.parse(localStorage.getItem(key) || '{}');
          errors.push(entry);
        } catch (parseError) {
          // Remove invalid entries
          localStorage.removeItem(key);
        }
      }
      
      return errors.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.warn('Failed to retrieve errors:', error);
      return [];
    }
  },

  async clearErrors(): Promise<void> {
    try {
      if (typeof window === 'undefined') {return;}
      
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith('error_log_'));
      allKeys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear errors:', error);
    }
  }
};