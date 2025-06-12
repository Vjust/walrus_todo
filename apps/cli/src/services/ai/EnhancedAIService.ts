/**
 * EnhancedAIService - Enhanced AI service with new operations and features
 *
 * Extends the base AIService with:
 * - Advanced AI operations (group, schedule, detect_dependencies, estimate_effort)
 * - Result caching for improved performance
 * - Consistent prompting through PromptManager
 * - Configurable behavior through AIConfigManager
 */

// PromptTemplate imported but not used
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
} from '../../types/adapters/AIModelAdapter';
import { AIProviderFactory } from './AIProviderFactory';
import { PromptManager } from './PromptManager';
import { ResultCache } from './ResultCache';
import { AIConfigManager } from './AIConfigManager';
import { Logger } from '../../utils/Logger';

// Type definitions for new operation results
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

export class EnhancedAIService {
  private modelAdapter: AIModelAdapter;
  private verificationService?: AIVerificationService;
  private options: AIModelOptions;
  private promptManager: PromptManager;
  private resultCache: ResultCache;
  private configManager: AIConfigManager;
  private logger: Logger;

  constructor(
    apiKey?: string,
    provider?: AIProvider,
    modelName?: string,
    options: AIModelOptions = {},
    verificationService?: AIVerificationService
  ) {
    this?.logger = new Logger('EnhancedAIService');
    this?.promptManager = PromptManager.getInstance();
    this?.resultCache = ResultCache.getInstance();
    this?.configManager = AIConfigManager.getInstance();

    // Initialize result cache from config
    const globalConfig = this?.configManager?.getGlobalConfig();
    this?.resultCache?.configure({
      enabled: globalConfig.cacheEnabled,
      ttlMs: globalConfig.defaultTtl,
      maxEntries: globalConfig.maxCacheEntries,
    });

    this?.options = {
      temperature: globalConfig.defaultTemperature,
      maxTokens: globalConfig.defaultMaxTokens,
      ...options,
    };

    // If apiKey is provided directly, use it with the specified or default provider
    if (apiKey) {
      if (provider) {
        // Initialize with a fallback adapter, will be replaced asynchronously
        this?.modelAdapter = AIProviderFactory.createFallbackAdapter();

        // Then create the real adapter asynchronously
        AIProviderFactory.createProvider({
          provider,
          modelName,
          options: this.options,
        }).then(adapter => {
          this?.modelAdapter = adapter;
        }).catch(error => {
          this?.logger?.warn('Failed to initialize AI provider:', error);
          // Keep using the fallback adapter
        });
      } else {
        // Default to configured default provider if only apiKey is provided
        // Initialize with a fallback adapter, will be replaced asynchronously
        this?.modelAdapter = AIProviderFactory.createFallbackAdapter();

        // Then create the real adapter asynchronously
        AIProviderFactory.createProvider({
          provider: globalConfig.defaultProvider,
          modelName: modelName || 'grok-beta',
          options: this.options,
        }).then(adapter => {
          this?.modelAdapter = adapter;
        }).catch(error => {
          this?.logger?.warn('Failed to initialize default AI provider:', error);
          // Keep using the fallback adapter
        });
      }
    } else {
      // Otherwise, use the factory to get the default provider
      // Initialize with a fallback adapter, will be replaced asynchronously
      this?.modelAdapter = AIProviderFactory.createFallbackAdapter();

      // Get the default provider and create the real adapter asynchronously
      AIProviderFactory.getDefaultProvider().then(defaultProvider => {
        AIProviderFactory.createProvider({
          provider: provider || defaultProvider.provider,
          modelName: modelName || defaultProvider.modelName,
          options: this.options,
        }).then(adapter => {
          this?.modelAdapter = adapter;
        }).catch(error => {
          this?.logger?.warn('Failed to initialize AI provider from default:', error);
          // Keep using the fallback adapter
        });
      }).catch(error => {
        this?.logger?.warn('Failed to get default AI provider:', error);
        // Keep using the fallback adapter
      });
    }

    this?.verificationService = verificationService;
  }

  /**
   * Get the underlying provider adapter
   */
  public getProvider(): AIModelAdapter {
    return this.modelAdapter;
  }

  /**
   * Set a different provider adapter
   */
  public async setProvider(
    provider: AIProvider,
    modelName?: string,
    options?: AIModelOptions
  ): Promise<void> {
    // Create provider
    const adapter = await AIProviderFactory.createProvider({
      provider,
      modelName,
      options: { ...this.options, ...options },
    });

    // Set it
    this?.modelAdapter = adapter;
  }

  /**
   * Configure service behavior
   */
  public configure(
    config: Partial<{
      cacheEnabled: boolean;
      useEnhancedPrompts: boolean;
      defaultTemperature: number;
      defaultMaxTokens: number;
    }>
  ): void {
    if (config.cacheEnabled !== undefined) {
      this?.resultCache?.configure({ enabled: config.cacheEnabled });
    }

    if (
      config.useEnhancedPrompts !== undefined ||
      config.defaultTemperature !== undefined ||
      config.defaultMaxTokens !== undefined
    ) {
      this?.configManager?.updateGlobalConfig({
        useEnhancedPrompts: config.useEnhancedPrompts,
        defaultTemperature: config.defaultTemperature,
        defaultMaxTokens: config.defaultMaxTokens,
      });
    }
  }

  /**
   * Set a custom prompt for a specific operation
   */
  public setCustomPrompt(operation: string, promptTemplate: string): void {
    this?.promptManager?.setPromptOverride(operation, promptTemplate);
  }

  /**
   * Clear prompt customizations
   */
  public clearCustomPrompts(): void {
    this?.promptManager?.clearAllPromptOverrides();
  }

  /**
   * Generate a summary of the todos
   */
  async summarize(todos: Todo[]): Promise<string> {
    const operation = 'summarize';
    this?.logger?.debug(
      `Starting ${operation} operation with ${todos.length} todos`
    );

    // Check cache first
    const cachedResult = this?.resultCache?.get<string>(operation, todos);
    if (cachedResult) {
      this?.resultCache?.recordHit();
      this?.logger?.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }

    this?.resultCache?.recordMiss();

    // Get operation-specific config
    const opConfig = this?.configManager?.getOperationConfig(operation as any);
    const promptTemplate = this?.promptManager?.getPromptTemplate(
      operation,
      this?.modelAdapter?.getProviderName(),
      opConfig.enhanced
    );

    const response = await this?.modelAdapter?.processWithPromptTemplate(
      promptTemplate,
      {
        todos: todos
          .map(t => `- ${t.title}: ${t.description || 'No description'}`)
          .join('\n'),
      }
    );

    // Cache the result
    this?.resultCache?.set(operation, todos, response);

    return response.result;
  }

  /**
   * Generate a summary with blockchain verification
   */
  async summarizeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<string>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }

    const summary = await this.summarize(todos as any);
    return this?.verificationService?.createVerifiedSummary(
      todos,
      summary,
      privacyLevel
    );
  }

  /**
   * Categorize todos into logical groups
   */
  async categorize(todos: Todo[]): Promise<Record<string, string[]>> {
    const operation = 'categorize';
    this?.logger?.debug(
      `Starting ${operation} operation with ${todos.length} todos`
    );

    // Check cache first
    const cachedResult = this?.resultCache?.get<Record<string, string[]>>(
      operation,
      todos
    );
    if (cachedResult) {
      this?.resultCache?.recordHit();
      this?.logger?.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }

    this?.resultCache?.recordMiss();

    // Get operation-specific config
    const opConfig = this?.configManager?.getOperationConfig(operation as any);
    const promptTemplate = this?.promptManager?.getPromptTemplate(
      operation,
      this?.modelAdapter?.getProviderName(),
      opConfig.enhanced
    );

    const modelOptions = this?.configManager?.getModelOptions(operation as any);

    const response = await this?.modelAdapter?.completeStructured<
      Record<string, string[]>
    >({
      prompt: promptTemplate,
      input: {
        todos: todos
          .map(t => `- ${t.title}: ${t.description || 'No description'}`)
          .join('\n'),
      },
      options: modelOptions,
      metadata: { operation },
    });

    // Cache the result
    this?.resultCache?.set(operation, todos, response);

    return response.result || {};
  }

  /**
   * Categorize todos with blockchain verification
   */
  async categorizeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, string[]>>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }

    const categories = await this.categorize(todos as any);
    return this?.verificationService?.createVerifiedCategorization(
      todos,
      categories,
      privacyLevel
    );
  }

  /**
   * Prioritize todos based on importance and urgency
   */
  async prioritize(todos: Todo[]): Promise<Record<string, number>> {
    const operation = 'prioritize';
    this?.logger?.debug(
      `Starting ${operation} operation with ${todos.length} todos`
    );

    // Check cache first
    const cachedResult = this?.resultCache?.get<Record<string, number>>(
      operation,
      todos
    );
    if (cachedResult) {
      this?.resultCache?.recordHit();
      this?.logger?.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }

    this?.resultCache?.recordMiss();

    // Get operation-specific config
    const opConfig = this?.configManager?.getOperationConfig(operation as any);
    const promptTemplate = this?.promptManager?.getPromptTemplate(
      operation,
      this?.modelAdapter?.getProviderName(),
      opConfig.enhanced
    );

    const modelOptions = this?.configManager?.getModelOptions(operation as any);

    const response = await this?.modelAdapter?.completeStructured<
      Record<string, number>
    >({
      prompt: promptTemplate,
      options: modelOptions,
      metadata: { operation },
    });

    // Cache the result
    this?.resultCache?.set(operation, todos, response);

    return response.result || {};
  }

  /**
   * Prioritize todos with blockchain verification
   */
  async prioritizeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, number>>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }

    const priorities = await this.prioritize(todos as any);
    return this?.verificationService?.createVerifiedPrioritization(
      todos,
      priorities,
      privacyLevel
    );
  }

  /**
   * Suggest new todos based on existing ones
   */
  async suggest(todos: Todo[]): Promise<string[]> {
    const operation = 'suggest';
    this?.logger?.debug(
      `Starting ${operation} operation with ${todos.length} todos`
    );

    // Check cache first
    const cachedResult = this?.resultCache?.get<string[]>(operation, todos);
    if (cachedResult) {
      this?.resultCache?.recordHit();
      this?.logger?.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }

    this?.resultCache?.recordMiss();

    // Get operation-specific config
    const opConfig = this?.configManager?.getOperationConfig(operation as any);
    const promptTemplate = this?.promptManager?.getPromptTemplate(
      operation,
      this?.modelAdapter?.getProviderName(),
      opConfig.enhanced
    );

    const modelOptions = this?.configManager?.getModelOptions(operation as any);

    const response = await this?.modelAdapter?.completeStructured<string[]>({
      prompt: promptTemplate,
      options: modelOptions,
      metadata: { operation },
    });

    // Cache the result
    this?.resultCache?.set(operation, todos, response);

    return response.result || [];
  }

  /**
   * Suggest new todos with blockchain verification
   */
  async suggestWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<string[]>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }

    const suggestions = await this.suggest(todos as any);
    return this?.verificationService?.createVerifiedSuggestion(
      todos,
      suggestions,
      privacyLevel
    );
  }

  /**
   * Analyze todos for patterns, dependencies, and insights
   */
  async analyze(todos: Todo[]): Promise<Record<string, unknown>> {
    const operation = 'analyze';
    this?.logger?.debug(
      `Starting ${operation} operation with ${todos.length} todos`
    );

    // Check cache first
    const cachedResult = this?.resultCache?.get<Record<string, unknown>>(
      operation,
      todos
    );
    if (cachedResult) {
      this?.resultCache?.recordHit();
      this?.logger?.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }

    this?.resultCache?.recordMiss();

    // Get operation-specific config
    const opConfig = this?.configManager?.getOperationConfig(operation as any);
    const promptTemplate = this?.promptManager?.getPromptTemplate(
      operation,
      this?.modelAdapter?.getProviderName(),
      opConfig.enhanced
    );

    const modelOptions = this?.configManager?.getModelOptions(operation as any);

    const response = await this?.modelAdapter?.completeStructured<
      Record<string, unknown>
    >({
      prompt: promptTemplate,
      options: modelOptions,
      metadata: { operation },
    });

    // Cache the result
    this?.resultCache?.set(operation, todos, response);

    return response.result || {};
  }

  /**
   * Analyze todos with blockchain verification
   */
  async analyzeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, unknown>>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }

    const analysis = await this.analyze(todos as any);
    return this?.verificationService?.createVerifiedAnalysis(
      todos,
      analysis,
      privacyLevel
    );
  }

  /**
   * Group todos into workflow sequences or parallel tracks
   */
  async group(todos: Todo[]): Promise<GroupResult> {
    const operation = 'group';
    this?.logger?.debug(
      `Starting ${operation} operation with ${todos.length} todos`
    );

    // Check cache first
    const cachedResult = this?.resultCache?.get<GroupResult>(operation, todos);
    if (cachedResult) {
      this?.resultCache?.recordHit();
      this?.logger?.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }

    this?.resultCache?.recordMiss();

    // Get operation-specific config
    const opConfig = this?.configManager?.getOperationConfig(operation as any);
    const promptTemplate = this?.promptManager?.getPromptTemplate(
      operation,
      this?.modelAdapter?.getProviderName(),
      opConfig.enhanced
    );

    const modelOptions = this?.configManager?.getModelOptions(operation as any);

    const response = await this?.modelAdapter?.completeStructured<GroupResult>({
      prompt: promptTemplate,
      options: modelOptions,
      metadata: { operation },
    });

    // Cache the result
    this?.resultCache?.set(operation, todos, response);

    // Ensure we return at least an empty result
    return (
      response.result || { sequentialTracks: {}, parallelOpportunities: [] }
    );
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

    const groups = await this.group(todos as any);

    // For new operations, we'll use the existing verification types that are most similar
    const result = await this?.verificationService?.createVerifiedAnalysis(
      todos,
      groups,
      privacyLevel
    );
    return {
      ...result,
      result: result.result as unknown as GroupResult,
    };
  }

  /**
   * Create a suggested schedule for todos
   */
  async schedule(todos: Todo[]): Promise<ScheduleResult> {
    const operation = 'schedule';
    this?.logger?.debug(
      `Starting ${operation} operation with ${todos.length} todos`
    );

    // Check cache first
    const cachedResult = this?.resultCache?.get<ScheduleResult>(operation, todos);
    if (cachedResult) {
      this?.resultCache?.recordHit();
      this?.logger?.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }

    this?.resultCache?.recordMiss();

    // Get operation-specific config
    const opConfig = this?.configManager?.getOperationConfig(operation as any);
    const promptTemplate = this?.promptManager?.getPromptTemplate(
      operation,
      this?.modelAdapter?.getProviderName(),
      opConfig.enhanced
    );

    const modelOptions = this?.configManager?.getModelOptions(operation as any);

    const response = await this?.modelAdapter?.completeStructured<ScheduleResult>(
      {
        prompt: promptTemplate,
        options: modelOptions,
        metadata: { operation },
      }
    );

    // Cache the result
    this?.resultCache?.set(operation, todos, response);

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

    const schedule = await this.schedule(todos as any);

    // Using analysis verification type for new operation
    return this?.verificationService?.createVerifiedAnalysis(
      todos,
      schedule,
      privacyLevel
    );
  }

  /**
   * Detect dependencies between todos
   */
  async detectDependencies(todos: Todo[]): Promise<DependencyResult> {
    const operation = 'detect_dependencies';
    this?.logger?.debug(
      `Starting ${operation} operation with ${todos.length} todos`
    );

    // Check cache first
    const cachedResult = this?.resultCache?.get<DependencyResult>(
      operation,
      todos
    );
    if (cachedResult) {
      this?.resultCache?.recordHit();
      this?.logger?.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }

    this?.resultCache?.recordMiss();

    // Get operation-specific config
    const opConfig = this?.configManager?.getOperationConfig(operation as any);
    const promptTemplate = this?.promptManager?.getPromptTemplate(
      operation,
      this?.modelAdapter?.getProviderName(),
      opConfig.enhanced
    );

    const modelOptions = this?.configManager?.getModelOptions(operation as any);

    const response =
      await this?.modelAdapter?.completeStructured<DependencyResult>({
        prompt: promptTemplate,
        options: modelOptions,
        metadata: { operation },
      });

    // Cache the result
    this?.resultCache?.set(operation, todos, response);

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

    const dependencies = await this.detectDependencies(todos as any);

    // Using analysis verification type for new operation
    const result = await this?.verificationService?.createVerifiedAnalysis(
      todos,
      dependencies,
      privacyLevel
    );
    return {
      ...result,
      result: result.result as unknown as DependencyResult,
    };
  }

  /**
   * Estimate effort required for todos
   */
  async estimateEffort(todos: Todo[]): Promise<EffortResult> {
    const operation = 'estimate_effort';
    this?.logger?.debug(
      `Starting ${operation} operation with ${todos.length} todos`
    );

    // Check cache first
    const cachedResult = this?.resultCache?.get<EffortResult>(operation, todos);
    if (cachedResult) {
      this?.resultCache?.recordHit();
      this?.logger?.debug(`Cache hit for ${operation}`);
      return cachedResult.result;
    }

    this?.resultCache?.recordMiss();

    // Get operation-specific config
    const opConfig = this?.configManager?.getOperationConfig(operation as any);
    const promptTemplate = this?.promptManager?.getPromptTemplate(
      operation,
      this?.modelAdapter?.getProviderName(),
      opConfig.enhanced
    );

    const modelOptions = this?.configManager?.getModelOptions(operation as any);

    const response = await this?.modelAdapter?.completeStructured<EffortResult>({
      prompt: promptTemplate,
      options: modelOptions,
      metadata: { operation },
    });

    // Cache the result
    this?.resultCache?.set(operation, todos, response);

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

    const efforts = await this.estimateEffort(todos as any);

    // Using analysis verification type for new operation
    return this?.verificationService?.createVerifiedAnalysis(
      todos,
      efforts,
      privacyLevel
    );
  }

  /**
   * Clear operation cache
   */
  public clearCache(operation?: string): void {
    if (operation) {
      this?.resultCache?.clearOperation(operation as any);
    } else {
      this?.resultCache?.clear();
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
    return this?.resultCache?.getStats();
  }
}
