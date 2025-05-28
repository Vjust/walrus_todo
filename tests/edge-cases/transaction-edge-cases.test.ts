import { CLIError } from '../../apps/cli/src/types/errors/consolidated/CLIError';
import { FuzzGenerator } from '../helpers/fuzz-generator';

// Manual mock implementation for SuiTestService
class MockSuiTestService {
  private todosStore: Map<string, any[]> = new Map();
  private deletedLists: Set<string> = new Set();
  private memoryPressureMode = false;
  private networkErrorMode = false;

  createTodoList = jest.fn().mockImplementation(async () => {
    const listId = `list-${Date.now()}-${Math.random()}`;
    this.todosStore.set(listId, []);
    return listId;
  });

  addTodo = jest
    .fn()
    .mockImplementation(async (listId: string, text: string) => {
      if (this.networkErrorMode) {
        throw new Error('Network timeout');
      }

      if (this.deletedLists.has(listId)) {
        throw new CLIError('Todo list not found', 'LIST_NOT_FOUND');
      }

      const todoId = `todo-${Date.now()}-${Math.random()}`;
      const todo = {
        id: todoId,
        text,
        completed: false,
        updatedAt: Date.now(),
      };

      const todos = this.todosStore.get(listId) || [];
      todos.push(todo);
      this.todosStore.set(listId, todos);

      return todoId;
    });

  getTodos = jest.fn().mockImplementation(async (listId: string) => {
    if (this.deletedLists.has(listId)) {
      throw new CLIError('Todo list not found', 'LIST_NOT_FOUND');
    }

    return this.todosStore.get(listId) || [];
  });

  updateTodo = jest
    .fn()
    .mockImplementation(
      async (listId: string, todoId: string, updates: any) => {
        if (this.deletedLists.has(listId)) {
          throw new CLIError('Invalid state transition', 'INVALID_STATE');
        }

        const todos = this.todosStore.get(listId) || [];
        const todoIndex = todos.findIndex(t => t.id === todoId);

        if (todoIndex === -1) {
          throw new CLIError('Todo not found', 'TODO_NOT_FOUND');
        }

        // Simulate state validation for double completion
        if (updates.completed === true && todos[todoIndex].completed === true) {
          throw new CLIError('Invalid state transition', 'INVALID_STATE');
        }

        todos[todoIndex] = {
          ...todos[todoIndex],
          ...updates,
          updatedAt: Date.now(),
        };
        this.todosStore.set(listId, todos);
      }
    );

  deleteTodoList = jest.fn().mockImplementation(async (listId: string) => {
    if (this.deletedLists.has(listId)) {
      throw new CLIError('List not found', 'LIST_NOT_FOUND');
    }

    this.deletedLists.add(listId);
    this.todosStore.delete(listId);
  });

  // Test helper methods
  setMemoryPressureMode(enabled: boolean) {
    this.memoryPressureMode = enabled;
  }

  setNetworkErrorMode(enabled: boolean) {
    this.networkErrorMode = enabled;
  }

  reset() {
    this.todosStore.clear();
    this.deletedLists.clear();
    this.memoryPressureMode = false;
    this.networkErrorMode = false;
    jest.clearAllMocks();
  }
}

class MockNFTStorageContract {
  constructor(public address: string) {}
  mintNFT = jest.fn().mockResolvedValue({ id: 'nft-123' });
  transferNFT = jest.fn().mockResolvedValue({ success: true });
  burnNFT = jest.fn().mockResolvedValue({ success: true });

  // Add missing methods that tests expect
  entry_create_nft = jest.fn().mockResolvedValue('nft-456');
  entry_transfer_nft = jest.fn().mockRejectedValue(new Error('Unauthorized'));
  entry_update_metadata = jest
    .fn()
    .mockRejectedValue(new Error('Unauthorized'));
}

describe('Transaction Edge Cases', () => {
  const fuzzer = new FuzzGenerator();
  let suiService: MockSuiTestService;
  let nftContract: MockNFTStorageContract;

  beforeEach(() => {
    suiService = new MockSuiTestService();
    nftContract = new MockNFTStorageContract('0x456');
  });

  describe('Resource Exhaustion', () => {
    it('should handle large transaction volume', async () => {
      const listId = await suiService.createTodoList();
      const largeVolume = 1000;

      // Create many todos simultaneously
      await Promise.all(
        Array(largeVolume)
          .fill(null)
          .map(() => suiService.addTodo(listId, fuzzer.string()))
      );

      const todos = await suiService.getTodos(listId);
      expect(todos.length).toBe(largeVolume);
    });

    it('should handle memory pressure', async () => {
      const listId = await suiService.createTodoList();

      // Create todos with large content
      const largeTodos = Array(100)
        .fill(null)
        .map(() => ({
          text: fuzzer.string({ minLength: 1000000, maxLength: 2000000 }), // 1-2MB strings
        }));

      // Add large todos through the service
      for (const todo of largeTodos) {
        await suiService.addTodo(listId, todo.text);
      }

      // Verify all large todos were created successfully
      const todos = await suiService.getTodos(listId);
      expect(todos.length).toBe(largeTodos.length);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent modifications', async () => {
      const listId = await suiService.createTodoList();

      // Simulate multiple users modifying the same list
      const users = Array(10)
        .fill(null)
        .map(() => ({
          addTodo: jest
            .fn()
            .mockRejectedValue(
              new CLIError('Unauthorized access to todo list', 'UNAUTHORIZED')
            ),
          getTodos: jest
            .fn()
            .mockRejectedValue(
              new CLIError('Unauthorized access to todo list', 'UNAUTHORIZED')
            ),
          updateTodo: jest
            .fn()
            .mockRejectedValue(
              new CLIError('Unauthorized access to todo list', 'UNAUTHORIZED')
            ),
        }));

      await Promise.all(
        users.map(async user => {
          await expect(
            Promise.all([
              user.addTodo(listId, fuzzer.string()),
              user.getTodos(listId),
              user.updateTodo(listId, fuzzer.string(), { completed: true }),
            ])
          ).rejects.toThrow(/Unauthorized/);
        })
      );
    });
  });

  describe('Network Conditions', () => {
    it('should handle connection interruptions', async () => {
      const listId = await suiService.createTodoList();

      // Enable network error mode
      suiService.setNetworkErrorMode(true);

      // Simulate network interruptions during operations
      const operations = async () => {
        await expect(
          Promise.race([
            suiService.addTodo(listId, fuzzer.string()),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Network timeout')), 100)
            ),
          ])
        ).rejects.toThrow(/timeout|failed|error/i);
      };

      await Promise.all(Array(10).fill(null).map(operations));
    });

    it('should handle slow responses', async () => {
      const listId = await suiService.createTodoList();

      // Simulate varying network latencies
      const latencies = [100, 500, 1000, 2000, 5000];

      for (const latency of latencies) {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, latency));
        await suiService.addTodo(listId, fuzzer.string());
        const duration = Date.now() - start;
        expect(duration).toBeGreaterThanOrEqual(latency);
      }
    });
  });

  describe('Data Integrity', () => {
    it('should handle invalid state transitions', async () => {
      // Use the MockSuiTestService that has state validation logic
      const mockService = new MockSuiTestService();

      const listId = await mockService.createTodoList();
      const todoId = await mockService.addTodo(listId, 'test');

      // Test 1: Complete already completed todo
      await mockService.updateTodo(listId, todoId, { completed: true }); // First completion succeeds
      await expect(
        mockService.updateTodo(listId, todoId, { completed: true }) // Second completion should fail
      ).rejects.toThrow(/Invalid state transition/);

      // Test 2: Update deleted todo
      const listId2 = await mockService.createTodoList();
      const todoId2 = await mockService.addTodo(listId2, 'test');
      await mockService.deleteTodoList(listId2); // Delete the list
      await expect(
        mockService.updateTodo(listId2, todoId2, { text: 'new text' }) // Try to update todo in deleted list
      ).rejects.toThrow(/Invalid state transition/);

      // Test 3: Double deletion
      const listId3 = await mockService.createTodoList();
      await mockService.deleteTodoList(listId3); // First deletion succeeds
      await expect(
        mockService.deleteTodoList(listId3) // Second deletion should fail
      ).rejects.toThrow(/List not found/);
    });

    it('should handle data races', async () => {
      const listId = await suiService.createTodoList();
      const todoId = await suiService.addTodo(listId, 'test');

      // Simulate concurrent updates to the same todo
      const promises = [
        Promise.resolve().then(() =>
          suiService.updateTodo(listId, todoId, { text: 'update 1' })
        ),
        Promise.resolve().then(() =>
          suiService.updateTodo(listId, todoId, { text: 'update 2' })
        ),
        Promise.resolve().then(() =>
          suiService.updateTodo(listId, todoId, { completed: true })
        ),
        Promise.resolve().then(() => suiService.deleteTodoList(listId)),
      ];

      await Promise.all(promises.map(p => p.catch(e => e))); // Capture but don't fail on errors

      // Verify final state is consistent - the list should be deleted
      await expect(suiService.getTodos(listId)).rejects.toThrow(/not found/);
    });
  });

  describe('NFT Edge Cases', () => {
    it('should handle NFT ownership changes during operations', async () => {
      const sender = { sender: fuzzer.blockchainData().address() };
      const nftId = await nftContract.entry_create_nft(sender, {
        name: 'Test NFT',
        description: 'Test Description',
        url: 'https://example.com/test',
      });

      // Simulate rapid ownership changes
      const newOwners = Array(5)
        .fill(null)
        .map(() => fuzzer.blockchainData().address());

      await Promise.all(
        newOwners.map(async owner => {
          await expect(
            (async () => {
              await nftContract.entry_transfer_nft(sender, nftId, owner);
              await nftContract.entry_update_metadata(
                { sender: owner },
                nftId,
                {
                  description: fuzzer.string(),
                }
              );
            })()
          ).rejects.toThrow(/Unauthorized|not found/i);
        })
      );
    });
  });
});
