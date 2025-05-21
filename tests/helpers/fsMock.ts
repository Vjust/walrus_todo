/**
 * Centralized Filesystem Mocking Helper
 * 
 * This module provides a consistent filesystem mocking infrastructure for all tests.
 * It ensures that all tests use the same mocked filesystem methods and provides
 * utilities for asserting filesystem operations.
 */

import * as fs from 'fs';

export interface MockedFs {
  readFileSync: jest.MockedFunction<typeof fs.readFileSync>;
  writeFileSync: jest.MockedFunction<typeof fs.writeFileSync>;
  existsSync: jest.MockedFunction<typeof fs.existsSync>;
  mkdirSync: jest.MockedFunction<typeof fs.mkdirSync>;
  unlinkSync: jest.MockedFunction<typeof fs.unlinkSync>;
  rmdirSync: jest.MockedFunction<typeof fs.rmdirSync>;
  readdirSync: jest.MockedFunction<typeof fs.readdirSync>;
}

export interface MockedFsPromises {
  readFile: jest.MockedFunction<any>;
  writeFile: jest.MockedFunction<any>;
  mkdir: jest.MockedFunction<any>;
  unlink: jest.MockedFunction<any>;
  rmdir: jest.MockedFunction<any>;
  readdir: jest.MockedFunction<any>;
  access: jest.MockedFunction<any>;
  stat: jest.MockedFunction<any>;
}

// Global mock instances that all tests can use
export const mockedFs: MockedFs = {
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
  readdirSync: jest.fn()
};

export const mockedFsPromises: MockedFsPromises = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  rmdir: jest.fn(),
  readdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn()
};

/**
 * Setup filesystem mocks with default behaviors
 */
export function setupFsMocks(): MockedFs {
  // Reset all mocks
  Object.values(mockedFs).forEach(mock => mock.mockReset());
  Object.values(mockedFsPromises).forEach(mock => mock.mockReset());

  // Setup default behaviors
  mockedFs.existsSync.mockReturnValue(true);
  mockedFs.readFileSync.mockReturnValue('{}');
  mockedFs.readdirSync.mockReturnValue([]);
  
  // Setup fs.promises defaults
  mockedFsPromises.readFile.mockResolvedValue('{}');
  mockedFsPromises.writeFile.mockResolvedValue(undefined);
  mockedFsPromises.mkdir.mockResolvedValue(undefined);
  mockedFsPromises.unlink.mockResolvedValue(undefined);
  mockedFsPromises.rmdir.mockResolvedValue(undefined);
  mockedFsPromises.readdir.mockResolvedValue([]);
  mockedFsPromises.access.mockResolvedValue(undefined);
  mockedFsPromises.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });

  return mockedFs;
}

/**
 * Create a mock filesystem with specific file contents
 */
export function createMockFileSystem(files: Record<string, string>): MockedFs {
  setupFsMocks();

  // Mock file existence
  mockedFs.existsSync.mockImplementation((path: string) => {
    return Object.keys(files).includes(path.toString());
  });

  // Mock file reading
  mockedFs.readFileSync.mockImplementation((path: string) => {
    const filePath = path.toString();
    if (filePath in files) {
      return files[filePath];
    }
    throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
  });

  // Mock fs.promises.readFile
  mockedFsPromises.readFile.mockImplementation(async (path: string) => {
    const filePath = path.toString();
    if (filePath in files) {
      return files[filePath];
    }
    throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
  });

  return mockedFs;
}

/**
 * Assert that a file was written with specific content
 */
export function assertFileWritten(expectedPath: string, expectedContent?: string): void {
  expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
    expectedPath,
    expectedContent ? expectedContent : expect.any(String),
    expect.any(Object)
  );
}

/**
 * Assert that fs.promises.writeFile was called with specific content  
 */
export function assertFileWrittenAsync(expectedPath: string, expectedContent?: string): void {
  expect(mockedFsPromises.writeFile).toHaveBeenCalledWith(
    expectedPath,
    expectedContent ? expectedContent : expect.any(String),
    expect.any(Object)
  );
}

/**
 * Assert that a directory was created
 */
export function assertDirectoryCreated(expectedPath: string): void {
  expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
    expectedPath,
    expect.objectContaining({ recursive: true })
  );
}

/**
 * Assert that fs.promises.mkdir was called
 */
export function assertDirectoryCreatedAsync(expectedPath: string): void {
  expect(mockedFsPromises.mkdir).toHaveBeenCalledWith(
    expectedPath,
    expect.objectContaining({ recursive: true })
  );
}

/**
 * Get the number of times writeFileSync was called
 */
export function getWriteFileCallCount(): number {
  return mockedFs.writeFileSync.mock.calls.length;
}

/**
 * Get the number of times fs.promises.writeFile was called
 */
export function getWriteFileAsyncCallCount(): number {
  return mockedFsPromises.writeFile.mock.calls.length;
}

/**
 * Get all paths that were written to
 */
export function getWrittenPaths(): string[] {
  return mockedFs.writeFileSync.mock.calls.map(call => call[0] as string);
}

/**
 * Get all paths that were written to via fs.promises
 */
export function getWrittenPathsAsync(): string[] {
  return mockedFsPromises.writeFile.mock.calls.map(call => call[0] as string);
}

/**
 * Reset all filesystem mocks
 */
export function resetFsMocks(): void {
  Object.values(mockedFs).forEach(mock => mock.mockReset());
  Object.values(mockedFsPromises).forEach(mock => mock.mockReset());
}

/**
 * Mock the fs module globally for consistent behavior across tests
 */
export function mockFsModule(): void {
  jest.mock('fs', () => ({
    readFileSync: mockedFs.readFileSync,
    writeFileSync: mockedFs.writeFileSync,
    existsSync: mockedFs.existsSync,
    mkdirSync: mockedFs.mkdirSync,
    unlinkSync: mockedFs.unlinkSync,
    rmdirSync: mockedFs.rmdirSync,
    readdirSync: mockedFs.readdirSync,
    promises: {
      readFile: mockedFsPromises.readFile,
      writeFile: mockedFsPromises.writeFile,
      mkdir: mockedFsPromises.mkdir,
      unlink: mockedFsPromises.unlink,
      rmdir: mockedFsPromises.rmdir,
      readdir: mockedFsPromises.readdir,
      access: mockedFsPromises.access,
      stat: mockedFsPromises.stat
    }
  }));
}

/**
 * Setup complete fs mocking for a test suite
 */
export function setupTestSuiteFsMocks(): MockedFs {
  mockFsModule();
  return setupFsMocks();
}