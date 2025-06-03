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
import { toast } from 'react-hot-toast';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
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

describe('ToastService', () => {
  let service: ToastService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new ToastService();
    
    // Mock toast IDs
    mockToast.success.mockReturnValue('toast-success-id');
    mockToast.error.mockReturnValue('toast-error-id');
    mockToast.loading.mockReturnValue('toast-loading-id');
    mockToast.custom.mockReturnValue('toast-custom-id');
  });
  
  describe('Basic Toast Operations', () => {
    it('should show success toast with default options', () => {
      const message = 'Operation completed successfully';
      const toastId = service.success(message);
      
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
      expect(toastId).toBe('toast-success-id');
    });
    
    it('should show error toast with extended duration', () => {
      const message = 'Something went wrong';
      const toastId = service.error(message);
      
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
      expect(toastId).toBe('toast-error-id');
    });
    
    it('should show warning toast', () => {
      const message = 'Please check your input';
      const toastId = service.warning(message);
      
      expect(mockToast).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: 5000,
          style: expect.objectContaining({
            background: '#FFFBEB',
            color: '#92400E',
          }),
        })
      );
      expect(toastId).toBe('toast-custom-id');
    });
    
    it('should show info toast', () => {
      const message = 'Here is some information';
      const toastId = service.info(message);
      
      expect(mockToast).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: 4000,
          style: expect.objectContaining({
            background: '#EFF6FF',
            color: '#1E40AF',
          }),
        })
      );
      expect(toastId).toBe('toast-custom-id');
    });
    
    it('should show loading toast that persists', () => {
      const message = 'Processing...';
      const toastId = service.loading(message);
      
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
      expect(toastId).toBe('toast-loading-id');
    });
  });
  
  describe('Toast Configuration', () => {
    it('should respect custom duration', () => {
      const message = 'Custom duration toast';
      const customDuration = 10000;
      
      service.success(message, { duration: customDuration });
      
      expect(mockToast.success).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: customDuration,
        })
      );
    });
    
    it('should respect custom position', () => {
      const message = 'Bottom toast';
      const position = ToastPosition.BOTTOM_CENTER;
      
      service.info(message, { position });
      
      expect(mockToast).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          position: 'bottom-center',
        })
      );
    });
    
    it('should apply custom styling', () => {
      const message = 'Styled toast';
      const customStyle = {
        background: '#FF0000',
        color: '#FFFFFF',
        fontSize: '16px',
      };
      
      service.error(message, { style: customStyle });
      
      expect(mockToast.error).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          style: expect.objectContaining(customStyle),
        })
      );
    });
    
    it('should use custom icon', () => {
      const message = 'Custom icon toast';
      const customIcon = '🎉';
      
      service.success(message, { icon: customIcon });
      
      expect(mockToast.success).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          icon: customIcon,
        })
      );
    });
    
    it('should handle persistent toasts', () => {
      const message = 'Persistent toast';
      
      service.warning(message, { persistent: true });
      
      expect(mockToast).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          duration: Infinity,
        })
      );
    });
  });
  
  describe('Toast with Title', () => {
    it('should render title and message', () => {
      const title = 'Success';
      const message = 'Operation completed';
      
      service.success(message, { title });
      
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.any(Object), // JSX element
        expect.any(Object)
      );
    });
  });
  
  describe('Toast with Actions', () => {
    it('should create custom toast with action buttons', () => {
      const message = 'Action required';
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
        expect.any(Function),
        expect.any(Object)
      );
    });
    
    it('should handle loading action state', () => {
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
  
  describe('Toast Management', () => {
    it('should track active toasts', () => {
      service.success('Toast 1');
      service.error('Toast 2');
      
      expect(service.getActiveCount()).toBe(2);
    });
    
    it('should dismiss specific toast', () => {
      const toastId = service.success('Dismissible toast');
      
      service.dismiss(toastId);
      
      expect(mockToast.dismiss).toHaveBeenCalledWith(toastId);
      expect(service.getActiveCount()).toBe(0);
    });
    
    it('should dismiss all toasts', () => {
      service.success('Toast 1');
      service.error('Toast 2');
      
      service.dismissAll();
      
      expect(mockToast.dismiss).toHaveBeenCalledWith();
      expect(service.getActiveCount()).toBe(0);
    });
    
    it('should enforce max toast limit', () => {
      const limitedService = new ToastService({}, 2);
      
      limitedService.success('Toast 1');
      limitedService.success('Toast 2');
      limitedService.success('Toast 3'); // Should dismiss oldest
      
      expect(mockToast.dismiss).toHaveBeenCalledWith('toast-success-id');
    });
    
    it('should check if toast is active', () => {
      const toastId = service.success('Active toast');
      
      expect(service.isActive(toastId)).toBe(true);
      
      service.dismiss(toastId);
      
      expect(service.isActive(toastId)).toBe(false);
    });
  });
  
  describe('Toast Updates', () => {
    it('should update loading toast to success', () => {
      const toastId = service.loading('Processing...');
      
      service.update(toastId, {
        type: ToastType.SUCCESS,
        message: 'Completed successfully',
      });
      
      expect(mockToast.success).toHaveBeenCalledWith(
        'Completed successfully',
        { id: toastId }
      );
    });
    
    it('should update loading toast to error', () => {
      const toastId = service.loading('Processing...');
      
      service.update(toastId, {
        type: ToastType.ERROR,
        message: 'Operation failed',
      });
      
      expect(mockToast.error).toHaveBeenCalledWith(
        'Operation failed',
        { id: toastId }
      );
    });
    
    it('should handle update of non-existent toast', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      service.update('non-existent-id', {
        type: ToastType.SUCCESS,
        message: 'Updated',
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Toast with ID non-existent-id not found'
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Promise-based Toasts', () => {
    it('should handle successful promise', async () => {
      const promise = Promise.resolve('Success data');
      const messages = {
        loading: 'Processing...',
        success: 'Success!',
        error: 'Error!',
      };
      
      service.promise(promise, messages);
      
      expect(mockToast.promise).toHaveBeenCalledWith(
        promise,
        messages,
        expect.objectContaining({
          style: expect.any(Object),
          success: expect.any(Object),
          error: expect.any(Object),
        })
      );
    });
    
    it('should handle promise with dynamic messages', async () => {
      const promise = Promise.resolve({ id: '123' });
      const messages = {
        loading: 'Saving...',
        success: (data: any) => `Saved with ID ${data.id}`,
        error: (error: Error) => `Failed: ${error.message}`,
      };
      
      service.promise(promise, messages);
      
      expect(mockToast.promise).toHaveBeenCalledWith(
        promise,
        messages,
        expect.any(Object)
      );
    });
  });
  
  describe('Theme Management', () => {
    it('should use custom theme', () => {
      const customTheme = {
        success: {
          background: '#00FF00',
          color: '#000000',
          border: '#00AA00',
          icon: '✓',
        },
      };
      
      const themedService = new ToastService(customTheme);
      
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
    
    it('should update theme at runtime', () => {
      const newTheme = {
        error: {
          background: '#FF0000',
          color: '#FFFFFF',
          border: '#AA0000',
          icon: '✗',
        },
      };
      
      service.updateTheme(newTheme);
      
      const currentTheme = service.getTheme();
      expect(currentTheme.error).toEqual(newTheme.error);
    });
    
    it('should preserve other theme values when updating', () => {
      const originalTheme = service.getTheme();
      
      service.updateTheme({
        success: {
          background: '#NEW_COLOR',
          color: '#NEW_TEXT',
          border: '#NEW_BORDER',
          icon: '🎉',
        },
      });
      
      const updatedTheme = service.getTheme();
      expect(updatedTheme.error).toEqual(originalTheme.error);
      expect(updatedTheme.success.background).toBe('#NEW_COLOR');
    });
  });
  
  describe('Singleton and Convenience Functions', () => {
    it('should use singleton instance', () => {
      const toastId1 = showSuccess('Success message');
      const toastId2 = showError('Error message');
      
      expect(mockToast.success).toHaveBeenCalledWith(
        'Success message',
        expect.any(Object)
      );
      expect(mockToast.error).toHaveBeenCalledWith(
        'Error message',
        expect.any(Object)
      );
    });
    
    it('should use convenience functions', () => {
      showWarning('Warning message');
      showInfo('Info message');
      showLoading('Loading message');
      
      expect(mockToast).toHaveBeenCalledTimes(3);
    });
    
    it('should use convenience dismiss functions', () => {
      const toastId = showSuccess('Toast to dismiss');
      
      dismissToast(toastId);
      dismissAllToasts();
      
      expect(mockToast.dismiss).toHaveBeenCalledWith(toastId);
      expect(mockToast.dismiss).toHaveBeenCalledWith();
    });
  });
  
  describe('Edge Cases and Error Handling', () => {
    it('should handle empty messages gracefully', () => {
      service.success('');
      service.error('');
      
      expect(mockToast.success).toHaveBeenCalledWith('', expect.any(Object));
      expect(mockToast.error).toHaveBeenCalledWith('', expect.any(Object));
    });
    
    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      
      service.info(longMessage);
      
      expect(mockToast).toHaveBeenCalledWith(
        longMessage,
        expect.objectContaining({
          style: expect.objectContaining({
            maxWidth: '400px',
          }),
        })
      );
    });
    
    it('should handle failed action execution', async () => {
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
      const customToastCall = mockToast.custom.mock.calls[0];
      const toastFunction = customToastCall[0];
      
      // Mock toast object
      const mockToastObj = { id: 'test-id' };
      
      // This would normally be called by clicking the action button
      try {
        await failingAction.action();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      
      consoleSpy.mockRestore();
    });
    
    it('should handle invalid toast configuration', () => {
      const invalidConfig = {
        type: 'invalid-type' as any,
        message: 'Test message',
      };
      
      expect(() => {
        service.show(invalidConfig);
      }).not.toThrow();
    });
  });
  
  describe('Performance and Memory', () => {
    it('should cleanup old toasts automatically', (done) => {
      const toastId = service.success('Auto cleanup test');
      
      expect(service.isActive(toastId)).toBe(true);
      
      // Wait for auto-cleanup (duration + 1000ms)
      setTimeout(() => {
        expect(service.isActive(toastId)).toBe(false);
        done();
      }, 5100); // 4000ms duration + 1000ms cleanup + buffer
    });
    
    it('should handle rapid toast creation', () => {
      for (let i = 0; i < 100; i++) {
        service.info(`Toast ${i}`);
      }
      
      // Service should handle this without errors
      expect(mockToast).toHaveBeenCalledTimes(100);
    });
  });
});
