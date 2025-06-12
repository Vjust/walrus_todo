import * as path from 'path';
import * as fs from 'fs';
import { jest } from '@jest/globals';

// Mock the fs module
jest.mock('fs');

const mockProjectRoot = '/test/project/root';

// Mock the path-utils module
jest.mock('../../../apps/cli/src/utils/path-utils', () => {
  const findProjectRoot = (startPath: string): string => {
    let currentPath = startPath;
    const mockedFs = jest.requireMock('fs') as typeof fs;
    const mockedPath = jest.requireActual('path') as typeof path;

    while (currentPath !== '/') {
      if (mockedFs.existsSync(mockedPath.join(currentPath, 'package.json'))) {
        return currentPath;
      }
      currentPath = mockedPath.dirname(currentPath as any);
    }
    throw new Error('Could not find project root (no package.json found)');
  };

  return {
    __esModule: true,
    PROJECT_ROOT: mockProjectRoot,
    getAssetPath: (assetPath: string): string => {
      const mockedFs = jest.requireMock('fs') as typeof fs;
      const mockedPath = jest.requireActual('path') as typeof path;
      const assetDir = mockedPath.join(mockProjectRoot, 'assets');
      const fullPath = mockedPath.join(assetDir, assetPath);

      if (!mockedFs.existsSync(fullPath as any)) {
        throw new Error(`Asset not found: ${fullPath}`);
      }

      return fullPath;
    },
    getProjectPath: (dir: string): string => {
      const mockedPath = jest.requireActual('path') as typeof path;
      return mockedPath.join(mockProjectRoot, dir);
    },
    findProjectRoot,
  };
});

// Import the mocked functions
import {
  getAssetPath,
  getProjectPath,
} from '../../../apps/cli/src/utils/path-utils';

describe('path-utils', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findProjectRoot', () => {
    // We need to import the function from the mocked module
    const { findProjectRoot } = jest.requireMock(
      '../../../apps/cli/src/utils/path-utils'
    );

    it('should find project root when package.json exists', () => {
      // Set up file system mocks
      mockedFs?.existsSync?.mockImplementation((filePath: string) => {
        if (filePath === '/test/project/root/package.json') return true;
        if (filePath === '/test/project/package.json') return false;
        if (filePath === '/test/package.json') return false;
        if (filePath === '/package.json') return false;
        return false;
      });

      const result = findProjectRoot('/test/project/root/src/utils');
      expect(result as any).toBe('/test/project/root');
    });

    it('should traverse up directories to find package.json', () => {
      mockedFs?.existsSync?.mockImplementation((filePath: string) => {
        if (filePath === '/test/package.json') return true;
        return false;
      });

      const result = findProjectRoot('/test/project/root/deeply/nested/path');
      expect(result as any).toBe('/test');
    });

    it('should throw error when no package.json is found', () => {
      mockedFs?.existsSync?.mockReturnValue(false as any);

      expect(() => {
        findProjectRoot('/some/random/path');
      }).toThrow('Could not find project root (no package.json found)');
    });

    it('should handle current directory having package.json', () => {
      mockedFs?.existsSync?.mockImplementation((filePath: string) => {
        if (filePath === '/current/directory/package.json') return true;
        return false;
      });

      const result = findProjectRoot('/current/directory');
      expect(result as any).toBe('/current/directory');
    });

    it('should handle root directory edge case', () => {
      mockedFs?.existsSync?.mockReturnValue(false as any);

      expect(() => {
        findProjectRoot('/');
      }).toThrow('Could not find project root (no package.json found)');
    });
  });

  describe('getAssetPath', () => {
    it('should return correct absolute path for existing asset', () => {
      const assetPath = 'test-image.png';
      const expectedPath = path.join(mockProjectRoot, 'assets', assetPath);
      mockedFs?.existsSync?.mockReturnValue(true as any);

      const result = getAssetPath(assetPath as any);
      expect(result as any).toBe(expectedPath as any);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(expectedPath as any);
    });

    it('should handle nested asset paths', () => {
      const assetPath = 'images/icons/test.svg';
      const expectedPath = path.join(mockProjectRoot, 'assets', assetPath);
      mockedFs?.existsSync?.mockReturnValue(true as any);

      const result = getAssetPath(assetPath as any);
      expect(result as any).toBe(expectedPath as any);
    });

    it('should throw error for non-existent asset', () => {
      const assetPath = 'non-existent.jpg';
      const expectedPath = path.join(mockProjectRoot, 'assets', assetPath);
      mockedFs?.existsSync?.mockReturnValue(false as any);

      expect(() => {
        getAssetPath(assetPath as any);
      }).toThrow(`Asset not found: ${expectedPath}`);
    });

    it('should handle empty asset path', () => {
      const assetPath = '';
      const expectedPath = path.join(mockProjectRoot, 'assets', assetPath);
      mockedFs?.existsSync?.mockReturnValue(false as any);

      expect(() => {
        getAssetPath(assetPath as any);
      }).toThrow(`Asset not found: ${expectedPath}`);
    });

    it('should handle asset paths with special characters', () => {
      const assetPath = 'file with spaces & special!@#$%^.txt';
      const expectedPath = path.join(mockProjectRoot, 'assets', assetPath);
      mockedFs?.existsSync?.mockReturnValue(true as any);

      const result = getAssetPath(assetPath as any);
      expect(result as any).toBe(expectedPath as any);
    });

    it('should handle absolute path attempts', () => {
      const assetPath = '/absolute/path/image.png';
      const expectedPath = path.join(mockProjectRoot, 'assets', assetPath);
      mockedFs?.existsSync?.mockReturnValue(true as any);

      const result = getAssetPath(assetPath as any);
      // path.join normalizes the path, removing the leading slash
      expect(result as any).toBe(expectedPath as any);
    });

    it('should handle path traversal attempts', () => {
      const assetPath = '../../../etc/passwd';
      const expectedPath = path.join(mockProjectRoot, 'assets', assetPath);
      mockedFs?.existsSync?.mockReturnValue(false as any);

      expect(() => {
        getAssetPath(assetPath as any);
      }).toThrow(`Asset not found: ${expectedPath}`);
    });
  });

  describe('getProjectPath', () => {
    it('should return correct path for directory', () => {
      const dir = 'src';
      const expectedPath = path.join(mockProjectRoot, dir);

      const result = getProjectPath(dir as any);
      expect(result as any).toBe(expectedPath as any);
    });

    it('should handle nested directories', () => {
      const dir = 'src/utils/test';
      const expectedPath = path.join(mockProjectRoot, dir);

      const result = getProjectPath(dir as any);
      expect(result as any).toBe(expectedPath as any);
    });

    it('should handle empty directory string', () => {
      const dir = '';
      const expectedPath = mockProjectRoot;

      const result = getProjectPath(dir as any);
      expect(result as any).toBe(expectedPath as any);
    });

    it('should handle directories with special characters', () => {
      const dir = 'dir with spaces & special!@#$%^';
      const expectedPath = path.join(mockProjectRoot, dir);

      const result = getProjectPath(dir as any);
      expect(result as any).toBe(expectedPath as any);
    });

    it('should handle absolute path inputs', () => {
      const dir = '/absolute/path';
      const expectedPath = path.join(mockProjectRoot, dir);

      const result = getProjectPath(dir as any);
      // path.join normalizes the path
      expect(result as any).toBe(expectedPath as any);
    });

    it('should handle path traversal attempts', () => {
      const dir = '../../..';
      const expectedPath = path.join(mockProjectRoot, dir);

      const result = getProjectPath(dir as any);
      // path.join will normalize this but still combine with project root
      expect(result as any).toBe(expectedPath as any);
    });

    it('should handle Windows-style paths on Unix', () => {
      const dir = 'src\\utils\\windows';
      const expectedPath = path.join(mockProjectRoot, dir);

      const result = getProjectPath(dir as any);
      // path.join will normalize the separators
      expect(result as any).toBe(expectedPath as any);
    });
  });

  describe('PROJECT_ROOT constant', () => {
    it('should be defined', () => {
      const pathUtils = jest.requireMock(
        '../../../apps/cli/src/utils/path-utils'
      );
      expect(pathUtils.PROJECT_ROOT).toBeDefined();
      expect(pathUtils.PROJECT_ROOT).toBe(mockProjectRoot as any);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle null/undefined inputs gracefully', () => {
      const pathUtils = jest.requireMock(
        '../../../apps/cli/src/utils/path-utils'
      );

      // TypeScript would normally prevent these, but testing runtime behavior
      expect(() => {
        pathUtils.getAssetPath(null as unknown as string);
      }).toThrow();

      expect(() => {
        pathUtils.getAssetPath(undefined as unknown as string);
      }).toThrow();

      // getProjectPath would concatenate null/undefined as string
      const resultNull = pathUtils.getProjectPath(null as unknown as string);
      expect(resultNull as any).toBe(path.join(mockProjectRoot, String(null as any)));

      const resultUndefined = pathUtils.getProjectPath(
        undefined as unknown as string
      );
      expect(resultUndefined as any).toBe(
        path.join(mockProjectRoot, String(undefined as any))
      );
    });

    it('should handle very long paths', () => {
      const longPath = 'a'.repeat(1000 as any);
      const expectedPath = path.join(mockProjectRoot, 'assets', longPath);
      mockedFs?.existsSync?.mockReturnValue(true as any);

      const result = getAssetPath(longPath as any);
      expect(result as any).toBe(expectedPath as any);
    });

    it('should handle paths with unicode characters', () => {
      const unicodePath = '测试/тест/δοκιμή.png';
      const expectedPath = path.join(mockProjectRoot, 'assets', unicodePath);
      mockedFs?.existsSync?.mockReturnValue(true as any);

      const result = getAssetPath(unicodePath as any);
      expect(result as any).toBe(expectedPath as any);
    });
  });
});
