/**
 * Centralized Error Handling for Walrus Client
 */

import { 
  WalrusClientError, 
  WalrusNetworkError, 
  WalrusValidationError,
  WalrusStorageError 
} from '../errors';

export class ErrorHandler {
  static handleFetchError(error: unknown, url?: string): WalrusNetworkError {
    if (error instanceof Response) {
      return new WalrusNetworkError(
        `HTTP ${error.status}: ${error.statusText}`,
        error.status,
        url
      );
    }
    
    if (error instanceof Error) {
      // Check for common network error patterns
      if (error.name === 'AbortError') {
        return new WalrusNetworkError('Request was aborted', undefined, url, error);
      }
      
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return new WalrusNetworkError('Request timed out', undefined, url, error);
      }
      
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return new WalrusNetworkError('Network error occurred', undefined, url, error);
      }
      
      return new WalrusNetworkError(error.message, undefined, url, error);
    }
    
    return new WalrusNetworkError(`Unknown network error: ${String(error)}`, undefined, url);
  }

  static handleValidationError(message: string, field?: string, value?: unknown): WalrusValidationError {
    return new WalrusValidationError(message, field, value);
  }

  static handleStorageError(message: string, operation?: string, blobId?: string, cause?: Error): WalrusStorageError {
    return new WalrusStorageError(message, operation, blobId, cause);
  }

  static handleResponseError(response: Response, url?: string): WalrusNetworkError {
    return new WalrusNetworkError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      url || response.url
    );
  }

  static isRetryableError(error: Error): boolean {
    if (error instanceof WalrusNetworkError) {
      // Retry on 5xx errors, timeouts, and rate limiting
      return !error.status || 
             error.status >= 500 || 
             error.status === 429 ||
             error.message.includes('timeout') ||
             error.message.includes('network');
    }
    
    // Retry on network-related errors
    return error.name === 'AbortError' ||
           error.name === 'TimeoutError' ||
           error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('ECONNRESET') ||
           error.message.includes('ENOTFOUND');
  }

  static wrapError(error: unknown, context?: string): WalrusClientError {
    if (error instanceof WalrusClientError) {
      return error;
    }
    
    if (error instanceof Error) {
      const message = context ? `${context}: ${error.message}` : error.message;
      return new WalrusClientError(message, undefined, error);
    }
    
    const message = context ? `${context}: ${String(error)}` : String(error);
    return new WalrusClientError(message);
  }

  static createErrorFromResponse(response: Response): WalrusNetworkError {
    const message = `Request failed with status ${response.status}: ${response.statusText}`;
    return new WalrusNetworkError(message, response.status, response.url);
  }

  static async extractErrorMessage(response: Response): Promise<string> {
    try {
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const json = await response.json();
        return json.error || json.message || `HTTP ${response.status}`;
      }
      
      if (contentType?.includes('text/')) {
        const text = await response.text();
        return text || `HTTP ${response.status}`;
      }
      
      return `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      return `HTTP ${response.status}: ${response.statusText}`;
    }
  }
}