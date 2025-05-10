/**
 * Types for the AI mocking framework
 */

import { AIProvider, AIModelOptions } from '../../types/adapters/AIModelAdapter';

/**
 * Supported operation types for AI mocking
 */
export enum AIOperationType {
  SUMMARIZE = 'summarize',
  CATEGORIZE = 'categorize',
  PRIORITIZE = 'prioritize',
  SUGGEST = 'suggest',
  ANALYZE = 'analyze',
  COMPLETE = 'complete',
  DEFAULT = 'default'
}

/**
 * Recording mode for the mock provider
 */
export enum RecordingMode {
  DISABLED = 'disabled',
  RECORD = 'record',
  REPLAY = 'replay'
}

/**
 * Template for mock responses
 */
export interface MockResponseTemplate {
  text?: string | ((prompt: string) => string);
  structured?: any | ((prompt: string) => any);
  patterns?: Array<{
    match: string | RegExp;
    text?: string | ((prompt: string) => string);
    structured?: any | ((prompt: string) => any);
  }>;
}

/**
 * Options for simulating latency in responses
 */
export interface LatencyOptions {
  enabled: boolean;
  minLatencyMs: number;
  maxLatencyMs: number;
  jitterEnabled: boolean;
  timeoutProbability: number;
  timeoutAfterMs: number;
}

/**
 * Error type to simulate
 */
export enum MockErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  SERVER = 'server',
  TOKEN_LIMIT = 'token_limit',
  CONTENT_POLICY = 'content_policy',
  INVALID_REQUEST = 'invalid_request',
  INTERNAL = 'internal'
}

/**
 * Options for configuring error simulation
 */
export interface MockErrorOptions {
  enabled: boolean;
  errorType?: MockErrorType;
  probability?: number;
  errorMessage?: string;
  operationTargets?: string[];
}

/**
 * Configuration options for the mock provider
 */
export interface MockResponseOptions {
  provider?: AIProvider;
  modelName?: string;
  modelOptions?: AIModelOptions;
  templates?: Record<string, MockResponseTemplate>;
  errors?: MockErrorOptions;
  latency?: LatencyOptions;
  recordingMode?: RecordingMode;
}

/**
 * Recorded request and response pair
 */
export interface RecordedInteraction {
  id: string;
  timestamp: number;
  operation: string;
  method: string;
  request: any;
  response: any;
  provider: AIProvider;
  modelName: string;
}

/**
 * Scenario definition for custom test cases
 */
export interface MockScenario {
  name: string;
  description?: string;
  provider: AIProvider;
  modelName?: string;
  templates: Record<string, MockResponseTemplate>;
  errors?: MockErrorOptions;
  latency?: LatencyOptions;
}