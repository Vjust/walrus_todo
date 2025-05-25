/**
 * Supported AI providers
 *
 * Re-export the AIProvider enum from the types/adapters directory to ensure
 * consistent provider types throughout the codebase
 */
import { AIProvider } from '../../types/adapters/AIModelAdapter';
export { AIProvider };

/**
 * AI operation types
 */
export type TodoAIOperation =
  | 'summarize'
  | 'categorize'
  | 'prioritize'
  | 'suggest'
  | 'analyze'
  | 'group'
  | 'schedule'
  | 'detect_dependencies'
  | 'estimate_effort';

/**
 * AI verification level
 */
export enum VerificationLevel {
  NONE = 'none', // No verification
  HASH = 'hash', // Store hash only on-chain
  FULL = 'full', // Store full verification
}

/**
 * Options for AI operations
 */
export interface AIOperationOptions {
  provider?: AIProvider;
  verificationLevel?: VerificationLevel;
  cacheResults?: boolean;
  storeResult?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * AI verification result
 */
export interface VerificationResult {
  verified: boolean;
  verificationId?: string;
  timestamp?: string;
  provider?: AIProvider;
  operation?: TodoAIOperation;
  signature?: string;
}

/**
 * Credential status
 */
export interface CredentialStatus {
  provider: AIProvider;
  verified: boolean;
  expiresAt?: string;
  permissions?: string[];
}

/**
 * API Response types for different providers
 */
export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface XAIResponse {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Prompt template input types
 */
export interface PromptInput {
  [key: string]:
    | string
    | number
    | boolean
    | string[]
    | PromptInput
    | PromptInput[];
}

/**
 * Error response type
 */
export interface AIErrorResponse {
  error: {
    message: string;
    type?: string;
    code?: string;
    param?: string;
  };
  status?: number;
}

/**
 * Network error type
 */
export interface NetworkError extends Error {
  status?: number;
  response?: {
    status: number;
    statusText?: string;
    data?: unknown;
  };
  cause?: Error;
}

/**
 * Cache entry type
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

/**
 * Blockchain verification data
 */
export interface BlockchainVerificationData {
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  verifier: string;
  signature: string;
  data: {
    operation: TodoAIOperation;
    inputHash: string;
    outputHash: string;
    provider: AIProvider;
  };
}

/**
 * Credential validation result
 */
export interface CredentialValidationResult {
  isValid: boolean;
  provider: AIProvider;
  error?: string;
  expiresAt?: Date;
  permissions?: string[];
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  modelName?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute?: number;
  };
}

/**
 * Response parser options
 */
export interface ParseOptions {
  strict?: boolean;
  defaultValue?: unknown;
  validator?: (value: unknown) => boolean;
}
