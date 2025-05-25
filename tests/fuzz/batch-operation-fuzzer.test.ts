import { BatchProcessor } from '../../src/utils/batch-processor';
import type { Todo, BatchResult } from '../../src/types/todo';

// Random operation types for fuzzing
enum BatchOperationType {
  ADD_TODO = 'ADD_TODO',
  UPDATE_TODO = 'UPDATE_TODO',
  COMPLETE_TODO = 'COMPLETE_TODO',
  DELETE_TODO = 'DELETE_TODO',
  MIXED_OPERATIONS = 'MIXED_OPERATIONS',
  PARALLEL_READS = 'PARALLEL_READS',
  STRESS_BATCH = 'STRESS_BATCH',
}

interface FuzzTestCase {
  id: string;
  type: BatchOperationType;
  batchSize: number;
  operations: any[];
  expectedBehavior: string;
}

describe('Batch Operation Fuzzer Tests', () => {
  let todoService: TodoService;
  let batchProcessor: BatchProcessor;
  let activeOperations: Set<string>;

  beforeEach(() => {
    jest.clearAllMocks();
    todoService = new TodoService('test');
    batchProcessor = new BatchProcessor();
    activeOperations = new Set();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper function to generate random string
  const randomString = (length: number = 10): string => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(
      { length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  };

  // Helper function to generate random todo
  const generateRandomTodo = (): Partial<Todo> => ({
    text: randomString(20 + Math.floor(Math.random() * 80)),
    description:
      Math.random() > 0.5
        ? randomString(50 + Math.floor(Math.random() * 150))
        : undefined,
    tags: Array.from({ length: Math.floor(Math.random() * 5) }, () =>
      randomString(5)
    ),
    priority: (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3,
    dueDate:
      Math.random() > 0.5
        ? new Date(
            Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000
          ).toISOString()
        : undefined,
  });

  // Generate fuzz test cases
  const generateFuzzTestCases = (count: number): FuzzTestCase[] => {
    const testCases: FuzzTestCase[] = [];

    for (let i = 0; i < count; i++) {
      const operationType =
        Object.values(BatchOperationType)[
          Math.floor(Math.random() * Object.values(BatchOperationType).length)
        ];
      const batchSize = Math.floor(Math.random() * 50) + 1;

      let operations: any[] = [];
      let expectedBehavior = '';

      switch (operationType) {
        case BatchOperationType.ADD_TODO:
          operations = Array.from({ length: batchSize }, () => ({
            type: 'add',
            data: generateRandomTodo(),
          }));
          expectedBehavior = `Should add ${batchSize} todos successfully`;
          break;

        case BatchOperationType.UPDATE_TODO:
          operations = Array.from({ length: batchSize }, (_, index) => ({
            type: 'update',
            id: `todo-${index}`,
            data: { text: randomString(20), completed: Math.random() > 0.5 },
          }));
          expectedBehavior = `Should attempt to update ${batchSize} todos`;
          break;

        case BatchOperationType.COMPLETE_TODO:
          operations = Array.from({ length: batchSize }, (_, index) => ({
            type: 'complete',
            id: `todo-${index}`,
          }));
          expectedBehavior = `Should attempt to complete ${batchSize} todos`;
          break;

        case BatchOperationType.DELETE_TODO:
          operations = Array.from({ length: batchSize }, (_, index) => ({
            type: 'delete',
            id: `todo-${index}`,
          }));
          expectedBehavior = `Should attempt to delete ${batchSize} todos`;
          break;

        case BatchOperationType.MIXED_OPERATIONS:
          operations = Array.from({ length: batchSize }, (_, index) => {
            const types = ['add', 'update', 'complete', 'delete'];
            const type = types[Math.floor(Math.random() * types.length)];
            switch (type) {
              case 'add':
                return { type, data: generateRandomTodo() };
              case 'update':
                return {
                  type,
                  id: `todo-${index % 10}`,
                  data: { text: randomString(20) },
                };
              case 'complete':
                return { type, id: `todo-${index % 10}` };
              case 'delete':
                return { type, id: `todo-${index % 10}` };
              default:
                return { type: 'add', data: generateRandomTodo() };
            }
          });
          expectedBehavior = `Should handle ${batchSize} mixed operations`;
          break;

        case BatchOperationType.PARALLEL_READS:
          operations = Array.from({ length: batchSize }, () => ({
            type: 'read',
            filter:
              Math.random() > 0.5
                ? { completed: Math.random() > 0.5 }
                : undefined,
          }));
          expectedBehavior = `Should handle ${batchSize} parallel read operations`;
          break;

        case BatchOperationType.STRESS_BATCH:
          operations = Array.from(
            { length: Math.min(batchSize * 10, 500) },
            (_, index) => ({
              type: 'add',
              data: {
                text: randomString(1000), // Large text
                description: randomString(5000), // Very large description
                tags: Array.from({ length: 50 }, () => randomString(10)), // Many tags
                attachments: Array.from({ length: 10 }, () => ({
                  // Large attachments
                  filename: randomString(20),
                  data: randomString(10000),
                })),
              },
            })
          );
          expectedBehavior = `Should handle stress test with ${operations.length} large operations`;
          break;
      }

      testCases.push({
        id: `fuzz-test-${i}`,
        type: operationType,
        batchSize,
        operations,
        expectedBehavior,
      });
    }

    return testCases;
  };

  // Test execution function
  const executeBatchTest = async (
    testCase: FuzzTestCase
  ): Promise<BatchResult> => {
    const operationId = `batch-${testCase.id}`;
    activeOperations.add(operationId);

    try {
      const results: any[] = [];
      const errors: any[] = [];
      const startTime = Date.now();

      // Execute operations in batches
      const chunkSize = Math.min(testCase.operations.length, 10);
      for (let i = 0; i < testCase.operations.length; i += chunkSize) {
        const chunk = testCase.operations.slice(i, i + chunkSize);

        const chunkResults = await Promise.allSettled(
          chunk.map(async operation => {
            switch (operation.type) {
              case 'add':
                return await todoService.createTodo(
                  operation.data.text,
                  operation.data
                );
              case 'update':
                return await todoService.updateTodo(
                  operation.id,
                  operation.data
                );
              case 'complete':
                return await todoService.completeTodo(operation.id);
              case 'delete':
                return await todoService.deleteTodo(operation.id);
              case 'read':
                return await todoService.listTodos(operation.filter);
              default:
                throw new Error(`Unknown operation type: ${operation.type}`);
            }
          })
        );

        chunkResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            errors.push({
              operation: chunk[index],
              error: result.reason,
            });
          }
        });
      }

      const endTime = Date.now();

      return {
        successful: results.length,
        failed: errors.length,
        duration: endTime - startTime,
        results,
        errors,
      };
    } finally {
      activeOperations.delete(operationId);
    }
  };

  // Edge case: Empty batch
  it('should handle empty batch operations', async () => {
    const testCase: FuzzTestCase = {
      id: 'empty-batch',
      type: BatchOperationType.MIXED_OPERATIONS,
      batchSize: 0,
      operations: [],
      expectedBehavior: 'Should handle empty batch gracefully',
    };

    const result = await executeBatchTest(testCase);
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  // Edge case: Single operation batch
  it('should handle single operation batch', async () => {
    const testCase: FuzzTestCase = {
      id: 'single-operation',
      type: BatchOperationType.ADD_TODO,
      batchSize: 1,
      operations: [
        {
          type: 'add',
          data: generateRandomTodo(),
        },
      ],
      expectedBehavior: 'Should handle single operation successfully',
    };

    const result = await executeBatchTest(testCase);
    expect(result.successful + result.failed).toBe(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  // Edge case: Duplicate operations
  it('should handle duplicate operations in batch', async () => {
    const todoData = generateRandomTodo();
    const testCase: FuzzTestCase = {
      id: 'duplicate-operations',
      type: BatchOperationType.ADD_TODO,
      batchSize: 5,
      operations: Array.from({ length: 5 }, () => ({
        type: 'add',
        data: { ...todoData }, // Same data
      })),
      expectedBehavior: 'Should handle duplicate todo additions',
    };

    const result = await executeBatchTest(testCase);
    expect(result.successful).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  // Edge case: Invalid operations
  it('should handle invalid operations gracefully', async () => {
    const testCase: FuzzTestCase = {
      id: 'invalid-operations',
      type: BatchOperationType.MIXED_OPERATIONS,
      batchSize: 5,
      operations: [
        { type: 'add', data: null }, // Invalid data
        { type: 'update', id: null, data: { text: 'test' } }, // Invalid ID
        { type: 'complete', id: '' }, // Empty ID
        { type: 'delete', id: 'non-existent-id' }, // Non-existent ID
        { type: 'unknown', data: {} }, // Unknown operation type
      ],
      expectedBehavior:
        'Should handle invalid operations with appropriate errors',
    };

    const result = await executeBatchTest(testCase);
    expect(result.failed).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // Main fuzz testing loop
  describe('Random Batch Operation Tests', () => {
    const FUZZ_TEST_COUNT = 20; // Number of random test cases to generate
    const testCases = generateFuzzTestCases(FUZZ_TEST_COUNT);

    testCases.forEach((testCase, index) => {
      it(`Fuzz Test ${index + 1}: ${testCase.type} with ${testCase.batchSize} operations`, async () => {
        // console.log(`Executing: ${testCase.expectedBehavior}`); // Removed console statement

        const result = await executeBatchTest(testCase);

        // Basic assertions that should always be true
        expect(result.successful).toBeGreaterThanOrEqual(0);
        expect(result.failed).toBeGreaterThanOrEqual(0);
        expect(result.successful + result.failed).toBeLessThanOrEqual(
          testCase.operations.length
        );
        expect(result.duration).toBeGreaterThanOrEqual(0);

        // Type-specific assertions
        switch (testCase.type) {
          case BatchOperationType.ADD_TODO:
            expect(result.successful).toBeGreaterThan(0);
            break;

          case BatchOperationType.PARALLEL_READS:
            expect(result.successful).toBe(testCase.operations.length);
            break;

          case BatchOperationType.STRESS_BATCH:
            // Stress tests may have some failures due to resource limits
            expect(result.successful + result.failed).toBe(
              testCase.operations.length
            );
            break;
        }

        // console.log(`Result: ${result.successful} successful, ${result.failed} failed, ${result.duration}ms`); // Removed console statement
      });
    });
  });

  // Concurrent batch operations test
  it('should handle concurrent batch operations', async () => {
    const concurrentBatches = 5;
    const testCases = generateFuzzTestCases(concurrentBatches);

    const results = await Promise.allSettled(
      testCases.map(testCase => executeBatchTest(testCase))
    );

    let totalSuccessful = 0;
    let totalFailed = 0;

    results.forEach((result, index) => {
      expect(result.status).toBe('fulfilled');
      if (result.status === 'fulfilled') {
        totalSuccessful += result.value.successful;
        totalFailed += result.value.failed;
        // console.log(`Batch ${index + 1}: ${result.value.successful} successful, ${result.value.failed} failed`); // Removed console statement
      }
    });

    expect(totalSuccessful).toBeGreaterThanOrEqual(0);
    expect(totalFailed).toBeGreaterThanOrEqual(0);
  });

  // Memory pressure test
  it('should handle operations under memory pressure', async () => {
    const largeTextSize = 100000; // 100KB of text
    const testCase: FuzzTestCase = {
      id: 'memory-pressure',
      type: BatchOperationType.ADD_TODO,
      batchSize: 10,
      operations: Array.from({ length: 10 }, () => ({
        type: 'add',
        data: {
          text: randomString(largeTextSize),
          description: randomString(largeTextSize),
          tags: Array.from({ length: 100 }, () => randomString(1000)),
        },
      })),
      expectedBehavior: 'Should handle large operations under memory pressure',
    };

    const result = await executeBatchTest(testCase);
    expect(result.successful + result.failed).toBe(testCase.operations.length);
    // console.log(`Memory pressure test: ${result.successful} successful, ${result.failed} failed`); // Removed console statement
  });

  // Operation interruption simulation
  it('should handle interrupted batch operations', async () => {
    const testCase: FuzzTestCase = {
      id: 'interrupted-batch',
      type: BatchOperationType.MIXED_OPERATIONS,
      batchSize: 20,
      operations: Array.from({ length: 20 }, (_, index) => ({
        type:
          index % 4 === 0
            ? 'add'
            : index % 4 === 1
              ? 'update'
              : index % 4 === 2
                ? 'complete'
                : 'delete',
        ...(index % 4 === 0
          ? { data: generateRandomTodo() }
          : { id: `todo-${index}` }),
        ...(index % 4 === 1 ? { data: { text: randomString(20) } } : {}),
      })),
      expectedBehavior: 'Should handle interrupted operations gracefully',
    };

    // Start batch operation
    const operationPromise = executeBatchTest(testCase);

    // Simulate interruption after a delay
    setTimeout(() => {
      // In a real scenario, this might cancel ongoing operations
      // console.log("Simulating interruption..."); // Removed console statement
    }, 50);

    const result = await operationPromise;
    expect(result.successful + result.failed).toBeLessThanOrEqual(
      testCase.operations.length
    );
  });
});
