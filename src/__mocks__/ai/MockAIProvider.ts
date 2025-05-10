/**
 * MockAIProvider - Main class for mocking AI provider responses
 * This provides a flexible API for mocking different AI providers with
 * customizable response templates, error simulation, and latency control.
 */

import { 
  AIModelAdapter, 
  AIProvider, 
  AICompletionParams, 
  AIResponse, 
  AIModelOptions 
} from '../../types/adapters/AIModelAdapter';
import { PromptTemplate } from '@langchain/core/prompts';
import { 
  MockResponseTemplate, 
  MockResponseOptions, 
  MockErrorOptions,
  LatencyOptions, 
  RecordingMode
} from './types';
import { DefaultMockResponses } from './templates/DefaultResponses';
import { MockResponseRecorder } from './MockResponseRecorder';
import { ResponseTemplateManager } from './ResponseTemplateManager';
import { ErrorSimulator } from './ErrorSimulator';

export class MockAIProvider implements AIModelAdapter {
  protected provider: AIProvider;
  protected modelName: string;
  protected options: AIModelOptions;
  
  // Response control components
  private responseTemplates: ResponseTemplateManager;
  private errorSimulator: ErrorSimulator;
  private recorder?: MockResponseRecorder;
  
  // Latency simulation
  private latencyOptions: LatencyOptions = {
    enabled: false,
    minLatencyMs: 100,
    maxLatencyMs: 500,
    jitterEnabled: true,
    timeoutProbability: 0,
    timeoutAfterMs: 30000
  };
  
  // Recording mode
  private recordingMode: RecordingMode = RecordingMode.DISABLED;
  
  constructor(
    provider: AIProvider = AIProvider.XAI,
    modelName: string = 'mock-model',
    options: AIModelOptions = {},
    mockResponses: Record<string, MockResponseTemplate> = DefaultMockResponses
  ) {
    this.provider = provider;
    this.modelName = modelName;
    this.options = {
      temperature: 0.7,
      maxTokens: 1000,
      ...options
    };
    
    // Initialize response management
    this.responseTemplates = new ResponseTemplateManager(mockResponses);
    this.errorSimulator = new ErrorSimulator();
  }
  
  /**
   * Get the name of the provider being mocked
   */
  public getProviderName(): AIProvider {
    return this.provider;
  }
  
  /**
   * Get the name of the current model being mocked
   */
  public getModelName(): string {
    return this.modelName;
  }
  
  /**
   * Set the model name
   */
  public setModelName(modelName: string): void {
    this.modelName = modelName;
  }
  
  /**
   * Configure mock response behavior
   */
  public configure(options: MockResponseOptions): void {
    if (options.templates) {
      this.responseTemplates.addTemplates(options.templates);
    }
    
    if (options.errors) {
      this.errorSimulator.configure(options.errors);
    }
    
    if (options.latency) {
      this.latencyOptions = {
        ...this.latencyOptions,
        ...options.latency
      };
    }
    
    if (options.recordingMode !== undefined) {
      this.recordingMode = options.recordingMode;
      
      if (this.recordingMode !== RecordingMode.DISABLED && !this.recorder) {
        this.recorder = new MockResponseRecorder();
      }
    }
  }
  
  /**
   * Generate a completion from the mocked AI model
   */
  public async complete(params: AICompletionParams): Promise<AIResponse> {
    await this.simulateLatency();
    
    // Check for error simulation
    this.errorSimulator.maybeThrowError('complete');
    
    // Get prompt as string
    const promptStr = typeof params.prompt === 'string' 
      ? params.prompt 
      : JSON.stringify(params.prompt);
    
    // Record the request if in recording mode
    if (this.recordingMode === RecordingMode.RECORD && this.recorder) {
      this.recorder.recordRequest('complete', promptStr, params);
    }
    
    // Get response from template
    const responseText = this.responseTemplates.getTextResponse(promptStr, 'complete');
    
    // Create response object
    const response: AIResponse = {
      result: responseText,
      modelName: this.modelName,
      provider: this.provider,
      tokenUsage: this.generateMockTokenUsage(promptStr, responseText),
      timestamp: Date.now(),
      metadata: {
        ...params.metadata,
        mocked: true
      }
    };
    
    // Record response if in recording mode
    if (this.recordingMode === RecordingMode.RECORD && this.recorder) {
      this.recorder.recordResponse('complete', response);
    }
    
    return response;
  }
  
  /**
   * Generate a structured response from the mocked AI model
   */
  public async completeStructured<T>(params: AICompletionParams): Promise<AIResponse<T>> {
    await this.simulateLatency();
    
    // Check for error simulation
    this.errorSimulator.maybeThrowError('completeStructured');
    
    // Get prompt as string
    const promptStr = typeof params.prompt === 'string' 
      ? params.prompt 
      : JSON.stringify(params.prompt);
      
    // Get operation type from metadata or infer from prompt
    const operation = params.metadata?.operation as string || this.inferOperationType(promptStr);
    
    // Record the request if in recording mode
    if (this.recordingMode === RecordingMode.RECORD && this.recorder) {
      this.recorder.recordRequest('completeStructured', promptStr, { ...params, operation });
    }
    
    // Get structured response from template
    const structuredResult = this.responseTemplates.getStructuredResponse<T>(promptStr, operation);
    
    // Create response object
    const response: AIResponse<T> = {
      result: structuredResult,
      modelName: this.modelName,
      provider: this.provider,
      tokenUsage: this.generateMockTokenUsage(promptStr, JSON.stringify(structuredResult)),
      timestamp: Date.now(),
      metadata: {
        ...params.metadata,
        mocked: true,
        operation
      }
    };
    
    // Record response if in recording mode
    if (this.recordingMode === RecordingMode.RECORD && this.recorder) {
      this.recorder.recordResponse('completeStructured', response);
    }
    
    return response;
  }
  
  /**
   * Process a prompt through a mocked LangChain chain
   */
  public async processWithPromptTemplate(
    promptTemplate: PromptTemplate, 
    input: Record<string, any>
  ): Promise<AIResponse> {
    await this.simulateLatency();
    
    // Check for error simulation
    this.errorSimulator.maybeThrowError('processWithPromptTemplate');
    
    // Format the prompt template with input
    let formattedPrompt: string;
    try {
      formattedPrompt = await promptTemplate.format(input);
    } catch (error) {
      throw new Error(`Error formatting prompt template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Infer operation type from the formatted prompt
    const operation = this.inferOperationType(formattedPrompt);
    
    // Record the request if in recording mode
    if (this.recordingMode === RecordingMode.RECORD && this.recorder) {
      this.recorder.recordRequest('processWithPromptTemplate', formattedPrompt, { promptTemplate, input, operation });
    }
    
    // Get response from template
    const responseText = this.responseTemplates.getTextResponse(formattedPrompt, operation);
    
    // Create response object
    const response: AIResponse = {
      result: responseText,
      modelName: this.modelName,
      provider: this.provider,
      tokenUsage: this.generateMockTokenUsage(formattedPrompt, responseText),
      timestamp: Date.now(),
      metadata: {
        mocked: true,
        operation
      }
    };
    
    // Record response if in recording mode
    if (this.recordingMode === RecordingMode.RECORD && this.recorder) {
      this.recorder.recordResponse('processWithPromptTemplate', response);
    }
    
    return response;
  }
  
  /**
   * Get the recorded interactions if recording is enabled
   */
  public getRecordedInteractions() {
    return this.recorder?.getRecordings() || [];
  }
  
  /**
   * Save recorded interactions to a file
   */
  public saveRecordings(filePath?: string): boolean {
    if (this.recordingMode === RecordingMode.DISABLED || !this.recorder) {
      return false;
    }
    
    return this.recorder.saveRecordings(filePath);
  }
  
  /**
   * Load recorded interactions from a file for replay
   */
  public loadRecordings(filePath: string): boolean {
    if (!this.recorder) {
      this.recorder = new MockResponseRecorder();
    }
    
    const success = this.recorder.loadRecordings(filePath);
    if (success) {
      this.recordingMode = RecordingMode.REPLAY;
    }
    
    return success;
  }
  
  /**
   * Reset all mock configurations to defaults
   */
  public reset(): void {
    this.responseTemplates = new ResponseTemplateManager(DefaultMockResponses);
    this.errorSimulator = new ErrorSimulator();
    this.latencyOptions = {
      enabled: false,
      minLatencyMs: 100,
      maxLatencyMs: 500,
      jitterEnabled: true,
      timeoutProbability: 0,
      timeoutAfterMs: 30000
    };
    this.recordingMode = RecordingMode.DISABLED;
    this.recorder = undefined;
  }
  
  /**
   * Generate random token usage stats for mocking
   */
  private generateMockTokenUsage(prompt: string, response: string): { prompt: number; completion: number; total: number } {
    // Very roughly estimate token counts based on string lengths
    // In reality, tokenization is more complex but this is good enough for mocking
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(response.length / 4);
    
    return {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens
    };
  }
  
  /**
   * Simulate network latency in responses
   */
  private async simulateLatency(): Promise<void> {
    if (!this.latencyOptions.enabled) {
      return;
    }
    
    // Check for timeout simulation
    if (Math.random() < this.latencyOptions.timeoutProbability) {
      // Wait the timeout duration and then throw
      await new Promise(resolve => setTimeout(resolve, this.latencyOptions.timeoutAfterMs));
      throw new Error(`Request timed out after ${this.latencyOptions.timeoutAfterMs}ms`);
    }
    
    const baseLatency = this.latencyOptions.minLatencyMs;
    let latency = baseLatency;
    
    // Add jitter if enabled
    if (this.latencyOptions.jitterEnabled) {
      const jitterRange = this.latencyOptions.maxLatencyMs - this.latencyOptions.minLatencyMs;
      latency += Math.random() * jitterRange;
    }
    
    await new Promise(resolve => setTimeout(resolve, latency));
  }
  
  /**
   * Infer the operation type from the prompt content
   */
  private inferOperationType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('summarize') || lowerPrompt.includes('summary')) {
      return 'summarize';
    } else if (lowerPrompt.includes('categorize') || lowerPrompt.includes('categories') || lowerPrompt.includes('group')) {
      return 'categorize';
    } else if (lowerPrompt.includes('prioritize') || lowerPrompt.includes('priority')) {
      return 'prioritize';
    } else if (lowerPrompt.includes('suggest') || lowerPrompt.includes('recommendation')) {
      return 'suggest';
    } else if (lowerPrompt.includes('analyze') || lowerPrompt.includes('analysis')) {
      return 'analyze';
    }
    
    return 'default';
  }
}