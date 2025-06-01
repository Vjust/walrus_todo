/**
 * Tests for useSuiTodos hook
 * Ensures proper blockchain todo operations and state management
 */

import { renderHookSafe as renderHook, act, waitFor } from '../test-utils';
import { useSuiTodos, useTodoOperation, NetworkType } from '../../src/hooks/useSuiTodos';
import { useWalletContext } from '../../src/contexts/WalletContext';
import { initializeSuiClient, getSuiClient } from '../../src/lib/sui-client';
import toast from 'react-hot-toast';

// Import centralized mocks
import '../mocks';

// Mock dependencies
jest.mock('../../src/contexts/WalletContext');
jest.mock('../../src/lib/sui-client');
jest.mock('react-hot-toast');

// Mock the Sui SDK
jest.mock('@mysten/sui/client', () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    getOwnedObjects: jest.fn(),
    getObject: jest.fn(),
    multiGetObjects: jest.fn(),
    dryRunTransactionBlock: jest.fn(),
  })),
}));

jest.mock('@mysten/sui/transactions', () => ({
  Transaction: jest.fn().mockImplementation(() => ({
    moveCall: jest.fn(),
    build: jest.fn().mockResolvedValue('mock-transaction'),
  })),
}));

describe('useSuiTodos', () => {
  const mockSuiClient = {
    getOwnedObjects: jest.fn(),
    getObject: jest.fn(),
    multiGetObjects: jest.fn(),
  };

  const mockWalletContext = {
    connected: true,
    address: '0xowner123',
    chainId: 'testnet',
  };

  const mockTodoObjects = [
    {
      data: {
        objectId: '0x123',
        content: {
          dataType: 'moveObject',
          fields: {
            id: { id: '0x123' },
            title: 'Test Todo 1',
            description: 'Description 1',
            completed: false,
            priority: 0, // high
            owner: '0xowner123',
            created_at: '1234567890',
            tags: [],
            due_date: null,
            completed_at: null,
          },
        },
      },
    },
    {
      data: {
        objectId: '0x456',
        content: {
          dataType: 'moveObject',
          fields: {
            id: { id: '0x456' },
            title: 'Test Todo 2',
            description: 'Description 2',
            completed: true,
            priority: 1, // medium
            owner: '0xowner123',
            created_at: '1234567891',
            tags: ['work'],
            due_date: '1234567900',
            completed_at: '1234567895',
          },
        },
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    (useWalletContext as jest.Mock).mockReturnValue(mockWalletContext);
    (getSuiClient as jest.Mock).mockReturnValue(mockSuiClient);
    (initializeSuiClient as jest.Mock).mockResolvedValue(undefined);
    
    // Mock toast
    (toast.error as jest.Mock).mockImplementation(() => {});
    
    // Default mock implementations
    mockSuiClient.getOwnedObjects.mockResolvedValue({
      data: mockTodoObjects.map(obj => ({
        data: { objectId: obj.data.objectId },
      })),
      hasNextPage: false,
    });
    
    mockSuiClient.multiGetObjects.mockResolvedValue(mockTodoObjects);
  });

  describe('Fetching Todos', () => {
    it('should fetch todos when wallet is connected', async () => {
      const { result } = renderHook(() => useSuiTodos());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.todos).toHaveLength(2);
      expect(result.current.todos[0]).toMatchObject({
        id: '0x123',
        objectId: '0x123',
        title: 'Test Todo 1',
        completed: false,
        priority: 'high',
      });
    });

    it('should return empty array when wallet is not connected', async () => {
      (useWalletContext as jest.Mock).mockReturnValue({
        ...mockWalletContext,
        connected: false,
        address: null,
      });

      const { result } = renderHook(() => useSuiTodos());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.todos).toEqual([]);
      expect(mockSuiClient.getOwnedObjects).not.toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      const error = new Error('Network error');
      mockSuiClient.getOwnedObjects.mockRejectedValue(error);

      const { result } = renderHook(() => useSuiTodos());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(error);
      expect(result.current.todos).toEqual([]);
      expect(toast.error).toHaveBeenCalledWith('Failed to fetch todos: Network error');
    });

    it('should filter by network', async () => {
      const { result } = renderHook(() => 
        useSuiTodos({ network: 'mainnet' as NetworkType })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should return empty as mocked todos are for testnet
      expect(result.current.todos).toEqual([]);
    });

    it('should handle pagination', async () => {
      mockSuiClient.getOwnedObjects.mockResolvedValueOnce({
        data: [{ data: { objectId: '0x123' } }],
        hasNextPage: true,
        nextCursor: 'cursor1',
      }).mockResolvedValueOnce({
        data: [{ data: { objectId: '0x456' } }],
        hasNextPage: false,
      });

      const { result } = renderHook(() => useSuiTodos());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSuiClient.getOwnedObjects).toHaveBeenCalledTimes(2);
      expect(result.current.todos).toHaveLength(2);
    });
  });

  describe('Todo Operations', () => {
    const mockSignAndExecute = jest.fn();
    
    beforeEach(() => {
      (useWalletContext as jest.Mock).mockReturnValue({
        ...mockWalletContext,
        signAndExecuteTransaction: mockSignAndExecute,
      });
      
      mockSignAndExecute.mockResolvedValue({
        digest: '0xdigest123',
        effects: { status: { status: 'success' } },
      });
    });

    describe('createTodo', () => {
      it('should create a new todo', async () => {
        const { result } = renderHook(() => useTodoOperation());

        const params = {
          title: 'New Todo',
          description: 'New Description',
          priority: 'high' as const,
          tags: ['urgent'],
          dueDate: new Date('2024-12-31'),
        };

        await act(async () => {
          const txResult = await result.current.createTodo(params);
          expect(txResult.digest).toBe('0xdigest123');
        });

        expect(mockSignAndExecute).toHaveBeenCalled();
        
        // Verify transaction was built correctly
        const txCall = mockSignAndExecute.mock.calls[0];
        expect(txCall[0]).toMatchObject({
          transaction: expect.any(Object),
        });
      });

      it('should validate title length', async () => {
        const { result } = renderHook(() => useTodoOperation());

        const params = {
          title: 'a'.repeat(101), // Too long
          description: '',
          priority: 'medium' as const,
        };

        await expect(result.current.createTodo(params)).rejects.toThrow(
          'Title must be 100 characters or less'
        );

        expect(mockSignAndExecute).not.toHaveBeenCalled();
      });

      it('should handle transaction errors', async () => {
        mockSignAndExecute.mockRejectedValue(new Error('User rejected'));

        const { result } = renderHook(() => useTodoOperation());

        await expect(
          result.current.createTodo({
            title: 'New Todo',
            description: '',
            priority: 'low' as const,
          })
        ).rejects.toThrow('User rejected');
      });
    });

    describe('updateTodo', () => {
      it('should update an existing todo', async () => {
        const { result } = renderHook(() => useTodoOperation());

        const params = {
          todoId: '0x123',
          title: 'Updated Title',
          description: 'Updated Description',
          priority: 'low' as const,
        };

        await act(async () => {
          const txResult = await result.current.updateTodo(params);
          expect(txResult.digest).toBe('0xdigest123');
        });

        expect(mockSignAndExecute).toHaveBeenCalled();
      });

      it('should allow partial updates', async () => {
        const { result } = renderHook(() => useTodoOperation());

        const params = {
          todoId: '0x123',
          title: 'Only Title Updated',
        };

        await act(async () => {
          await result.current.updateTodo(params);
        });

        expect(mockSignAndExecute).toHaveBeenCalled();
      });
    });

    describe('completeTodo', () => {
      it('should mark todo as completed', async () => {
        const { result } = renderHook(() => useTodoOperation());

        await act(async () => {
          const txResult = await result.current.completeTodo('0x123');
          expect(txResult.digest).toBe('0xdigest123');
        });

        expect(mockSignAndExecute).toHaveBeenCalled();
      });
    });

    describe('deleteTodo', () => {
      it('should delete a todo', async () => {
        const { result } = renderHook(() => useTodoOperation());

        await act(async () => {
          const txResult = await result.current.deleteTodo('0x123');
          expect(txResult.digest).toBe('0xdigest123');
        });

        expect(mockSignAndExecute).toHaveBeenCalled();
      });
    });

    describe('transferTodo', () => {
      it('should transfer todo ownership', async () => {
        const { result } = renderHook(() => useTodoOperation());

        const recipient = '0xrecipient456';

        await act(async () => {
          const txResult = await result.current.transferTodo('0x123', recipient);
          expect(txResult.digest).toBe('0xdigest123');
        });

        expect(mockSignAndExecute).toHaveBeenCalled();
      });

      it('should validate recipient address', async () => {
        const { result } = renderHook(() => useTodoOperation());

        await expect(
          result.current.transferTodo('0x123', 'invalid-address')
        ).rejects.toThrow('Invalid recipient address');
      });
    });
  });

  describe('Optimistic Updates', () => {
    it('should optimistically update todo completion', async () => {
      const { result: todosResult } = renderHook(() => useSuiTodos());
      const { result: opsResult } = renderHook(() => useTodoOperation());

      await waitFor(() => {
        expect(todosResult.current.loading).toBe(false);
      });

      const incompleteTodo = todosResult.current.todos.find(t => !t.completed);
      expect(incompleteTodo).toBeDefined();

      // Complete the todo
      await act(async () => {
        await opsResult.current.completeTodo(incompleteTodo!.id);
      });

      // Should trigger refetch
      await waitFor(() => {
        expect(mockSuiClient.getOwnedObjects).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed requests', async () => {
      mockSuiClient.getOwnedObjects
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: [],
          hasNextPage: false,
        });

      const { result } = renderHook(() => useSuiTodos());

      // First attempt fails
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Manual retry
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });

      expect(mockSuiClient.getOwnedObjects).toHaveBeenCalledTimes(2);
    });
  });

  describe('Priority Mapping', () => {
    it('should correctly map priority values', async () => {
      const { result } = renderHook(() => useSuiTodos());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const todos = result.current.todos;
      expect(todos[0].priority).toBe('high'); // 0 -> high
      expect(todos[1].priority).toBe('medium'); // 1 -> medium
    });
  });
});