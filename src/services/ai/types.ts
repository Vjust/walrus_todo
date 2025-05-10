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
  NONE = 'none',        // No verification
  HASH = 'hash',        // Store hash only on-chain
  FULL = 'full'         // Store full verification
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