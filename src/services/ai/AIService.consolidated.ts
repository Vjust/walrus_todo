/**
 * Consolidated AI Service
 * 
 * This is a unified AI service implementation that combines features from both
 * the original AIService and EnhancedAIService classes.
 * 
 * Key features include:
 * - Core AI operations (summarize, categorize, prioritize, suggest, analyze)
 * - Advanced operations (group, schedule, detect_dependencies, estimate_effort)
 * - Result caching for improved performance
 * - Blockchain verification of AI results
 * - Configurable behavior through AIConfigManager
 * - Consistent prompting through PromptManager
 */

// PromptTemplate imported but not used
import { Todo } from '../../types/todo';
import { AIVerificationService, VerifiedAIResult } from './AIVerificationService';
import { AIPrivacyLevel } from '../../types/adapters/AIVerifierAdapter';
import { AIModelAdapter, AIProvider, AIModelOptions } from '../../types/adapters/AIModelAdapter';
import { AIProviderFactory } from './AIProviderFactory';
// ResponseParser imported but not used
import { PromptManager } from './PromptManager';
import { ResultCache } from './ResultCache';
import { AIConfigManager } from './AIConfigManager';
import { Logger } from '../../utils/Logger';
import { secureCredentialService } from './SecureCredentialService';

// Type definitions for advanced operations
export interface GroupResult {
  sequentialTracks: Record<string, string[]>;
  parallelOpportunities: string[][];
}

export interface ScheduleResult {
  [todoId: string]: {
    start: number;  // Days from now
    duration: number;  // Days
    due: number;  // Days from now
  };
}

export interface DependencyResult {
  dependencies: Record<string, string[]>;  // todoId -> [dependency ids]
  blockers: Record<string, string[]>;  // todoId -> [blocker ids]
}

export interface EffortEstimate {
  effort: number;  // 1-5 scale
  reasoning: string;
  estimated_hours?: number;
}

export interface EffortResult {
  [todoId: string]: EffortEstimate;
}

/**
 * Service responsible for AI-powered operations on todo items using various language models.
 * Provides a unified interface for todo-related AI operations with optional blockchain
 * verification capabilities for enhanced security and provability.
 * 
 * This service acts as a facade over different AI model adapters (OpenAI, XAI, etc.)
 * and centralizes access to AI functionality throughout the application.
 */
export class AIService {
  /** The active AI model adapter implementation */
  private modelAdapter: AIModelAdapter;
  
  /** Optional service for blockchain verification of AI results */
  private verificationService?: AIVerificationService;
  
  /** Configuration options for the AI model */
  private options: AIModelOptions;

  /** Prompt manager for consistent prompting */
  private promptManager: PromptManager;
  
  /** Cache for AI operation results */
  private resultCache: ResultCache;
  
  /** Configuration manager for AI behavior */
  private configManager: AIConfigManager;
  
  /** Logger for diagnostic information */
  private logger: Logger;

  /** Singleton instance */
  private static _instance: AIService;

  /**
   * Get the singleton instance of AIService
   */
  public static getInstance(): AIService {
    if (!AIService._instance) {
      AIService._instance = new AIService();
    }
    return AIService._instance;
  }

  /**
   * Creates a new instance of the AIService with the specified provider and configuration.
   * Uses fallback mechanisms to ensure service availability even if the primary provider fails.
   * 
   * @param provider - Optional AI provider to use (defaults to configured default)
   * @param modelName - Optional model name to use with the provider
   * @param options - Configuration options for the AI model
   * @param verificationService - Optional service for blockchain verification of AI results
   */
  private constructor(
    provider?: AIProvider,
    modelName?: string,
    options: AIModelOptions = {},
    verificationService?: AIVerificationService
  ) {
    this.logger = new Logger('AIService');
    this.promptManager = PromptManager.getInstance();
    this.resultCache = ResultCache.getInstance();
    this.configManager = AIConfigManager.getInstance();
    
    // Initialize result cache from config
    const globalConfig = this.configManager.getGlobalConfig();
    this.resultCache.configure({
      enabled: globalConfig.cacheEnabled,
      ttlMs: globalConfig.defaultTtl,
      maxEntries: globalConfig.maxCacheEntries
    });
    
    // Set default options with overrides from parameters
    this.options = {
      temperature: globalConfig.defaultTemperature,
      maxTokens: globalConfig.defaultMaxTokens,
      ...options
    };

    this.verificationService = verificationService;

    // Initialize with default fallback adapter immediately
    try {
      const defaultAdapter = AIProviderFactory.createDefaultAdapter();
      this.modelAdapter = defaultAdapter;
    } catch (_error) {
      this.logger.error('Failed to initialize with default adapter:', error);
      // Set a minimal fallback adapter to avoid null reference errors
      this.modelAdapter = AIProviderFactory.createFallbackAdapter();
    }

    // Initialize the full model adapter asynchronously
    this.initializeModelAdapter(provider, modelName)
      .catch(error => {
        this.logger.error('Model adapter initialization failed:', error instanceof Error ? error : new Error(String(error)));
      });
  }

  /**
   * Initializes the model adapter asynchronously with secure credential handling.
   * This allows the service to start immediately with a fallback adapter while
   * loading the actual provider credentials in the background.
   * 
   * @param provider - Optional AI provider to use 
   * @param modelName - Optional model name to use with the provider
   * @returns Promise resolving when initialization is complete
   * @throws Error if initialization fails after fallback
   */
  private async initializeModelAdapter(
    provider?: AIProvider,
    modelName?: string
  ): Promise<void> {
    try {
      // Use the secure credential service to get provider info
      const defaultProvider = await AIProviderFactory.getDefaultProvider();
      const selectedProvider = provider || defaultProvider.provider;
      
      // Initialize the provider adapter
      this.modelAdapter = await AIProviderFactory.createProvider({
        provider: selectedProvider,
        modelName: modelName || defaultProvider.modelName,
        options: this.options,
        credentialService: secureCredentialService
      });
    } catch (_error) {
      this.logger.error('Failed to initialize model adapter:', error);
      throw error;
    }
  }

  /**
   * Returns the currently active model adapter.
   * Useful for direct access to provider-specific functionality.
   * 
   * @returns The currently active AI model adapter
   */
  public getProvider(): AIModelAdapter {
    return this.modelAdapter;
  }

  /**
   * Cancels all pending AI operations.
   * This is useful for aborting operations when the user changes context or requests cancellation.
   * 
   * @param reason - Optional reason for cancellation for logging purposes
   */
  public cancelAllOperations(reason: string = 'User cancelled operation'): void {
    if (this.modelAdapter && typeof this.modelAdapter.cancelAllRequests === 'function') {
      this.modelAdapter.cancelAllRequests(reason);
    }
  }

  /**
   * Changes the active AI provider and model.
   * This allows switching between different AI services during runtime.
   * 
   * @param provider - The AI provider to use
   * @param modelName - Optional specific model name to use with the provider
   * @param options - Optional configuration options for the AI model
   * @returns Promise resolving when the provider is fully initialized
   * @throws Error if provider initialization fails
   */
  public async setProvider(provider: AIProvider, modelName?: string, options?: AIModelOptions): Promise<void> {
    try {
      this.modelAdapter = await AIProviderFactory.createProvider({
        provider,
        modelName,
        options: { ...this.options, ...options },
        credentialService: secureCredentialService
      });
    } catch (_error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to set provider ${provider}:`, typedError);
      // errorMessage would be used for more detailed error reporting
      // const errorMessage = `Failed to initialize AI provider ${provider}${modelName ? ` with model ${modelName}` : ''}: ${typedError.message}`;
      throw typedError;
    }
  }

  /**
   * Configure service behavior
   */
  public configure(config: Partial<{
    cacheEnabled: boolean;
    useEnhancedPrompts: boolean;
    defaultTemperature: number;
    defaultMaxTokens: number;
  }>): void {
    if (config.cacheEnabled !== undefined) {
      this.resultCache.configure({ enabled: config.cacheEnabled });
    }
    
    if (config.useEnhancedPrompts !== undefined ||
        config.defaultTemperature !== undefined ||
        config.defaultMaxTokens !== undefined) {
      
      this.configManager.updateGlobalConfig({
        useEnhancedPrompts: config.useEnhancedPrompts,
        defaultTemperature: config.defaultTemperature,
        defaultMaxTokens: config.defaultMaxTokens
      });
    }
  }

  /**
   * Set a custom prompt for a specific operation
   */
  public setCustomPrompt(operation: string, promptTemplate: string): void {
    this.promptManager.setPromptOverride(operation, promptTemplate);
  }

  /**
   * Clear prompt customizations
   */
  public clearCustomPrompts(): void {
    this.promptManager.clearAllPromptOverrides();
  }

  /**
   * Generates a concise summary of a collection of todos.
   * The summary focuses on key themes and priorities across the todos.
   * 
   * @param todos - Array of todo items to summarize
   * @returns Promise resolving to a string summary
   * @throws Error if summarization fails
   */
  async summarize(todos: Todo[]): Promise<string> {
    const operation = 'summarize';
    this.logger.debug(`Starting ${operation} operation with ${todos.length} todos`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<string>(operation, todos);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );

    // Format todos for the prompt
    const todoStr = todos.map(t => `- ${t.title}: ${t.description || 'No description'}`).join('\n');
    
    try {
      const response = await this.modelAdapter.processWithPromptTemplate(promptTemplate, { 
        todos: todoStr 
      });
      
      // Cache the result
      this.resultCache.set(operation, todos, response);
      
      return response.result;
    } catch (_error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      const summaryError = new Error(`Failed to summarize todos: ${typedError.message}`);
      (summaryError as any).cause = typedError;
      throw summaryError;
    }
  }
  
  /**
   * Generates a summary with blockchain verification for provability.
   * Creates a cryptographic proof of the summary that can be verified on-chain.
   * Verification details depend on the specified privacy level.
   * 
   * @param todos - Array of todo items to summarize
   * @param privacyLevel - Level of privacy for blockchain verification
   * @returns Promise resolving to a verified result containing the summary
   * @throws Error if verification service is not initialized or summarization fails
   */
  async summarizeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<string>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }
    
    const summary = await this.summarize(todos);
    return this.verificationService.createVerifiedSummary(todos, summary, privacyLevel);
  }

  /**
   * Categorizes todos into logical groups based on their content and purpose.
   * Uses AI to determine optimal categorization based on todo titles and descriptions.
   * 
   * @param todos - Array of todo items to categorize
   * @returns Promise resolving to a map of category names to arrays of todo IDs
   */
  async categorize(todos: Todo[]): Promise<Record<string, string[]>> {
    const operation = 'categorize';
    this.logger.debug(`Starting ${operation} operation with ${todos.length} todos`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<Record<string, string[]>>(operation, todos);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );

    // Format todos with IDs for categorization
    const todoStr = todos.map(t => 
      `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
    ).join('\n');
    
    const modelOptions = this.configManager.getModelOptions(operation);
    
    const response = await this.modelAdapter.completeStructured<Record<string, string[]>>({
      prompt: promptTemplate,
      input: { todos: todoStr },
      options: modelOptions,
      metadata: { operation }
    });
    
    // Cache the result
    this.resultCache.set(operation, todos, response);
    
    return response.result || {};
  }
  
  /**
   * Categorizes todos with blockchain verification for provability.
   * Creates a cryptographic proof of the categorization that can be verified on-chain.
   * 
   * @param todos - Array of todo items to categorize
   * @param privacyLevel - Level of privacy for blockchain verification
   * @returns Promise resolving to a verified result containing categorization
   * @throws Error if verification service is not initialized
   */
  async categorizeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, string[]>>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }
    
    const categories = await this.categorize(todos);
    return this.verificationService.createVerifiedCategorization(todos, categories, privacyLevel);
  }

  /**
   * Prioritizes todos based on importance, urgency, and dependencies.
   * Uses AI to score todos on a 1-10 scale (10 being highest priority).
   * The scoring takes into account implicit relationships between tasks.
   * 
   * @param todos - Array of todo items to prioritize
   * @returns Promise resolving to a map of todo IDs to priority scores (1-10)
   */
  async prioritize(todos: Todo[]): Promise<Record<string, number>> {
    const operation = 'prioritize';
    this.logger.debug(`Starting ${operation} operation with ${todos.length} todos`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<Record<string, number>>(operation, todos);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );

    // Format todos with IDs for prioritization
    const todoStr = todos.map(t => 
      `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
    ).join('\n');
    
    const modelOptions = this.configManager.getModelOptions(operation);
    
    const response = await this.modelAdapter.completeStructured<Record<string, number>>({
      prompt: promptTemplate,
      input: { todos: todoStr },
      options: modelOptions,
      metadata: { operation }
    });
    
    // Cache the result
    this.resultCache.set(operation, todos, response);
    
    return response.result || {};
  }
  
  /**
   * Prioritizes todos with blockchain verification for provability.
   * Creates a cryptographic proof of the prioritization that can be verified on-chain.
   * 
   * @param todos - Array of todo items to prioritize
   * @param privacyLevel - Level of privacy for blockchain verification
   * @returns Promise resolving to a verified result containing prioritization
   * @throws Error if verification service is not initialized
   */
  async prioritizeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, number>>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }
    
    const priorities = await this.prioritize(todos);
    return this.verificationService.createVerifiedPrioritization(todos, priorities, privacyLevel);
  }

  /**
   * Suggests new todos based on the context of existing ones.
   * Uses AI to identify logical next steps or related tasks that would complement
   * the current todo list, helping users complete projects more effectively.
   * 
   * @param todos - Array of existing todo items to base suggestions on
   * @returns Promise resolving to an array of suggested todo titles
   */
  async suggest(todos: Todo[]): Promise<string[]> {
    const operation = 'suggest';
    this.logger.debug(`Starting ${operation} operation with ${todos.length} todos`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<string[]>(operation, todos);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );

    // Format todos for suggestion generation
    const todoStr = todos.map(t => 
      `- ${t.title}: ${t.description || 'No description'}`
    ).join('\n');
    
    const modelOptions = this.configManager.getModelOptions(operation);
    
    // Pass the todos in the input object
    const response = await this.modelAdapter.completeStructured<string[]>({
      prompt: promptTemplate,
      input: { todos: todoStr },
      options: modelOptions,
      metadata: { operation }
    });
    
    // Cache the result
    this.resultCache.set(operation, todos, response);
    
    return response.result || [];
  }
  
  /**
   * Suggests new todos with blockchain verification for provability.
   * Creates a cryptographic proof of the suggestions that can be verified on-chain.
   * 
   * @param todos - Array of existing todo items to base suggestions on
   * @param privacyLevel - Level of privacy for blockchain verification
   * @returns Promise resolving to a verified result containing suggestions
   * @throws Error if verification service is not initialized
   */
  async suggestWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<string[]>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }
    
    const suggestions = await this.suggest(todos);
    return this.verificationService.createVerifiedSuggestion(todos, suggestions, privacyLevel);
  }

  /**
   * Analyzes todos for patterns, dependencies, and provides insights.
   * Generates a comprehensive analysis including themes, bottlenecks, 
   * time estimates, and workflow suggestions to help users better understand
   * and organize their work.
   * 
   * @param todos - Array of todo items to analyze
   * @returns Promise resolving to a structured analysis object
   */
  async analyze(todos: Todo[]): Promise<Record<string, any>> {
    const operation = 'analyze';
    this.logger.debug(`Starting ${operation} operation with ${todos.length} todos`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<Record<string, any>>(operation, todos);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );

    // Format todos with IDs for detailed analysis
    const todoStr = todos.map(t => 
      `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
    ).join('\n');
    
    const modelOptions = this.configManager.getModelOptions(operation);
    
    const response = await this.modelAdapter.completeStructured<Record<string, any>>({
      prompt: promptTemplate,
      input: { todos: todoStr },
      options: modelOptions,
      metadata: { operation }
    });
    
    // Cache the result
    this.resultCache.set(operation, todos, response);
    
    return response.result || {};
  }
  
  /**
   * Analyzes todos with blockchain verification for provability.
   * Creates a cryptographic proof of the analysis that can be verified on-chain.
   * 
   * @param todos - Array of todo items to analyze
   * @param privacyLevel - Level of privacy for blockchain verification
   * @returns Promise resolving to a verified result containing analysis
   * @throws Error if verification service is not initialized
   */
  async analyzeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, any>>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }
    
    const analysis = await this.analyze(todos);
    return this.verificationService.createVerifiedAnalysis(todos, analysis, privacyLevel);
  }

  /**
   * Suggests relevant tags for a single todo based on its content.
   * Uses AI to identify 2-4 tags that categorize the todo for better organization
   * and searchability.
   * 
   * @param todo - The todo item to generate tags for
   * @returns Promise resolving to an array of suggested tags
   * @throws Error if tag suggestion or response parsing fails
   */
  async suggestTags(todo: Todo): Promise<string[]> {
    const operation = 'suggest_tags';
    this.logger.debug(`Starting ${operation} operation for todo ${todo.id}`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<string[]>(operation, [todo]);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );
    
    try {
      const response = await this.modelAdapter.processWithPromptTemplate(promptTemplate, {
        title: todo.title,
        description: todo.description || 'No description'
      });

      try {
        const tags = JSON.parse(response.result);
        
        // Cache the result
        this.resultCache.set(operation, [todo], { 
          result: tags,
          modelName: this.modelAdapter.getProviderName(),
          provider: this.modelAdapter.getProviderName(),
          timestamp: Date.now()
        });
        
        return tags;
      } catch (_error) {
        this.logger.error('Failed to parse suggested tags:', error);
        throw new Error('Failed to parse tags response: ' + response.result);
      }
    } catch (_error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to suggest tags: ${typedError.message}`);
      throw typedError;
    }
  }

  /**
   * Suggests a priority level for a single todo based on its content.
   * Uses AI to determine if the todo should be high, medium, or low priority
   * based on the title and description. Defaults to medium priority if analysis fails.
   * 
   * @param todo - The todo item to suggest priority for
   * @returns Promise resolving to 'high', 'medium', or 'low' priority
   */
  async suggestPriority(todo: Todo): Promise<'high' | 'medium' | 'low'> {
    const operation = 'suggest_priority';
    this.logger.debug(`Starting ${operation} operation for todo ${todo.id}`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<'high' | 'medium' | 'low'>(operation, [todo]);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );
    
    try {
      const response = await this.modelAdapter.processWithPromptTemplate(promptTemplate, {
        title: todo.title,
        description: todo.description || 'No description'
      });

      // Validate and normalize the priority response
      const priority = response.result.trim().toLowerCase();
      if (['high', 'medium', 'low'].includes(priority)) {
        const typedPriority = priority as 'high' | 'medium' | 'low';
        
        // Cache the result
        this.resultCache.set(operation, [todo], { 
          result: typedPriority,
          modelName: this.modelAdapter.getProviderName(),
          provider: this.modelAdapter.getProviderName(),
          timestamp: Date.now()
        });
        
        return typedPriority;
      } else {
        this.logger.warn(`Invalid priority response: "${priority}", defaulting to "medium"`);
        return 'medium';
      }
    } catch (_error) {
      this.logger.error('Priority suggestion error:', error);
      return 'medium'; // Default to medium on error
    }
  }

  /**
   * Group todos into workflow sequences or parallel tracks
   */
  async group(todos: Todo[]): Promise<GroupResult> {
    const operation = 'group';
    this.logger.debug(`Starting ${operation} operation with ${todos.length} todos`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<GroupResult>(operation, todos);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );

    const todoStr = todos.map(t => 
      `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
    ).join('\n');
    
    const modelOptions = this.configManager.getModelOptions(operation);
    
    const response = await this.modelAdapter.completeStructured<GroupResult>({
      prompt: promptTemplate,
      input: { todos: todoStr },
      options: modelOptions,
      metadata: { operation }
    });
    
    // Cache the result
    this.resultCache.set(operation, todos, response);
    
    // Ensure we return at least an empty result
    return response.result || { sequentialTracks: {}, parallelOpportunities: [] };
  }

  /**
   * Group todos with blockchain verification
   */
  async groupWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<GroupResult>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }
    
    const groups = await this.group(todos);
    
    // For new operations, we'll use the existing verification types that are most similar
    const result = await this.verificationService.createVerifiedAnalysis(todos, groups, privacyLevel);
    return {
      ...result,
      result: result.result as unknown as GroupResult
    };
  }

  /**
   * Create a suggested schedule for todos
   */
  async schedule(todos: Todo[]): Promise<ScheduleResult> {
    const operation = 'schedule';
    this.logger.debug(`Starting ${operation} operation with ${todos.length} todos`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<ScheduleResult>(operation, todos);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );

    const todoStr = todos.map(t => 
      `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
    ).join('\n');
    
    const modelOptions = this.configManager.getModelOptions(operation);
    
    const response = await this.modelAdapter.completeStructured<ScheduleResult>({
      prompt: promptTemplate,
      input: { todos: todoStr },
      options: modelOptions,
      metadata: { operation }
    });
    
    // Cache the result
    this.resultCache.set(operation, todos, response);
    
    return response.result || {};
  }

  /**
   * Schedule todos with blockchain verification
   */
  async scheduleWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<ScheduleResult>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }
    
    const schedule = await this.schedule(todos);
    
    // Using analysis verification type for new operation
    return this.verificationService.createVerifiedAnalysis(todos, schedule, privacyLevel);
  }

  /**
   * Detect dependencies between todos
   */
  async detectDependencies(todos: Todo[]): Promise<DependencyResult> {
    const operation = 'detect_dependencies';
    this.logger.debug(`Starting ${operation} operation with ${todos.length} todos`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<DependencyResult>(operation, todos);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );

    const todoStr = todos.map(t => 
      `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
    ).join('\n');
    
    const modelOptions = this.configManager.getModelOptions(operation);
    
    const response = await this.modelAdapter.completeStructured<DependencyResult>({
      prompt: promptTemplate,
      input: { todos: todoStr },
      options: modelOptions,
      metadata: { operation }
    });
    
    // Cache the result
    this.resultCache.set(operation, todos, response);
    
    return response.result || { dependencies: {}, blockers: {} };
  }

  /**
   * Detect dependencies with blockchain verification
   */
  async detectDependenciesWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<DependencyResult>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }
    
    const dependencies = await this.detectDependencies(todos);
    
    // Using analysis verification type for new operation
    const result = await this.verificationService.createVerifiedAnalysis(todos, dependencies, privacyLevel);
    return {
      ...result,
      result: result.result as unknown as DependencyResult
    };
  }

  /**
   * Estimate effort required for todos
   */
  async estimateEffort(todos: Todo[]): Promise<EffortResult> {
    const operation = 'estimate_effort';
    this.logger.debug(`Starting ${operation} operation with ${todos.length} todos`);
    
    // Check cache first
    const cachedResult = this.resultCache.get<EffortResult>(operation, todos);
    if (cachedResult) {
      this.resultCache.recordHit();
      this.logger.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }
    
    this.resultCache.recordMiss();
    
    // Get operation-specific config
    const opConfig = this.configManager.getOperationConfig(operation);
    const promptTemplate = this.promptManager.getPromptTemplate(
      operation, 
      this.modelAdapter.getProviderName(),
      opConfig.enhanced
    );

    const todoStr = todos.map(t => 
      `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
    ).join('\n');
    
    const modelOptions = this.configManager.getModelOptions(operation);
    
    const response = await this.modelAdapter.completeStructured<EffortResult>({
      prompt: promptTemplate,
      input: { todos: todoStr },
      options: modelOptions,
      metadata: { operation }
    });
    
    // Cache the result
    this.resultCache.set(operation, todos, response);
    
    return response.result || {};
  }

  /**
   * Estimate effort with blockchain verification
   */
  async estimateEffortWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<EffortResult>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }
    
    const efforts = await this.estimateEffort(todos);
    
    // Using analysis verification type for new operation
    return this.verificationService.createVerifiedAnalysis(todos, efforts, privacyLevel);
  }

  /**
   * Clear operation cache
   */
  public clearCache(operation?: string): void {
    if (operation) {
      this.resultCache.clearOperation(operation);
    } else {
      this.resultCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    hitRate: number;
    operations: Record<string, number>;
  } {
    return this.resultCache.getStats();
  }
}

/**
 * Global singleton instance of the AIService for application-wide use.
 * This provides a consistent access point for AI functionality throughout the application.
 */
export const aiService = AIService.getInstance();
