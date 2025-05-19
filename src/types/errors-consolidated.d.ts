declare module '../../types/errors/consolidated' {
  export class BaseError extends Error {
    constructor(message: string, context?: string);
  }
  
  export class ValidationError extends BaseError {
    constructor(message: string, details?: any);
    details?: any;
  }
  
  export class NetworkError extends BaseError {
    constructor(message: string, statusCode?: number);
    statusCode?: number;
  }
  
  export class StorageError extends BaseError {
    constructor(message: string, operation?: string);
    operation?: string;
  }
  
  export class ConfigurationError extends BaseError {
    constructor(message: string, field?: string);
    field?: string;
  }
  
  export class AuthenticationError extends BaseError {
    constructor(message: string, provider?: string);
    provider?: string;
  }
}