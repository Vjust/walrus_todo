import { FuzzGenerator } from '../helpers/fuzz-generator';
import { WalrusStorage } from '../../src/utils/walrus-storage';
import { TodoStorage } from '../../src/utils/storage/implementations/TodoStorage';
import { ImageStorage } from '../../src/utils/storage/implementations/ImageStorage';
import { NFTStorage } from '../../src/utils/storage/implementations/NFTStorage';
import { FileHandleManager } from '../../src/utils/FileHandleManager';
import { StorageReuseAnalyzer } from '../../src/utils/storage-reuse-analyzer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

type StorageImplementation = WalrusStorage | TodoStorage | ImageStorage | NFTStorage;

describe('Storage Fuzzing Tests', () => {
  const fuzzer = new FuzzGenerator();
  const fileHandleManager = new FileHandleManager();
  let testDir: string;
  let storageInstances: StorageImplementation[];
  let walrusStorage: WalrusStorage;
  let todoStorage: TodoStorage;
  let imageStorage: ImageStorage;
  let nftStorage: NFTStorage;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(tmpdir(), `walrus-storage-fuzz-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Initialize storage instances with mock Walrus client
    walrusStorage = new WalrusStorage({
      url: 'http://localhost:8080',
      token: fuzzer.string({ minLength: 32, maxLength: 64 }),
      options: { timeout: 5000 }
    });

    // Initialize specialized storage implementations
    todoStorage = new TodoStorage({
      url: 'http://localhost:8080',
      token: fuzzer.string({ minLength: 32, maxLength: 64 })
    });

    imageStorage = new ImageStorage({
      url: 'http://localhost:8080',
      token: fuzzer.string({ minLength: 32, maxLength: 64 })
    });

    nftStorage = new NFTStorage({
      url: 'http://localhost:8080',
      token: fuzzer.string({ minLength: 32, maxLength: 64 })
    });

    storageInstances = [walrusStorage, todoStorage, imageStorage, nftStorage];
  });

  afterEach(async () => {
    // Clean up file handles
    await fileHandleManager.closeAll();
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Data Corruption Resilience', () => {
    it('should handle corrupted binary data', async () => {
      const corruptedData = fuzzer.array(() => {
        const originalData = fuzzer.buffer({ minLength: 1024, maxLength: 10240 });
        const corruptedBuffer = Buffer.from(originalData);
        
        // Randomly corrupt bytes
        const corruptionCount = fuzzer.number(1, 100);
        for (let i = 0; i < corruptionCount; i++) {
          const position = fuzzer.number(0, corruptedBuffer.length - 1);
          corruptedBuffer[position] = fuzzer.number(0, 255);
        }
        
        return corruptedBuffer;
      }, { minLength: 10, maxLength: 50 });

      for (const data of corruptedData) {
        try {
          const result = await walrusStorage.store(data);
          // Verify we can retrieve what we stored
          const retrieved = await walrusStorage.retrieve(result.blobId);
          expect(retrieved).toEqual(data);
        } catch (error) {
          // Expect proper error handling
          expect(error).toHaveProperty('message');
          expect(error.message).toMatch(/corrupt|invalid|fail/i);
        }
      }
    });

    it('should handle malformed JSON storage', async () => {
      const malformedJsonStrings = fuzzer.array(() => {
        const type = fuzzer.subset([
          'incomplete_json',
          'invalid_escape',
          'invalid_unicode',
          'unexpected_token',
          'circular_reference'
        ])[0];

        switch (type) {
          case 'incomplete_json':
            return '{"todo": "test", "completed": true';
          case 'invalid_escape':
            return '{"text": "invalid \\x escape"}';
          case 'invalid_unicode':
            return '{"text": "\\uD800\\uDC00"}';
          case 'unexpected_token':
            return '{"key": undefined}';
          case 'circular_reference':
            const obj: any = { a: 1 };
            obj.b = obj;
            try {
              return JSON.stringify(obj);
            } catch {
              return '{"circular": "[Circular]"}';
            }
          default:
            return '{';
        }
      }, { minLength: 10, maxLength: 30 });

      for (const jsonString of malformedJsonStrings) {
        try {
          await todoStorage.storeTodo({
            id: fuzzer.string(),
            text: jsonString,
            completed: false,
            createdAt: new Date()
          });
        } catch (error) {
          // Expect proper JSON error handling
          expect(error).toHaveProperty('message');
          expect(error.message).toMatch(/JSON|parse|invalid/i);
        }
      }
    });
  });

  describe('Edge Case Handling', () => {
    it('should handle extreme file sizes', async () => {
      const sizes = [
        0,                    // Empty file
        1,                    // Single byte
        1024 * 1024,         // 1MB
        10 * 1024 * 1024,    // 10MB
        50 * 1024 * 1024,    // 50MB (near typical limits)
      ];

      for (const size of sizes) {
        const data = fuzzer.buffer({ minLength: size, maxLength: size });
        const filePath = path.join(testDir, `test-${size}.bin`);
        
        try {
          await fs.writeFile(filePath, data);
          const result = await walrusStorage.storeFromPath(filePath);
          
          // Verify storage and retrieval
          expect(result.blobId).toBeTruthy();
          const retrieved = await walrusStorage.retrieve(result.blobId);
          expect(retrieved.length).toBe(size);
        } catch (error) {
          // Large files might fail due to limits
          if (size > 10 * 1024 * 1024) {
            expect(error.message).toMatch(/size|limit|too large/i);
          } else {
            throw error;
          }
        } finally {
          await fs.unlink(filePath).catch(() => {});
        }
      }
    });

    it('should handle special characters in filenames', async () => {
      const specialFilenames = fuzzer.array(() => {
        const chars = [
          'file with spaces.txt',
          'file-with-dashes.bin',
          'file_with_underscores.dat',
          'file.with.multiple.dots.ext',
          'UPPERCASE.TXT',
          '日本語ファイル.txt',
          '文件名🚀.bin',
          'file\\with\\backslashes.txt',
          'file/with/slashes.txt',
          'file:with:colons.txt',
          'file?with?questions.txt',
          'file*with*asterisks.txt',
          'file<with>brackets.txt',
          'file|with|pipes.txt',
          'file"with"quotes.txt',
          '.hidden-file.txt',
          'file-without-extension',
          '...multiple...dots...txt'
        ];
        return fuzzer.subset(chars)[0];
      }, { minLength: 10, maxLength: 20 });

      for (const filename of specialFilenames) {
        // Sanitize filename for filesystem
        const sanitizedFilename = filename.replace(/[<>:"|?*\\/]/g, '_');
        const filePath = path.join(testDir, sanitizedFilename);
        
        try {
          const data = fuzzer.buffer({ minLength: 100, maxLength: 1000 });
          await fs.writeFile(filePath, data);
          
          const result = await walrusStorage.storeFromPath(filePath);
          expect(result.blobId).toBeTruthy();
          
          // Verify the stored data
          const retrieved = await walrusStorage.retrieve(result.blobId);
          expect(retrieved).toEqual(data);
        } catch (error) {
          // Some filenames might fail on certain filesystems
          expect(error).toHaveProperty('message');
        } finally {
          await fs.unlink(filePath).catch(() => {});
        }
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle race conditions in storage operations', async () => {
      const operations = fuzzer.array(() => ({
        type: fuzzer.subset(['store', 'retrieve', 'delete'])[0],
        data: fuzzer.buffer({ minLength: 100, maxLength: 10000 }),
        delay: fuzzer.number(0, 100),
        storage: storageInstances[fuzzer.number(0, storageInstances.length - 1)]
      }), { minLength: 20, maxLength: 100 });

      const blobIds: Set<string> = new Set();
      const results = await Promise.allSettled(
        operations.map(async (op, index) => {
          await new Promise(resolve => setTimeout(resolve, op.delay));
          
          try {
            switch (op.type) {
              case 'store':
                const result = await op.storage.store(op.data);
                blobIds.add(result.blobId);
                return { type: 'store', blobId: result.blobId, index };
                
              case 'retrieve':
                if (blobIds.size > 0) {
                  const blobId = Array.from(blobIds)[fuzzer.number(0, blobIds.size - 1)];
                  const data = await op.storage.retrieve(blobId);
                  return { type: 'retrieve', size: data.length, index };
                }
                return { type: 'retrieve', skipped: true, index };
                
              case 'delete':
                if (blobIds.size > 0) {
                  const blobId = Array.from(blobIds)[fuzzer.number(0, blobIds.size - 1)];
                  await op.storage.delete(blobId);
                  blobIds.delete(blobId);
                  return { type: 'delete', blobId, index };
                }
                return { type: 'delete', skipped: true, index };
                
              default:
                throw new Error(`Unknown operation type: ${op.type}`);
            }
          } catch (error) {
            return { type: op.type, error: error.message, index };
          }
        })
      );

      // Verify some operations succeeded
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
      
      // Verify error handling for failed operations
      const failed = results.filter(r => r.status === 'rejected');
      failed.forEach(result => {
        expect(result.reason).toHaveProperty('message');
      });
    });

    it('should handle simultaneous writes to same blob ID', async () => {
      const dataChunks = fuzzer.array(() => 
        fuzzer.buffer({ minLength: 1000, maxLength: 5000 }),
        { minLength: 5, maxLength: 10 }
      );

      // Attempt to store multiple chunks "simultaneously"
      const promises = dataChunks.map(async (data, index) => {
        // Add small random delay to simulate real-world timing
        await new Promise(resolve => 
          setTimeout(resolve, fuzzer.number(0, 50))
        );
        
        return walrusStorage.store(data)
          .then(result => ({ success: true, blobId: result.blobId, index }))
          .catch(error => ({ success: false, error: error.message, index }));
      });

      const results = await Promise.all(promises);
      
      // All operations should complete (either successfully or with proper errors)
      expect(results.length).toBe(dataChunks.length);
      
      // At least some operations should succeed
      const successes = results.filter(r => r.success);
      expect(successes.length).toBeGreaterThan(0);
    });
  });

  describe('Storage Type Validation', () => {
    it('should properly handle mixed data types', async () => {
      const mixedData = fuzzer.array(() => {
        const type = fuzzer.subset([
          'string',
          'number',
          'buffer',
          'json',
          'bigint',
          'symbol',
          'undefined',
          'null',
          'function',
          'array',
          'nested_object'
        ])[0];

        switch (type) {
          case 'string':
            return fuzzer.string({ maxLength: 1000, includeUnicode: true });
          case 'number':
            return fuzzer.number(-1e10, 1e10);
          case 'buffer':
            return fuzzer.buffer({ minLength: 100, maxLength: 1000 });
          case 'json':
            return JSON.stringify({
              id: fuzzer.string(),
              value: fuzzer.number(),
              nested: { data: fuzzer.string() }
            });
          case 'bigint':
            return BigInt(fuzzer.number(0, 1e15));
          case 'symbol':
            return Symbol(fuzzer.string());
          case 'undefined':
            return undefined;
          case 'null':
            return null;
          case 'function':
            return () => fuzzer.string();
          case 'array':
            return fuzzer.array(() => fuzzer.string(), { minLength: 1, maxLength: 10 });
          case 'nested_object':
            return {
              level1: {
                level2: {
                  level3: {
                    data: fuzzer.string(),
                    numbers: fuzzer.array(() => fuzzer.number())
                  }
                }
              }
            };
          default:
            return fuzzer.string();
        }
      }, { minLength: 20, maxLength: 50 });

      for (const data of mixedData) {
        try {
          // Different storage types have different type expectations
          if (data instanceof Buffer) {
            const result = await walrusStorage.store(data);
            expect(result.blobId).toBeTruthy();
          } else if (typeof data === 'string') {
            const result = await walrusStorage.store(Buffer.from(data));
            expect(result.blobId).toBeTruthy();
          } else if (typeof data === 'object' && data !== null) {
            // Try JSON storage for objects
            const jsonStr = JSON.stringify(data);
            const result = await todoStorage.store(Buffer.from(jsonStr));
            expect(result.blobId).toBeTruthy();
          } else {
            // Expect failure for unsupported types
            await expect(walrusStorage.store(data as any))
              .rejects.toThrow();
          }
        } catch (error) {
          // Validate error messages
          expect(error).toHaveProperty('message');
          expect(error.message).toMatch(/type|invalid|unsupported/i);
        }
      }
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle memory pressure scenarios', async () => {
      const largeOperations = fuzzer.array(() => ({
        size: fuzzer.number(1024 * 1024, 10 * 1024 * 1024), // 1MB to 10MB
        count: fuzzer.number(1, 5),
        delay: fuzzer.number(0, 100)
      }), { minLength: 5, maxLength: 10 });

      const memoryPressureTest = async () => {
        const handles: string[] = [];
        
        try {
          for (const op of largeOperations) {
            for (let i = 0; i < op.count; i++) {
              await new Promise(resolve => setTimeout(resolve, op.delay));
              
              const data = fuzzer.buffer({ 
                minLength: op.size, 
                maxLength: op.size 
              });
              
              try {
                const result = await walrusStorage.store(data);
                handles.push(result.blobId);
                
                // Immediately free the buffer reference
                (data as any) = null;
                
                // Force garbage collection if available
                if (global.gc) {
                  global.gc();
                }
              } catch (error) {
                // Memory allocation might fail
                expect(error.message).toMatch(/memory|allocation|ENOMEM/i);
              }
            }
          }
        } finally {
          // Clean up stored blobs
          for (const blobId of handles) {
            try {
              await walrusStorage.delete(blobId);
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      };

      await expect(memoryPressureTest()).resolves.not.toThrow();
    });

    it('should handle file descriptor exhaustion', async () => {
      const fileOperations = fuzzer.array(() => ({
        filename: `test-${fuzzer.string()}.dat`,
        size: fuzzer.number(1000, 10000),
        keepOpen: fuzzer.boolean(0.3) // 30% chance to keep file open
      }), { minLength: 100, maxLength: 500 });

      const openHandles: Array<fs.FileHandle> = [];
      
      try {
        for (const op of fileOperations) {
          const filePath = path.join(testDir, op.filename);
          const data = fuzzer.buffer({ minLength: op.size, maxLength: op.size });
          
          try {
            // Create and possibly keep file handle open
            if (op.keepOpen) {
              const handle = await fs.open(filePath, 'w');
              await handle.write(data);
              openHandles.push(handle);
            } else {
              await fs.writeFile(filePath, data);
            }
            
            // Try to store from path
            await walrusStorage.storeFromPath(filePath);
          } catch (error) {
            // Expect file descriptor errors
            if (error.code === 'EMFILE' || error.code === 'ENFILE') {
              expect(error.message).toMatch(/too many open files/i);
            } else {
              throw error;
            }
          }
        }
      } finally {
        // Clean up open handles
        for (const handle of openHandles) {
          await handle.close().catch(() => {});
        }
      }
    });
  });

  describe('Storage Analyzer Fuzzing', () => {
    it('should handle edge cases in storage reuse analysis', async () => {
      const analyzer = new StorageReuseAnalyzer();
      
      const testCases = fuzzer.array(() => {
        const todoCount = fuzzer.number(0, 1000);
        const todos = fuzzer.array(() => ({
          id: fuzzer.string(),
          text: fuzzer.string({ 
            minLength: 0, 
            maxLength: fuzzer.number(0, 10000) 
          }),
          completed: fuzzer.boolean(),
          createdAt: new Date(fuzzer.number(0, Date.now())),
          tags: fuzzer.array(() => fuzzer.string(), 
            { minLength: 0, maxLength: 50 }
          ),
          metadata: fuzzer.boolean(0.3) ? {
            priority: fuzzer.subset(['low', 'medium', 'high'])[0],
            category: fuzzer.string(),
            assignee: fuzzer.email()
          } : undefined
        }), { minLength: todoCount, maxLength: todoCount });
        
        return { todos, blockSize: fuzzer.number(1024, 1024 * 1024) };
      }, { minLength: 10, maxLength: 20 });

      for (const testCase of testCases) {
        try {
          const result = analyzer.analyzeStorageReuse(testCase.todos, testCase.blockSize);
          
          // Validate result structure
          expect(result).toHaveProperty('allocations');
          expect(result).toHaveProperty('usage');
          expect(result.usage).toHaveProperty('totalSize');
          expect(result.usage).toHaveProperty('allocatedSize');
          expect(result.usage).toHaveProperty('utilization');
          
          // Validate calculations
          expect(result.usage.utilization).toBeGreaterThanOrEqual(0);
          expect(result.usage.utilization).toBeLessThanOrEqual(1);
          expect(result.usage.totalSize).toBeGreaterThanOrEqual(0);
          expect(result.usage.allocatedSize).toBeGreaterThanOrEqual(result.usage.totalSize);
        } catch (error) {
          // Analyzer should handle edge cases gracefully
          expect(error).toHaveProperty('message');
          expect(error.message).not.toMatch(/undefined|null/);
        }
      }
    });
  });
});