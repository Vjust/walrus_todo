import { cleanupTestFiles, cleanupTestTodos, cleanupNetworkTestData } from './cleanup';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../src/utils/Logger';

/**
 * Tests for the cleanup utility
 */

// Mock the Logger to avoid console output during tests
jest.mock('../../src/utils/Logger', () => {
  return {
    Logger: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }))
  };
});

describe('Cleanup Utility', () => {
  const testDir = path.join(__dirname, 'test-temp');
  
  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  describe('cleanupTestFiles', () => {
    it('should remove test files in dry run mode', async () => {
      // Create test files
      const testFile1 = path.join(testDir, 'test-todo-123.json');
      const testFile2 = path.join(testDir, 'test-image.png');
      await fs.writeFile(testFile1, JSON.stringify({ id: 'test-123' }));
      await fs.writeFile(testFile2, 'fake image data');
      
      // Run cleanup in dry run mode
      await cleanupTestFiles({
        paths: [testFile1, testFile2],
        dryRun: true
      });
      
      // Verify files still exist (dry run)
      expect(await fs.access(testFile1).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(testFile2).then(() => true).catch(() => false)).toBe(true);
    });
    
    it('should remove test files in actual mode', async () => {
      // Create test files
      const testFile1 = path.join(testDir, 'test-todo-456.json');
      const testFile2 = path.join(testDir, 'mock-data.json');
      await fs.writeFile(testFile1, JSON.stringify({ id: 'test-456' }));
      await fs.writeFile(testFile2, 'mock data');
      
      // Run actual cleanup
      await cleanupTestFiles({
        paths: [testFile1, testFile2],
        dryRun: false
      });
      
      // Verify files are removed
      expect(await fs.access(testFile1).then(() => true).catch(() => false)).toBe(false);
      expect(await fs.access(testFile2).then(() => true).catch(() => false)).toBe(false);
    });
    
    it('should handle non-existent files gracefully', async () => {
      // Try to clean up non-existent files
      await expect(cleanupTestFiles({
        paths: ['non-existent-file.json'],
        dryRun: false
      })).resolves.not.toThrow();
    });
  });
  
  describe('cleanupTestTodos', () => {
    it('should filter out test todos from storage', async () => {
      const mockTodos = [
        { id: 'test-todo-1', title: 'Test Todo 1' },
        { id: 'real-todo-1', title: 'Real Todo 1' },
        { id: 'test-batch-2', title: 'Test Batch 2' },
        { id: 'real-todo-2', title: 'Real Todo 2' }
      ];
      
      // Create temporary todos file
      const todosFile = path.join(testDir, 'todos.json');
      await fs.writeFile(todosFile, JSON.stringify(mockTodos));
      
      // Mock the storage directory
      const originalHome = process.env.HOME;
      process.env.HOME = testDir;
      
      // Create storage directory structure
      const storageDir = path.join(testDir, '.walrus-todos');
      await fs.mkdir(storageDir, { recursive: true });
      await fs.writeFile(path.join(storageDir, 'todos.json'), JSON.stringify(mockTodos));
      
      // Run cleanup
      await cleanupTestTodos(['test-todo-*', 'test-batch-*']);
      
      // Read filtered todos
      const filteredData = await fs.readFile(path.join(storageDir, 'todos.json'), 'utf-8');
      const filteredTodos = JSON.parse(filteredData);
      
      // Verify only real todos remain
      expect(filteredTodos).toHaveLength(2);
      expect(filteredTodos[0].id).toBe('real-todo-1');
      expect(filteredTodos[1].id).toBe('real-todo-2');
      
      // Restore original HOME
      process.env.HOME = originalHome;
    });
  });
  
  describe('cleanupNetworkTestData', () => {
    it('should attempt to clean up network data', async () => {
      // This test just verifies the function runs without errors
      // In a real test, we'd mock the Walrus and Sui interactions
      await expect(cleanupNetworkTestData()).resolves.not.toThrow();
    });
  });
  
  describe('Integration with test suite', () => {
    it('should be callable from test hooks', async () => {
      // Example of how to use in afterAll hook
      const cleanup = async () => {
        await cleanupTestFiles({
          dryRun: false,
          cleanNetwork: false
        });
      };
      
      await expect(cleanup()).resolves.not.toThrow();
    });
  });
});

/**
 * Example usage in actual test files:
 * 
 * afterAll(async () => {
 *   // Clean up test data after all tests complete
 *   await cleanupTestFiles({
 *     cleanNetwork: process.env.CLEANUP_NETWORK === 'true'
 *   });
 * });
 */