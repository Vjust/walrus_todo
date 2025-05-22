/**
 * Tests for blockchain event hooks
 * Ensures real-time event subscriptions work correctly
 */

import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the hooks and types with proper interfaces
const mockUseBlockchainEvents = jest.fn();
const mockUseTodoEvents = jest.fn();
const mockUseTodoStateSync = jest.fn();

jest.mock('@/hooks/useBlockchainEvents', () => ({
  useBlockchainEvents: mockUseBlockchainEvents,
  useTodoEvents: mockUseTodoEvents,
  useTodoStateSync: mockUseTodoStateSync,
}));

jest.mock('@/lib/blockchain-events', () => ({
  BlockchainEventManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    subscribeToEvents: jest.fn(),
    unsubscribeAll: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getConnectionState: jest.fn(),
    destroy: jest.fn(),
  }))
}));

jest.mock('@/lib/sui-client', () => ({
  Todo: jest.fn()
}));

// Define Todo interface for tests
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority?: string;
  blockchainStored?: boolean;
  objectId?: string;
  owner?: string;
  createdAt?: number;
  completedAt?: number;
}

// Mock the blockchain event manager
jest.mock('@/lib/blockchain-events');
jest.mock('@/lib/sui-client');

const mockEventManager = {
  initialize: jest.fn(),
  subscribeToEvents: jest.fn(),
  unsubscribeAll: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getConnectionState: jest.fn(),
  destroy: jest.fn(),
};

const mockGetEventManager = jest.fn(() => mockEventManager);

// Mock the wallet context
const mockWalletContext = {
  address: '0x123456789',
  connected: true,
  // ... other wallet properties
};

jest.mock('@/contexts/WalletContext', () => ({
  useWalletContext: () => mockWalletContext,
}));

describe('useBlockchainEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEventManager.getConnectionState.mockReturnValue({
      connected: false,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: 0,
    });
  });

  it('should initialize event manager on mount', async () => {
    mockEventManager.initialize.mockResolvedValue(undefined);
    mockEventManager.subscribeToEvents.mockResolvedValue(undefined);

    const { result } = renderHook(() => 
      useBlockchainEvents({ autoStart: true })
    );

    await waitFor(() => {
      expect(mockEventManager.initialize).toHaveBeenCalled();
    });
  });

  it('should start subscription when autoStart is true', async () => {
    mockEventManager.initialize.mockResolvedValue(undefined);
    mockEventManager.subscribeToEvents.mockResolvedValue(undefined);

    const { result } = renderHook(() => 
      useBlockchainEvents({ autoStart: true, owner: '0x123' })
    );

    await waitFor(() => {
      expect(mockEventManager.subscribeToEvents).toHaveBeenCalledWith('0x123');
    });
  });

  it('should provide connection state', () => {
    const mockState = {
      connected: true,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: 1,
    };

    mockEventManager.getConnectionState.mockReturnValue(mockState);

    const { result } = renderHook(() => useBlockchainEvents());

    expect(result.current.connectionState).toEqual(mockState);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });

  it('should handle start and stop subscription', async () => {
    mockEventManager.initialize.mockResolvedValue(undefined);
    mockEventManager.subscribeToEvents.mockResolvedValue(undefined);

    const { result } = renderHook(() => 
      useBlockchainEvents({ autoStart: false })
    );

    // Start subscription
    await act(async () => {
      await result.current.startSubscription();
    });

    expect(mockEventManager.subscribeToEvents).toHaveBeenCalled();

    // Stop subscription
    act(() => {
      result.current.stopSubscription();
    });

    expect(mockEventManager.unsubscribeAll).toHaveBeenCalled();
  });

  it('should restart subscription', async () => {
    mockEventManager.initialize.mockResolvedValue(undefined);
    mockEventManager.subscribeToEvents.mockResolvedValue(undefined);

    const { result } = renderHook(() => 
      useBlockchainEvents({ autoStart: false })
    );

    await act(async () => {
      await result.current.restartSubscription();
    });

    expect(mockEventManager.unsubscribeAll).toHaveBeenCalled();
    expect(mockEventManager.subscribeToEvents).toHaveBeenCalled();
  });

  it('should add event listeners', () => {
    const mockUnsubscribe = jest.fn();
    mockEventManager.addEventListener.mockReturnValue(mockUnsubscribe);

    const { result } = renderHook(() => useBlockchainEvents());

    const listener = jest.fn();
    const unsubscribe = result.current.addEventListener('created', listener);

    expect(mockEventManager.addEventListener).toHaveBeenCalledWith('created', listener);
    expect(typeof unsubscribe).toBe('function');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useBlockchainEvents());

    unmount();

    expect(mockEventManager.destroy).toHaveBeenCalled();
  });
});

describe('useTodoEvents', () => {
  const mockTodoCreatedEvent = {
    type: 'created' as const,
    data: {
      todo_id: '1',
      title: 'Test Todo',
      owner: '0x123',
      timestamp: '1234567890',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventManager.getConnectionState.mockReturnValue({
      connected: true,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: 1,
    });
  });

  it('should track recent events', async () => {
    const mockUnsubscribe = jest.fn();
    mockEventManager.addEventListener.mockImplementation((eventType, listener) => {
      // Simulate event after subscription
      setTimeout(() => listener(mockTodoCreatedEvent), 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useTodoEvents({ autoStart: true }));

    await waitFor(() => {
      expect(result.current.recentEvents).toHaveLength(1);
      expect(result.current.recentEvents[0]).toEqual(mockTodoCreatedEvent);
    });
  });

  it('should call event handlers', async () => {
    const onTodoCreated = jest.fn();
    const mockUnsubscribe = jest.fn();

    mockEventManager.addEventListener.mockImplementation((eventType, listener) => {
      // Simulate event after subscription
      setTimeout(() => listener(mockTodoCreatedEvent), 10);
      return mockUnsubscribe;
    });

    renderHook(() => 
      useTodoEvents({ 
        autoStart: true,
        onTodoCreated,
      })
    );

    await waitFor(() => {
      expect(onTodoCreated).toHaveBeenCalledWith({
        id: '1',
        title: 'Test Todo',
        blockchainStored: true,
        objectId: '1',
        owner: '0x123',
        createdAt: 1234567890,
      });
    });
  });

  it('should clear recent events', async () => {
    const mockUnsubscribe = jest.fn();
    mockEventManager.addEventListener.mockImplementation((eventType, listener) => {
      setTimeout(() => listener(mockTodoCreatedEvent), 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useTodoEvents({ autoStart: true }));

    await waitFor(() => {
      expect(result.current.recentEvents).toHaveLength(1);
    });

    act(() => {
      result.current.clearRecentEvents();
    });

    expect(result.current.recentEvents).toHaveLength(0);
  });
});

describe('useTodoStateSync', () => {
  const initialTodos: Todo[] = [
    {
      id: '1',
      title: 'Initial Todo',
      completed: false,
      priority: 'medium',
      blockchainStored: false,
    },
  ];

  const mockTodoCreatedEvent = {
    type: 'created' as const,
    data: {
      todo_id: '2',
      title: 'New Todo',
      owner: '0x123',
      timestamp: '1234567890',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventManager.getConnectionState.mockReturnValue({
      connected: true,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: 1,
    });
  });

  it('should initialize with provided todos', () => {
    const onTodoChange = jest.fn();
    const { result } = renderHook(() => 
      useTodoStateSync({
        todos: initialTodos,
        onTodoChange,
        autoStart: false,
      })
    );

    expect(result.current.syncedTodos).toEqual(initialTodos);
  });

  it('should add new todos from blockchain events', async () => {
    const onTodoChange = jest.fn();
    const mockUnsubscribe = jest.fn();

    mockEventManager.addEventListener.mockImplementation((eventType, listener) => {
      setTimeout(() => listener(mockTodoCreatedEvent), 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => 
      useTodoStateSync({
        todos: initialTodos,
        onTodoChange,
        autoStart: true,
      })
    );

    await waitFor(() => {
      expect(result.current.syncedTodos).toHaveLength(2);
      expect(result.current.syncedTodos[1]).toMatchObject({
        id: '2',
        title: 'New Todo',
        blockchainStored: true,
      });
    });

    expect(onTodoChange).toHaveBeenCalled();
  });

  it('should update existing todos from blockchain events', async () => {
    const onTodoChange = jest.fn();
    const mockUnsubscribe = jest.fn();

    const mockTodoCompletedEvent = {
      type: 'completed' as const,
      data: {
        todo_id: '1',
        timestamp: '1234567890',
      },
    };

    mockEventManager.addEventListener.mockImplementation((eventType, listener) => {
      setTimeout(() => listener(mockTodoCompletedEvent), 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => 
      useTodoStateSync({
        todos: initialTodos,
        onTodoChange,
        autoStart: true,
      })
    );

    await waitFor(() => {
      const updatedTodo = result.current.syncedTodos.find(t => t.id === '1');
      expect(updatedTodo?.completed).toBe(true);
      expect(updatedTodo?.completedAt).toBe(1234567890);
    });

    expect(onTodoChange).toHaveBeenCalled();
  });

  it('should remove todos from blockchain delete events', async () => {
    const onTodoChange = jest.fn();
    const mockUnsubscribe = jest.fn();

    const mockTodoDeletedEvent = {
      type: 'deleted' as const,
      data: {
        todo_id: '1',
        timestamp: '1234567890',
      },
    };

    mockEventManager.addEventListener.mockImplementation((eventType, listener) => {
      setTimeout(() => listener(mockTodoDeletedEvent), 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => 
      useTodoStateSync({
        todos: initialTodos,
        onTodoChange,
        autoStart: true,
      })
    );

    await waitFor(() => {
      expect(result.current.syncedTodos).toHaveLength(0);
    });

    expect(onTodoChange).toHaveBeenCalled();
  });

  it('should update when external todos change', () => {
    const onTodoChange = jest.fn();
    const newTodos: Todo[] = [
      ...initialTodos,
      {
        id: '2',
        title: 'Another Todo',
        completed: false,
        priority: 'high',
        blockchainStored: false,
      },
    ];

    const { result, rerender } = renderHook(
      ({ todos }) => useTodoStateSync({
        todos,
        onTodoChange,
        autoStart: false,
      }),
      { initialProps: { todos: initialTodos } }
    );

    expect(result.current.syncedTodos).toEqual(initialTodos);

    rerender({ todos: newTodos });

    expect(result.current.syncedTodos).toEqual(newTodos);
  });
});

describe('Event error handling', () => {
  it('should handle connection errors', async () => {
    const connectionError = new Error('Connection failed');
    mockEventManager.initialize.mockRejectedValue(connectionError);

    const { result } = renderHook(() => 
      useBlockchainEvents({ autoStart: true })
    );

    await waitFor(() => {
      expect(result.current.error).toEqual(connectionError);
    });
  });

  it('should handle subscription errors', async () => {
    mockEventManager.initialize.mockResolvedValue(undefined);
    const subscriptionError = new Error('Subscription failed');
    mockEventManager.subscribeToEvents.mockRejectedValue(subscriptionError);

    const { result } = renderHook(() => 
      useBlockchainEvents({ autoStart: true })
    );

    await waitFor(() => {
      expect(result.current.error).toEqual(subscriptionError);
    });
  });
});

describe('Event manager lifecycle', () => {
  it('should not create multiple managers', () => {
    const { rerender } = renderHook(() => useBlockchainEvents());
    
    rerender();
    
    // Event manager should be singleton
    expect(mockGetEventManager).toHaveBeenCalledTimes(1);
  });

  it('should cleanup subscriptions on component unmount', () => {
    const { unmount } = renderHook(() => useBlockchainEvents({ autoStart: true }));

    unmount();

    expect(mockEventManager.destroy).toHaveBeenCalled();
  });
});