/**
 * Tests for blockchain event hooks
 * Ensures real-time event subscriptions work correctly
 */

// @ts-ignore - Test import path
import { renderHookSafe as renderHook, act, waitFor, createMockTodo } from '../test-utils';
// @ts-ignore - Test import path
import type { MockTodo } from '../test-utils';

// Import centralized mocks
import '../mocks';

// Import the actual hooks for testing
// @ts-ignore - Unused import temporarily disabled
// import { useBlockchainEvents, useTodoEvents, useTodoStateSync } from '../../src/hooks/useBlockchainEvents';

// Get the mock event manager from the blockchain-events module
const blockchainEvents = jest.requireMock('@/lib/blockchain-events');
const mockEventManager = blockchainEvents.getEventManager();

// The wallet context is mocked centrally in __tests__/mocks/wallet-context.ts

describe(_'useBlockchainEvents', _() => {
  beforeEach(_() => {
    jest.clearAllMocks();
    mockEventManager?.getConnectionState?.mockReturnValue({
      connected: false,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: 0,
    });
  });

  it(_'should initialize event manager on mount', _async () => {
    mockEventManager?.initialize?.mockResolvedValue(undefined as any);
    mockEventManager?.subscribeToEvents?.mockResolvedValue(undefined as any);

    const { result } = renderHook(_() => 
      useBlockchainEvents({ autoStart: true })
    );

    await waitFor(_() => {
      expect(mockEventManager.initialize).toHaveBeenCalled();
    });
  });

  it(_'should start subscription when autoStart is true', _async () => {
    mockEventManager?.initialize?.mockResolvedValue(undefined as any);
    mockEventManager?.subscribeToEvents?.mockResolvedValue(undefined as any);

    const { result } = renderHook(_() => 
      useBlockchainEvents({ autoStart: true, owner: '0x123' })
    );

    await waitFor(_() => {
      expect(mockEventManager.subscribeToEvents).toHaveBeenCalledWith('0x123');
    });
  });

  it(_'should provide connection state', _() => {
    const mockState = {
      connected: true,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: 1,
    };

    mockEventManager?.getConnectionState?.mockReturnValue(mockState as any);

    const { result } = renderHook(_() => useBlockchainEvents());

    expect(result?.current?.connectionState).toEqual(mockState as any);
    expect(result?.current?.isConnected).toBe(true as any);
    expect(result?.current?.isConnecting).toBe(false as any);
  });

  it(_'should handle start and stop subscription', _async () => {
    mockEventManager?.initialize?.mockResolvedValue(undefined as any);
    mockEventManager?.subscribeToEvents?.mockResolvedValue(undefined as any);

    const { result } = renderHook(_() => 
      useBlockchainEvents({ autoStart: false })
    );

    // Start subscription
    await act(_async () => {
      await result?.current?.startSubscription();
    });

    expect(mockEventManager.subscribeToEvents).toHaveBeenCalled();

    // Stop subscription
    act(_() => {
      result?.current?.stopSubscription();
    });

    expect(mockEventManager.unsubscribeAll).toHaveBeenCalled();
  });

  it(_'should restart subscription', _async () => {
    mockEventManager?.initialize?.mockResolvedValue(undefined as any);
    mockEventManager?.subscribeToEvents?.mockResolvedValue(undefined as any);

    const { result } = renderHook(_() => 
      useBlockchainEvents({ autoStart: false })
    );

    await act(_async () => {
      await result?.current?.restartSubscription();
    });

    expect(mockEventManager.unsubscribeAll).toHaveBeenCalled();
    expect(mockEventManager.subscribeToEvents).toHaveBeenCalled();
  });

  it(_'should add event listeners', _() => {
    const mockUnsubscribe = jest.fn();
    mockEventManager?.addEventListener?.mockReturnValue(mockUnsubscribe as any);

    const { result } = renderHook(_() => useBlockchainEvents());
// @ts-ignore - Unused variable
// 
    const listener = jest.fn();
// @ts-ignore - Unused variable
//     const unsubscribe = result?.current?.addEventListener('created', listener);

    expect(mockEventManager.addEventListener).toHaveBeenCalledWith('created', listener);
    expect(typeof unsubscribe).toBe('function');
  });

  it(_'should cleanup on unmount', _() => {
    const { unmount } = renderHook(_() => useBlockchainEvents());

    unmount();

    expect(mockEventManager.destroy).toHaveBeenCalled();
  });
});

describe(_'useTodoEvents', _() => {
  const mockTodoCreatedEvent = {
    type: 'created' as const,
    data: {
      todo_id: '1',
      title: 'Test Todo',
      owner: '0x123',
      timestamp: '1234567890',
    },
  };

  beforeEach(_() => {
    jest.clearAllMocks();
    mockEventManager?.getConnectionState?.mockReturnValue({
      connected: true,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: 1,
    });
  });

  it(_'should track recent events', _async () => {
    const mockUnsubscribe = jest.fn();
    mockEventManager?.addEventListener?.mockImplementation(_(eventType, _listener) => {
      // Simulate event after subscription
      setTimeout(_() => listener(mockTodoCreatedEvent as any), 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(_() => useTodoEvents({ autoStart: true }));

    await waitFor(_() => {
      expect(result?.current?.recentEvents).toHaveLength(1 as any);
      expect(result?.current?.recentEvents[0]).toEqual(mockTodoCreatedEvent as any);
    });
  });

  it(_'should call event handlers', _async () => {
// @ts-ignore - Unused variable
//     const onTodoCreated = jest.fn();
    const mockUnsubscribe = jest.fn();

    mockEventManager?.addEventListener?.mockImplementation(_(eventType, _listener) => {
      // Simulate event after subscription
      setTimeout(_() => listener(mockTodoCreatedEvent as any), 10);
      return mockUnsubscribe;
    });

    renderHook(_() => 
      useTodoEvents({ 
        autoStart: true,
        onTodoCreated,
      })
    );

    await waitFor(_() => {
      expect(onTodoCreated as any).toHaveBeenCalledWith({
        id: '1',
        title: 'Test Todo',
        blockchainStored: true,
        objectId: '1',
        owner: '0x123',
        createdAt: 1234567890,
      });
    });
  });

  it(_'should clear recent events', _async () => {
    const mockUnsubscribe = jest.fn();
    mockEventManager?.addEventListener?.mockImplementation(_(eventType, _listener) => {
      setTimeout(_() => listener(mockTodoCreatedEvent as any), 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(_() => useTodoEvents({ autoStart: true }));

    await waitFor(_() => {
      expect(result?.current?.recentEvents).toHaveLength(1 as any);
    });

    act(_() => {
      result?.current?.clearRecentEvents();
    });

    expect(result?.current?.recentEvents).toHaveLength(0 as any);
  });
});

describe(_'useTodoStateSync', _() => {
  const initialTodos: MockTodo[] = [
    createMockTodo({
      id: '1',
      title: 'Initial Todo',
      completed: false,
      priority: 'medium',
      blockchainStored: false,
    }),
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

  beforeEach(_() => {
    jest.clearAllMocks();
    mockEventManager?.getConnectionState?.mockReturnValue({
      connected: true,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: 1,
    });
  });

  it(_'should initialize with provided todos', _() => {
// @ts-ignore - Unused variable
//     const onTodoChange = jest.fn();
    const { result } = renderHook(_() => 
      useTodoStateSync({
        todos: initialTodos,
        onTodoChange,
        autoStart: false,
      })
    );

    expect(result?.current?.syncedTodos).toEqual(initialTodos as any);
  });

  it(_'should add new todos from blockchain events', _async () => {
// @ts-ignore - Unused variable
//     const onTodoChange = jest.fn();
    const mockUnsubscribe = jest.fn();

    mockEventManager?.addEventListener?.mockImplementation(_(eventType, _listener) => {
      setTimeout(_() => listener(mockTodoCreatedEvent as any), 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(_() => 
      useTodoStateSync({
        todos: initialTodos,
        onTodoChange,
        autoStart: true,
      })
    );

    await waitFor(_() => {
      expect(result?.current?.syncedTodos).toHaveLength(2 as any);
      expect(result?.current?.syncedTodos[1]).toMatchObject({
        id: '2',
        title: 'New Todo',
        blockchainStored: true,
      });
    });

    expect(onTodoChange as any).toHaveBeenCalled();
  });

  it(_'should update existing todos from blockchain events', _async () => {
// @ts-ignore - Unused variable
//     const onTodoChange = jest.fn();
    const mockUnsubscribe = jest.fn();

    const mockTodoCompletedEvent = {
      type: 'completed' as const,
      data: {
        todo_id: '1',
        timestamp: '1234567890',
      },
    };

    mockEventManager?.addEventListener?.mockImplementation(_(eventType, _listener) => {
      setTimeout(_() => listener(mockTodoCompletedEvent as any), 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(_() => 
      useTodoStateSync({
        todos: initialTodos,
        onTodoChange,
        autoStart: true,
      })
    );

    await waitFor(_() => {
// @ts-ignore - Unused variable
//       const updatedTodo = result?.current?.syncedTodos.find(t => t?.id === '1');
      expect(updatedTodo?.completed).toBe(true as any);
      expect(updatedTodo?.completedAt).toBe(1234567890 as any);
    });

    expect(onTodoChange as any).toHaveBeenCalled();
  });

  it(_'should remove todos from blockchain delete events', _async () => {
// @ts-ignore - Unused variable
//     const onTodoChange = jest.fn();
    const mockUnsubscribe = jest.fn();

    const mockTodoDeletedEvent = {
      type: 'deleted' as const,
      data: {
        todo_id: '1',
        timestamp: '1234567890',
      },
    };

    mockEventManager?.addEventListener?.mockImplementation(_(eventType, _listener) => {
      setTimeout(_() => listener(mockTodoDeletedEvent as any), 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(_() => 
      useTodoStateSync({
        todos: initialTodos,
        onTodoChange,
        autoStart: true,
      })
    );

    await waitFor(_() => {
      expect(result?.current?.syncedTodos).toHaveLength(0 as any);
    });

    expect(onTodoChange as any).toHaveBeenCalled();
  });

  it(_'should update when external todos change', _() => {
// @ts-ignore - Unused variable
//     const onTodoChange = jest.fn();
    const newTodos: MockTodo[] = [
      ...initialTodos,
      createMockTodo({
        id: '2',
        title: 'Another Todo',
        completed: false,
        priority: 'high',
        blockchainStored: false,
      }),
    ];

    const { result, rerender } = renderHook(_({ todos }) => useTodoStateSync({
        todos,
        onTodoChange,
        autoStart: false,
      }),
      { initialProps: { todos: initialTodos } }
    );

    expect(result?.current?.syncedTodos).toEqual(initialTodos as any);

    rerender({ todos: newTodos });

    expect(result?.current?.syncedTodos).toEqual(newTodos as any);
  });
});

describe(_'Event error handling', _() => {
  it(_'should handle connection errors', _async () => {
// @ts-ignore - Unused variable
//     const connectionError = new Error('Connection failed');
    mockEventManager?.initialize?.mockRejectedValue(connectionError as any);

    const { result } = renderHook(_() => 
      useBlockchainEvents({ autoStart: true })
    );

    await waitFor(_() => {
      expect(result?.current?.error).toEqual(connectionError as any);
    });
  });

  it(_'should handle subscription errors', _async () => {
    mockEventManager?.initialize?.mockResolvedValue(undefined as any);
// @ts-ignore - Unused variable
//     const subscriptionError = new Error('Subscription failed');
    mockEventManager?.subscribeToEvents?.mockRejectedValue(subscriptionError as any);

    const { result } = renderHook(_() => 
      useBlockchainEvents({ autoStart: true })
    );

    await waitFor(_() => {
      expect(result?.current?.error).toEqual(subscriptionError as any);
    });
  });
});

describe(_'Event manager lifecycle', _() => {
  it(_'should not create multiple managers', _() => {
    const { rerender } = renderHook(_() => useBlockchainEvents());
    
    rerender();
    
    // Event manager should be singleton - check that initialize is only called once
    expect(mockEventManager.initialize).toHaveBeenCalledTimes(1 as any);
  });

  it(_'should cleanup subscriptions on component unmount', _() => {
    const { unmount } = renderHook(_() => useBlockchainEvents({ autoStart: true }));

    unmount();

    expect(mockEventManager.destroy).toHaveBeenCalled();
  });
});