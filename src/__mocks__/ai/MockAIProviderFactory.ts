/**
 * MockAIProviderFactory - Factory for creating different mock AI providers
 */

import { AIModelAdapter, AIProvider, AIModelOptions } from '../../types/adapters/AIModelAdapter';
import { MockAIProvider } from './MockAIProvider';
import { MockXAIProvider } from './providers/MockXAIProvider';
import { MockOpenAIProvider } from './providers/MockOpenAIProvider';
import { MockAnthropicProvider } from './providers/MockAnthropicProvider';
import { MockResponseOptions, RecordingMode } from './types';
import { getScenario } from './scenarios';

export class MockAIProviderFactory {
  // Keep track of created providers for reuse
  private static providers: Map<string, AIModelAdapter> = new Map();
  
  /**
   * Create a mock AI provider based on the provider type
   */
  public static createProvider(
    provider: AIProvider = AIProvider.XAI,
    modelName?: string,
    options: AIModelOptions = {}
  ): AIModelAdapter {
    const key = `${provider}-${modelName || 'default'}`;
    
    // Return cached provider if available
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }
    
    let mockProvider: AIModelAdapter;
    
    // Create provider-specific implementation
    switch (provider) {
      case AIProvider.XAI:
        mockProvider = new MockXAIProvider(
          modelName || 'grok-beta',
          options
        );
        break;
        
      case AIProvider.OPENAI:
        mockProvider = new MockOpenAIProvider(
          modelName || 'gpt-3.5-turbo',
          options
        );
        break;
        
      case AIProvider.ANTHROPIC:
        mockProvider = new MockAnthropicProvider(
          modelName || 'claude-2',
          options
        );
        break;
        
      default:
        // Generic mock provider for other providers
        mockProvider = new MockAIProvider(
          provider,
          modelName || 'default-model',
          options
        );
    }
    
    // Cache the provider
    this.providers.set(key, mockProvider);
    return mockProvider;
  }
  
  /**
   * Get a provider configured with a predefined scenario
   */
  public static createProviderForScenario(scenarioName: string): AIModelAdapter | null {
    const scenario = getScenario(scenarioName);
    if (!scenario) {
      return null;
    }
    
    // Create a provider using the scenario configuration
    const provider = this.createProvider(
      scenario.provider,
      scenario.modelName
    );
    
    // Configure the provider with scenario settings
    if (provider instanceof MockAIProvider) {
      provider.configure({
        templates: scenario.templates,
        errors: scenario.errors,
        latency: scenario.latency
      });
    }
    
    return provider;
  }
  
  /**
   * Create a provider configured for recording real AI responses
   */
  public static createRecordingProvider(
    provider: AIProvider = AIProvider.XAI,
    modelName?: string,
    savePath?: string
  ): AIModelAdapter {
    const mockProvider = this.createProvider(provider, modelName) as MockAIProvider;
    
    mockProvider.configure({
      recordingMode: RecordingMode.RECORD
    });
    
    // Set up auto-save on process exit if savePath is provided
    if (savePath && typeof process !== 'undefined') {
      const saveRecordings = () => {
        mockProvider.saveRecordings(savePath);
      };
      
      // Clean up previous listeners to avoid duplicates
      process.removeListener('exit', saveRecordings);
      process.on('exit', saveRecordings);
    }
    
    return mockProvider;
  }
  
  /**
   * Create a provider configured to replay recorded AI responses
   */
  public static createReplayProvider(
    recordingPath: string,
    provider: AIProvider = AIProvider.XAI,
    modelName?: string
  ): AIModelAdapter {
    const mockProvider = this.createProvider(provider, modelName) as MockAIProvider;
    
    const success = mockProvider.loadRecordings(recordingPath);
    if (success) {
      mockProvider.configure({
        recordingMode: RecordingMode.REPLAY
      });
    }
    
    return mockProvider;
  }
  
  /**
   * Configure a mock provider with custom options
   */
  public static configureProvider(
    provider: AIModelAdapter,
    options: MockResponseOptions
  ): boolean {
    if (provider instanceof MockAIProvider) {
      provider.configure(options);
      return true;
    }
    
    return false;
  }
  
  /**
   * Reset all providers to default state
   */
  public static resetAllProviders(): void {
    this.providers.forEach(provider => {
      if (provider instanceof MockAIProvider) {
        provider.reset();
      }
    });
  }
  
  /**
   * Clear cached providers
   */
  public static clearCache(): void {
    this.providers.clear();
  }
}