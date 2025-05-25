/**
 * Blob Mappings Path Test
 *
 * This test verifies that blob mappings are correctly stored in the
 * directory specified by WALRUS_TODO_CONFIG_DIR environment variable.
 */

import fs from 'fs-extra';
import path from 'path';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import CompleteCommand from '../../src/commands/complete';
import * as baseCommand from '../../src/base-command';

describe('Blob Mappings Path Test', () => {
  // Create a temporary test directory
  const testDir = path.join(__dirname, 'test-temp-blob-mappings');
  const blobMappingsFile = path.join(testDir, 'blob-mappings.json');

  // Store original environment variable
  const originalConfigDir = process.env.WALRUS_TODO_CONFIG_DIR;

  beforeAll(() => {
    // Create test directory and set the environment variable
    fs.ensureDirSync(testDir);
    process.env.WALRUS_TODO_CONFIG_DIR = testDir;
  });

  afterAll(() => {
    // Clean up test directory and restore environment variable
    fs.removeSync(testDir);
    if (originalConfigDir) {
      process.env.WALRUS_TODO_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.WALRUS_TODO_CONFIG_DIR;
    }
  });

  beforeEach(() => {
    // Reset test directory before each test
    fs.emptyDirSync(testDir);
  });

  it('should write blob mappings to the directory specified by WALRUS_TODO_CONFIG_DIR', () => {
    // Create an instance of CompleteCommand
    const command = new CompleteCommand([], {} as any);

    // Access private method using type assertion
    const saveBlobMapping = (command as any).saveBlobMapping.bind(command);

    // Call the method with test data
    saveBlobMapping('test-todo-id', 'test-blob-id');

    // Verify that the blob mappings file exists in the specified directory
    expect(fs.existsSync(blobMappingsFile)).toBe(true);

    // Verify the content of the blob mappings file
    const mappings = fs.readJsonSync(blobMappingsFile);
    expect(mappings).toHaveProperty('test-todo-id', 'test-blob-id');
  });

  it('should use the directory from getConfigDir() method in BaseCommand', () => {
    // Spy on getConfigDir method
    const getConfigDirSpy = jest.spyOn(
      baseCommand.BaseCommand.prototype,
      'getConfigDir'
    );

    // Create an instance of CompleteCommand
    const command = new CompleteCommand([], {} as any);

    // Access private method using type assertion
    const saveBlobMapping = (command as any).saveBlobMapping.bind(command);

    // Call the method with test data
    saveBlobMapping('another-todo-id', 'another-blob-id');

    // Verify that getConfigDir was called
    expect(getConfigDirSpy).toHaveBeenCalled();

    // Verify that the blob mappings file exists
    expect(fs.existsSync(blobMappingsFile)).toBe(true);

    // Verify the content of the blob mappings file
    const mappings = fs.readJsonSync(blobMappingsFile);
    expect(mappings).toHaveProperty('another-todo-id', 'another-blob-id');

    // Restore the spy
    getConfigDirSpy.mockRestore();
  });
});
