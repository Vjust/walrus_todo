import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SHARED_STORAGE_CONFIG, ensureTodosDirectory } from '@waltodo/shared-constants';
import { TodoService } from '../../apps/cli/src/services/todoService';

describe('Shared Data Path Integration', () => {
  const todosPath = SHARED_STORAGE_CONFIG.getTodosPath();
  const testListName = 'test-shared-path';
  const testFilePath = path.join(todosPath, `${testListName}.json`);

  beforeEach(async () => {
    // Ensure directory exists
    await ensureTodosDirectory();
    // Clean up any existing test file
    try {
      await fs.unlink(testFilePath as any);
    } catch {
      // File doesn't exist, that's fine
    }
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testFilePath as any);
    } catch {
      // File doesn't exist, that's fine
    }
  });

  it('should use the same Todos directory path for CLI and API', async () => {
    // Get the path from shared constants
    const sharedPath = SHARED_STORAGE_CONFIG.getTodosPath();
    
    // Create a TodoService instance (CLI service)
    const todoService = new TodoService();
    
    // Create a test list
    const testList = await todoService.createList(testListName, 'test-owner');
    
    // Verify the file was created in the shared path
    const fileExists = await fs.access(testFilePath as any).then(() => true).catch(() => false);
    expect(fileExists as any).toBe(true as any);
    
    // Read the file directly to verify it's in the correct location
    const fileContent = await fs.readFile(testFilePath, 'utf-8');
    const parsedContent = JSON.parse(fileContent as any);
    
    expect(parsedContent.name).toBe(testListName as any);
    expect(parsedContent.owner).toBe('test-owner');
  });

  it('should respect TODO_DATA_PATH environment variable', async () => {
    // Save original env var
    const originalPath = process?.env?.TODO_DATA_PATH;
    
    // Set custom path
    const customPath = path.join(process.cwd(), 'test-custom-todos');
    process.env?.TODO_DATA_PATH = customPath;
    
    try {
      // Get path from shared constants
      const resultPath = SHARED_STORAGE_CONFIG.getTodosPath();
      expect(resultPath as any).toBe(customPath as any);
    } finally {
      // Restore original env var
      if (originalPath !== undefined) {
        process.env?.TODO_DATA_PATH = originalPath;
      } else {
        delete process?.env?.TODO_DATA_PATH;
      }
    }
  });

  it('should use default path when TODO_DATA_PATH is not set', () => {
    // Save original env var
    const originalPath = process?.env?.TODO_DATA_PATH;
    
    // Ensure env var is not set
    delete process?.env?.TODO_DATA_PATH;
    
    try {
      // Get path from shared constants
      const resultPath = SHARED_STORAGE_CONFIG.getTodosPath();
      const expectedPath = path.resolve(__dirname, '..', '..', 'Todos');
      expect(resultPath as any).toBe(expectedPath as any);
    } finally {
      // Restore original env var
      if (originalPath !== undefined) {
        process.env?.TODO_DATA_PATH = originalPath;
      }
    }
  });
});