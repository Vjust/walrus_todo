/**
 * Path Validator
 *
 * Utility for validating file paths to prevent path traversal and other file-related
 * vulnerabilities. This extends the base input validation with file-specific checks.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PathValidationError } from '../types/errors/PathValidationError';

/**
 * Safe operation types for path validation
 */
export enum SafePathOperation {
  READ = 'read',
  WRITE = 'write',
  APPEND = 'append',
  DELETE = 'delete',
  CREATE_DIR = 'create_directory',
}

/**
 * Configuration for path validation
 */
export interface PathValidationConfig {
  /**
   * Base directories that are allowed for file operations
   */
  allowedDirectories: string[];

  /**
   * Whether to allow absolute paths outside of allowed directories if explicitly approved
   */
  allowExplicitAbsolutePaths: boolean;

  /**
   * File extensions that are allowed for specific operations
   */
  allowedExtensions: {
    [SafePathOperation.READ]?: string[];
    [SafePathOperation.WRITE]?: string[];
    [SafePathOperation.APPEND]?: string[];
  };

  /**
   * Maximum allowed file size for reading (in bytes)
   */
  maxReadSize: number;

  /**
   * Maximum allowed file size for writing (in bytes)
   */
  maxWriteSize: number;
}

/**
 * Default configuration for path validation
 */
const DEFAULT_PATH_VALIDATION_CONFIG: PathValidationConfig = {
  allowedDirectories: [
    process.cwd(),
    os.tmpdir(),
    path.resolve(os.homedir(), '.sui'),
    path.resolve(os.homedir(), '.walrus'),
    path.resolve(os.homedir(), '.waltodo'),
  ],
  allowExplicitAbsolutePaths: false,
  allowedExtensions: {
    [SafePathOperation.READ]: [
      '.json',
      '.ts',
      '.js',
      '.toml',
      '.md',
      '.txt',
      '.log',
      '.move',
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
    ],
    [SafePathOperation.WRITE]: ['.json', '.toml', '.txt', '.log', '.md'],
    [SafePathOperation.APPEND]: ['.log', '.txt', '.md'],
  },
  maxReadSize: 10 * 1024 * 1024, // 10 MB
  maxWriteSize: 5 * 1024 * 1024, // 5 MB
};

/**
 * Current configuration for path validation
 */
let currentConfig: PathValidationConfig = { ...DEFAULT_PATH_VALIDATION_CONFIG };

/**
 * Configure path validation
 * @param config Configuration for path validation
 */
export function configurePathValidation(
  config: Partial<PathValidationConfig>
): void {
  currentConfig = {
    ...currentConfig,
    ...config,
    // Merge nested objects
    allowedExtensions: {
      ...currentConfig.allowedExtensions,
      ...config.allowedExtensions,
    },
  };
}

/**
 * Reset path validation configuration to defaults
 */
export function resetPathValidationConfig(): void {
  currentConfig = { ...DEFAULT_PATH_VALIDATION_CONFIG };
}

/**
 * Validates a file path to prevent path traversal and ensure secure file operations
 * @param inputPath The file path to validate
 * @param operation The operation to be performed on the file
 * @param options Additional validation options
 * @returns The normalized absolute path if validation passes
 * @throws PathValidationError if validation fails
 */
export function validatePath(
  inputPath: string,
  operation: SafePathOperation,
  options: {
    mustExist?: boolean;
    allowAbsolutePath?: boolean;
    checkExtension?: boolean;
    checkSize?: boolean;
  } = {}
): string {
  // Check for null or empty path
  if (!inputPath) {
    throw new PathValidationError('File path cannot be empty', { operation });
  }

  // Check for shell metacharacters
  if (/[;&|<>$`\\!]/.test(inputPath)) {
    throw new PathValidationError('File path contains invalid characters', {
      path: inputPath,
      operation,
    });
  }

  // Normalize and resolve the path
  const resolvedPath = path.resolve(inputPath);

  // Prevent path traversal by ensuring the path is within allowed directories
  const isWithinAllowedDirectories = currentConfig?.allowedDirectories?.some(
    dir => {
      const normalizedDir = path.normalize(dir);
      return resolvedPath.startsWith(normalizedDir);
    }
  );

  // Check if the path is allowed
  if (
    !isWithinAllowedDirectories &&
    !(options.allowAbsolutePath && currentConfig.allowExplicitAbsolutePaths)
  ) {
    throw new PathValidationError(
      `File path must be within allowed directories: ${currentConfig?.allowedDirectories?.join(', ')}`,
      { path: inputPath, operation }
    );
  }

  // Check if the path exists if required
  if (options.mustExist && !fs.existsSync(resolvedPath)) {
    throw new PathValidationError(`File does not exist: ${resolvedPath}`, {
      path: inputPath,
      operation,
    });
  }

  // For operations that need to check the file extension
  if (options.checkExtension && operation in currentConfig.allowedExtensions) {
    const ext = path.extname(resolvedPath).toLowerCase();
    const allowedExts = currentConfig?.allowedExtensions?.[operation];

    if (allowedExts && !allowedExts.includes(ext)) {
      throw new PathValidationError(
        `File extension "${ext}" not allowed for ${operation} operation. Allowed extensions: ${allowedExts.join(', ')}`,
        { path: inputPath, operation }
      );
    }
  }

  // Check file size for read operations if the file exists
  if (
    options.checkSize &&
    operation === SafePathOperation.READ &&
    fs.existsSync(resolvedPath)
  ) {
    const stats = fs.statSync(resolvedPath);

    if (stats.isFile() && stats.size > currentConfig.maxReadSize) {
      throw new PathValidationError(
        `File size exceeds maximum allowed size for reading (${currentConfig.maxReadSize} bytes)`,
        { path: inputPath, operation }
      );
    }
  }

  return resolvedPath;
}

/**
 * Safely read a file with path validation
 * @param filePath The file path to read
 * @param options File reading options
 * @returns The file contents
 * @throws PathValidationError if validation fails
 */
export function safeReadFile(
  filePath: string,
  options: {
    encoding?: BufferEncoding;
    flag?: string;
    allowAbsolutePath?: boolean;
  } = {}
): string | Buffer {
  const validatedPath = validatePath(filePath, SafePathOperation.READ, {
    mustExist: true,
    allowAbsolutePath: options.allowAbsolutePath,
    checkExtension: true,
    checkSize: true,
  });

  return fs.readFileSync(validatedPath, {
    encoding: options.encoding,
    flag: options.flag,
  });
}

/**
 * Safely write to a file with path validation
 * @param filePath The file path to write to
 * @param data The data to write
 * @param options File writing options
 * @throws PathValidationError if validation fails
 */
export function safeWriteFile(
  filePath: string,
  data: string | Buffer,
  options: {
    encoding?: BufferEncoding;
    flag?: string;
    mode?: fs.Mode;
    allowAbsolutePath?: boolean;
  } = {}
): void {
  const validatedPath = validatePath(filePath, SafePathOperation.WRITE, {
    allowAbsolutePath: options.allowAbsolutePath,
    checkExtension: true,
  });

  // Check the size of the data to write
  if (typeof data === 'string') {
    const byteSize = Buffer.byteLength(data, options.encoding);
    if (byteSize > currentConfig.maxWriteSize) {
      throw new PathValidationError(
        `Data size exceeds maximum allowed size for writing (${currentConfig.maxWriteSize} bytes)`,
        { path: filePath, operation: SafePathOperation.WRITE }
      );
    }
  } else if (data.length > currentConfig.maxWriteSize) {
    throw new PathValidationError(
      `Data size exceeds maximum allowed size for writing (${currentConfig.maxWriteSize} bytes)`,
      { path: filePath, operation: SafePathOperation.WRITE }
    );
  }

  // Create the directory if it doesn't exist
  const dirPath = path.dirname(validatedPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(validatedPath, data, {
    encoding: options.encoding,
    flag: options.flag,
    mode: options.mode,
  });
}

/**
 * Safely check if a file exists with path validation
 * @param filePath The file path to check
 * @param options Path validation options
 * @returns True if the file exists, false otherwise
 * @throws PathValidationError if path validation fails
 */
export function safeFileExists(
  filePath: string,
  options: {
    allowAbsolutePath?: boolean;
  } = {}
): boolean {
  try {
    const validatedPath = validatePath(filePath, SafePathOperation.READ, {
      allowAbsolutePath: options.allowAbsolutePath,
      checkExtension: false,
    });

    return fs.existsSync(validatedPath);
  } catch (error) {
    if (error instanceof PathValidationError) {
      throw error;
    }

    return false;
  }
}

/**
 * Safely create a directory with path validation
 * @param dirPath The directory path to create
 * @param options Directory creation options
 * @throws PathValidationError if validation fails
 */
export function safeCreateDirectory(
  dirPath: string,
  options: {
    recursive?: boolean;
    allowAbsolutePath?: boolean;
    mode?: fs.Mode;
  } = {}
): void {
  const validatedPath = validatePath(dirPath, SafePathOperation.CREATE_DIR, {
    allowAbsolutePath: options.allowAbsolutePath,
  });

  fs.mkdirSync(validatedPath, {
    recursive: options.recursive,
    mode: options.mode,
  });
}

/**
 * Safely delete a file with path validation
 * @param filePath The file path to delete
 * @param options Path validation options
 * @throws PathValidationError if validation fails
 */
export function safeDeleteFile(
  filePath: string,
  options: {
    allowAbsolutePath?: boolean;
  } = {}
): void {
  const validatedPath = validatePath(filePath, SafePathOperation.DELETE, {
    mustExist: true,
    allowAbsolutePath: options.allowAbsolutePath,
    checkExtension: true,
  });

  fs.unlinkSync(validatedPath);
}
