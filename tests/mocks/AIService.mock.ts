const { jest } = require('@jest/globals');
import type { Todo } from '../../apps/cli/src/types/todo';
import {
  AIProvider,
  AIModelOptions,
} from '../../apps/cli/src/types/adapters/AIModelAdapter';
import {
  AIPrivacyLevel,
  AIActionType,
  VerificationRecord,
} from '../../apps/cli/src/types/adapters/AIVerifierAdapter';
import {
  CredentialType,
  AIPermissionLevel,
} from '../../apps/cli/src/types/adapters/AICredentialAdapter';
import type { AIVerificationService } from './AIVerificationService.mock';

/**
 * Mock implementation of AIService for testing
 */
export interface MockAIService {
  summarize: jest.MockedFunction<(todos: Todo[]) => Promise<string>>;
  categorize: jest.MockedFunction<
    (todos: Todo[]) => Promise<Record<string, unknown>>
  >;
  analyze: jest.MockedFunction<(todos: Todo[]) => Promise<string>>;
  prioritize: jest.MockedFunction<(todos: Todo[]) => Promise<Todo[]>>;
  suggest: jest.MockedFunction<(todos: Todo[]) => Promise<string[]>>;
  complete: jest.MockedFunction<(prompt: string) => Promise<string>>;
  getProviderName: jest.MockedFunction<() => string>;
  getModelName: jest.MockedFunction<() => string>;
  cancelAllRequests: jest.MockedFunction<() => void>;
  setOperationType: jest.MockedFunction<(type: string) => void>;
  verifyCredentials: jest.MockedFunction<() => Promise<boolean>>;
  isOperationPermitted: jest.MockedFunction<
    (operation: string) => Promise<boolean>
  >;

  // Internal properties that tests might access
  modelAdapter?: {
    getProviderName: () => string;
    getModelName: () => string;
    complete: jest.MockedFunction<(prompt: string) => Promise<string>>;
    completeStructured: jest.MockedFunction<
      (params: unknown) => Promise<unknown>
    >;
    processWithPromptTemplate: jest.MockedFunction<
      (template: unknown, context: unknown) => Promise<unknown>
    >;
    cancelAllRequests: jest.MockedFunction<() => void>;
  };
  options?: AIModelOptions;
  verificationService?: AIVerificationService;
  permissionManager?: {
    checkPermission: jest.MockedFunction<
      (provider: string, operation: string) => boolean
    >;
    verifyOperationPermission: jest.MockedFunction<
      (operation: string) => Promise<void>
    >;
  };
  auditLogger?: {
    log: jest.MockedFunction<(eventType: string, details: unknown) => void>;
  };
}

/**
 * Creates a mock AIService instance
 */
export function createMockAIService(
  apiKey?: string,
  provider: AIProvider = AIProvider.XAI,
  modelName?: string,
  options: AIModelOptions = {},
  verificationService?: AIVerificationService
): MockAIService {
  const mockModelAdapter = {
    getProviderName: jest.fn().mockReturnValue(provider as any),
    getModelName: jest.fn().mockReturnValue(modelName || 'gpt-4'),
    complete: jest.fn().mockResolvedValue('Mock response'),
    completeStructured: jest.fn().mockResolvedValue({
      result: {},
      modelName: modelName || 'gpt-4',
      provider,
      timestamp: Date.now(),
    }),
    processWithPromptTemplate: jest.fn().mockResolvedValue({
      result: 'Mock result',
      modelName: modelName || 'gpt-4',
      provider,
      timestamp: Date.now(),
    }),
    cancelAllRequests: jest.fn(),
  };

  const mockService: MockAIService = {
    summarize: jest.fn().mockImplementation(async (todos: Todo[]) => {
      // Simulate PII detection and anonymization
      const todoStr = JSON.stringify(todos as any);

      // Check for PII patterns and reject if found (simulating anonymization)
      const piiPatterns = [
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
        /\b\d{3}-\d{2}-\d{4}\b/,
        /\b(?:\d[ -]*?){13,16}\b/,
      ];

      // If too many todos (DoS protection)
      if (todos.length > 500) {
        throw new Error('Input exceeds maximum allowed size');
      }

      // Simulate length-based rejection for large inputs
      if (todoStr.length > 50000) {
        throw new Error('Input exceeds maximum allowed size');
      }

      return `Summary of ${todos.length} todos`;
    }),

    categorize: jest.fn().mockImplementation(async (todos: Todo[]) => {
      // Check for differential privacy options
      if (mockService.options?.differentialPrivacy) {
        return {
          differentialPrivacyEnabled: true,
          noisedCounts: true,
          categories: {
            work: todos.filter(t => t?.title?.includes('work')).map(t => t.id),
            personal: todos
              .filter(t => !t?.title?.includes('work'))
              .map(t => t.id),
          },
        };
      }

      return {
        differentialPrivacyEnabled: false,
        categories: {
          work: todos.filter(t => t?.title?.includes('work')).map(t => t.id),
          personal: todos.filter(t => !t?.title?.includes('work')).map(t => t.id),
        },
      };
    }),

    analyze: jest.fn().mockImplementation(async (todos: Todo[]) => {
      // Check permissions for analyze operation
      if (mockService.permissionManager) {
        const hasPermission = mockService?.permissionManager?.checkPermission(
          provider,
          'analyze'
        );
        if (!hasPermission) {
          throw new Error('Insufficient permissions for analyze operation');
        }
      }

      return `Analysis of ${todos.length} todos`;
    }),

    prioritize: jest.fn().mockResolvedValue([]),
    suggest: jest.fn().mockResolvedValue(['Mock suggestion']),
    complete: jest.fn().mockResolvedValue('Mock completion'),
    getProviderName: jest.fn().mockReturnValue(provider as any),
    getModelName: jest.fn().mockReturnValue(modelName || 'gpt-4'),
    cancelAllRequests: jest.fn(),
    setOperationType: jest.fn(),
    verifyCredentials: jest.fn().mockResolvedValue(true as any),
    isOperationPermitted: jest.fn().mockResolvedValue(true as any),

    // Internal properties
    modelAdapter: mockModelAdapter,
    options,
    verificationService,
    permissionManager: {
      checkPermission: jest.fn().mockReturnValue(true as any),
      verifyOperationPermission: jest.fn().mockResolvedValue(undefined as any),
    },
    auditLogger: {
      log: jest.fn(),
    },
  };

  return mockService;
}

/**
 * Mock AIService constructor for jest.mock usage
 */
export const MockAIService = jest
  .fn()
  .mockImplementation(
    (
      apiKey?: string,
      provider: AIProvider = AIProvider.XAI,
      modelName?: string,
      options: AIModelOptions = {},
      verificationService?: AIVerificationService
    ) => {
      return createMockAIService(
        apiKey,
        provider,
        modelName,
        options,
        verificationService
      );
    }
  );

/**
 * Mock data for tests
 */
export const mockVerificationRecord: VerificationRecord = {
  id: 'ver-123',
  requestHash: 'req-hash-123',
  responseHash: 'res-hash-123',
  user: 'user-123',
  provider: 'xai',
  timestamp: Date.now(),
  verificationType: AIActionType.SUMMARIZE,
  metadata: {},
};

export {
  AIProvider,
  AIPrivacyLevel,
  AIActionType,
  CredentialType,
  AIPermissionLevel,
};
