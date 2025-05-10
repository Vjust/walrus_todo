import { jest } from '@jest/globals';
import { AIProvider, AIModelAdapter, AICompletionParams, AIResponse } from '../../src/types/adapters/AIModelAdapter';
import { PromptTemplate } from '@langchain/core/prompts';

/**
 * Mock implementation of the AIModelAdapter interface for testing
 */
export class MockAIModelAdapter implements AIModelAdapter {
  private mockProvider: AIProvider;
  private mockModelName: string;
  
  constructor(provider: AIProvider = AIProvider.XAI, modelName: string = 'mock-model') {
    this.mockProvider = provider;
    this.mockModelName = modelName;
  }

  getProviderName(): AIProvider {
    return this.mockProvider;
  }

  getModelName(): string {
    return this.mockModelName;
  }

  async complete(params: AICompletionParams): Promise<AIResponse> {
    return {
      result: 'Mock completion result',
      modelName: this.mockModelName,
      provider: this.mockProvider,
      tokenUsage: {
        prompt: 10,
        completion: 20,
        total: 30
      },
      timestamp: Date.now()
    };
  }

  async completeStructured<T>(params: AICompletionParams): Promise<AIResponse<T>> {
    // Default mock implementations for different prompt types
    let result: any;
    
    const promptStr = typeof params.prompt === 'string' 
      ? params.prompt 
      : JSON.stringify(params.prompt);
    
    // Determine the type of operation based on the prompt content
    if (promptStr.includes('categorize') || promptStr.toLowerCase().includes('categories')) {
      result = { 'work': ['todo-1', 'todo-2'], 'personal': ['todo-3'] };
    } else if (promptStr.includes('prioritize') || promptStr.toLowerCase().includes('priority')) {
      result = { 'todo-1': 9, 'todo-2': 7, 'todo-3': 3 };
    } else if (promptStr.includes('suggest') || promptStr.toLowerCase().includes('suggestions')) {
      result = ['Suggested task 1', 'Suggested task 2', 'Suggested task 3'];
    } else if (promptStr.includes('analyze') || promptStr.toLowerCase().includes('analysis')) {
      result = {
        'themes': ['productivity', 'deadlines'],
        'bottlenecks': ['dependent tasks'],
        'timeEstimates': { 'total': '3 days' }
      };
    } else {
      result = { 'default': 'mock structured result' };
    }

    return {
      result: result as T,
      modelName: this.mockModelName,
      provider: this.mockProvider,
      tokenUsage: {
        prompt: 15,
        completion: 25,
        total: 40
      },
      timestamp: Date.now()
    };
  }

  async processWithPromptTemplate(promptTemplate: PromptTemplate, input: Record<string, any>): Promise<AIResponse> {
    return {
      result: 'Mock prompt template result',
      modelName: this.mockModelName,
      provider: this.mockProvider,
      tokenUsage: {
        prompt: 12,
        completion: 18,
        total: 30
      },
      timestamp: Date.now()
    };
  }
}

/**
 * Create a jest spy implementation of the AIModelAdapter
 */
export const createMockAIModelAdapter = () => {
  const mockAdapter: AIModelAdapter = {
    getProviderName: jest.fn().mockReturnValue(AIProvider.XAI),
    getModelName: jest.fn().mockReturnValue('mock-model'),
    complete: jest.fn().mockImplementation(async () => ({
      result: 'Mock completion result',
      modelName: 'mock-model',
      provider: AIProvider.XAI,
      tokenUsage: { prompt: 10, completion: 20, total: 30 },
      timestamp: Date.now()
    })),
    completeStructured: jest.fn().mockImplementation(async () => ({
      result: { mockKey: 'mock structured value' },
      modelName: 'mock-model',
      provider: AIProvider.XAI,
      tokenUsage: { prompt: 15, completion: 25, total: 40 },
      timestamp: Date.now()
    })),
    processWithPromptTemplate: jest.fn().mockImplementation(async () => ({
      result: 'Mock prompt template result',
      modelName: 'mock-model',
      provider: AIProvider.XAI,
      tokenUsage: { prompt: 12, completion: 18, total: 30 },
      timestamp: Date.now()
    }))
  };

  return mockAdapter;
};