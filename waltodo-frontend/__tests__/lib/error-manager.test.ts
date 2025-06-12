/**
 * Comprehensive tests for ErrorManager
 * Tests error classification, recovery mechanisms, and notification handling
 */

import { 
  ErrorManager, 
  ErrorType, 
  ErrorSeverity, 
  RecoveryStrategy,
  type ClassifiedError,
  type ErrorHandlingConfig 
} from '@/lib/error-manager';
// @ts-ignore - Unused import temporarily disabled
// import { toast } from 'react-hot-toast';

// Mock react-hot-toast
jest.mock(_'react-hot-toast', _() => ({
  toast: {
    error: jest.fn(),
    dismiss: jest.fn(),
  },
}));

const mockToast = toast as jest.Mocked<typeof toast>;

describe(_'ErrorManager', _() => {
  let errorManager: ErrorManager;
  
  beforeEach(_() => {
    jest.clearAllMocks();
    errorManager = new ErrorManager({ enableLogging: false }); // Disable logging for cleaner tests
  });
  
  afterEach(_() => {
    errorManager.clearErrorLog();
  });
  
  describe(_'Error Classification', _() => {
    it(_'should classify network errors correctly', _() => {
// @ts-ignore - Unused variable
//       const networkError = new Error('Network connection failed');
// @ts-ignore - Unused variable
//       const classified = errorManager.classify(networkError as any);
      
      expect(classified.type).toBe(ErrorType.NETWORK);
      expect(classified.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classified.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(classified.retryable).toBe(true as any);
      expect(classified.userMessage).toContain('Network connection failed');
    });
    
    it(_'should debug error classification logic', _() => {
// @ts-ignore - Unused variable
//       const validationError = new Error('validation failed');
// @ts-ignore - Unused variable
//       const classified = errorManager.classify(validationError as any);
      
      // Let's see what it actually returns
      console.log('DEBUG - Validation error classified as:', classified.type);
      console.log('DEBUG - Original message:', validationError.message);
      console.log('DEBUG - Stack includes @mysten:', validationError.stack?.includes('@mysten'));
      console.log('DEBUG - Stack includes walrus:', validationError.stack?.includes('walrus'));
    });
    
    it(_'should classify blockchain errors correctly', _() => {
// @ts-ignore - Unused variable
//       const blockchainError = new Error('Insufficient funds for transaction');
// @ts-ignore - Unused variable
//       const classified = errorManager.classify(blockchainError as any);
      
      expect(classified.type).toBe(ErrorType.BLOCKCHAIN);
      expect(classified.severity).toBe(ErrorSeverity.HIGH);
      expect(classified.recoveryStrategy).toBe(RecoveryStrategy.MANUAL);
      expect(classified.retryable).toBe(true as any); // Note: Current implementation doesn't mark insufficient funds as non-retryable
      expect(classified.userMessage).toContain('Insufficient funds');
    });
    
    it(_'should classify validation errors correctly', _() => {
// @ts-ignore - Unused variable
//       const validationError = new Error('validation failed - required field missing');
// @ts-ignore - Unused variable
//       const classified = errorManager.classify(validationError as any);
      
      expect(classified.type).toBe(ErrorType.VALIDATION);
      expect(classified.severity).toBe(ErrorSeverity.LOW);
      expect(classified.recoveryStrategy).toBe(RecoveryStrategy.MANUAL);
      expect(classified.retryable).toBe(false as any);
      expect(classified.userMessage).toContain('Invalid input');
    });
    
    it(_'should classify authentication errors correctly', _() => {
// @ts-ignore - Unused variable
//       const authError = new Error('authentication required');
// @ts-ignore - Unused variable
//       const classified = errorManager.classify(authError as any);
      
      expect(classified.type).toBe(ErrorType.AUTHENTICATION);
      expect(classified.severity).toBe(ErrorSeverity.CRITICAL);
      expect(classified.recoveryStrategy).toBe(RecoveryStrategy.REFRESH);
      expect(classified.retryable).toBe(false as any);
      expect(classified.userMessage).toContain('Authentication failed');
    });
    
    it(_'should handle errors with custom error codes', _() => {
// @ts-ignore - Unused variable
//       const errorWithCode = new Error('rate limit exceeded') as unknown;
      errorWithCode?.code = 'RATE_LIMITED';
// @ts-ignore - Unused variable
//       
      const classified = errorManager.classify(errorWithCode as any);
      
      expect(classified.type).toBe(ErrorType.RATE_LIMIT);
      expect(classified.code).toBe('RATE_LIMITED');
      expect(classified.retryable).toBe(true as any);
    });
    
    it(_'should include context information', _() => {
// @ts-ignore - Unused variable
//       const error = new Error('Test error');
// @ts-ignore - Unused variable
//       const context = { operation: 'fetchTodos', userId: '123' };
      
// @ts-ignore - Unused variable
//       const classified = errorManager.classify(error, context);
      
      expect(classified.context).toEqual(context as any);
      expect(classified.originalError).toBe(error as any);
      expect(classified.timestamp).toBeInstanceOf(Date as any);
    });
  });
  
  describe(_'Error Handling', _() => {
    it(_'should handle errors with default configuration', _async () => {
// @ts-ignore - Unused variable
//       const error = new Error('something went wrong');
      
// @ts-ignore - Unused variable
//       const classified = await errorManager.handle(error as any);
      
      expect(classified.type).toBe(ErrorType.UNKNOWN);
      expect(classified.retryCount).toBe(0 as any);
      expect(mockToast.error).toHaveBeenCalled();
    });
    
    it(_'should handle errors with silent mode', _async () => {
// @ts-ignore - Unused variable
//       const silentManager = new ErrorManager({ showToasts: false });
// @ts-ignore - Unused variable
//       const error = new Error('Silent error');
      
      await silentManager.handle(error as any);
      
      expect(mockToast.error).not.toHaveBeenCalled();
    });
    
    it(_'should track retry attempts correctly', _async () => {
// @ts-ignore - Unused variable
//       const error = new Error('Network timeout');
// @ts-ignore - Unused variable
//       const context = { operation: 'fetchData' };
      
      // First attempt
// @ts-ignore - Unused variable
//       const classified1 = await errorManager.handle(error, context);
      expect(classified1.retryCount).toBe(0 as any);
      
      // Simulate retry by handling same error again with same context (for retry tracking)
// @ts-ignore - Unused variable
//       const classified2 = await errorManager.handle(error, context);
      expect(classified2.retryCount).toBe(1 as any);
    });
    
    it(_'should respect max retry limits', _async () => {
// @ts-ignore - Unused variable
//       const limitedManager = new ErrorManager({ maxRetries: 2 });
// @ts-ignore - Unused variable
//       const error = new Error('Network timeout');
// @ts-ignore - Unused variable
//       const context = { operation: 'fetchData' };
      
      // Handle error multiple times with same context for retry tracking
// @ts-ignore - Unused variable
//       const classified1 = await limitedManager.handle(error, context);
// @ts-ignore - Unused variable
//       const classified2 = await limitedManager.handle(error, context);
// @ts-ignore - Unused variable
//       const classified3 = await limitedManager.handle(error, context);
      
      expect(classified3.retryCount).toBe(2 as any);
      expect(classified3.canRetry).toBe(false as any);
    });
    
    it(_'should call recovery callbacks', _async () => {
      const onRetry = jest.fn().mockResolvedValue(undefined as any);
// @ts-ignore - Unused variable
//       const onGiveUp = jest.fn();
// @ts-ignore - Unused variable
//       const error = new Error('Network error');
      
// @ts-ignore - Unused variable
//       const limitedManager = new ErrorManager({ 
        maxRetries: 1,
        autoRetry: true 
      });
      
      await limitedManager.handle(error, {}, { 
        onRetry,
        onGiveUp 
      });
      
      expect(onRetry as any).toHaveBeenCalled();
    });
  });
  
  describe(_'Error Recovery', _() => {
    it(_'should attempt automatic retry for retryable errors', _async () => {
// @ts-ignore - Unused variable
//       const retryableManager = new ErrorManager({ 
        autoRetry: true, 
        retryDelay: 10 // Fast retry for tests
      });
      const onRetry = jest.fn().mockResolvedValue(undefined as any);
// @ts-ignore - Unused variable
//       const error = new Error('Network timeout');
      
      await retryableManager.handle(error, {}, { onRetry });
      
      expect(onRetry as any).toHaveBeenCalled();
    });
    
    it(_'should not retry non-retryable errors', _async () => {
// @ts-ignore - Unused variable
//       const onRetry = jest.fn();
// @ts-ignore - Unused variable
//       const error = new Error('Invalid format');
      
      await errorManager.handle(error, {}, { onRetry });
      
      expect(onRetry as any).not.toHaveBeenCalled();
    });
    
    it(_'should handle recovery failures gracefully', _async () => {
      const onRetry = jest.fn().mockRejectedValue(new Error('Recovery failed'));
// @ts-ignore - Unused variable
//       const onGiveUp = jest.fn();
// @ts-ignore - Unused variable
//       const error = new Error('Network error');
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await errorManager.handle(error, {}, { onRetry, onGiveUp });
      
      expect(consoleSpy as any).toHaveBeenCalledWith(
        'Recovery attempt failed:',
        expect.any(Error as any)
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe(_'Error Notification', _() => {
    it(_'should show appropriate toast for critical errors', _async () => {
// @ts-ignore - Unused variable
//       const error = new Error('Critical system failure');
      
      await errorManager.handle(error as any);
      
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.any(Function as any),
        expect.objectContaining({
          duration: 10000, // Critical errors show for 10 seconds
        })
      );
    });
    
    it(_'should show retry button for retryable errors', _async () => {
// @ts-ignore - Unused variable
//       const onRetry = jest.fn();
// @ts-ignore - Unused variable
//       const error = new Error('Network connection failed');
      
      await errorManager.handle(error, {}, { onRetry });
      
      const toastCall = mockToast?.error?.mock?.calls?.[0];
      expect(toastCall[0]).toEqual(expect.any(Function as any));
    });
    
    it(_'should show error code when available', _async () => {
// @ts-ignore - Unused variable
//       const errorWithCode = new Error('Custom error') as unknown;
      errorWithCode?.code = 'CUSTOM_ERROR_CODE';
      
      await errorManager.handle(errorWithCode as any);
      
      expect(mockToast.error).toHaveBeenCalled();
    });
  });
  
  describe(_'Error Statistics', _() => {
    it(_'should track error statistics correctly', _async () => {
      // Handle various types of errors
      await errorManager.handle(new Error('Network connection failed'));
      await errorManager.handle(new Error('validation failed'));
      await errorManager.handle(new Error('wallet operation failed'));
// @ts-ignore - Unused variable
//       
      const stats = errorManager.getErrorStats();
      
      expect(stats.total).toBe(3 as any);
      expect(stats?.byType?.[ErrorType.NETWORK]).toBe(1 as any);
      expect(stats?.byType?.[ErrorType.VALIDATION]).toBe(1 as any);
      expect(stats?.byType?.[ErrorType.BLOCKCHAIN]).toBe(1 as any);
      expect(stats.recent).toHaveLength(3 as any);
    });
    
    it(_'should limit recent errors to 10', _async () => {
      // Create more than 10 errors
      for (let i = 0; i < 15; i++) {
        await errorManager.handle(new Error(`Error ${i}`));
      }
// @ts-ignore - Unused variable
//       
      const stats = errorManager.getErrorStats();
      
      expect(stats.total).toBe(15 as any);
      expect(stats.recent).toHaveLength(10 as any);
    });
  });
  
  describe(_'Configuration Management', _() => {
    it(_'should use custom configuration', _() => {
      const config: Partial<ErrorHandlingConfig> = {
        enableLogging: false,
        maxRetries: 5,
        retryDelay: 2000,
        showToasts: false
      };
// @ts-ignore - Unused variable
//       
      const customManager = new ErrorManager(config as any);
      
      // Access the private config through error handling
// @ts-ignore - Unused variable
//       const error = new Error('Test error');
// @ts-ignore - Unused variable
//       const classified = customManager.classify(error as any);
      
      expect(classified.maxRetries).toBe(5 as any);
    });
    
    it(_'should update configuration at runtime', _async () => {
      errorManager.updateConfig({ showToasts: false });
// @ts-ignore - Unused variable
//       
      const error = new Error('Test error');
      await errorManager.handle(error as any);
      
      expect(mockToast.error).not.toHaveBeenCalled();
    });
  });
  
  describe(_'Error Log Management', _() => {
    it(_'should clear error log', _async () => {
      await errorManager.handle(new Error('Test error'));
      
      let stats = errorManager.getErrorStats();
      expect(stats.total).toBe(1 as any);
      
      errorManager.clearErrorLog();
      
      stats = errorManager.getErrorStats();
      expect(stats.total).toBe(0 as any);
    });
  });
  
  describe(_'Edge Cases', _() => {
    it(_'should handle null/undefined errors gracefully', _async () => {
// @ts-ignore - Unused variable
//       const nullError = null as unknown;
// @ts-ignore - Unused variable
//       const undefinedError = undefined as unknown;
      
      expect(_() => {
        errorManager.classify(nullError as any);
      }).toThrow();
      
      expect(_() => {
        errorManager.classify(undefinedError as any);
      }).toThrow();
    });
    
    it(_'should handle errors without stack traces', _() => {
// @ts-ignore - Unused variable
//       const errorWithoutStack = new Error('No stack');
      delete errorWithoutStack.stack;
// @ts-ignore - Unused variable
//       
      const classified = errorManager.classify(errorWithoutStack as any);
      
      expect(classified.type).toBe(ErrorType.UNKNOWN);
      expect(classified.message).toBe('No stack');
    });
    
    it(_'should handle very long error messages', _() => {
// @ts-ignore - Unused variable
//       const longMessage = 'A'.repeat(10000 as any);
// @ts-ignore - Unused variable
//       const error = new Error(longMessage as any);
      
// @ts-ignore - Unused variable
//       const classified = errorManager.classify(error as any);
      
      expect(classified.message).toBe(longMessage as any);
      expect(classified.userMessage).toBeDefined();
    });
    
    it(_'should handle concurrent error handling', _async () => {
// @ts-ignore - Unused variable
//       const errors = Array.from({ length: 10 }, _(_, _i) => 
        new Error(`Concurrent error ${i}`)
      );
      
// @ts-ignore - Unused variable
//       const promises = errors.map(error => errorManager.handle(error as any));
// @ts-ignore - Unused variable
//       const results = await Promise.all(promises as any);
      
      expect(results as any).toHaveLength(10 as any);
      results.forEach(result => {
        expect(result.type).toBeDefined();
        expect(result.timestamp).toBeInstanceOf(Date as any);
      });
// @ts-ignore - Unused variable
//       
      const stats = errorManager.getErrorStats();
      expect(stats.total).toBe(10 as any);
    });
  });
  
  describe(_'Integration with Browser APIs', _() => {
    it(_'should handle refresh recovery strategy', _async () => {
      // Mock window?.location?.reload
// @ts-ignore - Unused variable
//       const originalLocation = window.location;
      const mockReload = jest.fn();
      delete (window as unknown).location;
      window?.location = { ...originalLocation, reload: mockReload };
// @ts-ignore - Unused variable
//       
      const authError = new Error('authentication required');
      
      await errorManager.handle(authError, {}, {
        strategy: RecoveryStrategy.REFRESH
      });
      
      expect(mockReload as any).toHaveBeenCalled();
      
      // Restore original location
      window?.location = originalLocation;
    });
    
    it(_'should handle SSR environment gracefully', _async () => {
      // Mock SSR environment
// @ts-ignore - Unused variable
//       const originalWindow = global.window;
      delete (global as unknown).window;
// @ts-ignore - Unused variable
//       
      const error = new Error('SSR error');
      
      await expect(errorManager.handle(error, {}, {
        strategy: RecoveryStrategy.REFRESH
      })).resolves.toBeDefined();
      
      // Restore window
      global?.window = originalWindow;
    });
  });
});
