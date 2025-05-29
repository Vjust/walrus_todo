/**
 * Local type definitions for security tests
 * This file defines all the types needed for security tests without importing from CLI sources
 */

// AI Provider enumeration
export enum AIProvider {
  XAI = 'xai',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
}

// Credential types
export enum CredentialType {
  API_KEY = 'api_key',
  OAUTH = 'oauth',
  SERVICE_ACCOUNT = 'service_account',
}

// Permission levels
export enum AIPermissionLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
}

// Action types for AI operations
export enum AIActionType {
  SUMMARIZE = 'summarize',
  GENERATE = 'generate',
  ANALYZE = 'analyze',
  CLASSIFY = 'classify',
}

// Privacy levels
export enum AIPrivacyLevel {
  PUBLIC = 'public',
  PRIVATE = 'private',
  CONFIDENTIAL = 'confidential',
}

// AI Model Options interface
export interface AIModelOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: AIProvider;
}

// Verification Record interface
export interface VerificationRecord {
  id: string;
  verificationType: AIActionType;
  timestamp: number;
  status: 'verified' | 'failed' | 'pending';
  data?: any;
}

// Todo interface for testing
export interface Todo {
  id: string;
  content: string;
  completed: boolean;
  createdAt: number;
  updatedAt?: number;
  tags?: string[];
}

// AI Provider Credential interface
export interface AIProviderCredential {
  id: string;
  type: CredentialType;
  provider: AIProvider;
  data: Record<string, any>;
  permissions: AIPermissionLevel[];
}