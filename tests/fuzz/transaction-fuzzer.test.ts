import { FuzzGenerator } from '../helpers/fuzz-generator';
import { SuiTestService } from '../../../src/services/SuiTestService';
import { MockTodoListContract } from '../../__mocks__/contracts/todo-list';
import { MockNFTStorageContract } from '../../__mocks__/contracts/nft-storage';

describe('Transaction Fuzzing Tests', () => {
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

  describe('Todo List Operations', () => {
    it('should handle rapid sequential operations', async () => {
      const operations = fuzzer.array(() => ({
        type: fuzzer.subset(['create', 'update', 'delete'])[0],
        text: fuzzer.string({ maxLength: 1000, includeUnicode: true }),
        delay: fuzzer.number(0, 100)
      }), { minLength: 10, maxLength: 50 });

      const listId = await suiService.createTodoList();
      
      // Execute operations in rapid succession
      await Promise.all(operations.map(async op => {
        await new Promise(resolve => setTimeout(resolve, op.delay));
        switch (op.type) {
          case 'create':
            await suiService.addTodo(listId, op.text);
            break;
          case 'update':
            const todos = await suiService.getTodos(listId);
            if (todos.length > 0) {
              const randomTodo = todos[Math.floor(Math.random() * todos.length)];
              await suiService.updateTodo(listId, randomTodo.id, {
                text: op.text,
                completed: fuzzer.boolean()
              });
            }
            break;
          case 'delete':
            await suiService.deleteTodoList(listId);
            break;
        }
      }));
    });

    it('should handle malformed input data', async () => {
      const malformedInputs = fuzzer.array(() => ({
        text: fuzzer.string({
          minLength: 0,
          maxLength: 10000,
          includeSpecialChars: true,
          includeUnicode: true
        })
      }), { minLength: 20, maxLength: 100 });

      const listId = await suiService.createTodoList();

      for (const input of malformedInputs) {
        try {
          await suiService.addTodo(listId, input.text);
        } catch (error) {
          // Expect valid error handling
          expect(error).toHaveProperty('message');
        }
      }
    });
  });

  describe('NFT Operations', () => {
    it('should handle concurrent NFT operations', async () => {
      const operations = fuzzer.array(() => ({
        type: fuzzer.subset(['create', 'transfer', 'update'])[0],
        metadata: {
          name: fuzzer.string(),
          description: fuzzer.string({ maxLength: 500 }),
          url: `https://example.com/${fuzzer.string()}`
        },
        newOwner: fuzzer.blockchainData().address()
      }), { minLength: 5, maxLength: 20 });

      const nftIds: string[] = [];

      await Promise.all(operations.map(async op => {
        try {
          switch (op.type) {
            case 'create':
              const nftId = await nftContract.entry_create_nft(
                { sender: fuzzer.blockchainData().address() },
                op.metadata
              );
              nftIds.push(nftId);
              break;
            case 'transfer':
              if (nftIds.length > 0) {
                const randomNftId = nftIds[Math.floor(Math.random() * nftIds.length)];
                await nftContract.entry_transfer_nft(
                  { sender: fuzzer.blockchainData().address() },
                  randomNftId,
                  op.newOwner
                );
              }
              break;
            case 'update':
              if (nftIds.length > 0) {
                const randomNftId = nftIds[Math.floor(Math.random() * nftIds.length)];
                await nftContract.entry_update_metadata(
                  { sender: fuzzer.blockchainData().address() },
                  randomNftId,
                  op.metadata
                );
              }
              break;
          }
        } catch (error) {
          // Expect valid error handling
          expect(error).toHaveProperty('message');
        }
      }));
    });
  });

  describe('Network Condition Simulation', () => {
    it('should handle network latency and errors', async () => {
      const listId = await suiService.createTodoList();

      // Simulate network conditions
      const networkConditions = fuzzer.array(() => ({
        latency: fuzzer.number(100, 5000),
        errorProbability: fuzzer.number(0, 0.3),
        operation: async () => {
          if (fuzzer.boolean(0.7)) { // 70% success rate
            await suiService.addTodo(listId, fuzzer.string());
          } else {
            throw fuzzer.networkError();
          }
        }
      }), { minLength: 10, maxLength: 30 });

      for (const condition of networkConditions) {
        await new Promise(resolve => setTimeout(resolve, condition.latency));
        try {
          await condition.operation();
        } catch (error) {
          // Expect valid error handling
          expect(error).toHaveProperty('message');
        }
      }
    });
  });
});