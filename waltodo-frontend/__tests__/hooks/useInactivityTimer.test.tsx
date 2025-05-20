import { renderHook, act } from '@testing-library/react';
import { useInactivityTimer } from '../../src/contexts/WalletContext'; // Import the hook from actual file

// Mock the Date.now function
const mockDateNow = jest.fn(() => 1621234567890); // Fixed timestamp for testing
global.Date.now = mockDateNow;

describe('useInactivityTimer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockDateNow.mockReturnValue(1621234567890); // Reset timestamp
    
    // Mock event listeners
    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with current timestamp', () => {
    const onTimeout = jest.fn();
    const { result } = renderHook(() => useInactivityTimer(true, onTimeout));
    
    expect(result.current.lastActivity).toBe(1621234567890);
  });

  it('should not set up event listeners when not connected', () => {
    const onTimeout = jest.fn();
    renderHook(() => useInactivityTimer(false, onTimeout));
    
    expect(window.addEventListener).not.toHaveBeenCalled();
  });

  it('should set up event listeners when connected', () => {
    const onTimeout = jest.fn();
    renderHook(() => useInactivityTimer(true, onTimeout));
    
    // Check for 3 event listeners: mousedown, keydown, touchstart
    expect(window.addEventListener).toHaveBeenCalledTimes(3);
    expect(window.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
  });

  it('should reset lastActivity when resetActivityTimer is called', () => {
    const onTimeout = jest.fn();
    const { result } = renderHook(() => useInactivityTimer(true, onTimeout));
    
    // Update the mocked Date.now return value
    mockDateNow.mockReturnValue(1621234667890); // 100s later
    
    // Call resetActivityTimer
    act(() => {
      result.current.resetActivityTimer();
    });
    
    // Check if lastActivity was updated
    expect(result.current.lastActivity).toBe(1621234667890);
  });

  it('should call onTimeout when session times out', () => {
    const onTimeout = jest.fn();
    renderHook(() => useInactivityTimer(true, onTimeout));
    
    // Move time forward by less than timeout (29 min)
    mockDateNow.mockReturnValue(1621234567890 + 29 * 60 * 1000); 
    jest.advanceTimersByTime(60000); // Check every minute
    
    // onTimeout should not be called yet
    expect(onTimeout).not.toHaveBeenCalled();
    
    // Move time forward beyond timeout (31 min)
    mockDateNow.mockReturnValue(1621234567890 + 31 * 60 * 1000);
    jest.advanceTimersByTime(60000); // Another minute
    
    // onTimeout should be called
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('should clean up event listeners on unmount', () => {
    const onTimeout = jest.fn();
    const { unmount } = renderHook(() => useInactivityTimer(true, onTimeout));
    
    unmount();
    
    // Check for 3 event listeners being removed
    expect(window.removeEventListener).toHaveBeenCalledTimes(3);
    expect(window.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
  });

  it('should reset timer on user activity', () => {
    const onTimeout = jest.fn();
    renderHook(() => useInactivityTimer(true, onTimeout));
    
    // Capture the callback function registered with the event listener
    const handleActivity = (window.addEventListener as jest.Mock).mock.calls[0][1];
    
    // Mock Date.now to return a new value
    mockDateNow.mockReturnValue(1621234667890); // 100s later
    
    // Simulate user activity
    act(() => {
      handleActivity();
    });
    
    // Move time forward to what would have been a timeout from the original time
    mockDateNow.mockReturnValue(1621234567890 + 31 * 60 * 1000);
    jest.advanceTimersByTime(60000);
    
    // onTimeout should not be called because we reset the timer
    expect(onTimeout).not.toHaveBeenCalled();
    
    // But if we move time forward from the new activity time, it should trigger
    mockDateNow.mockReturnValue(1621234667890 + 31 * 60 * 1000);
    jest.advanceTimersByTime(60000);
    
    // Now onTimeout should be called
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});