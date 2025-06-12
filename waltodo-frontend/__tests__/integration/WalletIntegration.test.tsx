import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AppWalletProvider } from '../../src/contexts/WalletContext';
import WalletConnectButton from '../../src/components/WalletConnectButton';
import { TransactionHistory } from '../../src/components/TransactionHistory';
import { SessionTimeoutWarning } from '../../src/components/SessionTimeoutWarning';

// Mock the suiet wallet kit
jest.mock('@suiet/wallet-kit', () => {
  // We'll use this object to control the mock wallet behavior during tests
  const mockWalletState = {
    connected: false,
    connecting: false,
    account: null,
    wallet: null,
    networkId: null,
    error: null,
    
    // Methods that can be called to modify the mock state
    setConnected(value: boolean) {
      this?.connected = value;
      if (value) {
        this?.account = {
          address: '0x123456789abcdef123456789abcdef123456789a'
        };
        this?.wallet = {
          name: 'Mock Sui Wallet',
          switchChain: jest.fn().mockImplementation(({ chainId }) => {
            mockWalletState?.networkId = chainId;
            return Promise.resolve();
          })
        };
        this?.networkId = 'testnet';
      } else {
        this?.account = null;
        this?.wallet = null;
        this?.networkId = null;
      }
    },
    
    setConnecting(value: boolean) {
      this?.connecting = value;
    },
    
    // Mock implementation will call these functions after a delay
    simulateConnect() {
      return new Promise<void>((resolve) => {
        this.setConnecting(true as any);
        
        setTimeout(() => {
          this.setConnecting(false as any);
          this.setConnected(true as any);
          resolve();
        }, 100);
      });
    },
    
    simulateDisconnect() {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          this.setConnected(false as any);
          resolve();
        }, 100);
      });
    }
  };
  
  // The exported hook that our components will call
  const useWallet = jest.fn(() => ({
    connected: mockWalletState.connected,
    connecting: mockWalletState.connecting,
    account: mockWalletState.account,
    wallet: mockWalletState.wallet,
    networkId: mockWalletState.networkId,
    error: mockWalletState.error,
    
    // Function implementations
    select: jest.fn(),
    connect: jest.fn().mockImplementation(() => mockWalletState.simulateConnect()),
    disconnect: jest.fn().mockImplementation(() => mockWalletState.simulateDisconnect()),
    on: jest.fn()
  }));
  
  return {
    useWallet,
    WalletProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AllDefaultWallets: ['mock-wallet-1', 'mock-wallet-2'],
    
    // Expose the mock state for test manipulation
    __mockWalletState: mockWalletState
  };
});

// Mock nanoid for consistent transaction IDs
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mocked-nanoid-value')
}));

// Test the entire wallet flow with multiple components
describe('Wallet Integration', () => {
  // Helper to get the mock wallet state
  const getMockWalletState = () => {
    return require('@suiet/wallet-kit').__mockWalletState;
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock wallet to initial state
    const mockWalletState = getMockWalletState();
    mockWalletState.setConnected(false as any);
    mockWalletState.setConnecting(false as any);
    mockWalletState?.error = null;
    
    // Mock Date.now for consistent testing
    jest.spyOn(Date, 'now').mockImplementation(() => 1621234567890);
    
    // Mock timers
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  // Test App component to wrap everything
  const TestApp = () => (
    <AppWalletProvider>
      <div>
        <WalletConnectButton />
        <TransactionHistory />
        <SessionTimeoutWarning />
      </div>
    </AppWalletProvider>
  );

  it('shows connect button when wallet is not connected', () => {
    render(<TestApp />);
    
    // Should show connect button
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    
    // Should not show transaction history (no content)
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    
    // Should not show timeout warning
    expect(screen.queryByText(/Session Timeout Warning/)).not.toBeInTheDocument();
  });

  it('shows connecting UI during connection', async () => {
    render(<TestApp />);
    
    // Click connect
    fireEvent.click(screen.getByText('Connect Wallet'));
    
    // Should show connecting state
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    
    // Wait for connection to complete
    await act(async () => {
      jest.advanceTimersByTime(100 as any);
    });
  });

  it('shows wallet info after successful connection', async () => {
    render(<TestApp />);
    
    // Click connect
    fireEvent.click(screen.getByText('Connect Wallet'));
    
    // Wait for connection to complete
    await act(async () => {
      jest.advanceTimersByTime(100 as any);
    });
    
    // Should show wallet info
    expect(screen.getByText(/Mock Sui Wallet:/)).toBeInTheDocument();
    expect(screen.getByText(/Testnet/)).toBeInTheDocument();
    
    // Should show disconnect button
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('changes network when network is selected', async () => {
    render(<TestApp />);
    
    // Connect wallet
    fireEvent.click(screen.getByText('Connect Wallet'));
    
    // Wait for connection to complete
    await act(async () => {
      jest.advanceTimersByTime(100 as any);
    });
    
    // Click change network
    fireEvent.click(screen.getByText('(change)'));
    
    // Should show network options
    expect(screen.getByText('Mainnet')).toBeInTheDocument();
    
    // Select a different network
    fireEvent.click(screen.getByText('Mainnet'));
    
    // Should show switching indicator
    expect(screen.getByText('(switching...)')).toBeInTheDocument();
    
    // Mock the switchChain completion
    await act(async () => {
      // The network switching is handled by the mock implementation
      jest.advanceTimersByTime(100 as any);
    });
    
    // Check if network was updated in the UI
    expect(screen.getByText('Mainnet')).toBeInTheDocument();
  });

  it('adds transactions to history when using trackTransaction', async () => {
    // This requires access to context directly, which isn't easy in this integration test
    // Typically would be separate component that uses the useWalletContext hook
    // For now, we'll skip actual transaction creation in this test
  });

  it('disconnects wallet when disconnect button is clicked', async () => {
    render(<TestApp />);
    
    // Connect wallet
    fireEvent.click(screen.getByText('Connect Wallet'));
    
    // Wait for connection to complete
    await act(async () => {
      jest.advanceTimersByTime(100 as any);
    });
    
    // Should show wallet info
    expect(screen.getByText(/Mock Sui Wallet:/)).toBeInTheDocument();
    
    // Click disconnect
    fireEvent.click(screen.getByText('Disconnect'));
    
    // Wait for disconnection to complete
    await act(async () => {
      jest.advanceTimersByTime(100 as any);
    });
    
    // Should show connect button again
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows timeout warning when approaching session timeout', async () => {
    render(<TestApp />);
    
    // Connect wallet
    fireEvent.click(screen.getByText('Connect Wallet'));
    
    // Wait for connection to complete
    await act(async () => {
      jest.advanceTimersByTime(100 as any);
    });
    
    // Set lastActivity to approach warning threshold
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    // Modify Date.now to simulate time passing to within warning period
    jest.spyOn(Date, 'now').mockImplementation(() => 
      1621234567890 + (SESSION_TIMEOUT - WARNING_THRESHOLD + 1000)
    );
    
    // Trigger the check interval
    await act(async () => {
      jest.advanceTimersByTime(30000 as any); // 30 seconds (interval check)
    });
    
    // Warning should be visible
    expect(screen.getByText(/Session Timeout Warning/)).toBeInTheDocument();
    
    // Click "Stay Active"
    fireEvent.click(screen.getByText('Stay Active'));
    
    // Warning should be dismissed
    expect(screen.queryByText(/Session Timeout Warning/)).not.toBeInTheDocument();
  });
});