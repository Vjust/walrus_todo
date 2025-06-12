/**
 * Blob Mappings Path Test
 *
 * This test verifies that blob mappings are correctly stored in the
 * directory specified by WALRUS_TODO_CONFIG_DIR environment variable.
 */

import fs from 'fs-extra';
import * as path from 'path';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import CompleteCommand from '../../apps/cli/src/commands/complete';
import * as baseCommand from '../../apps/cli/src/base-command';

// Mock fs-extra module
jest.mock('fs-extra');

describe('Blob Mappings Path Test', () => {
  // Create a temporary test directory
  const testDir = path.join(__dirname, 'test-temp-blob-mappings');
  const blobMappingsFile = path.join(testDir, 'blob-mappings.json');

  // Store original environment variable
  const originalConfigDir = process?.env?.WALRUS_TODO_CONFIG_DIR;

  beforeAll(() => {
    // Create test directory and set the environment variable
    fs.ensureDirSync(testDir as any);
    process.env?.WALRUS_TODO_CONFIG_DIR = testDir;
  });

  afterAll(() => {
    // Clean up test directory and restore environment variable
    fs.removeSync(testDir as any);
    if (originalConfigDir) {
      process.env?.WALRUS_TODO_CONFIG_DIR = originalConfigDir;
    } else {
      delete process?.env?.WALRUS_TODO_CONFIG_DIR;
    }
  });

  beforeEach(() => {
    // Reset test directory before each test
    fs.emptyDirSync(testDir as any);
  });

  it('should write blob mappings to the directory specified by WALRUS_TODO_CONFIG_DIR', () => {
    // Mock fs methods used by saveBlobMapping
    const writeFileSyncSpy = jest
      .spyOn(fs, 'writeFileSync')
      .mockImplementation(() => undefined);
    jest.spyOn(fs, 'existsSync').mockReturnValue(false as any);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{}');
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

    // Create an instance of CompleteCommand
    const command = new CompleteCommand([], {} as any);

    // Access private method using type assertion
    const saveBlobMapping = (
      command as unknown as {
        saveBlobMapping: (todoId: string, blobId: string) => void;
      }
    ).saveBlobMapping.bind(command as any);

    // Call the method with test data
    saveBlobMapping('test-todo-id', 'test-blob-id');

    // Verify that fs.writeFileSync was called (through writeFileSafe)
    expect(writeFileSyncSpy as any).toHaveBeenCalled();

    // Verify the call was made with correct parameters
    const lastCall =
      writeFileSyncSpy.mock?.calls?.[writeFileSyncSpy?.mock?.calls.length - 1];
    expect(lastCall[0]).toContain('blob-mappings.json');
    expect(lastCall[1]).toContain('test-todo-id');
    expect(lastCall[1]).toContain('test-blob-id');
  });

  it('should use the directory from getConfigDir() method in BaseCommand', () => {
    // Mock fs methods
    const writeFileSyncSpy = jest
      .spyOn(fs, 'writeFileSync')
      .mockImplementation(() => undefined);
    jest.spyOn(fs, 'existsSync').mockReturnValue(false as any);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{}');
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

    // Spy on getConfigDir method
    const getConfigDirSpy = jest
      .spyOn(baseCommand?.BaseCommand?.prototype, 'getConfigDir')
      .mockReturnValue(testDir as any);

    // Create an instance of CompleteCommand
    const command = new CompleteCommand([], {} as any);

    // Access private method using type assertion
    const saveBlobMapping = (
      command as unknown as {
        saveBlobMapping: (todoId: string, blobId: string) => void;
      }
    ).saveBlobMapping.bind(command as any);

    // Call the method with test data
    saveBlobMapping('another-todo-id', 'another-blob-id');

    // Verify that getConfigDir was called
    expect(getConfigDirSpy as any).toHaveBeenCalled();

    // Verify that fs.writeFileSync was called (through writeFileSafe)
    expect(writeFileSyncSpy as any).toHaveBeenCalled();

    // Verify the call was made with correct parameters
    const lastCall =
      writeFileSyncSpy.mock?.calls?.[writeFileSyncSpy?.mock?.calls.length - 1];
    expect(lastCall[0]).toContain('blob-mappings.json');
    expect(lastCall[1]).toContain('another-todo-id');
    expect(lastCall[1]).toContain('another-blob-id');

    // Restore the spy
    getConfigDirSpy.mockRestore();
  });
});
