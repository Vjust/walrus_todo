import React from 'react';
import { render, screen, fireEvent } from '../test-utils';
import { TransactionHistory } from '../../src/components/TransactionHistory';
import { useWalletContext } from '../../src/contexts/WalletContext';
import type { TransactionRecord } from '../../src/contexts/WalletContext';

// Import centralized mocks
import '../mocks';

// Mock wallet context
jest.mock('../../src/contexts/WalletContext', () => ({
  useWalletContext: jest.fn()
}));

// Mock Intl.RelativeTimeFormat for consistent testing
const mockFormatFn = jest.fn(value => `${Math.abs(value as any)} time units ago`);
// Use Object.defineProperty to avoid read-only property error
Object.defineProperty(global.Intl, 'RelativeTimeFormat', {
  value: jest.fn().mockImplementation(() => ({
    format: mockFormatFn
  })),
  writable: true,
  configurable: true
});

describe('TransactionHistory', () => {
  // Sample transaction records for testing
  const mockTransactions: TransactionRecord[] = [
    {
      id: 'tx1',
      status: 'success',
      timestamp: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      type: 'Transfer',
      details: { hash: '0xabc123def456' }
    },
    {
      id: 'tx2',
      status: 'pending',
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      type: 'Swap'
    },
    {
      id: 'tx3',
      status: 'failed',
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      type: 'Mint',
      details: { message: 'Transaction failed: insufficient funds' }
    },
    {
      id: 'tx4',
      status: 'success',
      timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      type: 'Stake',
      details: { hash: '0x789012345abc' }
    },
    {
      id: 'tx5',
      status: 'success',
      timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      type: 'Claim',
      details: { hash: '0xdef456789abc' }
    },
    {
      id: 'tx6',
      status: 'success',
      timestamp: new Date(Date.now() - 604800000).toISOString(), // 7 days ago
      type: 'Vote',
      details: { hash: '0x123def789abc' }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default to empty transactions
    (useWalletContext as jest.Mock).mockReturnValue({
      transactions: []
    });
  });

  it('displays message when no transactions exist', () => {
    render(<TransactionHistory />);
    
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('displays transactions with correct status icons', () => {
    // Use a subset of mock transactions with different statuses
    (useWalletContext as jest.Mock).mockReturnValue({
      transactions: mockTransactions.slice(0, 3) // Success, Pending, Error
    });
    
    render(<TransactionHistory />);
    
    // Check transaction types are displayed
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getByText('Swap')).toBeInTheDocument();
    expect(screen.getByText('Mint')).toBeInTheDocument();
    
    // Check hash is displayed for the success transaction
    expect(screen.getByText(/0xabc123/)).toBeInTheDocument();
    
    // Check error message is displayed
    expect(screen.getByText(/insufficient funds/)).toBeInTheDocument();
  });

  it('limits transactions to maxItems by default', () => {
    (useWalletContext as jest.Mock).mockReturnValue({
      transactions: mockTransactions // All 6 transactions
    });
    
    // Default maxItems is 5
    render(<TransactionHistory />);
    
    // Should show the 5 most recent transactions
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getByText('Swap')).toBeInTheDocument();
    expect(screen.getByText('Mint')).toBeInTheDocument();
    expect(screen.getByText('Stake')).toBeInTheDocument();
    expect(screen.getByText('Claim')).toBeInTheDocument();
    
    // Should not show the oldest transaction
    expect(screen.queryByText('Vote')).not.toBeInTheDocument();
    
    // Should show a "Show all" button
    expect(screen.getByText('Show all (6)')).toBeInTheDocument();
  });

  it('expands to show all transactions when "Show all" is clicked', () => {
    (useWalletContext as jest.Mock).mockReturnValue({
      transactions: mockTransactions // All 6 transactions
    });
    
    render(<TransactionHistory />);
    
    // Initially, should not show the oldest transaction
    expect(screen.queryByText('Vote')).not.toBeInTheDocument();
    
    // Click "Show all"
    fireEvent.click(screen.getByText('Show all (6)'));
    
    // Now should show all transactions, including the oldest
    expect(screen.getByText('Vote')).toBeInTheDocument();
    
    // Button should now say "Show less"
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('collapses back when "Show less" is clicked', () => {
    (useWalletContext as jest.Mock).mockReturnValue({
      transactions: mockTransactions // All 6 transactions
    });
    
    render(<TransactionHistory />);
    
    // Click "Show all"
    fireEvent.click(screen.getByText('Show all (6)'));
    
    // Now should show all transactions
    expect(screen.getByText('Vote')).toBeInTheDocument();
    
    // Click "Show less"
    fireEvent.click(screen.getByText('Show less'));
    
    // Should hide the oldest transaction again
    expect(screen.queryByText('Vote')).not.toBeInTheDocument();
  });

  it('respects custom maxItems prop', () => {
    (useWalletContext as jest.Mock).mockReturnValue({
      transactions: mockTransactions // All 6 transactions
    });
    
    // Set maxItems to 2
    render(<TransactionHistory maxItems={2} />);
    
    // Should only show the 2 most recent transactions
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getByText('Swap')).toBeInTheDocument();
    
    // Should not show the rest
    expect(screen.queryByText('Mint')).not.toBeInTheDocument();
    expect(screen.queryByText('Stake')).not.toBeInTheDocument();
    expect(screen.queryByText('Claim')).not.toBeInTheDocument();
    expect(screen.queryByText('Vote')).not.toBeInTheDocument();
  });

  it('uses Intl.RelativeTimeFormat for time formatting', () => {
    // Set up a single transaction for simplicity
    (useWalletContext as jest.Mock).mockReturnValue({
      transactions: [mockTransactions[0]] // Just the first transaction (1 minute ago)
    });
    
    render(<TransactionHistory />);
    
    // Check that Intl.RelativeTimeFormat was used
    expect(global?.Intl?.RelativeTimeFormat).toHaveBeenCalledWith('en', { numeric: 'auto' });
    
    // Check that format function was called with expected value
    // The first parameter should be negative, representing time in the past
    expect(mockFormatFn as any).toHaveBeenCalledWith(expect.any(Number as any), expect.any(String as any));
    
    // The result of the format function should be in the document
    expect(screen.getByText('1 time units ago')).toBeInTheDocument();
  });

  it('falls back to manual formatting when Intl.RelativeTimeFormat is not available', () => {
    // Temporarily remove Intl.RelativeTimeFormat
    const originalIntl = global.Intl;
    delete (global as any).Intl.RelativeTimeFormat;
    
    // Set up a single transaction for simplicity
    (useWalletContext as jest.Mock).mockReturnValue({
      transactions: [
        {
          ...mockTransactions[0],
          timestamp: Date.now() - 60000 // 1 minute ago
        }
      ]
    });
    
    render(<TransactionHistory />);
    
    // Should use fallback formatting
    expect(screen.getByText('1 minute ago')).toBeInTheDocument();
    
    // Restore Intl
    global?.Intl = originalIntl;
  });
});