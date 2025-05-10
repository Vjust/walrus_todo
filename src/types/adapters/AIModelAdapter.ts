/**
 * AI Model Adapter Interface
 * 
 * This file defines the interface for AI model adapters, which provide a consistent
 * way to interact with different AI providers (OpenAI, XAI, etc.).
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { SecureCredentialService } from '../../services/ai/SecureCredentialService';

export enum AIProvider {
  XAI = 'xai',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama'
}

export interface AIModelOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  modelName?: string;

  // Network operation parameters
  timeout?: number;        // Request timeout in milliseconds
  retries?: number;        // Number of retry attempts
  retryDelay?: number;     // Base delay between retries in milliseconds
  maxRetryTime?: number;   // Maximum total time to spend on retries
  retryBackoffFactor?: number; // Exponential backoff factor for retries
}

export interface AIRequestMetadata {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  timestamp?: number;
  additionalContext?: Record<string, any>;
  operation?: string;
}

export interface AICompletionParams {
  prompt: string | PromptTemplate;
  options?: AIModelOptions;
  metadata?: AIRequestMetadata;
}

export interface AIResponse<T = string> {
  result: T;
  modelName: string;
  provider: AIProvider;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AIProviderCreationParams {
  provider: AIProvider;
  modelName?: string;
  options?: AIModelOptions;
  credentialService?: SecureCredentialService;
}

export interface AIModelAdapter {
  /**
   * Get the name of the provider
   */
  getProviderName(): AIProvider;

  /**
   * Get the name of the current model being used
   */
  getModelName(): string;

  /**
   * Generate a completion from the AI model
   */
  complete(params: AICompletionParams): Promise<AIResponse>;

  /**
   * Generate a structured response from the AI model
   */
  completeStructured<T>(params: AICompletionParams): Promise<AIResponse<T>>;

  /**
   * Process a prompt through a LangChain chain
   */
  processWithPromptTemplate(promptTemplate: PromptTemplate, input: Record<string, any>): Promise<AIResponse>;

  /**
   * Cancel all pending operations
   * @param reason Optional reason for cancellation
   */
  cancelAllRequests?(reason?: string): void;
}