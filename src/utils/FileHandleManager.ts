/**
 * FileHandleManager - Resource manager for file handles
 * 
 * Provides utilities for safely handling file operations with proper cleanup
 * Ensures all file handles are properly closed even in error scenarios
 */

import * as fs from 'fs';
import { promisify } from 'util';
import { Logger } from './Logger';

// Promisified fs functions
const open = promisify(fs.open);
const close = promisify(fs.close);
const read = promisify(fs.read);
const write = promisify(fs.write);

// Logger instance
const logger = Logger.getInstance();

/**
 * Safely execute an operation with a file handle that is automatically closed
 * 
 * @param filePath File path to open
 * @param flags File open flags (e.g., 'r', 'w', 'a')
 * @param operation Function that receives the file descriptor and performs operations
 * @returns The result of the operation
 */
export async function withFileHandle<T>(
  filePath: string, 
  flags: string, 
  operation: (fd: number) => Promise<T>
): Promise<T> {
  let fd: number | null = null;
  
  try {
    fd = await open(filePath, flags);
    return await operation(fd);
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error(`File operation failed on ${filePath}`, errorObj);
    throw error;
  } finally {
    if (fd !== null) {
      try {
        await close(fd);
        logger.debug(`Closed file descriptor for ${filePath}`);
      } catch (closeError) {
        // Log but don't throw - we're already in cleanup
        const errorObj = closeError instanceof Error ? closeError : new Error(String(closeError));
        logger.error(`Error closing file ${filePath}`, errorObj);
      }
    }
  }
}

/**
 * Safely read a file with proper handle cleanup
 * 
 * @param filePath File to read
 * @returns File contents as string
 */
export async function safeReadFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let fileStream: fs.ReadStream | null = null;
    
    try {
      fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      let data = '';
      
      fileStream.on('data', (chunk) => {
        data += chunk;
      });
      
      fileStream.on('end', () => {
        resolve(data);
      });
      
      fileStream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      // Ensure we close the stream on synchronous errors
      if (fileStream && fileStream.readable) {
        fileStream.destroy();
      }
      reject(error);
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
export async function safeWriteFile(
  filePath: string,
  data: string | Buffer,
  options?: {
    encoding?: BufferEncoding;
    mode?: number;
    flag?: string;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    let fileStream: fs.WriteStream | null = null;
    
    try {
      fileStream = fs.createWriteStream(filePath, options);
      
      fileStream.on('finish', () => {
        resolve();
      });
      
      fileStream.on('error', (error) => {
        reject(error);
      });
      
      // Write and end the stream
      fileStream.write(data);
      fileStream.end();
    } catch (error) {
      // Ensure we close the stream on synchronous errors
      if (fileStream) {
        fileStream.destroy();
      }
      reject(error);
    }
  });
}

/**
 * Safely read a file in chunks with proper cleanup
 */
export function createSafeReadStream(
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
  const stream = fs.createReadStream(filePath, options);

  // Handle errors explicitly
  stream.on('error', (error) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error reading stream from ${filePath}`, errorObj);
    stream.destroy();
  });

  return stream;
}

/**
 * Safely write to a file in chunks with proper cleanup
 */
export function createSafeWriteStream(
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
  const stream = fs.createWriteStream(filePath, options);

  // Handle errors explicitly
  stream.on('error', (error) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error writing stream to ${filePath}`, errorObj);
    stream.destroy();
  });

  return stream;
}