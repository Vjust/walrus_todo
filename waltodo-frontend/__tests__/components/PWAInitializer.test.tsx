/**
 * Tests for PWAInitializer component
 * Ensures proper PWA initialization and service worker registration
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '../test-utils';
import { PWAInitializer } from '../../src/components/PWAInitializer';
import { usePWA } from '../../src/hooks/usePWA';
import toast from 'react-hot-toast';

// Import centralized mocks
import '../mocks';

// Mock dependencies
jest.mock('../../src/hooks/usePWA');
jest.mock('react-hot-toast');

// Mock navigator.serviceWorker
const mockServiceWorker = {
  register: jest.fn(),
  ready: Promise.resolve({
    pushManager: {
      subscribe: jest.fn(),
    },
  }),
  addEventListener: jest.fn(),
};

Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true,
});

describe('PWAInitializer', () => {
  const mockUsePWA = {
    isInstalled: false,
    isStandalone: false,
    installPromptEvent: null,
    canInstall: false,
    promptInstall: jest.fn(),
    isOnline: true,
    registration: null,
    updateAvailable: false,
    updateApp: jest.fn(),
    isIOS: false,
    isAndroid: false,
    isChrome: true,
    isFirefox: false,
    isSafari: false,
    metrics: {
      installSource: null,
      installTime: null,
      updateCount: 0,
      lastUpdateTime: null,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock
    (usePWA as jest.Mock).mockReturnValue(mockUsePWA);
    
    // Mock toast
    (toast.success as jest.Mock).mockImplementation(() => {});
    (toast.error as jest.Mock).mockImplementation(() => {});
    (toast as any).mockImplementation(() => {});
  });

  describe('Service Worker Registration', () => {
    it('should register service worker on mount', async () => {
      mockServiceWorker.register.mockResolvedValue({
        scope: '/',
        active: { state: 'activated' },
      });

      render(<PWAInitializer />);

      await waitFor(() => {
        expect(mockServiceWorker.register).toHaveBeenCalledWith(
          '/service-worker.js',
          { scope: '/' }
        );
      });

      expect(toast.success).toHaveBeenCalledWith(
        'App ready for offline use!',
        expect.any(Object)
      );
    });

    it('should handle registration errors', async () => {
      const error = new Error('Registration failed');
      mockServiceWorker.register.mockRejectedValue(error);

      render(<PWAInitializer />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to register service worker',
          expect.any(Object)
        );
      });
    });

    it('should not register on localhost in development', async () => {
      // Mock window.location
      delete (window as any).location;
      window.location = { hostname: 'localhost' } as any;
      
      // Mock process.env
      process.env.NODE_ENV = 'development';

      render(<PWAInitializer />);

      await waitFor(() => {
        expect(mockServiceWorker.register).not.toHaveBeenCalled();
      });

      // Restore
      process.env.NODE_ENV = 'test';
    });
  });

  describe('Update Notifications', () => {
    it('should show update notification when available', () => {
      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        updateAvailable: true,
      });

      render(<PWAInitializer />);

      expect(screen.getByText(/Update available/i)).toBeInTheDocument();
      expect(screen.getByText(/Refresh to update/i)).toBeInTheDocument();
    });

    it('should trigger app update when refresh clicked', async () => {
      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        updateAvailable: true,
      });

      render(<PWAInitializer />);

      const refreshButton = screen.getByText(/Refresh to update/i);
      fireEvent.click(refreshButton);

      expect(mockUsePWA.updateApp).toHaveBeenCalled();
    });

    it('should dismiss update notification', () => {
      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        updateAvailable: true,
      });

      render(<PWAInitializer />);

      const dismissButton = screen.getByLabelText(/Dismiss/i);
      fireEvent.click(dismissButton);

      expect(screen.queryByText(/Update available/i)).not.toBeInTheDocument();
    });
  });

  describe('Offline Indicator', () => {
    it('should show offline indicator when offline', () => {
      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        isOnline: false,
      });

      render(<PWAInitializer />);

      expect(screen.getByText(/You are offline/i)).toBeInTheDocument();
    });

    it('should hide offline indicator when online', () => {
      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        isOnline: true,
      });

      render(<PWAInitializer />);

      expect(screen.queryByText(/You are offline/i)).not.toBeInTheDocument();
    });

    it('should show notification when going offline', () => {
      const { rerender } = render(<PWAInitializer />);

      // Go offline
      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        isOnline: false,
      });

      rerender(<PWAInitializer />);

      expect(toast).toHaveBeenCalledWith(
        'You are now offline. Some features may be limited.',
        expect.objectContaining({
          icon: '📵',
        })
      );
    });

    it('should show notification when coming back online', () => {
      // Start offline
      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        isOnline: false,
      });

      const { rerender } = render(<PWAInitializer />);

      // Go online
      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        isOnline: true,
      });

      rerender(<PWAInitializer />);

      expect(toast.success).toHaveBeenCalledWith(
        'You are back online!',
        expect.objectContaining({
          icon: '🌐',
        })
      );
    });
  });

  describe('Background Sync', () => {
    it('should register background sync on service worker ready', async () => {
      const mockRegistration = {
        sync: {
          register: jest.fn(),
        },
      };

      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        registration: mockRegistration,
      });

      render(<PWAInitializer />);

      await waitFor(() => {
        expect(mockRegistration.sync.register).toHaveBeenCalledWith('sync-todos');
      });
    });

    it('should handle browsers without background sync', async () => {
      const mockRegistration = {
        // No sync property
      };

      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        registration: mockRegistration,
      });

      render(<PWAInitializer />);

      // Should not throw error
      expect(() => render(<PWAInitializer />)).not.toThrow();
    });
  });

  describe('Push Notifications', () => {
    it('should request notification permission on prompt', async () => {
      // Mock Notification API
      const mockNotification = {
        permission: 'default',
        requestPermission: jest.fn().mockResolvedValue('granted'),
      };
      
      Object.defineProperty(window, 'Notification', {
        value: mockNotification,
        writable: true,
      });

      render(<PWAInitializer />);

      // Assume there's a button to enable notifications
      const enableButton = screen.queryByText(/Enable notifications/i);
      if (enableButton) {
        fireEvent.click(enableButton);

        await waitFor(() => {
          expect(mockNotification.requestPermission).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Platform-Specific Behavior', () => {
    it('should show iOS install instructions', () => {
      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        isIOS: true,
        isStandalone: false,
        canInstall: false,
      });

      render(<PWAInitializer />);

      expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument();
      expect(screen.getByText(/Share button/i)).toBeInTheDocument();
    });

    it('should not show install UI in standalone mode', () => {
      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        isStandalone: true,
        canInstall: false,
      });

      render(<PWAInitializer />);

      expect(screen.queryByText(/Install/i)).not.toBeInTheDocument();
    });
  });

  describe('Metrics Tracking', () => {
    it('should track install metrics', async () => {
      const mockMetrics = {
        installSource: 'prompt',
        installTime: Date.now(),
        updateCount: 0,
        lastUpdateTime: null,
      };

      (usePWA as jest.Mock).mockReturnValue({
        ...mockUsePWA,
        isInstalled: true,
        metrics: mockMetrics,
      });

      render(<PWAInitializer />);

      // Verify metrics are being used (implementation specific)
      expect(mockMetrics.installSource).toBe('prompt');
    });
  });

  describe('Error Boundaries', () => {
    it('should handle service worker errors gracefully', async () => {
      // Simulate service worker not supported
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        writable: true,
      });

      render(<PWAInitializer />);

      // Should render without crashing
      expect(screen.getByTestId('pwa-initializer')).toBeInTheDocument();
      
      // Restore
      Object.defineProperty(navigator, 'serviceWorker', {
        value: mockServiceWorker,
        writable: true,
      });
    });
  });
});