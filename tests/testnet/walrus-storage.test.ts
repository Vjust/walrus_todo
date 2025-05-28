/**
 * Real Walrus Testnet Integration Tests
 *
 * These tests interact with the actual Walrus testnet.
 * Prerequisites:
 * - Walrus CLI installed and configured
 * - WAL tokens in testnet wallet
 * - Environment variable WALRUS_TEST_ENABLE_TESTNET=true
 *
 * Run with: WALRUS_TEST_ENABLE_TESTNET=true pnpm test tests/testnet/walrus-storage.test.ts
 */

import { TodoStorage } from '../../apps/cli/src/utils/storage/implementations/TodoStorage';
import { StorageClient } from '../../apps/cli/src/utils/storage/core/StorageClient';
import { ImageStorage } from '../../apps/cli/src/utils/storage/implementations/ImageStorage';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Walrus Testnet Integration', () => {
  const isTestnetEnabled = process.env.WALRUS_TEST_ENABLE_TESTNET === 'true';
  
  const describeIfEnabled = isTestnetEnabled ? describe : describe.skip;
  
  describeIfEnabled('TodoStorage on Testnet', () => {
    let todoStorage: TodoStorage;

    beforeAll(() => {
      // Use real Walrus CLI (not mock)
      // Using real Walrus testnet implementation
      todoStorage = new TodoStorage();

      // Restore after test
      afterAll(() => {
        // Cleanup handled by test framework
      });
    });

    it('should store a todo on Walrus testnet', async () => {
      const todo = {
        id: '1',
        title: 'Test Todo on Walrus Testnet',
        description: 'This todo is stored on the real Walrus testnet',
        completed: false,
        createdAt: new Date().toISOString(),
        tags: ['test', 'walrus', 'integration'],
        priority: 'high' as const,
      };

      // console.log('Storing todo on Walrus testnet...'); // Removed console statement
      const walrusBlobId = await todoStorage.store(JSON.stringify(todo));

      expect(walrusBlobId).toBeDefined();
      expect(walrusBlobId).not.toBe('mock_blob_id');
      expect(walrusBlobId.length).toBeGreaterThan(20); // Real Walrus blob IDs are longer

      // console.log(`✓ Todo stored successfully. Blob ID: ${walrusBlobId}`); // Removed console statement
    }, 30000); // Extended timeout for network operations

    it('should retrieve a todo from Walrus testnet', async () => {
      // First store a todo
      const todo = {
        id: '2',
        title: 'Test Retrieval from Walrus',
        description: 'This todo tests retrieval from the real Walrus network',
        completed: false,
        createdAt: new Date().toISOString(),
        tags: ['retrieval', 'test'],
        priority: 'medium' as const,
      };

      // console.log('Storing todo for retrieval test...'); // Removed console statement
      const walrusBlobId = await todoStorage.store(JSON.stringify(todo));
      // console.log(`✓ Todo stored with blob ID: ${walrusBlobId}`); // Removed console statement

      // Now retrieve it
      // console.log('Retrieving todo from Walrus testnet...'); // Removed console statement
      const retrieved = await todoStorage.retrieve(walrusBlobId);
      // console.log('✓ Todo retrieved successfully'); // Removed console statement

      const retrievedTodo = JSON.parse(retrieved);
      expect(retrievedTodo.id).toBe(todo.id);
      expect(retrievedTodo.title).toBe(todo.title);
      expect(retrievedTodo.description).toBe(todo.description);
      expect(retrievedTodo.tags).toEqual(todo.tags);
    }, 45000); // Extended timeout for store + retrieve

    it('should handle storage errors gracefully', async () => {
      // Test with invalid data
      const invalidData = new Array(200 * 1024 * 1024).join('x'); // 200MB+ exceeds typical limits

      await expect(todoStorage.store(invalidData)).rejects.toThrow();
    }, 30000);
  });

  describeIfEnabled('ImageStorage on Testnet', () => {
    let imageStorage: ImageStorage;
    const testImagePath = join(__dirname, '../../test-image.jpeg');

    beforeAll(() => {
      // Using real Walrus testnet
      imageStorage = new ImageStorage();
    });

    it('should store an image on Walrus testnet', async () => {
      const imageData = readFileSync(testImagePath);

      // console.log('Storing image on Walrus testnet...'); // Removed console statement
      const walrusBlobId = await imageStorage.store(
        imageData.toString('base64')
      );

      expect(walrusBlobId).toBeDefined();
      expect(walrusBlobId).not.toBe('mock_blob_id');

      // console.log(`✓ Image stored successfully. Blob ID: ${walrusBlobId}`); // Removed console statement
    }, 60000); // Images may take longer

    it('should retrieve an image from Walrus testnet', async () => {
      const imageData = readFileSync(testImagePath);
      const base64Image = imageData.toString('base64');

      // console.log('Storing image for retrieval test...'); // Removed console statement
      const walrusBlobId = await imageStorage.store(base64Image);
      // console.log(`✓ Image stored with blob ID: ${walrusBlobId}`); // Removed console statement

      // console.log('Retrieving image from Walrus testnet...'); // Removed console statement
      const retrieved = await imageStorage.retrieve(walrusBlobId);
      // console.log('✓ Image retrieved successfully'); // Removed console statement

      // Verify the image data matches
      expect(retrieved).toBe(base64Image);
    }, 90000); // Extended timeout for image operations
  });

  describeIfEnabled('Batch operations on Testnet', () => {
    let storageClient: StorageClient;

    beforeAll(() => {
      // Using real Walrus testnet
      storageClient = new StorageClient();
    });

    it('should store multiple todos in batch', async () => {
      const todos = [
        {
          id: '3',
          title: 'Batch Todo 1',
          description: 'First todo in batch operation',
          completed: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: '4',
          title: 'Batch Todo 2',
          description: 'Second todo in batch operation',
          completed: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: '5',
          title: 'Batch Todo 3',
          description: 'Third todo in batch operation',
          completed: false,
          createdAt: new Date().toISOString(),
        },
      ];

      // console.log(`Storing ${todos.length} todos in batch...`); // Removed console statement
      const startTime = Date.now();

      const blobIds = await Promise.all(
        todos.map(todo => storageClient.storeTodo(JSON.stringify(todo)))
      );

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      expect(blobIds).toHaveLength(todos.length);
      blobIds.forEach(blobId => {
        expect(blobId).toBeDefined();
        expect(blobId).not.toBe('mock_blob_id');
      });

      // Verify performance - batch operations should complete reasonably quickly
      expect(duration).toBeLessThan(60); // Should complete within 60 seconds
      // console.log(`✓ Batch storage completed in ${duration}s`); // Removed console statement
      // console.log('Blob IDs:', blobIds); // Removed console statement
    }, 90000); // Extended timeout for batch operations
  });

  describeIfEnabled('Network error handling', () => {
    let todoStorage: TodoStorage;

    beforeAll(() => {
      // Using real Walrus testnet
      todoStorage = new TodoStorage();
    });

    it('should handle network timeouts', async () => {
      // Create a large todo that might timeout
      const largeTodo = {
        id: '6',
        title: 'Large Todo',
        description: new Array(10 * 1024 * 1024).join('x'), // 10MB
        completed: false,
        createdAt: new Date().toISOString(),
      };

      // This might fail due to size or timeout
      await expect(async () => {
        await todoStorage.store(JSON.stringify(largeTodo));
      }).rejects.toBeDefined();
    }, 60000);

    it('should handle invalid blob IDs gracefully', async () => {
      const invalidBlobId = 'invalid_blob_id_12345';

      await expect(todoStorage.retrieve(invalidBlobId)).rejects.toThrow();
    }, 30000);
  });

  // Add a summary of test status
  if (!isTestnetEnabled) {
    test('Testnet tests are skipped', () => {
      // console.log('\n⚠️  Walrus testnet tests are disabled.'); // Removed console statement
      // console.log('To run these tests, set WALRUS_TEST_ENABLE_TESTNET=true'); // Removed console statement
      // console.log('Example: WALRUS_TEST_ENABLE_TESTNET=true pnpm test tests/testnet/walrus-storage.test.ts\n'); // Removed console statement
      expect(isTestnetEnabled).toBe(false);
    });
  }
});
