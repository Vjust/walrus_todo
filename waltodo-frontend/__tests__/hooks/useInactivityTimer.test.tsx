import { renderHookSafe as renderHook, act } from '../test-utils';
import { useInactivityTimer } from '../../src/hooks/useInactivityTimer';

// Import centralized mocks
import '../mocks';

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
    const { result } = renderHook(() => useInactivityTimer({
      timeout: 30 * 60 * 1000, // 30 minutes
      onTimeout,
    }));
    
    expect(result.current.lastActivity).toBe(1621234567890);
  });

  it('should set up default event listeners', () => {
    const onTimeout = jest.fn();
    renderHook(() => useInactivityTimer({
      timeout: 30 * 60 * 1000,
      onTimeout,
    }));
    
    // Should set up 4 default event listeners: mousedown, keydown, touchstart, scroll
    expect(window.addEventListener).toHaveBeenCalledTimes(4);
    expect(window.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function), { passive: true });
    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), { passive: true });
    expect(window.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: true });
    expect(window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
  });

  it('should set up custom event listeners when provided', () => {
    const onTimeout = jest.fn();
    renderHook(() => useInactivityTimer({
      timeout: 30 * 60 * 1000,
      onTimeout,
      events: ['click', 'mousemove'],
    }));
    
    // Check for custom event listeners
    expect(window.addEventListener).toHaveBeenCalledTimes(2);
    expect(window.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), { passive: true });
    expect(window.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function), { passive: true });
  });

  it('should reset lastActivity when resetActivityTimer is called', () => {
    const onTimeout = jest.fn();
    const { result } = renderHook(() => useInactivityTimer({
      timeout: 30 * 60 * 1000,
      onTimeout,
    }));
    
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
    renderHook(() => useInactivityTimer({
      timeout: 30 * 60 * 1000, // 30 minutes
      onTimeout,
    }));
    
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
    const { unmount } = renderHook(() => useInactivityTimer({
      timeout: 30 * 60 * 1000,
      onTimeout,
    }));
    
    unmount();
    
    // Check for 4 default event listeners being removed
    expect(window.removeEventListener).toHaveBeenCalledTimes(4);
    expect(window.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('should reset timer on user activity', () => {
    const onTimeout = jest.fn();
    renderHook(() => useInactivityTimer({
      timeout: 30 * 60 * 1000,
      onTimeout,
    }));
    
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