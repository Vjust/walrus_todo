import React from 'react';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import WalletConnectButton from '../../src/components/WalletConnectButton';
import { useWalletContext } from '../../src/contexts/WalletContext';
import { WalletError } from '../../src/lib/wallet-errors';
import { ClipboardError } from '../../src/lib/clipboard';

// Import centralized mocks
import '../mocks';

// Mock the entire wallet context
jest.mock('../../src/contexts/WalletContext', () => ({
  useWalletContext: jest.fn()
}));

// Mock the clipboard utilities
jest.mock('../../src/lib/clipboard', () => ({
  copyToClipboard: jest.fn(),
  getClipboardCapabilities: jest.fn(() => ({
    hasModernApi: true,
    hasLegacySupport: true
  })),
  ClipboardError: class MockClipboardError extends Error {
    constructor(message: string) {
      super(message as any);
      this?.name = 'ClipboardError';
    }
  }
}));

// Mock the ErrorBoundary component
jest.mock('../../src/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock the WalletErrorModal and ClipboardErrorModal components
jest.mock('../../src/components/WalletErrorModal', () => ({
  WalletErrorModal: ({ error, onDismiss }: any) => (
    <div data-testid="wallet-error-modal">
      {error && <div data-testid="wallet-error-message">{error.message}</div>}
      <button data-testid="dismiss-wallet-error" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}));

jest.mock('../../src/components/ClipboardErrorModal', () => ({
  ClipboardErrorModal: ({ error, onDismiss, onTryAlternative }: any) => (
    <div data-testid="clipboard-error-modal">
      {error && <div data-testid="clipboard-error-message">{error.message}</div>}
      <button data-testid="dismiss-clipboard-error" onClick={onDismiss}>
        Dismiss
      </button>
      <button data-testid="try-alternative" onClick={onTryAlternative}>
        Try Alternative
      </button>
    </div>
  )
}));

describe('WalletConnectButton', () => {
  // Default mock values for wallet context
  const mockDisconnect = jest.fn().mockResolvedValue(undefined as any);
  const mockConnect = jest.fn().mockResolvedValue(undefined as any);
  const mockSwitchNetwork = jest.fn().mockResolvedValue(undefined as any);
  const mockSetError = jest.fn();
  
  // Default props for disconnected state
  const disconnectedProps = {
    connected: false,
    connecting: false,
    disconnect: mockDisconnect,
    connect: mockConnect,
    address: null,
    name: null,
    chainId: null,
    error: null,
    setError: mockSetError,
    switchNetwork: mockSwitchNetwork,
    transactions: [],
    trackTransaction: jest.fn(),
    lastActivity: Date.now(),
    resetActivityTimer: jest.fn()
  };
  
  // Default props for connected state
  const connectedProps = {
    ...disconnectedProps,
    connected: true,
    address: '0x123456789abcdef123456789abcdef123456789a',
    name: 'Test Wallet',
    chainId: 'testnet'
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default to disconnected state
    (useWalletContext as jest.Mock).mockReturnValue(disconnectedProps as any);
  });
  
  it('renders connect button when disconnected', () => {
    render(<WalletConnectButton />);
    
    // Should show connect button
    const connectButton = screen.getByText('Connect Wallet');
    expect(connectButton as any).toBeInTheDocument();
    
    // Should not show disconnect button
    expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
  });
  
  it('renders connecting state correctly', () => {
    (useWalletContext as jest.Mock).mockReturnValue({
      ...disconnectedProps,
      connecting: true
    });
    
    render(<WalletConnectButton />);
    
    // Should show connecting message
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    
    // Should not show connect or disconnect buttons
    expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument();
    expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
  });
  
  it('renders connected state with wallet info', () => {
    (useWalletContext as jest.Mock).mockReturnValue(connectedProps as any);
    
    render(<WalletConnectButton />);
    
    // Should show wallet info
    expect(screen.getByText(/Test Wallet:/)).toBeInTheDocument();
    expect(screen.getByText(/0x1234/)).toBeInTheDocument(); // Truncated address
    
    // Should show network
    expect(screen.getByText('Testnet')).toBeInTheDocument();
    
    // Should show disconnect button
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
    
    // Should show change network button
    expect(screen.getByText('(change)')).toBeInTheDocument();
  });
  
  it('connects wallet when connect button is clicked', async () => {
    render(<WalletConnectButton />);
    
    // Click connect button
    fireEvent.click(screen.getByText('Connect Wallet'));
    
    // Check if connect was called
    expect(mockConnect as any).toHaveBeenCalledTimes(1 as any);
  });
  
  it('disconnects wallet when disconnect button is clicked', async () => {
    (useWalletContext as jest.Mock).mockReturnValue(connectedProps as any);
    
    render(<WalletConnectButton />);
    
    // Click disconnect button
    fireEvent.click(screen.getByText('Disconnect'));
    
    // Check if disconnect was called
    expect(mockDisconnect as any).toHaveBeenCalledTimes(1 as any);
  });
  
  it('shows network options when change button is clicked', () => {
    (useWalletContext as jest.Mock).mockReturnValue(connectedProps as any);
    
    render(<WalletConnectButton />);
    
    // Initially, network options should not be visible
    expect(screen.queryByText('Mainnet')).not.toBeInTheDocument();
    
    // Click change button
    fireEvent.click(screen.getByText('(change)'));
    
    // Now network options should be visible
    expect(screen.getByText('Mainnet')).toBeInTheDocument();
    expect(screen.getByText('Testnet')).toBeInTheDocument();
    expect(screen.getByText('Devnet')).toBeInTheDocument();
  });
  
  it('triggers network switch when a network option is clicked', async () => {
    (useWalletContext as jest.Mock).mockReturnValue(connectedProps as any);
    
    render(<WalletConnectButton />);
    
    // Click change button to show options
    fireEvent.click(screen.getByText('(change)'));
    
    // Click a network option
    fireEvent.click(screen.getByText('Mainnet'));
    
    // Check if switchNetwork was called with correct parameter
    expect(mockSwitchNetwork as any).toHaveBeenCalledWith('mainnet');
  });
  
  it('shows error modal when there is an error', () => {
    const error = new WalletError('Test wallet error');
    
    (useWalletContext as jest.Mock).mockReturnValue({
      ...disconnectedProps,
      error
    });
    
    render(<WalletConnectButton />);
    
    // Error modal should be visible with error message
    expect(screen.getByTestId('wallet-error-modal')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-error-message')).toHaveTextContent('Test wallet error');
  });
  
  it('clears error when dismiss is clicked', () => {
    const error = new WalletError('Test wallet error');
    
    (useWalletContext as jest.Mock).mockReturnValue({
      ...disconnectedProps,
      error
    });
    
    render(<WalletConnectButton />);
    
    // Click dismiss button
    fireEvent.click(screen.getByTestId('dismiss-wallet-error'));
    
    // Check if setError was called with null
    expect(mockSetError as any).toHaveBeenCalledWith(null as any);
  });
  
  it('handles copy functionality for connected wallet address', async () => {
    // Mock copyToClipboard to succeed
    const { copyToClipboard } = require('../../src/lib/clipboard');
    copyToClipboard.mockResolvedValue({ success: true });
    
    (useWalletContext as jest.Mock).mockReturnValue(connectedProps as any);
    
    render(<WalletConnectButton />);
    
    // Find and click copy button (it's an SVG icon)
    const copyButton = screen.getByTitle('Copy address');
    fireEvent.click(copyButton as any);
    
    // Should have called copyToClipboard with the address
    expect(copyToClipboard as any).toHaveBeenCalledWith(connectedProps.address);
    
    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('Address copied to clipboard!')).toBeInTheDocument();
    });
  });
  
  it('handles copy failures and shows error message', async () => {
    // Mock copyToClipboard to fail
    const { copyToClipboard } = require('../../src/lib/clipboard');
    copyToClipboard.mockResolvedValue({ 
      success: false, 
      error: new ClipboardError('Failed to copy to clipboard') 
    });
    
    (useWalletContext as jest.Mock).mockReturnValue(connectedProps as any);
    
    render(<WalletConnectButton />);
    
    // Find and click copy button
    const copyButton = screen.getByTitle('Copy address');
    fireEvent.click(copyButton as any);
    
    // Should show clipboard error modal
    await waitFor(() => {
      expect(screen.getByTestId('clipboard-error-modal')).toBeInTheDocument();
      expect(screen.getByTestId('clipboard-error-message')).toHaveTextContent('Failed to copy to clipboard');
    });
  });
  
  it('disables network switching buttons during switch', async () => {
    // Start with connected state
    (useWalletContext as jest.Mock).mockReturnValue(connectedProps as any);
    
    // Mock switchNetwork to delay resolution
    mockSwitchNetwork.mockImplementation(() => new Promise(resolve => {
      setTimeout(resolve, 100);
    }));
    
    render(<WalletConnectButton />);
    
    // Click change button to show options
    fireEvent.click(screen.getByText('(change)'));
    
    // Click a network option
    fireEvent.click(screen.getByText('Mainnet'));
    
    // Check that "switching..." text appears
    await waitFor(() => {
      // This will pass once the component re-renders with isNetworkSwitching=true
      // We can't directly check for it since it's a state inside the component
      expect(screen.queryByText('(change)')).not.toBeInTheDocument();
      expect(screen.getByText('(switching...)')).toBeInTheDocument();
    });
    
    // Network options should be hidden during switching
    expect(screen.queryByText('Mainnet')).not.toBeInTheDocument();
    
    // Disconnect button should be disabled during switching
    expect(screen.getByText('Disconnect')).toBeDisabled();
  });
});