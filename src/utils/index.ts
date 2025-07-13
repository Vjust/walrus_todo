/**
 * Utils module exports
 * 
 * This module provides utility functions for compression, logging,
 * error handling, and other common operations.
 */

// Compression utilities
export {
  compress,
  decompress
} from './compression.js';

// Logging utilities
export {
  Logger,
  LogLevel,
  LogEntry,
  LoggerConfig,
  logger,
  createLogger,
  Timer,
  timer
} from './logger.js';

// Error classes and utilities
export {
  WaltodoError,
  WalrusError,
  ConfigError,
  ValidationError,
  StorageError,
  EncryptionError,
  NetworkError,
  NotFoundError,
  ConflictError,
  AuthError,
  isWaltodoError,
  isWalrusError,
  isValidationError,
  isNotFoundError,
  formatError,
  ErrorResponse,
  toErrorResponse
} from './errors.js';