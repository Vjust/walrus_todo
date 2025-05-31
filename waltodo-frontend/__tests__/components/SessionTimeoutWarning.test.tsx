import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '../test-utils';
import { SessionTimeoutWarning } from '../../src/components/SessionTimeoutWarning';
import { useWalletContext } from '../../src/contexts/WalletContext';

// Import centralized mocks
import '../mocks';

// Mock wallet context
jest.mock('../../src/contexts/WalletContext', () => ({
  useWalletContext: jest.fn()
}));

// Constants from the component
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes

describe('SessionTimeoutWarning', () => {
  // Mock current time for consistent testing
  let mockNow = Date.now();
  const originalNow = Date.now;
  
  // Timer mocking
  let timerCallback: () => void;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Restore and re-mock Date.now for each test
    global.Date.now = originalNow;
    mockNow = originalNow();
    global.Date.now = jest.fn(() => mockNow);
    
    // Mock setInterval to capture the callback for testing
    jest.spyOn(global, 'setInterval').mockImplementation((callback: any, ms: number) => {
      timerCallback = callback;
      return 1 as any; // Timer ID
    });
    
    // Default context values
    (useWalletContext as jest.Mock).mockReturnValue({
      connected: true,
      lastActivity: mockNow - (SESSION_TIMEOUT - WARNING_THRESHOLD - 1000), // Just before warning threshold
      resetActivityTimer: jest.fn()
    });
  });
  
  afterEach(() => {
    jest.useRealTimers();
    global.Date.now = originalNow;
  });
  
  it('does not show warning when user is active', () => {
    render(<SessionTimeoutWarning />);
    
    // Warning should not be visible
    expect(screen.queryByText(/Session Timeout Warning/)).not.toBeInTheDocument();
  });
  
  it('shows warning when approaching timeout threshold', () => {
    // Set activity time to be within warning threshold
    (useWalletContext as jest.Mock).mockReturnValue({
      connected: true,
      lastActivity: mockNow - (SESSION_TIMEOUT - WARNING_THRESHOLD / 2), // Middle of warning period
      resetActivityTimer: jest.fn()
    });
    
    render(<SessionTimeoutWarning />);
    
    // Warning should now be visible
    expect(screen.queryByText(/Session Timeout Warning/)).not.toBeInTheDocument();
    
    // Call the timer callback directly to simulate interval trigger
    act(() => {
      timerCallback();
    });
    
    // Warning should be visible after timer callback
    expect(screen.getByText(/Session Timeout Warning/)).toBeInTheDocument();
    expect(screen.getByText(/Your wallet session will expire in/)).toBeInTheDocument();
  });
  
  it('does not show warning when not connected', () => {
    // Set connected to false
    (useWalletContext as jest.Mock).mockReturnValue({
      connected: false,
      lastActivity: mockNow - (SESSION_TIMEOUT - WARNING_THRESHOLD / 2), // Middle of warning period
      resetActivityTimer: jest.fn()
    });
    
    render(<SessionTimeoutWarning />);
    
    // Call the timer callback
    act(() => {
      timerCallback();
    });
    
    // Warning should still not be visible
    expect(screen.queryByText(/Session Timeout Warning/)).not.toBeInTheDocument();
  });
  
  it('calls resetActivityTimer when "Stay Active" is clicked', () => {
    // Set activity time to be within warning threshold
    const mockResetActivityTimer = jest.fn();
    (useWalletContext as jest.Mock).mockReturnValue({
      connected: true,
      lastActivity: mockNow - (SESSION_TIMEOUT - WARNING_THRESHOLD / 2), // Middle of warning period
      resetActivityTimer: mockResetActivityTimer
    });
    
    render(<SessionTimeoutWarning />);
    
    // Call the timer callback to show warning
    act(() => {
      timerCallback();
    });
    
    // Warning should be visible
    const stayActiveButton = screen.getByText('Stay Active');
    expect(stayActiveButton).toBeInTheDocument();
    
    // Click "Stay Active"
    fireEvent.click(stayActiveButton);
    
    // Should call resetActivityTimer
    expect(mockResetActivityTimer).toHaveBeenCalledTimes(1);
    
    // Warning should be dismissed
    expect(screen.queryByText(/Session Timeout Warning/)).not.toBeInTheDocument();
  });
  
  it('dismisses warning when "Dismiss" is clicked', () => {
    // Set activity time to be within warning threshold
    (useWalletContext as jest.Mock).mockReturnValue({
      connected: true,
      lastActivity: mockNow - (SESSION_TIMEOUT - WARNING_THRESHOLD / 2), // Middle of warning period
      resetActivityTimer: jest.fn()
    });
    
    render(<SessionTimeoutWarning />);
    
    // Call the timer callback to show warning
    act(() => {
      timerCallback();
    });
    
    // Warning should be visible
    const dismissButton = screen.getByText('Dismiss');
    expect(dismissButton).toBeInTheDocument();
    
    // Click "Dismiss"
    fireEvent.click(dismissButton);
    
    // Warning should be dismissed
    expect(screen.queryByText(/Session Timeout Warning/)).not.toBeInTheDocument();
  });
  
  it('formats countdown timer correctly', () => {
    // Set activity time to exactly 2 minutes before timeout
    const timeRemaining = 2 * 60 * 1000; // 2 minutes
    (useWalletContext as jest.Mock).mockReturnValue({
      connected: true,
      lastActivity: mockNow - (SESSION_TIMEOUT - timeRemaining),
      resetActivityTimer: jest.fn()
    });
    
    render(<SessionTimeoutWarning />);
    
    // Call the timer callback to show warning
    act(() => {
      timerCallback();
    });
    
    // Warning should show the formatted time remaining (2:00)
    expect(screen.getByText(/Your wallet session will expire in 2:00/)).toBeInTheDocument();
    
    // Advance time by 30 seconds
    mockNow += 30 * 1000;
    
    // Call the timer callback again to update the display
    act(() => {
      timerCallback();
    });
    
    // Warning should now show 1:30
    expect(screen.getByText(/Your wallet session will expire in 1:30/)).toBeInTheDocument();
  });
  
  it('hides warning when timeout period is over', () => {
    // Set activity time to be within warning threshold
    (useWalletContext as jest.Mock).mockReturnValue({
      connected: true,
      lastActivity: mockNow - (SESSION_TIMEOUT - WARNING_THRESHOLD / 2), // Middle of warning period
      resetActivityTimer: jest.fn()
    });
    
    render(<SessionTimeoutWarning />);
    
    // Call the timer callback to show warning
    act(() => {
      timerCallback();
    });
    
    // Warning should be visible
    expect(screen.getByText(/Session Timeout Warning/)).toBeInTheDocument();
    
    // Advance time beyond the timeout
    mockNow += SESSION_TIMEOUT;
    
    // Call the timer callback again
    act(() => {
      timerCallback();
    });
    
    // Warning should no longer be visible
    expect(screen.queryByText(/Session Timeout Warning/)).not.toBeInTheDocument();
  });
});