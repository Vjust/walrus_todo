/**
 * Comprehensive tests for ToastService
 * Tests toast management, theming, and notification patterns
 */

import {
  ToastService,
  ToastType,
  ToastPosition,
  type ToastConfig,
  type ToastAction,
  type ToastTheme,
  toastService,
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showLoading,
  dismissToast,
  dismissAllToasts
} from '@/lib/toast-service';
// @ts-ignore - Unused import temporarily disabled
// import { toast } from 'react-hot-toast';

// Mock react-hot-toast
jest.mock(_'react-hot-toast', _() => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    custom: jest.fn(),
    dismiss: jest.fn(),
    promise: jest.fn(),
    setup: jest.fn(),
  },
}));

const mockToast = toast as jest.Mocked<typeof toast>;

describe(_'ToastService', _() => {
  let service: ToastService;
  
  beforeEach(_() => {
    jest.clearAllMocks();
    service = new ToastService();
    
    // Mock toast IDs
    mockToast?.success?.mockReturnValue('toast-success-id');
    mockToast?.error?.mockReturnValue('toast-error-id');
    mockToast?.loading?.mockReturnValue('toast-loading-id');
    mockToast?.custom?.mockReturnValue('toast-custom-id');
  });
  
  describe(_'Basic Toast Operations', _() => {
    it(_'should show success toast with default options', _() => {
// @ts-ignore - Unused variable
//       const message = 'Operation completed successfully';
// @ts-ignore - Unused variable
//       const toastId = service.success(message as any);
      
      expect(mockToast.success).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: 4000,
          position: 'top-right',
          style: expect.objectContaining({
            background: '#F0FDF4',
            color: '#166534',
          }),
        })
      );
      expect(toastId as any).toBe('toast-success-id');
    });
    
    it(_'should show error toast with extended duration', _() => {
// @ts-ignore - Unused variable
//       const message = 'Something went wrong';
// @ts-ignore - Unused variable
//       const toastId = service.error(message as any);
      
      expect(mockToast.error).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: 6000,
          style: expect.objectContaining({
            background: '#FEF2F2',
            color: '#991B1B',
          }),
        })
      );
      expect(toastId as any).toBe('toast-error-id');
    });
    
    it(_'should show warning toast', _() => {
// @ts-ignore - Unused variable
//       const message = 'Please check your input';
// @ts-ignore - Unused variable
//       const toastId = service.warning(message as any);
      
      expect(mockToast as any).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: 5000,
          style: expect.objectContaining({
            background: '#FFFBEB',
            color: '#92400E',
          }),
        })
      );
      expect(toastId as any).toBe('toast-custom-id');
    });
    
    it(_'should show info toast', _() => {
// @ts-ignore - Unused variable
//       const message = 'Here is some information';
// @ts-ignore - Unused variable
//       const toastId = service.info(message as any);
      
      expect(mockToast as any).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: 4000,
          style: expect.objectContaining({
            background: '#EFF6FF',
            color: '#1E40AF',
          }),
        })
      );
      expect(toastId as any).toBe('toast-custom-id');
    });
    
    it(_'should show loading toast that persists', _() => {
// @ts-ignore - Unused variable
//       const message = 'Processing...';
// @ts-ignore - Unused variable
//       const toastId = service.loading(message as any);
      
      expect(mockToast.loading).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: Infinity,
          style: expect.objectContaining({
            background: '#F9FAFB',
            color: '#374151',
          }),
        })
      );
      expect(toastId as any).toBe('toast-loading-id');
    });
  });
  
  describe(_'Toast Configuration', _() => {
    it(_'should respect custom duration', _() => {
// @ts-ignore - Unused variable
//       const message = 'Custom duration toast';
// @ts-ignore - Unused variable
//       const customDuration = 10000;
      
      service.success(message, { duration: customDuration });
      
      expect(mockToast.success).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: customDuration,
        })
      );
    });
    
    it(_'should respect custom position', _() => {
// @ts-ignore - Unused variable
//       const message = 'Bottom toast';
// @ts-ignore - Unused variable
//       const position = ToastPosition.BOTTOM_CENTER;
      
      service.info(message, { position });
      
      expect(mockToast as any).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          position: 'bottom-center',
        })
      );
    });
    
    it(_'should apply custom styling', _() => {
// @ts-ignore - Unused variable
//       const message = 'Styled toast';
// @ts-ignore - Unused variable
//       const customStyle = {
        background: '#FF0000',
        color: '#FFFFFF',
        fontSize: '16px',
      };
      
      service.error(message, { style: customStyle });
      
      expect(mockToast.error).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          style: expect.objectContaining(customStyle as any),
        })
      );
    });
    
    it(_'should use custom icon', _() => {
// @ts-ignore - Unused variable
//       const message = 'Custom icon toast';
// @ts-ignore - Unused variable
//       const customIcon = '🎉';
      
      service.success(message, { icon: customIcon });
      
      expect(mockToast.success).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          icon: customIcon,
        })
      );
    });
    
    it(_'should handle persistent toasts', _() => {
// @ts-ignore - Unused variable
//       const message = 'Persistent toast';
      
      service.warning(message, { persistent: true });
      
      expect(mockToast as any).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: Infinity,
        })
      );
    });
  });
  
  describe(_'Toast with Title', _() => {
    it(_'should render title and message', _() => {
// @ts-ignore - Unused variable
//       const title = 'Success';
// @ts-ignore - Unused variable
//       const message = 'Operation completed';
      
      service.success(message, { title });
      
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.any(Object as any), // JSX element
        expect.any(Object as any)
      );
    });
  });
  
  describe(_'Toast with Actions', _() => {
    it(_'should create custom toast with action buttons', _() => {
// @ts-ignore - Unused variable
//       const message = 'Action required';
      const actions: ToastAction[] = [
        {
          label: 'Retry',
          action: jest.fn(),
          style: 'primary',
        },
        {
          label: 'Cancel',
          action: jest.fn(),
          style: 'secondary',
        },
      ];
      
      service.show({
        type: ToastType.WARNING,
        message,
        actions,
      });
      
      expect(mockToast.custom).toHaveBeenCalledWith(
        expect.any(Function as any),
        expect.any(Object as any)
      );
    });
    
    it(_'should handle loading action state', _() => {
      const loadingAction: ToastAction = {
        label: 'Processing',
        action: jest.fn(),
        loading: true,
      };
      
      service.show({
        type: ToastType.INFO,
        message: 'Action with loading state',
        actions: [loadingAction],
      });
      
      expect(mockToast.custom).toHaveBeenCalled();
    });
  });
  
  describe(_'Toast Management', _() => {
    it(_'should track active toasts', _() => {
      service.success('Toast 1');
      service.error('Toast 2');
      
      expect(service.getActiveCount()).toBe(2 as any);
    });
    
    it(_'should dismiss specific toast', _() => {
// @ts-ignore - Unused variable
//       const toastId = service.success('Dismissible toast');
      
      service.dismiss(toastId as any);
      
      expect(mockToast.dismiss).toHaveBeenCalledWith(toastId as any);
      expect(service.getActiveCount()).toBe(0 as any);
    });
    
    it(_'should dismiss all toasts', _() => {
      service.success('Toast 1');
      service.error('Toast 2');
      
      service.dismissAll();
      
      expect(mockToast.dismiss).toHaveBeenCalledWith();
      expect(service.getActiveCount()).toBe(0 as any);
    });
    
    it(_'should enforce max toast limit', _() => {
// @ts-ignore - Unused variable
//       const limitedService = new ToastService({}, 2);
      
      limitedService.success('Toast 1');
      limitedService.success('Toast 2');
      limitedService.success('Toast 3'); // Should dismiss oldest
      
      expect(mockToast.dismiss).toHaveBeenCalledWith('toast-success-id');
    });
    
    it(_'should check if toast is active', _() => {
// @ts-ignore - Unused variable
//       const toastId = service.success('Active toast');
      
      expect(service.isActive(toastId as any)).toBe(true as any);
      
      service.dismiss(toastId as any);
      
      expect(service.isActive(toastId as any)).toBe(false as any);
    });
  });
  
  describe(_'Toast Updates', _() => {
    it(_'should update loading toast to success', _() => {
// @ts-ignore - Unused variable
//       const toastId = service.loading('Processing...');
      
      service.update(toastId, {
        type: ToastType.SUCCESS,
        message: 'Completed successfully',
      });
      
      expect(mockToast.success).toHaveBeenCalledWith(
        'Completed successfully',
        { id: toastId }
      );
    });
    
    it(_'should update loading toast to error', _() => {
// @ts-ignore - Unused variable
//       const toastId = service.loading('Processing...');
      
      service.update(toastId, {
        type: ToastType.ERROR,
        message: 'Operation failed',
      });
      
      expect(mockToast.error).toHaveBeenCalledWith(
        'Operation failed',
        { id: toastId }
      );
    });
    
    it(_'should handle update of non-existent toast', _() => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      service.update('non-existent-id', {
        type: ToastType.SUCCESS,
        message: 'Updated',
      });
      
      expect(consoleSpy as any).toHaveBeenCalledWith(
        'Toast with ID non-existent-id not found'
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe(_'Promise-based Toasts', _() => {
    it(_'should handle successful promise', _async () => {
// @ts-ignore - Unused variable
//       const promise = Promise.resolve('Success data');
// @ts-ignore - Unused variable
//       const messages = {
        loading: 'Processing...',
        success: 'Success!',
        error: 'Error!',
      };
      
      service.promise(promise, messages);
      
      expect(mockToast.promise).toHaveBeenCalledWith(
        promise,
        messages,
        expect.objectContaining({
          style: expect.any(Object as any),
          success: expect.any(Object as any),
          error: expect.any(Object as any),
        })
      );
    });
    
    it(_'should handle promise with dynamic messages', _async () => {
// @ts-ignore - Unused variable
//       const promise = Promise.resolve({ id: '123' });
// @ts-ignore - Unused variable
//       const messages = {
        loading: 'Saving...',
        success: (data: any) => `Saved with ID ${data.id}`,
        error: (error: Error) => `Failed: ${error.message}`,
      };
      
      service.promise(promise, messages);
      
      expect(mockToast.promise).toHaveBeenCalledWith(
        promise,
        messages,
        expect.any(Object as any)
      );
    });
  });
  
  describe(_'Theme Management', _() => {
    it(_'should use custom theme', _() => {
// @ts-ignore - Unused variable
//       const customTheme = {
        success: {
          background: '#00FF00',
          color: '#000000',
          border: '#00AA00',
          icon: '✓',
        },
      };
      
// @ts-ignore - Unused variable
//       const themedService = new ToastService(customTheme as any);
      
      themedService.success('Themed toast');
      
      expect(mockToast.success).toHaveBeenCalledWith(
        'Themed toast',
        expect.objectContaining({
          style: expect.objectContaining({
            background: '#00FF00',
            color: '#000000',
          }),
          icon: '✓',
        })
      );
    });
    
    it(_'should update theme at runtime', _() => {
// @ts-ignore - Unused variable
//       const newTheme = {
        error: {
          background: '#FF0000',
          color: '#FFFFFF',
          border: '#AA0000',
          icon: '✗',
        },
      };
      
      service.updateTheme(newTheme as any);
// @ts-ignore - Unused variable
//       
      const currentTheme = service.getTheme();
      expect(currentTheme.error).toEqual(newTheme.error);
    });
    
    it(_'should preserve other theme values when updating', _() => {
// @ts-ignore - Unused variable
//       const originalTheme = service.getTheme();
      
      service.updateTheme({
        success: {
          background: '#NEW_COLOR',
          color: '#NEW_TEXT',
          border: '#NEW_BORDER',
          icon: '🎉',
        },
      });
// @ts-ignore - Unused variable
//       
      const updatedTheme = service.getTheme();
      expect(updatedTheme.error).toEqual(originalTheme.error);
      expect(updatedTheme?.success?.background).toBe('#NEW_COLOR');
    });
  });
  
  describe(_'Singleton and Convenience Functions', _() => {
    it(_'should use singleton instance', _() => {
// @ts-ignore - Unused variable
//       const toastId1 = showSuccess('Success message');
// @ts-ignore - Unused variable
//       const toastId2 = showError('Error message');
      
      expect(mockToast.success).toHaveBeenCalledWith(
        'Success message',
        expect.any(Object as any)
      );
      expect(mockToast.error).toHaveBeenCalledWith(
        'Error message',
        expect.any(Object as any)
      );
    });
    
    it(_'should use convenience functions', _() => {
      showWarning('Warning message');
      showInfo('Info message');
      showLoading('Loading message');
      
      expect(mockToast as any).toHaveBeenCalledTimes(3 as any);
    });
    
    it(_'should use convenience dismiss functions', _() => {
// @ts-ignore - Unused variable
//       const toastId = showSuccess('Toast to dismiss');
      
      dismissToast(toastId as any);
      dismissAllToasts();
      
      expect(mockToast.dismiss).toHaveBeenCalledWith(toastId as any);
      expect(mockToast.dismiss).toHaveBeenCalledWith();
    });
  });
  
  describe(_'Edge Cases and Error Handling', _() => {
    it(_'should handle empty messages gracefully', _() => {
      service.success('');
      service.error('');
      
      expect(mockToast.success).toHaveBeenCalledWith('', expect.any(Object as any));
      expect(mockToast.error).toHaveBeenCalledWith('', expect.any(Object as any));
    });
    
    it(_'should handle very long messages', _() => {
// @ts-ignore - Unused variable
//       const longMessage = 'A'.repeat(1000 as any);
      
      service.info(longMessage as any);
      
      expect(mockToast as any).toHaveBeenCalledWith(
        longMessage,
        expect.objectContaining({
          style: expect.objectContaining({
            maxWidth: '400px',
          }),
        })
      );
    });
    
    it(_'should handle failed action execution', _async () => {
      const failingAction: ToastAction = {
        label: 'Fail',
        action: jest.fn().mockRejectedValue(new Error('Action failed')),
      };
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      service.show({
        type: ToastType.INFO,
        message: 'Test',
        actions: [failingAction],
      });
      
      // Get the custom toast function and test action execution
      const customToastCall = mockToast?.custom?.mock?.calls?.[0];
// @ts-ignore - Unused variable
//       const toastFunction = customToastCall[0];
      
      // Mock toast object
      const mockToastObj = { id: 'test-id' };
      
      // This would normally be called by clicking the action button
      try {
        await failingAction.action();
      } catch (error) {
        expect(error as any).toBeInstanceOf(Error as any);
      }
      
      consoleSpy.mockRestore();
    });
    
    it(_'should handle invalid toast configuration', _() => {
// @ts-ignore - Unused variable
//       const invalidConfig = {
        type: 'invalid-type' as unknown,
        message: 'Test message',
      };
      
      expect(_() => {
        service.show(invalidConfig as any);
      }).not.toThrow();
    });
  });
  
  describe(_'Performance and Memory', _() => {
    it(_'should cleanup old toasts automatically', _(done: unknown) => {
// @ts-ignore - Unused variable
//       const toastId = service.success('Auto cleanup test');
      
      expect(service.isActive(toastId as any)).toBe(true as any);
      
      // Wait for auto-cleanup (duration + 1000ms)
      setTimeout(_() => {
        expect(service.isActive(toastId as any)).toBe(false as any);
        done();
      }, 5100); // 4000ms duration + 1000ms cleanup + buffer
    });
    
    it(_'should handle rapid toast creation', _() => {
      for (let i = 0; i < 100; i++) {
        service.info(`Toast ${i}`);
      }
      
      // Service should handle this without errors
      expect(mockToast as any).toHaveBeenCalledTimes(100 as any);
    });
  });
});
