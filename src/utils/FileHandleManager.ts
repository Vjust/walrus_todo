/**
 * FileHandleManager - Resource manager for file handles
 * 
 * Provides utilities for safely handling file operations with proper cleanup
 * Ensures all file handles are properly closed even in error scenarios
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { Logger } from './Logger';

// Promisified fs functions
const open = promisify(fs.open);
const close = promisify(fs.close);
// const read = promisify(fs.read); // Unused
// const write = promisify(fs.write); // Unused

/**
 * Configuration options for FileHandleManager
 */
export interface FileHandleManagerOptions {
  /** Base directory for relative paths */
  baseDir?: string;
  /** Default encoding for read operations */
  defaultEncoding?: BufferEncoding;
  /** Whether to throw errors or just log them */
  throwErrors?: boolean;
  /** Custom logger instance */
  logger?: Logger;
  /** Default file creation mode */
  defaultMode?: number;
  /** Automatically create directories when writing to files */
  autoCreateDirs?: boolean;
}

/**
 * FileHandleManager class for safely managing file operations
 * 
 * Provides utilities for handling file operations with proper cleanup
 * and error handling. Can be instantiated with custom configuration 
 * for different behaviors and mock in tests.
 */
export class FileHandleManager {
  private baseDir: string;
  private defaultEncoding: BufferEncoding;
  private throwErrors: boolean;
  private logger: Logger;
  private defaultMode: number;
  private autoCreateDirs: boolean;
  /** Track all opened file handles for cleanup */
  private openHandles: Array<number> = [];
  
  /**
   * Create a new FileHandleManager instance
   * 
   * @param options Configuration options
   */
  constructor(options: FileHandleManagerOptions = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.defaultEncoding = options.defaultEncoding || 'utf8';
    this.throwErrors = options.throwErrors !== undefined ? options.throwErrors : true;
    this.logger = options.logger || Logger.getInstance();
    this.defaultMode = options.defaultMode || 0o666;
    this.autoCreateDirs = options.autoCreateDirs !== undefined ? options.autoCreateDirs : true;
  }
  
  /**
   * Close all open file handles
   * 
   * Ensures all tracked file handles are properly closed
   * Used for cleanup in tests and resource management
   * 
   * @returns Promise that resolves when all handles are closed
   */
  async closeAll(): Promise<void> {
    if (this.openHandles.length === 0) {
      return;
    }
    
    const errors: Error[] = [];
    
    for (const fd of this.openHandles.slice()) {
      try {
        await close(fd);
        const index = this.openHandles.indexOf(fd);
        if (index !== -1) {
          this.openHandles.splice(index, 1);
        }
        this.logger.debug(`Closed file descriptor ${fd}`);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Error closing file descriptor ${fd}`, errorObj);
        errors.push(errorObj);
      }
    }
    
    if (errors.length > 0 && this.throwErrors) {
      throw new Error(`Failed to close ${errors.length} file handles: ${errors.map(e => e.message).join(', ')}`);
    }
  }
  
  /**
   * Resolve a file path, making it absolute if it's relative
   * 
   * @param filePath File path to resolve
   * @returns Absolute file path
   */
  resolvePath(filePath: string): string {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    
    // If the path is absolute, return it as is
    if (filePath.startsWith('/') || /^[A-Z]:\\/.test(filePath)) {
      return filePath;
    }
    
    // Otherwise, resolve it relative to the base directory
    return path.resolve(this.baseDir, filePath);
  }
  
  /**
   * Safely execute an operation with a file handle that is automatically closed
   * 
   * @param filePath File path to open
   * @param flags File open flags (e.g., 'r', 'w', 'a')
   * @param operation Function that receives the file descriptor and performs operations
   * @returns The result of the operation
   */
  async withFileHandle<T>(
    filePath: string, 
    flags: string, 
    operation: (fd: number) => Promise<T>
  ): Promise<T> {
    const resolvedPath = this.resolvePath(filePath);
    let fd: number | null = null;
    
    try {
      // Create directory if needed and writing
      if (this.autoCreateDirs && (flags.includes('w') || flags.includes('a'))) {
        const dir = path.dirname(resolvedPath);
        await fsPromises.mkdir(dir, { recursive: true }).catch(() => {});
      }
      
      fd = await open(resolvedPath, flags);
      // Track the open file handle
      this.openHandles.push(fd);
      
      return await operation(fd);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`File operation failed on ${resolvedPath}`, errorObj);
      if (this.throwErrors) {
        throw error;
      }
      return null as any;
    } finally {
      if (fd !== null) {
        try {
          await close(fd);
          // Remove the file handle from tracking
          const index = this.openHandles.indexOf(fd);
          if (index !== -1) {
            this.openHandles.splice(index, 1);
          }
          this.logger.debug(`Closed file descriptor for ${resolvedPath}`);
        } catch (closeError) {
          // Log but don't throw - we're already in cleanup
          const errorObj = closeError instanceof Error ? closeError : new Error(String(closeError));
          this.logger.error(`Error closing file ${resolvedPath}`, errorObj);
        }
      }
    }
  }
  
  /**
   * Safely read a file with proper handle cleanup
   * 
   * @param filePath File to read
   * @param options Read options
   * @returns File contents as string
   */
  async safeReadFile(
    filePath: string,
    options?: {
      encoding?: BufferEncoding;
      flag?: string;
    }
  ): Promise<string> {
    const resolvedPath = this.resolvePath(filePath);
    const encoding = options?.encoding || this.defaultEncoding;
    const flag = options?.flag || 'r';
    
    return new Promise((resolve, reject) => {
      let fileStream: fs.ReadStream | null = null;
      
      try {
        fileStream = fs.createReadStream(resolvedPath, { 
          encoding, 
          flags: flag 
        });
        let data = '';
        
        fileStream.on('data', (chunk) => {
          data += chunk;
        });
        
        fileStream.on('end', () => {
          resolve(data);
        });
        
        fileStream.on('error', (error) => {
          if (this.throwErrors) {
            reject(error);
          } else {
            this.logger.error(`Error reading file ${resolvedPath}`, error);
            resolve('');
          }
        });
      } catch (error) {
        // Ensure we close the stream on synchronous errors
        if (fileStream && fileStream.readable) {
          fileStream.destroy();
        }
        
        if (this.throwErrors) {
          reject(error);
        } else {
          this.logger.error(`Error setting up read stream for ${resolvedPath}`, error);
          resolve('');
        }
      }
    });
  }
  
  /**
   * Safely write to a file with proper handle cleanup
   * 
   * @param filePath File to write
   * @param data Data to write
   * @param options Write options
   */
  async safeWriteFile(
    filePath: string,
    data: string | Buffer,
    options?: {
      encoding?: BufferEncoding;
      mode?: number;
      flag?: string;
    }
  ): Promise<void> {
    const resolvedPath = this.resolvePath(filePath);
    const encoding = options?.encoding || this.defaultEncoding;
    const mode = options?.mode || this.defaultMode;
    const flag = options?.flag || 'w';
    
    // Create directory if needed
    if (this.autoCreateDirs) {
      const dir = path.dirname(resolvedPath);
      await fsPromises.mkdir(dir, { recursive: true }).catch(() => {});
    }
    
    return new Promise((resolve, reject) => {
      let fileStream: fs.WriteStream | null = null;
      
      try {
        fileStream = fs.createWriteStream(resolvedPath, {
          encoding,
          mode,
          flags: flag
        });
        
        fileStream.on('finish', () => {
          resolve();
        });
        
        fileStream.on('error', (error) => {
          if (this.throwErrors) {
            reject(error);
          } else {
            this.logger.error(`Error writing to file ${resolvedPath}`, error);
            resolve();
          }
        });
        
        // Write and end the stream
        fileStream.write(data);
        fileStream.end();
      } catch (error) {
        // Ensure we close the stream on synchronous errors
        if (fileStream) {
          fileStream.destroy();
        }
        
        if (this.throwErrors) {
          reject(error);
        } else {
          this.logger.error(`Error setting up write stream for ${resolvedPath}`, error);
          resolve();
        }
      }
    });
  }
  
  /**
   * Safely read a file in chunks with proper cleanup
   * 
   * @param filePath File to read
   * @param options Read stream options
   * @returns ReadStream
   */
  createSafeReadStream(
    filePath: string,
    options?: fs.ObjectEncodingOptions & {
      flags?: string;
      encoding?: BufferEncoding;
      fd?: number;
      mode?: number;
      autoClose?: boolean;
      emitClose?: boolean;
      start?: number;
      end?: number;
      highWaterMark?: number;
    }
  ): fs.ReadStream {
    const resolvedPath = this.resolvePath(filePath);
    const stream = fs.createReadStream(resolvedPath, options);
  
    // Handle errors explicitly
    stream.on('error', (error) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Error reading stream from ${resolvedPath}`, errorObj);
      stream.destroy();
    });
  
    return stream;
  }
  
  /**
   * Safely write to a file in chunks with proper cleanup
   * 
   * @param filePath File to write
   * @param options Write stream options
   * @returns WriteStream
   */
  createSafeWriteStream(
    filePath: string,
    options?: {
      flags?: string;
      encoding?: BufferEncoding;
      fd?: number;
      mode?: number;
      autoClose?: boolean;
      emitClose?: boolean;
      start?: number;
    }
  ): fs.WriteStream {
    const resolvedPath = this.resolvePath(filePath);
    
    // Create directory if needed
    if (this.autoCreateDirs) {
      const dir = path.dirname(resolvedPath);
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      } catch (error) {
        this.logger.error(`Failed to create directory ${dir}`, error);
      }
    }
    
    const stream = fs.createWriteStream(resolvedPath, options);
  
    // Handle errors explicitly
    stream.on('error', (error) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Error writing stream to ${resolvedPath}`, errorObj);
      stream.destroy();
    });
  
    return stream;
  }
  
  /**
   * Check if a file exists and is accessible
   * 
   * @param filePath File path to check
   * @returns Promise resolving to true if file exists and is accessible
   */
  async fileExists(filePath: string): Promise<boolean> {
    const resolvedPath = this.resolvePath(filePath);
    
    try {
      await fsPromises.access(resolvedPath, fs.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Create a directory if it doesn't exist
   * 
   * @param dirPath Directory path to create
   * @param options Directory creation options
   * @returns Promise resolving to true if directory was created or already exists
   */
  async ensureDirectory(
    dirPath: string,
    options?: { 
      recursive?: boolean;
      mode?: number;
    }
  ): Promise<boolean> {
    const resolvedPath = this.resolvePath(dirPath);
    const recursive = options?.recursive !== undefined ? options.recursive : true;
    const mode = options?.mode || this.defaultMode;
    
    try {
      if (!await this.fileExists(resolvedPath)) {
        await fsPromises.mkdir(resolvedPath, { recursive, mode });
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to create directory ${resolvedPath}`, error);
      if (this.throwErrors) {
        throw error;
      }
      return false;
    }
  }
}

// Create a default instance for simple usage
const defaultManager = new FileHandleManager();

// Export standalone functions for backward compatibility
export const withFileHandle = defaultManager.withFileHandle.bind(defaultManager);
export const safeReadFile = defaultManager.safeReadFile.bind(defaultManager);
export const safeWriteFile = defaultManager.safeWriteFile.bind(defaultManager);
export const createSafeReadStream = defaultManager.createSafeReadStream.bind(defaultManager);
export const createSafeWriteStream = defaultManager.createSafeWriteStream.bind(defaultManager);
export const closeAll = defaultManager.closeAll.bind(defaultManager);

// Export default instance for direct usage
export default FileHandleManager;