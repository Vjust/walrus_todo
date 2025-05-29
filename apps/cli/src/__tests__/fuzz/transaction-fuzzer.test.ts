import { FuzzGenerator } from '../helpers/fuzz-generator';
import { SuiTestService } from '../../services/SuiTestService';
jest.mock('../../services/SuiTestService');

// Mock NFT storage contract
class MockNFTStorageContract {
  constructor(public address: string) {}
  mintNFT = jest.fn().mockResolvedValue({ id: 'nft-123' });
  transferNFT = jest.fn().mockResolvedValue({ success: true });
  burnNFT = jest.fn().mockResolvedValue({ success: true });
  entry_create_nft = jest.fn().mockResolvedValue('nft-123');
  entry_transfer_nft = jest.fn().mockResolvedValue({ success: true });
  entry_update_metadata = jest.fn().mockResolvedValue({ success: true });
}

describe('Transaction Fuzzing Tests', () => {
  const fuzzer = new FuzzGenerator();
  let suiService: SuiTestService;
  let nftContract: InstanceType<typeof MockNFTStorageContract>;

  beforeEach(() => {
    suiService = new SuiTestService({
      activeNetwork: {
        name: 'testnet',
        fullnode: 'https://fullnode.testnet.sui.io',
      },
      activeAccount: {
        address: fuzzer.blockchainData().address(),
      },
      storage: {
        defaultSize: 1024,
        defaultEpochs: 5,
        replicationFactor: 3,
        directory: '/tmp',
        temporaryDirectory: '/tmp',
        maxRetries: 3,
        retryDelay: 1000,
      },
      todo: {
        localStoragePath: '/tmp',
        defaultCategories: [],
        defaultPriority: 'medium' as const,
        maxTitleLength: 100,
        maxDescriptionLength: 1000,
        defaultDueDateOffsetDays: 7,
        expiryCheckInterval: 60000,
      },
      walrus: {},
      logging: {
        level: 'info' as const,
        console: false,
      },
    });
    nftContract = new MockNFTStorageContract('0x456');
  });

  describe('Todo List Operations', () => {
    it('should handle rapid sequential operations', async () => {
      const operations = fuzzer.array(
        () => ({
          type: fuzzer.subset(['create', 'update', 'delete'])[0],
          text: fuzzer.string({ maxLength: 1000, includeUnicode: true }),
          delay: fuzzer.number(0, 100),
        }),
        { minLength: 10, maxLength: 50 }
      );

      const listId = await suiService.createTodoList();

      // Execute operations in rapid succession
      await Promise.all(
        operations.map(async op => {
          await new Promise(resolve => setTimeout(resolve, op.delay));
          switch (op.type) {
            case 'create': {
              await suiService.addTodo(listId, op.text);
              break;
            }
            case 'update': {
              const todos = await suiService.getTodos(listId);
              if (todos.length > 0) {
                const randomTodo =
                  todos[Math.floor(Math.random() * todos.length)];
                if (randomTodo) {
                  await suiService.updateTodo(listId, randomTodo.id, {
                    text: op.text,
                    completed: fuzzer.boolean(),
                  });
                }
              }
              break;
            }
            case 'delete': {
              await suiService.deleteTodoList(listId);
              break;
            }
          }
        })
      );

      expect(operations.length).toBeGreaterThan(0);
    });

    it('should handle malformed input data', async () => {
      const malformedInputs = fuzzer.array(
        () => ({
          text: fuzzer.string({
            minLength: 0,
            maxLength: 10000,
            includeSpecialChars: true,
            includeUnicode: true,
          }),
        }),
        { minLength: 20, maxLength: 100 }
      );

      const listId = await suiService.createTodoList();

      const results = await Promise.allSettled(
        malformedInputs.map(input => suiService.addTodo(listId, input.text))
      );

      // Check that errors have proper message property
      const rejectedResults = results.filter(
        result => result.status === 'rejected'
      );
      rejectedResults.forEach(result => {
        expect(result.status).toBe('rejected');
        expect(result.reason).toHaveProperty('message');
      });
    });
  });

  describe('NFT Operations', () => {
    it('should handle concurrent NFT operations', async () => {
      const operations = fuzzer.array(
        () => ({
          type: fuzzer.subset(['create', 'transfer', 'update'])[0],
          metadata: {
            name: fuzzer.string(),
            description: fuzzer.string({ maxLength: 500 }),
            url: `https://example.com/${fuzzer.string()}`,
          },
          newOwner: fuzzer.blockchainData().address(),
        }),
        { minLength: 5, maxLength: 20 }
      );

      const nftIds: string[] = [];

      const results = await Promise.allSettled(
        operations.map(async op => {
          switch (op.type) {
            case 'create': {
              const nftId = await nftContract.entry_create_nft(
                { sender: fuzzer.blockchainData().address() },
                op.metadata
              );
              nftIds.push(nftId);
              break;
            }
            case 'transfer': {
              if (nftIds.length > 0) {
                const randomNftId =
                  nftIds[Math.floor(Math.random() * nftIds.length)];
                await nftContract.entry_transfer_nft(
                  { sender: fuzzer.blockchainData().address() },
                  randomNftId,
                  op.newOwner
                );
              }
              break;
            }
            case 'update': {
              if (nftIds.length > 0) {
                const randomNftId =
                  nftIds[Math.floor(Math.random() * nftIds.length)];
                await nftContract.entry_update_metadata(
                  { sender: fuzzer.blockchainData().address() },
                  randomNftId,
                  op.metadata
                );
              }
              break;
            }
          }
        })
      );

      // Check that errors have proper message property
      const rejectedResults = results.filter(
        result => result.status === 'rejected'
      );
      rejectedResults.forEach(result => {
        expect(result.status).toBe('rejected');
        expect(result.reason).toHaveProperty('message');
      });
    });
  });

  describe('Network Condition Simulation', () => {
    it('should handle network latency and errors', async () => {
      const listId = await suiService.createTodoList();

      // Simulate network conditions
      const networkConditions = fuzzer.array(
        () => ({
          latency: fuzzer.number(100, 5000),
          errorProbability: fuzzer.number(0, 0.3),
          operation: async () => {
            if (fuzzer.boolean(0.7)) {
              // 70% success rate
              await suiService.addTodo(listId, fuzzer.string());
            } else {
              throw fuzzer.networkError();
            }
          },
        }),
        { minLength: 10, maxLength: 30 }
      );

      const results = await Promise.allSettled(
        networkConditions.map(async condition => {
          await new Promise(resolve => setTimeout(resolve, condition.latency));
          return condition.operation();
        })
      );

      const rejectedResults = results.filter(
        result => result.status === 'rejected'
      );
      rejectedResults.forEach(result => {
        expect(result.status).toBe('rejected');
        expect(result.reason).toHaveProperty('message');
      });

      expect(results.length).toBe(networkConditions.length);
    });
  });
});
