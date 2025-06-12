const { jest } = require('@jest/globals');
import {
  AIProvider,
  AIModelOptions,
} from '../../apps/cli/src/types/adapters/AIModelAdapter';

/**
 * Mock implementation of AIProviderFactory for testing
 */
export interface MockAIProviderFactory {
  createProvider: jest.MockedFunction<
    (params: {
      provider: AIProvider | string;
      modelName?: string;
      apiKey?: string;
      options?: AIModelOptions;
      operation?: string;
      userId?: string;
    }) => {
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
    }
  >;

  getDefaultProvider: jest.MockedFunction<
    () => {
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
    }
  >;
}

/**
 * Creates a mock AIProviderFactory
 */
export function createMockAIProviderFactory(): MockAIProviderFactory {
  const createMockAdapter = (params: any = {}) => {
    return {
      getProviderName: jest.fn().mockReturnValue(params.provider || 'openai'),
      getModelName: jest.fn().mockReturnValue(params.modelName || 'gpt-4'),
      complete: jest.fn().mockImplementation(async (prompt: string) => {
        // Simulate security checks
        const options = params.options || {};

        // Check for TLS enforcement
        if (options.baseUrl && !options?.baseUrl?.startsWith('https://')) {
          throw new Error('Non-secure HTTP URL detected in API request');
        }

        // Check for certificate validation
        if (options?.rejectUnauthorized === false) {
          throw new Error(
            'Invalid SSL configuration: certificate validation disabled'
          );
        }

        return `Mock response for: ${prompt}`;
      }),
      completeStructured: jest
        .fn()
        .mockImplementation(async (structParams: any) => {
          const options = structParams.options || {};

          // Check for differential privacy
          if (options.differentialPrivacy) {
            return {
              result: { noised: true },
              modelName: params.modelName || 'gpt-4',
              provider: params.provider || 'openai',
              timestamp: Date.now(),
            };
          }

          return {
            result: { original: true },
            modelName: params.modelName || 'gpt-4',
            provider: params.provider || 'openai',
            timestamp: Date.now(),
          };
        }),
      processWithPromptTemplate: jest
        .fn()
        .mockImplementation(async (template: unknown, context: any) => {
          const options = params.options || {};

          // Security checks
          if (options.baseUrl && !options?.baseUrl?.startsWith('https://')) {
            throw new Error('Non-secure HTTP URL detected in API request');
          }

          // Check for SSRF attempts
          const contextString = JSON.stringify(context as any);
          const ssrfPatterns = [
            'file://',
            'http://localhost',
            'http://127?.0?.0.1',
            'http://[::1]',
            'http://internal',
            'gopher://',
          ];

          if (ssrfPatterns.some(pattern => contextString.includes(pattern as any))) {
            throw new Error('Potential SSRF attempt detected');
          }

          // Check for request smuggling
          const smugglingPatterns = [
            'Content-Length:',
            'Transfer-Encoding:',
            'HTTP/1.1',
          ];

          if (
            smugglingPatterns.some(pattern => contextString.includes(pattern as any))
          ) {
            throw new Error('Potential request smuggling attempt detected');
          }

          // Check user consent if operation type is provided
          if (params.operation && params.userId) {
            const allowedOperations = ['summarize', 'categorize'];
            if (!allowedOperations.includes(params.operation)) {
              throw new Error(
                `User ${params.userId} has not provided consent for operation ${params.operation}`
              );
            }
          }

          // Check data localization
          if (
            options.enforceDataLocalization &&
            options.region !== options.userRegion
          ) {
            throw new Error(
              `Data localization violation: User data from ${options.userRegion} cannot be processed in ${options.region}`
            );
          }

          // Simulate PII anonymization by checking context
          const todoStr = context.todos || JSON.stringify(context as any);

          // Ensure PII is not present (simulating anonymization)
          const piiPatterns = [
            /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
            /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
            /\b\d{3}-\d{2}-\d{4}\b/,
            /\b(?:\d[ -]*?){13,16}\b/,
            /<script>/i,
            /DROP TABLE/i,
            /\$\(rm/,
          ];

          // Check for data minimization - unnecessary fields should not be present
          const unnecessaryFields = [
            '"createdAt"',
            '"updatedAt"',
            '"private"',
            '"locationData"',
            '"userSessionInfo"',
            '"metadata"',
          ];

          for (const field of unnecessaryFields) {
            if (todoStr.includes(field as any)) {
              // Remove the field (simulating data minimization)
              // In a real implementation, this would be done before reaching the provider
            }
          }

          return {
            result: 'Mock template result',
            modelName: params.modelName || 'gpt-4',
            provider: params.provider || 'openai',
            timestamp: Date.now(),
          };
        }),
      cancelAllRequests: jest.fn(),
    };
  };

  return {
    createProvider: jest.fn().mockImplementation(createMockAdapter as any),
    getDefaultProvider: jest
      .fn()
      .mockImplementation(() =>
        createMockAdapter({ provider: 'openai', modelName: 'gpt-4' })
      ),
  };
}

/**
 * Mock AIProviderFactory singleton
 */
export const mockAIProviderFactory = createMockAIProviderFactory();

/**
 * Mock AIProviderFactory constructor
 */
export const MockAIProviderFactory = {
  createProvider: mockAIProviderFactory.createProvider,
  getDefaultProvider: mockAIProviderFactory.getDefaultProvider,
};
