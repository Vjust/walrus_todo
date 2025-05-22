/**
 * MockAIProvider - Main class for mocking AI provider responses
 * 
 * A comprehensive mocking system for AI providers that implements the AIModelAdapter interface.
 * This class provides a flexible framework for testing AI-dependent functionality with:
 * - Customizable response templates for different operations
 * - Configurable error simulation with various failure scenarios
 * - Network latency simulation with jitter and timeout capabilities
 * - Request/response recording for playback in tests
 * 
 * Use this for unit and integration tests where real AI calls would be impractical,
 * expensive, or introduce flakiness into test results.
 * 
 * @example
 * ```typescript
 * // Basic usage with default mock responses
 * const mockAI = new MockAIProvider();
 * const response = await mockAI.complete({ prompt: "Summarize these tasks" });
 * 
 * // Configure with custom responses and error simulation
 * mockAI.configure({
 *   templates: { 
 *     summarize: { textResponse: "Custom summary response" }
 *   },
 *   errors: {
 *     errorProbability: 0.2,
 *     errorTypes: ['network', 'timeout']
 *   }
 * });
 * ```
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
  LatencyOptions, 
  RecordingMode
} from './types';
import { DefaultMockResponses } from './templates/DefaultResponses';
import { MockResponseRecorder } from './MockResponseRecorder';
import { ResponseTemplateManager } from './ResponseTemplateManager';
import { ErrorSimulator } from './ErrorSimulator';

/**
 * MockAIProvider implements the AIModelAdapter interface to provide
 * a fully-featured mock for AI model interactions in testing environments.
 * 
 * It supports text completions, structured data responses, and prompt template
 * processing with configurable response templates, latency simulation, and error injection.
 * 
 * @implements {AIModelAdapter}
 */
export class MockAIProvider implements AIModelAdapter {
  /** The AI provider being mocked (XAI, OpenAI, etc.) */
  protected provider: AIProvider;
  
  /** The model name being used for mock responses */
  protected modelName: string;
  
  /** Configuration options for the mock AI model */
  protected options: AIModelOptions;
  
  /** Manager for response templates that determine mock outputs */
  private responseTemplates: ResponseTemplateManager;
  
  /** Simulator for injecting errors into mock AI responses */
  private errorSimulator: ErrorSimulator;
  
  /** Optional recorder for capturing mock interactions */
  private recorder?: MockResponseRecorder;
  
  /**
   * Configuration for simulated network latency
   * Controls response timing, jitter, and potential timeouts
   */
  private latencyOptions: LatencyOptions = {
    enabled: false,
    minLatencyMs: 100,
    maxLatencyMs: 500,
    jitterEnabled: true,
    timeoutProbability: 0,
    timeoutAfterMs: 30000
  };
  
  /** Current recording mode for mock interactions */
  private recordingMode: RecordingMode = RecordingMode.DISABLED;
  
  /**
   * Creates a new MockAIProvider instance
   * 
   * @param provider - The AI provider to mock (defaults to XAI)
   * @param modelName - The name to use for the mock model (defaults to 'mock-model')
   * @param options - Model options like temperature and token limits
   * @param mockResponses - Custom response templates (defaults to standard templates)
   */
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
   * Gets the name of the AI provider being mocked
   * 
   * @returns The provider enum value (XAI, OPENAI, etc.)
   */
  public getProviderName(): AIProvider {
    return this.provider;
  }
  
  /**
   * Gets the name of the current model being mocked
   * 
   * @returns The model name string
   */
  public getModelName(): string {
    return this.modelName;
  }
  
  /**
   * Sets the mock model name
   * 
   * @param modelName - The new model name to use
   */
  public setModelName(modelName: string): void {
    this.modelName = modelName;
  }
  
  /**
   * Configures the mock provider's behavior
   * 
   * This method allows comprehensive configuration of the mock's behavior including:
   * - Custom response templates for different operations
   * - Error simulation settings
   * - Network latency simulation
   * - Recording mode for capturing and replaying interactions
   * 
   * @param options - Configuration options for the mock provider
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
   * Generates a text completion from the mocked AI model
   * 
   * Simulates an AI completion call by:
   * 1. Applying configured latency simulation
   * 2. Potentially throwing errors based on error configuration
   * 3. Recording the interaction if recording is enabled
   * 4. Returning a template-based response with mock token usage stats
   * 
   * @param params - The completion parameters including prompt and metadata
   * @returns A promise resolving to an AIResponse with the mock completion
   * @throws Error if the error simulator is configured to fail this operation
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
   * Generates a structured response from the mocked AI model
   * 
   * Similar to the complete method, but returns a typed structured object
   * instead of a plain text response. Useful for testing JSON or structured
   * data expectations from AI operations.
   * 
   * @template T - The expected return structure type
   * @param params - The completion parameters including prompt and metadata
   * @returns A promise resolving to an AIResponse with structured data of type T
   * @throws Error if the error simulator is configured to fail this operation
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
   * Processes a prompt through a mocked LangChain template
   * 
   * Simulates using a LangChain PromptTemplate to format variables
   * into a prompt and then generating a response. This allows testing
   * of code that uses LangChain's templating without real AI calls.
   * 
   * @param promptTemplate - The LangChain prompt template to use
   * @param input - Variables to inject into the template
   * @returns A promise resolving to an AIResponse with the mock completion
   * @throws Error if template formatting fails or if error simulation is triggered
   */
  public async processWithPromptTemplate(
    promptTemplate: PromptTemplate, 
    input: Record<string, unknown>
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
   * Gets all recorded AI interactions
   * 
   * Retrieves the full history of recorded requests and responses if
   * recording has been enabled. Useful for test assertions or debugging.
   * 
   * @returns Array of recorded interactions or empty array if recording is disabled
   */
  public getRecordedInteractions() {
    return this.recorder?.getRecordings() || [];
  }
  
  /**
   * Saves recorded interactions to a JSON file
   * 
   * Allows saving the history of requests and responses to a file
   * for later replay or analysis. This is useful for creating
   * reproducible test scenarios.
   * 
   * @param filePath - Optional path to save recordings (defaults to timestamp-based filename)
   * @returns true if recordings were saved successfully, false otherwise
   */
  public saveRecordings(filePath?: string): boolean {
    if (this.recordingMode === RecordingMode.DISABLED || !this.recorder) {
      return false;
    }
    
    return this.recorder.saveRecordings(filePath);
  }
  
  /**
   * Loads recorded interactions from a JSON file
   * 
   * Imports previously recorded AI interactions for replay in tests.
   * When loaded, the mock will use these recorded interactions instead
   * of generating new responses.
   * 
   * @param filePath - Path to the JSON file containing recorded interactions
   * @returns true if recordings were loaded successfully, false otherwise
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
   * Resets all mock configurations to default values
   * 
   * Clears all custom configurations including:
   * - Response templates (reverts to defaults)
   * - Error simulation settings
   * - Latency options
   * - Recording mode and recorded interactions
   * 
   * Use this to ensure a clean state between tests.
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
   * Generates mock token usage statistics
   * 
   * Creates realistic-looking token usage estimates based on the
   * length of the prompt and response strings. This is a rough
   * approximation as real tokenization is more complex.
   * 
   * @param prompt - The input prompt string
   * @param response - The output response string
   * @returns Object containing prompt, completion, and total token counts
   * @private
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
   * Simulates network latency in AI responses
   * 
   * Adds configurable delay before responses to simulate real-world
   * network conditions. Can be configured with:
   * - Fixed or random latency within a range
   * - Jitter for more realistic variation
   * - Random timeouts to simulate failed requests
   * 
   * @throws Error if timeout simulation is triggered
   * @private
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
   * Infers the operation type from prompt content
   * 
   * Analyzes the prompt text to determine what kind of operation
   * is being requested (summarize, categorize, etc.). This helps
   * in selecting the appropriate response template.
   * 
   * @param prompt - The prompt string to analyze
   * @returns The inferred operation type as a string
   * @private
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