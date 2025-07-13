/**
 * Compression utilities for data storage
 * Provides gzip compression and decompression functions
 */

import { promisify } from 'util';
import { gzip as gzipCallback, gunzip as gunzipCallback } from 'zlib';

const gzipAsync = promisify(gzipCallback);
const gunzipAsync = promisify(gunzipCallback);

/**
 * Compress a string using gzip
 */
export async function compress(data: string): Promise<Buffer> {
  return gzipAsync(Buffer.from(data, 'utf-8'));
}

/**
 * Decompress gzipped data to string
 */
export async function decompress(data: Buffer | string): Promise<string> {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'base64') : data;
  const decompressed = await gunzipAsync(buffer);
  return decompressed.toString('utf-8');
}