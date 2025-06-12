/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  useSSRState,
  useProgressiveMount,
  useClientOnly,
  useSafeBrowserFeature,
  useSafeStorage,
  useHydrationSafePreferences,
  useLayoutStableHydration,
} from '@/lib/ssr-utils';

// Test component using SSR utilities
function TestSSRStateComponent() {
  const { isServer, isClient, isHydrated, isHydrating } = useSSRState();
  
  return (
    <div>
      <div data-testid="is-server">{isServer.toString()}</div>
      <div data-testid="is-client">{isClient.toString()}</div>
      <div data-testid="is-hydrated">{isHydrated.toString()}</div>
      <div data-testid="is-hydrating">{isHydrating.toString()}</div>
    </div>
  );
}

function TestProgressiveMountComponent() {
  const { mounted, isReady, progressiveStage } = useProgressiveMount({
    minLoadingTime: 10,
    enableProgressiveHydration: true,
  });
  
  return (
    <div>
      <div data-testid="mounted">{mounted.toString()}</div>
      <div data-testid="is-ready">{isReady.toString()}</div>
      <div data-testid="progressive-stage">{progressiveStage}</div>
    </div>
  );
}

function TestClientOnlyComponent() {
  const { isClient, ClientOnlyWrapper } = useClientOnly(() => <div data-testid="fallback">Loading...</div>);
  
  return (
    <div>
      <div data-testid="is-client-only">{isClient.toString()}</div>
      <ClientOnlyWrapper>
        <div data-testid="client-content">Client-only content</div>
      </ClientOnlyWrapper>
    </div>
  );
}

function TestBrowserFeatureComponent() {
  const { value, isLoaded, error } = useSafeBrowserFeature(
    () => typeof window !== 'undefined' && 'localStorage' in window,
    false
  );
  
  return (
    <div>
      <div data-testid="has-localstorage">{value.toString()}</div>
      <div data-testid="feature-loaded">{isLoaded.toString()}</div>
      <div data-testid="feature-error">{error?.message || 'none'}</div>
    </div>
  );
}

function TestSafeStorageComponent() {
  const [value, setValue, { isLoaded, error }] = useSafeStorage('test-key', 'default-value');
  
  const handleSetValue = () => {
    setValue('new-value');
  };
  
  return (
    <div>
      <div data-testid="storage-value">{value}</div>
      <div data-testid="storage-loaded">{isLoaded.toString()}</div>
      <div data-testid="storage-error">{error?.message || 'none'}</div>
      <button onClick={handleSetValue} data-testid="set-value">Set Value</button>
    </div>
  );
}

function TestHydrationSafePreferencesComponent() {
  const [theme, setTheme] = useHydrationSafePreferences('theme', 'light');
  
  const handleToggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };
  
  return (
    <div>
      <div data-testid="theme-value">{theme}</div>
      <button onClick={handleToggleTheme} data-testid="toggle-theme">Toggle Theme</button>
    </div>
  );
}

function TestLayoutStabilityComponent() {
  const isStable = useLayoutStableHydration();
  
  return (
    <div>
      <div data-testid="layout-stable">{isStable.toString()}</div>
    </div>
  );
}

describe('SSR Utils', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('useSSRState', () => {
    it('should correctly identify client/server state', () => {
      render(<TestSSRStateComponent />);
      
      // In jsdom, we're always on the client
      expect(screen.getByTestId('is-server')).toHaveTextContent('false');
      expect(screen.getByTestId('is-client')).toHaveTextContent('true');
    });

    it('should handle hydration state changes', async () => {
      render(<TestSSRStateComponent />);
      
      // Initially should be hydrating
      expect(screen.getByTestId('is-hydrating')).toHaveTextContent('true');
      expect(screen.getByTestId('is-hydrated')).toHaveTextContent('false');
      
      // Should become hydrated after a tick
      await waitFor(() => {
        expect(screen.getByTestId('is-hydrated')).toHaveTextContent('true');
        expect(screen.getByTestId('is-hydrating')).toHaveTextContent('false');
      });
    });
  });

  describe('useProgressiveMount', () => {
    it('should handle progressive mounting with minimum time', async () => {
      render(<TestProgressiveMountComponent />);
      
      // Initially should not be mounted or ready
      expect(screen.getByTestId('mounted')).toHaveTextContent('false');
      expect(screen.getByTestId('is-ready')).toHaveTextContent('false');
      
      // Should become mounted and ready after minimum time
      await waitFor(() => {
        expect(screen.getByTestId('mounted')).toHaveTextContent('true');
        expect(screen.getByTestId('is-ready')).toHaveTextContent('true');
      }, { timeout: 50 });
    });

    it('should handle progressive hydration stages', async () => {
      render(<TestProgressiveMountComponent />);
      
      expect(screen.getByTestId('progressive-stage')).toHaveTextContent('0');
      
      // Should progress through stages
      await waitFor(() => {
        const stage = parseInt(screen.getByTestId('progressive-stage').textContent || '0');
        expect(stage as any).toBeGreaterThan(0 as any);
      }, { timeout: 500 });
    });
  });

  describe('useClientOnly', () => {
    it('should render client content when ready', async () => {
      render(<TestClientOnlyComponent />);
      
      // Should show client status and content
      await waitFor(() => {
        expect(screen.getByTestId('is-client-only')).toHaveTextContent('true');
        expect(screen.getByTestId('client-content')).toBeInTheDocument();
      });
    });
  });

  describe('useSafeBrowserFeature', () => {
    it('should detect browser features safely', async () => {
      render(<TestBrowserFeatureComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('has-localstorage')).toHaveTextContent('true');
        expect(screen.getByTestId('feature-loaded')).toHaveTextContent('true');
        expect(screen.getByTestId('feature-error')).toHaveTextContent('none');
      });
    });
  });

  describe('useSafeStorage', () => {
    it('should handle localStorage safely', async () => {
      render(<TestSafeStorageComponent />);
      
      // Should start with default value
      expect(screen.getByTestId('storage-value')).toHaveTextContent('default-value');
      
      await waitFor(() => {
        expect(screen.getByTestId('storage-loaded')).toHaveTextContent('true');
      });
    });

    it('should update storage value', async () => {
      render(<TestSafeStorageComponent />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('storage-loaded')).toHaveTextContent('true');
      });
      
      // Click to set new value
      const setButton = screen.getByTestId('set-value');
      setButton.click();
      
      // Should update the value
      await waitFor(() => {
        expect(screen.getByTestId('storage-value')).toHaveTextContent('new-value');
      });
      
      // Should persist to localStorage
      expect(localStorage.getItem('test-key')).toBe('"new-value"');
    });
  });

  describe('useHydrationSafePreferences', () => {
    it('should handle preferences safely', async () => {
      render(<TestHydrationSafePreferencesComponent />);
      
      // Should start with default theme
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    });

    it('should toggle preferences', async () => {
      render(<TestHydrationSafePreferencesComponent />);
      
      // Wait for component to be ready
      await waitFor(() => {
        expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
      });
      
      // Click to toggle theme
      const toggleButton = screen.getByTestId('toggle-theme');
      toggleButton.click();
      
      // Should update to dark theme
      await waitFor(() => {
        expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
      });
      
      // Should persist to localStorage
      expect(localStorage.getItem('theme')).toBe('"dark"');
    });
  });

  describe('useLayoutStableHydration', () => {
    it('should handle layout stability', async () => {
      render(<TestLayoutStabilityComponent />);
      
      // Should eventually become stable
      await waitFor(() => {
        expect(screen.getByTestId('layout-stable')).toHaveTextContent('true');
      }, { timeout: 200 });
    });
  });
});

// Test SSR-safe component patterns
describe('SSR Fallback Components', () => {
  it('should handle safe JSON operations', () => {
    const { safeJSON } = require('@/lib/ssr-utils');
    
    // Test safe parsing
    expect(safeJSON.parse('{"valid": true}', { valid: false })).toEqual({ valid: true });
    expect(safeJSON.parse('invalid json', { valid: false })).toEqual({ valid: false });
    
    // Test safe stringifying
    expect(safeJSON.stringify({ test: true })).toBe('{"test":true}');
    expect(safeJSON.stringify(undefined as any)).toBe('{}');
  });
});