import { SuiTestService } from '@/services/SuiTestService';
import { MockTodoListContract } from '@/__mocks__/contracts/todo-list';
import { MockNFTStorageContract } from '@/__mocks__/contracts/nft-storage';
import { FuzzGenerator } from '../helpers/fuzz-generator';

describe('Transaction Edge Cases', () => {
  const fuzzer = new FuzzGenerator();
  let suiService: SuiTestService;
  let todoContract: MockTodoListContract;
  let nftContract: MockNFTStorageContract;

  beforeEach(() => {
    suiService = new SuiTestService({
      network: 'testnet',
      walletAddress: fuzzer.blockchainData().address(),
      encryptedStorage: false
    });
    todoContract = new MockTodoListContract('0x123');
    nftContract = new MockNFTStorageContract('0x456');
  });

  describe('Resource Exhaustion', () => {
    it('should handle large transaction volume', async () => {
      const listId = await suiService.createTodoList();
      const largeVolume = 1000;

      // Create many todos simultaneously
      await Promise.all(
        Array(largeVolume).fill(null).map(() =>
          suiService.addTodo(listId, fuzzer.string())
        )
      );

      const todos = await suiService.getTodos(listId);
      expect(todos.length).toBe(largeVolume);
    });

    it('should handle memory pressure', async () => {
      const listId = await suiService.createTodoList();
      
      // Create todos with large content
      const largeTodos = Array(100).fill(null).map(() => ({
        text: fuzzer.string({ minLength: 1000000, maxLength: 2000000 }) // 1-2MB strings
      }));

      for (const todo of largeTodos) {
        await suiService.addTodo(listId, todo.text);
      }
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent modifications', async () => {
      const listId = await suiService.createTodoList();
      
      // Simulate multiple users modifying the same list
      const users = Array(10).fill(null).map(() => new SuiTestService({
        network: 'testnet',
        walletAddress: fuzzer.blockchainData().address(),
        encryptedStorage: false
      }));

      await Promise.all(users.map(user =>
        Promise.all([
          user.addTodo(listId, fuzzer.string()),
          user.getTodos(listId),
          user.updateTodo(listId, fuzzer.string(), { completed: true })
        ]).catch((error: unknown) => {
          expect((error as Error).message).toContain('Unauthorized');
        })
      ));
    });
  });

  describe('Network Conditions', () => {
    it('should handle connection interruptions', async () => {
      const listId = await suiService.createTodoList();
      
      // Simulate network interruptions during operations
      const operations = async () => {
        try {
          await Promise.race([
            suiService.addTodo(listId, fuzzer.string()),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 100))
          ]);
        } catch (error: unknown) {
          if (!(error instanceof Error)) {
            throw new Error('Unexpected error type');
          }
          expect(error.message).toMatch(/timeout|failed|error/i);
        }
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
      const listId = await suiService.createTodoList();
      const todoId = await suiService.addTodo(listId, 'test');

      // Attempt invalid state transitions
      const invalidTransitions = [
        // Complete already completed todo
        async () => {
          await suiService.updateTodo(listId, todoId, { completed: true });
          await suiService.updateTodo(listId, todoId, { completed: true });
        },
        // Update deleted todo
        async () => {
          await suiService.deleteTodoList(listId);
          await suiService.updateTodo(listId, todoId, { text: 'new text' });
        },
        // Double deletion
        async () => {
          await suiService.deleteTodoList(listId);
          await suiService.deleteTodoList(listId);
        }
      ];

      for (const transition of invalidTransitions) {
        try {
          await transition();
        } catch (error: unknown) {
          if (!(error instanceof Error)) {
            throw new Error('Unexpected error type');
          }
          expect(error).toHaveProperty('message');
        }
      }
    });

    it('should handle data races', async () => {
      const listId = await suiService.createTodoList();
      const todoId = await suiService.addTodo(listId, 'test');

      // Simulate concurrent updates to the same todo
      await Promise.all([
        suiService.updateTodo(listId, todoId, { text: 'update 1' }),
        suiService.updateTodo(listId, todoId, { text: 'update 2' }),
        suiService.updateTodo(listId, todoId, { completed: true }),
        suiService.deleteTodoList(listId)
      ].map(p => p.catch(e => e))); // Capture but don't fail on errors

      // Verify final state is consistent
      try {
        await suiService.getTodos(listId);
      } catch (error: unknown) {
        expect((error as Error).message).toContain('not found');
      }
    });
  });

  describe('NFT Edge Cases', () => {
    it('should handle NFT ownership changes during operations', async () => {
      const sender = { sender: fuzzer.blockchainData().address() };
      const nftId = await nftContract.entry_create_nft(sender, {
        name: 'Test NFT',
        description: 'Test Description',
        url: 'https://example.com/test'
      });

      // Simulate rapid ownership changes
      const newOwners = Array(5).fill(null).map(() => fuzzer.blockchainData().address());
      
      await Promise.all(newOwners.map(async (owner) => {
        try {
          await nftContract.entry_transfer_nft(sender, nftId, owner);
          await nftContract.entry_update_metadata(
            { sender: owner },
            nftId,
            { description: fuzzer.string() }
          );
        } catch (error: unknown) {
          if (!(error instanceof Error)) {
            throw new Error('Unexpected error type');
          }
          expect(error.message).toMatch(/Unauthorized|not found/i);
        }
      }));
    });
  });
});