/**
 * Walrus Client Constants
 */

import type { WalrusNetwork, WalrusConfig } from './types';

export const WALRUS_NETWORKS: Record<WalrusNetwork, Partial<WalrusConfig>> = {
  mainnet: {
    network: 'mainnet',
    publisherUrl: 'https://publisher?.walrus?.space',
    aggregatorUrl: 'https://aggregator?.walrus?.space',
  },
  testnet: {
    network: 'testnet',
    publisherUrl: 'https://publisher-testnet?.walrus?.space',
    aggregatorUrl: 'https://aggregator-testnet?.walrus?.space',
  },
  devnet: {
    network: 'devnet',
    publisherUrl: 'https://publisher-devnet?.walrus?.space',
    aggregatorUrl: 'https://aggregator-devnet?.walrus?.space',
  },
  localnet: {
    network: 'localnet',
    publisherUrl: 'http://localhost:31415',
    aggregatorUrl: 'http://localhost:31416',
  },
};

export const DEFAULT_CONFIG: Partial<WalrusConfig> = {
  timeout: 30000,
  retries: 3,
};

export const DEFAULT_UPLOAD_OPTIONS = {
  epochs: 5,
  deletable: true,
  contentType: 'application/octet-stream',
};

export const IMAGE_VALIDATION = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_DIMENSIONS: 10000,
};

export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

export const API_ENDPOINTS = {
  STORE: '/v1/store',
  BLOB: '/v1/{blobId}',
  STATUS: '/v1/status/{blobId}',
  DELETE: '/v1/delete/{blobId}',
};

export const MIME_TYPE_SIGNATURES = {
  '89504e47': 'image/png',
  'ffd8': 'image/jpeg', 
  '47494638': 'image/gif',
  '52494646': 'image/webp',
  '25504446': 'application/pdf',
  '504b0304': 'application/zip',
} as const;

export const ERROR_CODES = {
  NETWORK_ERROR: 'WALRUS_NETWORK_ERROR',
  VALIDATION_ERROR: 'WALRUS_VALIDATION_ERROR',
  RETRY_ERROR: 'WALRUS_RETRY_ERROR',
  STORAGE_ERROR: 'WALRUS_STORAGE_ERROR',
  TIMEOUT_ERROR: 'WALRUS_TIMEOUT_ERROR',
  NOT_FOUND: 'WALRUS_NOT_FOUND',
  UNAUTHORIZED: 'WALRUS_UNAUTHORIZED',
  INVALID_RESPONSE: 'WALRUS_INVALID_RESPONSE',
  INVALID_CONFIG: 'WALRUS_INVALID_CONFIG',
  UNSUPPORTED_FORMAT: 'WALRUS_UNSUPPORTED_FORMAT',
  FILE_TOO_LARGE: 'WALRUS_FILE_TOO_LARGE',
  CHECKSUM_MISMATCH: 'WALRUS_CHECKSUM_MISMATCH',
} as const;