/**
 * Functional AI Service
 * 
 * A unified, functional programming-based AI service that consolidates features from:
 * - Core AI operations (summarize, categorize, prioritize, suggest, analyze)
 * - Advanced operations (group, schedule, detect dependencies, estimate effort)
 * - Security features (PII anonymization, prompt injection detection, sanitization)
 * - Caching and performance optimization
 * - Fallback mechanisms and graceful degradation
 * - Blockchain verification support
 * 
 * Uses functional programming patterns:
 * - Pure functions
 * - Function composition
 * - Higher-order functions
 * - Immutable data structures
 * - Monadic error handling (Result type)
 */

import { Todo } from '../../types/todo';
import {
  AIVerificationService,
  VerifiedAIResult,
} from './AIVerificationService';
import { AIPrivacyLevel } from '../../types/adapters/AIVerifierAdapter';
import {
  AIModelAdapter,
  AIProvider,
  AIModelOptions,
  AIResponse,
} from '../../types/adapters/AIModelAdapter';
import { AIProviderFactory } from './AIProviderFactory';
import { PromptManager } from './PromptManager';
import { ResultCache } from './ResultCache';
import { AIConfigManager } from './AIConfigManager';
import { Logger } from '../../utils/Logger';
import { secureCredentialService } from './SecureCredentialService';
import { PromptTemplate } from '@langchain/core/prompts';
import {
  AIPermissionManager,
  initializePermissionManager,
  getPermissionManager,
} from './AIPermissionManager';
import { SecureCredentialManager } from './SecureCredentialManager';
import { BlockchainVerifier } from './BlockchainVerifier';

// Re-export types and services
export { AIVerificationService } from './AIVerificationService';
export type { VerifiedAIResult } from './AIVerificationService';
export { secureCredentialService } from './SecureCredentialService';
export type { CredentialInfo } from './SecureCredentialService';
export { AIProvider } from './types';
export type * from './types';

// Result type for monadic error handling
export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

// Safe AI Result type with metadata
export interface SafeAIResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  aiAvailable: boolean;
  usedFallback: boolean;
  operation: string;
}

// Type definitions for advanced operations
export interface GroupResult {
  sequentialTracks: Record<string, string[]>;
  parallelOpportunities: string[][];
}

export interface ScheduleResult {
  [todoId: string]: {
    start: number; // Days from now
    duration: number; // Days
    due: number; // Days from now
  };
}

export interface DependencyResult {
  dependencies: Record<string, string[]>; // todoId -> [dependency ids]
  blockers: Record<string, string[]>; // todoId -> [blocker ids]
}

export interface EffortEstimate {
  effort: number; // 1-5 scale
  reasoning: string;
  estimated_hours?: number;
}

export interface EffortResult {
  [todoId: string]: EffortEstimate;
}

export interface TodoAnalysisResult {
  productivity_insights: {
    completion_rate: number;
    average_duration: number;
    peak_activity_periods: string[];
  };
  patterns: {
    common_categories: string[];
    recurring_themes: string[];
    workflow_efficiency: number;
  };
  recommendations: {
    optimization_suggestions: string[];
    priority_adjustments: Record<string, number>;
    time_management_tips: string[];
  };
}

// Service configuration
export interface AIServiceConfig {
  provider?: AIProvider;
  modelName?: string;
  options?: AIModelOptions;
  verificationService?: AIVerificationService;
  permissionManager?: AIPermissionManager;
  cacheEnabled?: boolean;
  useEnhancedPrompts?: boolean;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

// Service state
interface AIServiceState {
  modelAdapter: AIModelAdapter | null;
  verificationService?: AIVerificationService;
  permissionManager?: AIPermissionManager;
  logger: Logger;
  promptManager: PromptManager;
  resultCache: ResultCache;
  configManager: AIConfigManager;
  options: AIModelOptions;
  isInitialized: boolean;
  initializationError: string | null;
  lastHealthCheck: number;
  aiHealthy: boolean;
  activeTimeouts: Set<NodeJS.Timeout>;
}

// Fallback responses
const DEFAULT_RESPONSES = {
  summarize: (todoCount: number) =>
    `Summary: You have ${todoCount} todo${todoCount !== 1 ? 's' : ''} in your list. Consider reviewing and prioritizing them.`,

  categorize: (todos: Todo[]) => {
    const categories: Record<string, string[]> = { General: [] };
    todos.forEach(todo => categories.General.push(todo.id));
    return categories;
  },

  prioritize: (todos: Todo[]) => {
    const priorities: Record<string, number> = {};
    todos.forEach(todo => {
      if (todo.priority === 'high') {
        priorities[todo.id] = 8;
      } else if (todo.priority === 'low') {
        priorities[todo.id] = 3;
      } else {
        priorities[todo.id] = 5; // medium
      }
    });
    return priorities;
  },

  suggest: () => [
    'Review completed tasks for insights',
    'Set realistic deadlines for pending items',
    'Break down complex tasks into smaller steps',
  ],

  analyze: (todoCount: number): TodoAnalysisResult => ({
    productivity_insights: {
      completion_rate: 0,
      average_duration: 0,
      peak_activity_periods: [],
    },
    patterns: {
      common_categories: ['General'],
      recurring_themes: ['Task management'],
      workflow_efficiency: 0.5,
    },
    recommendations: {
      optimization_suggestions: ['Consider organizing tasks by priority'],
      priority_adjustments: {},
      time_management_tips: ['Review and update task descriptions'],
    },
  }),

  suggestTags: () => ['general', 'task'],

  suggestPriority: () => 'medium' as const,
};

// Pure functions for data sanitization
const sanitizeXSS = (text: string): string => {
  if (!text) return text;

  let sanitized = text;
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gis, '[SCRIPT_REMOVED]');
  sanitized = sanitized.replace(/<(iframe|object|embed|applet|form)[^>]*>.*?<\/\1>/gis, '[TAG_REMOVED]');
  sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, 'blocked:');
  sanitized = sanitized.replace(/data:text\/html/gi, 'blocked:');
  sanitized = sanitized.replace(/<img[^>]*onerror[^>]*>/gi, '[IMG_REMOVED]');

  return sanitized;
};

const sanitizeSQLInjection = (text: string): string => {
  if (!text) return text;

  let sanitized = text;
  const sqlPatterns = [
    /\bDROP\s+TABLE\b/gi,
    /\bDELETE\s+FROM\b/gi,
    /\bUPDATE\s+\w+\s+SET\b/gi,
    /\bINSERT\s+INTO\b/gi,
    /\bUNION\s+SELECT\b/gi,
    /\bOR\s+1\s*=\s*1\b/gi,
    /\bAND\s+1\s*=\s*1\b/gi,
    /';\s*--/g,
    /\/\*.*?\*\//gs,
  ];

  for (const pattern of sqlPatterns) {
    sanitized = sanitized.replace(pattern, '[SQL_FILTERED]');
  }

  return sanitized;
};

const sanitizePromptInjection = (text: string): string => {
  if (!text) return text;

  const injectionPatterns = [
    'ignore previous instructions',
    'disregard earlier directives',
    'forget the instructions above',
    'new instructions:',
    'instead, do the following:',
    'you are now',
    'act as',
    'pretend to be',
    'roleplay as',
    'system:',
    'user:',
    'assistant:',
    'override',
    'bypass',
  ];

  let sanitized = sanitizeXSS(sanitizeSQLInjection(text));

  for (const pattern of injectionPatterns) {
    const regex = new RegExp(
      pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'gi'
    );
    sanitized = sanitized.replace(regex, '[FILTERED]');
  }

  return sanitized;
};

const anonymizePII = (text: string): string => {
  if (!text) return text;

  const sanitized = sanitizePromptInjection(text);

  const piiPatterns: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[EMAIL]' },
    { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE]' },
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
    { pattern: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[CREDIT_CARD]' },
    { pattern: /\b\d+\s+[A-Z][a-z]+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Drive|Dr)\b/g, replacement: '[ADDRESS]' },
    { pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, replacement: '[NAME]' },
  ];

  let anonymized = sanitized;
  for (const { pattern, replacement } of piiPatterns) {
    anonymized = anonymized.replace(pattern, replacement);
  }

  return anonymized;
};

const sanitizeTodo = (todo: Todo): Partial<Todo> => {
  const sanitized: Partial<Todo> = {
    id: todo.id,
    title: anonymizePII(todo.title),
    completed: todo.completed,
  };

  if (todo.description) {
    sanitized.description = anonymizePII(todo.description);
  }
  if (todo.priority) {
    sanitized.priority = todo.priority;
  }
  if (todo.tags && Array.isArray(todo.tags)) {
    sanitized.tags = [...todo.tags];
  }

  return sanitized;
};

// Higher-order functions for common patterns
const withRetry = <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): (() => Promise<T>) => {
  return async () => {
    let lastError: Error | undefined;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }
    throw lastError || new Error('Operation failed after retries');
  };
};

const withTimeout = <T>(
  fn: () => Promise<T>,
  timeoutMs: number
): (() => Promise<T>) => {
  return () => Promise.race([
    fn(),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    ),
  ]);
};

const withCache = <T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  getCacheKey: (...args: Args) => string,
  cache: ResultCache
): ((...args: Args) => Promise<T>) => {
  return async (...args: Args) => {
    const cacheKey = getCacheKey(...args);
    const cachedResult = cache.get<T>(cacheKey, args[0]);
    
    if (cachedResult) {
      cache.recordHit();
      return cachedResult.result;
    }
    
    cache.recordMiss();
    const result = await fn(...args);
    cache.set(cacheKey, args[0], { result, timestamp: Date.now() });
    return result;
  };
};

const withSafetyChecks = <T>(
  fn: (todos: Todo[]) => Promise<T>,
  operation: string
): ((todos: Todo[]) => Promise<T>) => {
  return async (todos: Todo[]) => {
    // Input validation
    if (!todos || !Array.isArray(todos)) {
      throw new Error(`Cannot ${operation} null or non-array input`);
    }
    if (todos.length === 0) {
      throw new Error(`Cannot ${operation} empty todo list`);
    }
    if (todos.length > 500) {
      throw new Error(`Input exceeds maximum allowed size for ${operation}`);
    }

    // Detect prompt injection
    const todoStr = todos
      .map(t => `${t.title}: ${t.description || ''}`)
      .join('\n');
    
    const lowerStr = todoStr.toLowerCase();
    const injectionPatterns = [
      'ignore previous instructions',
      'forget everything',
      'system:',
      'assistant:',
    ];
    
    for (const pattern of injectionPatterns) {
      if (lowerStr.includes(pattern)) {
        throw new Error('Potential prompt injection detected');
      }
    }

    // Sanitize todos before processing
    const sanitizedTodos = todos.map(sanitizeTodo) as Todo[];
    return fn(sanitizedTodos);
  };
};

// Create minimal fallback adapter
const createMinimalFallbackAdapter = (): AIModelAdapter => ({
  getProviderName: () => AIProvider.XAI,
  getModelName: () => 'minimal-fallback',
  complete: async () => ({
    result: 'AI service temporarily unavailable',
    modelName: 'minimal-fallback',
    provider: AIProvider.XAI,
    timestamp: Date.now(),
  }),
  completeStructured: async <T>() => ({
    result: {} as T,
    modelName: 'minimal-fallback',
    provider: AIProvider.XAI,
    timestamp: Date.now(),
  }),
  processWithPromptTemplate: async () => ({
    result: 'Test result',
    modelName: 'minimal-fallback',
    provider: AIProvider.XAI,
    timestamp: Date.now(),
  }),
  cancelAllRequests: () => {},
});

// Initialize service state
const createInitialState = (): AIServiceState => ({
  modelAdapter: null,
  verificationService: undefined,
  permissionManager: undefined,
  logger: new Logger('AIService'),
  promptManager: PromptManager.getInstance(),
  resultCache: ResultCache.getInstance(),
  configManager: AIConfigManager.getInstance(),
  options: {
    temperature: 0.7,
    maxTokens: 2000,
  },
  isInitialized: false,
  initializationError: null,
  lastHealthCheck: 0,
  aiHealthy: false,
  activeTimeouts: new Set(),
});

// Global state (for singleton behavior)
let globalState: AIServiceState | null = null;

// Factory function to create AI service
export const createAIService = async (config: AIServiceConfig = {}): Promise<AIServiceState> => {
  // Use existing global state if available (singleton pattern)
  if (globalState && globalState.isInitialized) {
    return globalState;
  }

  const state = createInitialState();
  
  try {
    // Configure cache
    const globalConfig = state.configManager.getGlobalConfig();
    state.resultCache.configure({
      enabled: config.cacheEnabled ?? globalConfig.cacheEnabled,
      ttlMs: globalConfig.defaultTtl,
      maxEntries: globalConfig.maxCacheEntries,
    });

    // Set options
    state.options = {
      temperature: config.defaultTemperature ?? globalConfig.defaultTemperature,
      maxTokens: config.defaultMaxTokens ?? globalConfig.defaultMaxTokens,
      ...config.options,
    };

    // Initialize permission manager
    try {
      state.permissionManager = config.permissionManager ?? getPermissionManager();
    } catch {
      const credentialManager = new SecureCredentialManager();
      const mockVerifierAdapter = {};
      const blockchainVerifier = new BlockchainVerifier(mockVerifierAdapter);
      state.permissionManager = initializePermissionManager(
        credentialManager,
        blockchainVerifier
      );
    }

    // Set verification service
    state.verificationService = config.verificationService;

    // Initialize model adapter
    try {
      const defaultProvider = await AIProviderFactory.getDefaultProvider();
      state.modelAdapter = await AIProviderFactory.createProvider({
        provider: config.provider ?? defaultProvider.provider,
        modelName: config.modelName ?? defaultProvider.modelName,
        options: state.options,
        credentialService: secureCredentialService,
      });
      state.isInitialized = true;
      state.aiHealthy = true;
    } catch (error) {
      state.logger.error('Failed to initialize model adapter:', error as Error);
      state.modelAdapter = createMinimalFallbackAdapter();
      state.initializationError = error instanceof Error ? error.message : String(error);
    }

    globalState = state;
    return state;
  } catch (error) {
    state.logger.error('Failed to create AI service:', error as Error);
    state.modelAdapter = createMinimalFallbackAdapter();
    state.initializationError = error instanceof Error ? error.message : String(error);
    globalState = state;
    return state;
  }
};

// Health check function
const performHealthCheck = async (state: AIServiceState): Promise<boolean> => {
  const now = Date.now();
  const healthCheckInterval = 30000; // 30 seconds

  if (now - state.lastHealthCheck < healthCheckInterval) {
    return state.aiHealthy;
  }

  state.lastHealthCheck = now;

  if (!state.modelAdapter) {
    state.aiHealthy = false;
    return false;
  }

  try {
    const testTodos: Todo[] = [{
      id: 'health-check',
      title: 'Test todo',
      description: 'Health check test',
      completed: false,
      priority: 'medium',
      tags: [],
      private: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];

    const testResult = await withTimeout(
      () => summarizeTodos(state, testTodos),
      5000
    )();

    state.aiHealthy = typeof testResult === 'string' && testResult.length > 0;
    return state.aiHealthy;
  } catch (error) {
    state.aiHealthy = false;
    state.logger.warn('Health check failed:', error as Error);
    return false;
  }
};

// Safe execute wrapper
const safeExecute = async <T>(
  state: AIServiceState,
  operation: string,
  aiOperation: () => Promise<T>,
  fallbackResult: T
): Promise<SafeAIResult<T>> => {
  const aiAvailable = await performHealthCheck(state);

  if (!aiAvailable || !state.modelAdapter) {
    state.logger.debug(`AI not available for ${operation}, using fallback`);
    return {
      success: true,
      result: fallbackResult,
      aiAvailable: false,
      usedFallback: true,
      operation,
    };
  }

  try {
    AIProviderFactory.setAIFeatureRequested(true);
    const result = await withTimeout(aiOperation, 15000)();
    
    state.logger.debug(`AI operation ${operation} completed successfully`);
    return {
      success: true,
      result,
      aiAvailable: true,
      usedFallback: false,
      operation,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    state.logger.warn(`AI operation ${operation} failed: ${errorMessage}, using fallback`);
    
    state.aiHealthy = false;
    return {
      success: true,
      result: fallbackResult,
      error: errorMessage,
      aiAvailable: true,
      usedFallback: true,
      operation,
    };
  }
};

// Core AI operations
const summarizeTodos = async (state: AIServiceState, todos: Todo[]): Promise<string> => {
  const operation = 'summarize';
  
  // Check permissions
  if (state.permissionManager) {
    const hasPermission = await state.permissionManager.checkPermission(
      state.modelAdapter?.getProviderName() ?? AIProvider.XAI,
      operation
    );
    if (!hasPermission) {
      throw new Error(`Insufficient permissions for ${operation} operation`);
    }
  }

  const prompt = PromptTemplate.fromTemplate(
    `Summarize the following todos in 2-3 sentences, focusing on key themes and priorities:\n\n{todos}`
  );

  const todoStr = todos
    .map(t => `- ${t.title}: ${t.description || 'No description'}`)
    .join('\n');

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.processWithPromptTemplate(
    prompt,
    { todos: todoStr }
  );

  return response.result;
};

const categorizeTodos = async (state: AIServiceState, todos: Todo[]): Promise<Record<string, string[]>> => {
  const operation = 'categorize';
  
  const prompt = PromptTemplate.fromTemplate(
    `Categorize the following todos into logical groups. Return the result as a JSON object where keys are category names and values are arrays of todo IDs.\n\n{todos}`
  );

  const todoStr = todos
    .map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`)
    .join('\n');

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.completeStructured<Record<string, string[]>>({
    prompt,
    input: { todos: todoStr },
    options: { ...state.options, temperature: 0.5 },
    metadata: { operation },
  });

  const result = response.result || {};
  const sanitizedResult = Object.create(null);

  Object.keys(result).forEach(category => {
    if (category === '__proto__' || category === 'constructor' || category === 'prototype') {
      return;
    }
    const ids = result[category];
    if (Array.isArray(ids)) {
      sanitizedResult[category] = ids.filter(id => typeof id === 'string');
    }
  });

  return sanitizedResult;
};

const prioritizeTodos = async (state: AIServiceState, todos: Todo[]): Promise<Record<string, number>> => {
  const operation = 'prioritize';
  
  const promptTemplate = state.promptManager.getPromptTemplate(
    operation,
    state.modelAdapter?.getProviderName() ?? AIProvider.XAI,
    state.configManager.getOperationConfig(operation).enhanced
  );

  const todoStr = todos
    .map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`)
    .join('\n');

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.completeStructured<Record<string, number>>({
    prompt: promptTemplate,
    input: { todos: todoStr },
    options: { ...state.options, temperature: 0.3 },
    metadata: { operation },
  });

  return response.result || {};
};

const suggestTodos = async (state: AIServiceState, todos: Todo[]): Promise<string[]> => {
  const operation = 'suggest';
  
  const promptTemplate = state.promptManager.getPromptTemplate(
    operation,
    state.modelAdapter?.getProviderName() ?? AIProvider.XAI,
    state.configManager.getOperationConfig(operation).enhanced
  );

  const todoStr = todos
    .map(t => `- ${t.title}: ${t.description || 'No description'}`)
    .join('\n');

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.completeStructured<string[]>({
    prompt: promptTemplate,
    input: { todos: todoStr },
    options: { ...state.options, temperature: 0.8 },
    metadata: { operation },
  });

  return response.result || [];
};

const analyzeTodos = async (state: AIServiceState, todos: Todo[]): Promise<TodoAnalysisResult> => {
  const operation = 'analyze';
  
  const promptTemplate = state.promptManager.getPromptTemplate(
    operation,
    state.modelAdapter?.getProviderName() ?? AIProvider.XAI,
    state.configManager.getOperationConfig(operation).enhanced
  );

  const todoStr = todos
    .map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`)
    .join('\n');

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.completeStructured<TodoAnalysisResult>({
    prompt: promptTemplate,
    input: { todos: todoStr },
    options: { ...state.options, temperature: 0.5 },
    metadata: { operation },
  });

  return response.result || DEFAULT_RESPONSES.analyze(todos.length);
};

// Advanced operations
const groupTodos = async (state: AIServiceState, todos: Todo[]): Promise<GroupResult> => {
  const operation = 'group';
  
  const promptTemplate = state.promptManager.getPromptTemplate(
    operation,
    state.modelAdapter?.getProviderName() ?? AIProvider.XAI,
    state.configManager.getOperationConfig(operation).enhanced
  );

  const todoStr = todos
    .map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`)
    .join('\n');

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.completeStructured<GroupResult>({
    prompt: promptTemplate,
    input: { todos: todoStr },
    options: state.configManager.getModelOptions(operation),
    metadata: { operation },
  });

  return response.result || { sequentialTracks: {}, parallelOpportunities: [] };
};

const scheduleTodos = async (state: AIServiceState, todos: Todo[]): Promise<ScheduleResult> => {
  const operation = 'schedule';
  
  const promptTemplate = state.promptManager.getPromptTemplate(
    operation,
    state.modelAdapter?.getProviderName() ?? AIProvider.XAI,
    state.configManager.getOperationConfig(operation).enhanced
  );

  const todoStr = todos
    .map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`)
    .join('\n');

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.completeStructured<ScheduleResult>({
    prompt: promptTemplate,
    input: { todos: todoStr },
    options: state.configManager.getModelOptions(operation),
    metadata: { operation },
  });

  return response.result || {};
};

const detectDependencies = async (state: AIServiceState, todos: Todo[]): Promise<DependencyResult> => {
  const operation = 'detect_dependencies';
  
  const promptTemplate = state.promptManager.getPromptTemplate(
    operation,
    state.modelAdapter?.getProviderName() ?? AIProvider.XAI,
    state.configManager.getOperationConfig(operation).enhanced
  );

  const todoStr = todos
    .map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`)
    .join('\n');

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.completeStructured<DependencyResult>({
    prompt: promptTemplate,
    input: { todos: todoStr },
    options: state.configManager.getModelOptions(operation),
    metadata: { operation },
  });

  return response.result || { dependencies: {}, blockers: {} };
};

const estimateEffort = async (state: AIServiceState, todos: Todo[]): Promise<EffortResult> => {
  const operation = 'estimate_effort';
  
  const promptTemplate = state.promptManager.getPromptTemplate(
    operation,
    state.modelAdapter?.getProviderName() ?? AIProvider.XAI,
    state.configManager.getOperationConfig(operation).enhanced
  );

  const todoStr = todos
    .map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`)
    .join('\n');

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.completeStructured<EffortResult>({
    prompt: promptTemplate,
    input: { todos: todoStr },
    options: state.configManager.getModelOptions(operation),
    metadata: { operation },
  });

  return response.result || {};
};

// Single todo operations
const suggestTags = async (state: AIServiceState, todo: Todo): Promise<string[]> => {
  const prompt = PromptTemplate.fromTemplate(
    `Suggest 2-4 relevant tags for the following todo:\n\nTitle: {title}\nDescription: {description}\n\nReturn ONLY a JSON array of string tags, nothing else.`
  );

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.processWithPromptTemplate(
    prompt,
    {
      title: todo.title,
      description: todo.description || 'No description',
    }
  );

  try {
    return JSON.parse(response.result);
  } catch {
    throw new Error('Failed to parse tags response: ' + response.result);
  }
};

const suggestPriority = async (state: AIServiceState, todo: Todo): Promise<'high' | 'medium' | 'low'> => {
  const prompt = PromptTemplate.fromTemplate(
    `Based on this todo, suggest a priority level (must be exactly one of: "high", "medium", or "low"):\n\nTitle: {title}\nDescription: {description}\n\nReturn ONLY the priority level as a single word, nothing else.`
  );

  if (!state.modelAdapter) {
    throw new Error('Model adapter not initialized');
  }

  const response = await state.modelAdapter.processWithPromptTemplate(
    prompt,
    {
      title: todo.title,
      description: todo.description || 'No description',
    }
  );

  const priority = response.result.trim().toLowerCase();
  if (['high', 'medium', 'low'].includes(priority)) {
    return priority as 'high' | 'medium' | 'low';
  } else {
    state.logger.warn(`Invalid priority response: "${priority}", defaulting to "medium"`);
    return 'medium';
  }
};

// Public API with safe execution
export const summarize = async (todos: Todo[]): Promise<SafeAIResult<string>> => {
  const state = await createAIService();
  const safeSummarize = withSafetyChecks(
    withCache(
      (todos: Todo[]) => summarizeTodos(state, todos),
      () => 'summarize',
      state.resultCache
    ),
    'summarize'
  );

  return safeExecute(
    state,
    'summarize',
    () => safeSummarize(todos),
    DEFAULT_RESPONSES.summarize(todos.length)
  );
};

export const categorize = async (todos: Todo[]): Promise<SafeAIResult<Record<string, string[]>>> => {
  const state = await createAIService();
  const safeCategorize = withSafetyChecks(
    withCache(
      (todos: Todo[]) => categorizeTodos(state, todos),
      () => 'categorize',
      state.resultCache
    ),
    'categorize'
  );

  return safeExecute(
    state,
    'categorize',
    () => safeCategorize(todos),
    DEFAULT_RESPONSES.categorize(todos)
  );
};

export const prioritize = async (todos: Todo[]): Promise<SafeAIResult<Record<string, number>>> => {
  const state = await createAIService();
  const safePrioritize = withSafetyChecks(
    withCache(
      (todos: Todo[]) => prioritizeTodos(state, todos),
      () => 'prioritize',
      state.resultCache
    ),
    'prioritize'
  );

  return safeExecute(
    state,
    'prioritize',
    () => safePrioritize(todos),
    DEFAULT_RESPONSES.prioritize(todos)
  );
};

export const suggest = async (todos: Todo[]): Promise<SafeAIResult<string[]>> => {
  const state = await createAIService();
  const safeSuggest = withSafetyChecks(
    withCache(
      (todos: Todo[]) => suggestTodos(state, todos),
      () => 'suggest',
      state.resultCache
    ),
    'suggest'
  );

  return safeExecute(
    state,
    'suggest',
    () => safeSuggest(todos),
    DEFAULT_RESPONSES.suggest()
  );
};

export const analyze = async (todos: Todo[]): Promise<SafeAIResult<TodoAnalysisResult>> => {
  const state = await createAIService();
  const safeAnalyze = withSafetyChecks(
    withCache(
      (todos: Todo[]) => analyzeTodos(state, todos),
      () => 'analyze',
      state.resultCache
    ),
    'analyze'
  );

  return safeExecute(
    state,
    'analyze',
    () => safeAnalyze(todos),
    DEFAULT_RESPONSES.analyze(todos.length)
  );
};

export const group = async (todos: Todo[]): Promise<SafeAIResult<GroupResult>> => {
  const state = await createAIService();
  const safeGroup = withSafetyChecks(
    withCache(
      (todos: Todo[]) => groupTodos(state, todos),
      () => 'group',
      state.resultCache
    ),
    'group'
  );

  return safeExecute(
    state,
    'group',
    () => safeGroup(todos),
    { sequentialTracks: {}, parallelOpportunities: [] }
  );
};

export const schedule = async (todos: Todo[]): Promise<SafeAIResult<ScheduleResult>> => {
  const state = await createAIService();
  const safeSchedule = withSafetyChecks(
    withCache(
      (todos: Todo[]) => scheduleTodos(state, todos),
      () => 'schedule',
      state.resultCache
    ),
    'schedule'
  );

  return safeExecute(
    state,
    'schedule',
    () => safeSchedule(todos),
    {}
  );
};

export const detectDependenciesAI = async (todos: Todo[]): Promise<SafeAIResult<DependencyResult>> => {
  const state = await createAIService();
  const safeDetect = withSafetyChecks(
    withCache(
      (todos: Todo[]) => detectDependencies(state, todos),
      () => 'detect_dependencies',
      state.resultCache
    ),
    'detect_dependencies'
  );

  return safeExecute(
    state,
    'detect_dependencies',
    () => safeDetect(todos),
    { dependencies: {}, blockers: {} }
  );
};

export const estimateEffortAI = async (todos: Todo[]): Promise<SafeAIResult<EffortResult>> => {
  const state = await createAIService();
  const safeEstimate = withSafetyChecks(
    withCache(
      (todos: Todo[]) => estimateEffort(state, todos),
      () => 'estimate_effort',
      state.resultCache
    ),
    'estimate_effort'
  );

  return safeExecute(
    state,
    'estimate_effort',
    () => safeEstimate(todos),
    {}
  );
};

export const suggestTagsAI = async (todo: Todo): Promise<SafeAIResult<string[]>> => {
  const state = await createAIService();
  
  return safeExecute(
    state,
    'suggestTags',
    () => suggestTags(state, todo),
    DEFAULT_RESPONSES.suggestTags()
  );
};

export const suggestPriorityAI = async (todo: Todo): Promise<SafeAIResult<'high' | 'medium' | 'low'>> => {
  const state = await createAIService();
  
  return safeExecute(
    state,
    'suggestPriority',
    () => suggestPriority(state, todo),
    DEFAULT_RESPONSES.suggestPriority()
  );
};

// Verification wrappers
export const summarizeWithVerification = async (
  todos: Todo[],
  privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
): Promise<SafeAIResult<VerifiedAIResult<string>>> => {
  const state = await createAIService();
  
  if (!state.verificationService) {
    const result = await summarize(todos);
    if (!result.success || !result.result) {
      return result as SafeAIResult<VerifiedAIResult<string>>;
    }

    const fallbackVerification: VerifiedAIResult<string> = {
      result: result.result,
      verification: {
        id: 'fallback-summary',
        requestHash: '',
        responseHash: '',
        user: '',
        provider: 'fallback',
        timestamp: Date.now(),
        verificationType: 0,
        metadata: { usedFallback: 'true' },
      },
    };

    return {
      ...result,
      result: fallbackVerification,
    };
  }

  return safeExecute(
    state,
    'summarizeWithVerification',
    async () => {
      const summary = await summarizeTodos(state, todos);
      return state.verificationService!.createVerifiedSummary(todos, summary, privacyLevel);
    },
    {
      result: DEFAULT_RESPONSES.summarize(todos.length),
      verification: {
        id: 'fallback-summary',
        requestHash: '',
        responseHash: '',
        user: '',
        provider: 'fallback',
        timestamp: Date.now(),
        verificationType: 0,
        metadata: { usedFallback: 'true' },
      },
    }
  );
};

// Configuration functions
export const configure = async (config: Partial<AIServiceConfig>): Promise<void> => {
  const state = await createAIService();
  
  if (config.cacheEnabled !== undefined) {
    state.resultCache.configure({ enabled: config.cacheEnabled });
  }

  if (config.useEnhancedPrompts !== undefined || 
      config.defaultTemperature !== undefined || 
      config.defaultMaxTokens !== undefined) {
    state.configManager.updateGlobalConfig({
      useEnhancedPrompts: config.useEnhancedPrompts,
      defaultTemperature: config.defaultTemperature,
      defaultMaxTokens: config.defaultMaxTokens,
    });
  }
};

export const setCustomPrompt = async (operation: string, promptTemplate: string): Promise<void> => {
  const state = await createAIService();
  state.promptManager.setPromptOverride(operation, promptTemplate);
};

export const clearCustomPrompts = async (): Promise<void> => {
  const state = await createAIService();
  state.promptManager.clearAllPromptOverrides();
};

export const clearCache = async (operation?: string): Promise<void> => {
  const state = await createAIService();
  if (operation) {
    state.resultCache.clearOperation(operation);
  } else {
    state.resultCache.clear();
  }
};

export const getCacheStats = async (): Promise<{
  size: number;
  hitRate: number;
  operations: Record<string, number>;
}> => {
  const state = await createAIService();
  return state.resultCache.getStats();
};

export const getAIStatus = async (): Promise<{
  initialized: boolean;
  healthy: boolean;
  error: string | null;
  lastHealthCheck: Date | null;
}> => {
  const state = await createAIService();
  return {
    initialized: state.isInitialized,
    healthy: state.aiHealthy,
    error: state.initializationError,
    lastHealthCheck: state.lastHealthCheck > 0 ? new Date(state.lastHealthCheck) : null,
  };
};

export const isAIAvailable = async (): Promise<boolean> => {
  const state = await createAIService();
  return performHealthCheck(state);
};

export const setProvider = async (
  provider: AIProvider,
  modelName?: string,
  options?: AIModelOptions
): Promise<SafeAIResult<boolean>> => {
  const state = await createAIService();
  
  try {
    state.modelAdapter = await AIProviderFactory.createProvider({
      provider,
      modelName,
      options: { ...state.options, ...options },
      credentialService: secureCredentialService,
    });
    
    state.lastHealthCheck = 0;
    await performHealthCheck(state);
    
    return {
      success: true,
      result: true,
      aiAvailable: state.aiHealthy,
      usedFallback: false,
      operation: 'setProvider',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    state.logger.warn(`Failed to set AI provider to ${provider}: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      aiAvailable: false,
      usedFallback: false,
      operation: 'setProvider',
    };
  }
};

export const cancelAllOperations = async (reason?: string): Promise<void> => {
  const state = await createAIService();
  
  // Clear all tracked timeouts
  for (const timeout of state.activeTimeouts) {
    clearTimeout(timeout);
  }
  state.activeTimeouts.clear();
  
  // Cancel model adapter operations
  if (state.modelAdapter && typeof state.modelAdapter.cancelAllRequests === 'function') {
    state.modelAdapter.cancelAllRequests(reason || 'User cancelled operation');
  }
  
  state.logger.debug(`Cancelled all AI operations${reason ? `: ${reason}` : ''}`);
};

// Backward compatibility exports
export const aiService = {
  summarize: async (todos: Todo[]) => (await summarize(todos)).result,
  categorize: async (todos: Todo[]) => (await categorize(todos)).result,
  prioritize: async (todos: Todo[]) => (await prioritize(todos)).result,
  suggest: async (todos: Todo[]) => (await suggest(todos)).result,
  analyze: async (todos: Todo[]) => (await analyze(todos)).result,
  suggestTags: async (todo: Todo) => (await suggestTagsAI(todo)).result,
  suggestPriority: async (todo: Todo) => (await suggestPriorityAI(todo)).result,
  summarizeWithVerification,
  setProvider: async (provider: AIProvider, modelName?: string, options?: AIModelOptions) => {
    const result = await setProvider(provider, modelName, options);
    if (!result.success) {
      throw new Error(result.error || 'Failed to set provider');
    }
  },
  cancelAllOperations,
  getProvider: async () => {
    const state = await createAIService();
    return state.modelAdapter || createMinimalFallbackAdapter();
  },
};

export const safeAIService = {
  summarize,
  categorize,
  prioritize,
  suggest,
  analyze,
  suggestTags: suggestTagsAI,
  suggestPriority: suggestPriorityAI,
  summarizeWithVerification,
  isAIAvailable,
  getAIStatus,
  setProvider,
  cancelAllOperations,
  cleanup: async () => {
    await cancelAllOperations('Service cleanup');
    globalState = null;
  },
};

// Cleanup on process exit
if (typeof process !== 'undefined') {
  const cleanup = () => {
    if (globalState) {
      for (const timeout of globalState.activeTimeouts) {
        clearTimeout(timeout);
      }
      globalState.activeTimeouts.clear();
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('beforeExit', cleanup);
}