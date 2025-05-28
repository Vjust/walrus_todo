import { PromptTemplate } from '@langchain/core/prompts';
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
import { secureCredentialService } from './SecureCredentialService';
import { Logger } from '../../utils/Logger';

const logger = new Logger('AIService');

/**
 * Service responsible for AI-powered operations on todo items using various language models.
 * Provides a unified interface for todo-related AI operations including summarization,
 * categorization, prioritization, suggestion, and analysis - with optional blockchain
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

  /** Current operation type for consent management */
  private operationType?: string;

  /**
   * Creates a new instance of the AIService with the specified provider and configuration.
   * Uses fallback mechanisms to ensure service availability even if the primary provider fails.
   *
   * @param provider - Optional AI provider to use (defaults to configured default)
   * @param modelName - Optional model name to use with the provider
   * @param options - Configuration options for the AI model
   * @param verificationService - Optional service for blockchain verification of AI results
   */
  constructor(
    apiKey?: string,
    provider?: AIProvider,
    modelName?: string,
    options: AIModelOptions = {},
    verificationService?: AIVerificationService
  ) {
    // Sanitize and set default options with overrides from parameters
    this.options = this.sanitizeOptions({
      temperature: 0.7,
      maxTokens: 2000,
      ...options,
    });

    this.verificationService = verificationService;

    // Initialize with default fallback adapter immediately
    try {
      // Check if AIProviderFactory methods are available
      if (typeof AIProviderFactory.createDefaultAdapter === 'function') {
        const defaultAdapter = AIProviderFactory.createDefaultAdapter();
        this.modelAdapter = defaultAdapter;
      } else {
        logger.warn('AIProviderFactory.createDefaultAdapter is not available, using fallback');
        this.modelAdapter = this.createMinimalFallbackAdapter();
      }
    } catch (error) {
      logger.error(
        'AIService: Failed to initialize with default adapter:',
        error as Error
      );
      // Set a minimal fallback adapter to avoid null reference errors
      if (typeof AIProviderFactory.createFallbackAdapter === 'function') {
        this.modelAdapter = AIProviderFactory.createFallbackAdapter();
      } else {
        this.modelAdapter = this.createMinimalFallbackAdapter();
      }
    }

    // Initialize the full model adapter asynchronously
    this.initializeModelAdapter(apiKey, provider, modelName).catch(error => {
      logger.error('AIService: Model adapter initialization failed', error as Error, {
        provider,
        modelName,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
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
    apiKey?: string,
    provider?: AIProvider,
    modelName?: string
  ): Promise<void> {
    try {
      // Validate inputs first
      if (provider !== undefined && typeof provider !== 'string') {
        throw new Error(
          `Invalid provider type: expected string, got ${typeof provider}`
        );
      }
      if (modelName !== undefined && typeof modelName !== 'string') {
        throw new Error(
          `Invalid modelName type: expected string, got ${typeof modelName}`
        );
      }

      // If API key provided directly, use it (for testing/direct instantiation)
      if (apiKey) {
        // Validate and sanitize the API key
        this.validateApiKey(apiKey);
        
        const selectedProvider = provider || AIProvider.XAI;
        const selectedModelName = modelName || 'grok-beta';
        
        // Create adapter directly with provided API key
        this.modelAdapter = await AIProviderFactory.createProvider({
          provider: selectedProvider,
          modelName: selectedModelName,
          options: this.options,
          apiKey: apiKey,
        });
      } else {
        // Use the secure credential service to get provider info
        const defaultProvider = await AIProviderFactory.getDefaultProvider();

        // Ensure we have valid provider and modelName
        if (!defaultProvider.provider || !defaultProvider.modelName) {
          throw new Error(
            `Invalid default provider configuration: provider=${defaultProvider.provider}, modelName=${defaultProvider.modelName}`
          );
        }

        const selectedProvider = provider || defaultProvider.provider;
        const selectedModelName = modelName || defaultProvider.modelName;

        // Initialize the provider adapter
        this.modelAdapter = await AIProviderFactory.createProvider({
          provider: selectedProvider,
          modelName: selectedModelName,
          options: this.options,
          credentialService: secureCredentialService,
        });
      }
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      logger.error('AIService: Failed to initialize model adapter:', typedError, {
        provider,
        modelName,
        errorType: typedError.constructor.name,
      });
      throw new Error(`AIService initialization failed for provider ${provider || 'default'}: ${typedError.message}`);
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
  public cancelAllOperations(
    reason: string = 'User cancelled operation'
  ): void {
    if (
      this.modelAdapter &&
      typeof this.modelAdapter.cancelAllRequests === 'function'
    ) {
      this.modelAdapter.cancelAllRequests(reason);
    }
  }

  /**
   * Sets the current operation type for consent management
   *
   * This method allows the AI service to track which operation type is being performed
   * so that it can enforce user consent requirements for different types of AI operations.
   * Each operation type (e.g., summarize, categorize, analyze) may have different consent
   * requirements or privacy implications.
   *
   * @param operationType - The type of operation being performed (e.g., 'summarize', 'categorize')
   * @throws Error if the user has not consented to this operation type
   */
  public setOperationType(operationType: string): void {
    this.operationType = operationType;

    // Check if this adapter has consent checking capabilities
    if (
      this.modelAdapter &&
      typeof this.modelAdapter.checkConsentFor === 'function'
    ) {
      const hasConsent = this.modelAdapter.checkConsentFor(operationType);
      if (!hasConsent) {
        throw new Error(
          `AIService: User has not provided consent for operation type: ${operationType}. Please provide consent before using this AI operation.`
        );
      }
    }

    // Update options with the operation type for potential provider-specific handling
    this.options = {
      ...this.options,
      operation: operationType,
    };
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
  public async setProvider(
    provider: AIProvider,
    modelName?: string,
    options?: AIModelOptions
  ): Promise<void> {
    try {
      this.modelAdapter = await AIProviderFactory.createProvider({
        provider,
        modelName,
        options: { ...this.options, ...options },
        credentialService: secureCredentialService,
      });
    } catch (error) {
      const typedError =
        error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to set provider ${provider}`, typedError, {
        modelName,
        provider,
      });
      const initError = new Error(
        `Failed to initialize AI provider ${provider}${modelName ? ` with model ${modelName}` : ''}: ${typedError.message}`
      );
      (initError as Error & { cause?: Error }).cause = typedError;
      throw initError;
    }
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
    // Set operation type for consent management
    this.setOperationType('summarize');

    // Input validation: check for valid input
    if (todos === null || todos === undefined) {
      throw new Error('Cannot summarize null or undefined input');
    }
    
    if (!Array.isArray(todos)) {
      throw new Error('Input must be an array of todos');
    }
    
    if (todos.length === 0) {
      throw new Error('Cannot summarize empty todo list');
    }

    // Input validation: check for maximum input size to prevent DoS
    if (todos.length > 500) {
      throw new Error('Input exceeds maximum allowed size for summarization');
    }

    const prompt = PromptTemplate.fromTemplate(
      `Summarize the following todos in 2-3 sentences, focusing on key themes and priorities:\n\n{todos}`
    );

    // Format todos with minimal required fields and sanitize data
    const sanitizedTodos = todos.map(t => this.sanitizeTodo(t));
    const todoStr = sanitizedTodos
      .map(t => `- ${t.title}: ${t.description || 'No description'}`)
      .join('\n');

    // Check for prompt injection attempts
    this.detectPromptInjection(todoStr);

    try {
      const response = await this.modelAdapter.processWithPromptTemplate(
        prompt,
        { todos: todoStr }
      );
      return response.result;
    } catch (error) {
      // Ensure no sensitive data in error message
      const typedError =
        error instanceof Error ? error : new Error(String(error));
      const sanitizedMessage = this.sanitizeErrorMessage(typedError.message);
      const summaryError = new Error(
        `Failed to summarize todos: ${sanitizedMessage}`
      );
      (summaryError as Error & { cause?: Error }).cause = typedError;
      throw summaryError;
    }
  }

  /**
   * Sanitizes a todo object for privacy by removing sensitive or unnecessary fields
   * and detecting/anonymizing PII in content fields
   *
   * @param todo - The todo object to sanitize
   * @returns A sanitized copy of the todo with minimal required fields
   */
  private sanitizeTodo(todo: Todo): Partial<Todo> {
    // Extract only the fields we need
    const sanitized: Partial<Todo> = {
      id: todo.id,
      title: this.anonymizePII(todo.title),
      completed: todo.completed,
    };

    // Only include description if present
    if (todo.description) {
      sanitized.description = this.anonymizePII(todo.description);
    }

    // Only include priority if present
    if (todo.priority) {
      sanitized.priority = todo.priority;
    }

    // Only include tags if present (but as a new array to prevent reference issues)
    if (todo.tags && Array.isArray(todo.tags)) {
      sanitized.tags = [...todo.tags];
    }

    return sanitized;
  }

  /**
   * Detects and anonymizes personally identifiable information (PII) in text
   *
   * @param text - The text to anonymize
   * @returns Anonymized text with PII replaced
   */
  private anonymizePII(text: string): string {
    if (!text) return text;

    // First sanitize prompt injection patterns
    let sanitized = this.sanitizePromptInjection(text);

    // Common PII patterns
    const piiPatterns: Array<{ pattern: RegExp; replacement: string }> = [
      // Email addresses
      {
        pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        replacement: '[EMAIL]',
      },
      // Phone numbers
      { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE]' },
      // Social security numbers
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
      // Credit card numbers
      { pattern: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[CREDIT_CARD]' },
      // Physical addresses (simplified)
      {
        pattern:
          /\b\d+\s+[A-Z][a-z]+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Drive|Dr)\b/g,
        replacement: '[ADDRESS]',
      },
      // Likely names (simplified pattern)
      { pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, replacement: '[NAME]' },
    ];

    // Apply each pattern
    let anonymized = sanitized;
    for (const { pattern, replacement } of piiPatterns) {
      anonymized = anonymized.replace(pattern, replacement);
    }

    return anonymized;
  }

  /**
   * Sanitizes text to remove prompt injection patterns
   *
   * @param text - The text to sanitize
   * @returns Sanitized text with prompt injection patterns removed
   */
  private sanitizePromptInjection(text: string): string {
    if (!text) return text;

    // Prompt injection patterns to detect and remove
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

    let sanitized = text;
    for (const pattern of injectionPatterns) {
      // Create case-insensitive regex for each pattern
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      sanitized = sanitized.replace(regex, '[FILTERED]');
    }

    return sanitized;
  }

  /**
   * Validates API key format and security
   * 
   * @param apiKey - The API key to validate
   * @throws Error if API key is invalid or insecure
   */
  private validateApiKey(apiKey: string): void {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key: must be a non-empty string');
    }
    
    if (apiKey.length < 10) {
      throw new Error('Invalid API key format: too short');
    }
    
    // Check for common insecure patterns
    if (apiKey.includes(' ') || apiKey.includes('\n') || apiKey.includes('\t')) {
      throw new Error('Invalid API key format: contains whitespace characters');
    }
  }

  /**
   * Sanitizes options to prevent parameter injection
   * 
   * @param options - The options object to sanitize
   * @returns Sanitized options object
   */
  private sanitizeOptions(options: AIModelOptions): AIModelOptions {
    const sanitized: AIModelOptions = {};
    
    // Only allow known safe properties
    if (typeof options.temperature === 'number' && options.temperature >= 0 && options.temperature <= 2) {
      sanitized.temperature = options.temperature;
    }
    
    if (typeof options.maxTokens === 'number' && options.maxTokens > 0 && options.maxTokens <= 50000) {
      sanitized.maxTokens = options.maxTokens;
    }
    
    if (typeof options.baseUrl === 'string' && options.baseUrl.startsWith('https://')) {
      sanitized.baseUrl = options.baseUrl;
    }
    
    // Reject any options that try to disable security
    if (options.rejectUnauthorized === false) {
      throw new Error('Invalid SSL configuration: certificate validation disabled');
    }
    
    // Copy other safe options
    if (options.operation && typeof options.operation === 'string') {
      sanitized.operation = options.operation;
    }
    
    if (options.differentialPrivacy === true) {
      sanitized.differentialPrivacy = true;
      if (typeof options.epsilon === 'number' && options.epsilon > 0) {
        sanitized.epsilon = options.epsilon;
      }
    }
    
    if (options.collectUsageData === false) {
      sanitized.collectUsageData = false;
    }
    
    if (options.storePromptHistory === false) {
      sanitized.storePromptHistory = false;
    }
    
    return sanitized;
  }

  /**
   * Sanitizes error messages to remove any potentially sensitive information
   *
   * @param message - The error message to sanitize
   * @returns Sanitized error message
   */
  private sanitizeErrorMessage(message: string): string {
    // Redact API keys
    const apiKeyPattern =
      /(?:api[-_]?key|token|secret|password|credential)[^\w\n]*?\w+[-._=]*?([a-zA-Z0-9]{5,})/gi;
    let sanitized = message.replace(apiKeyPattern, (m, key) => {
      return m.replace(key, '[REDACTED]');
    });

    // Redact PII
    sanitized = this.anonymizePII(sanitized);

    // Remove detailed paths
    sanitized = sanitized.replace(/(?:\/[\w.-]+){3,}/g, '[PATH]');

    return sanitized;
  }

  /**
   * Detects potential prompt injection attempts in user input
   * 
   * @param input - The input text to check
   * @throws Error if prompt injection patterns are detected
   */
  private detectPromptInjection(input: string): void {
    const injectionPatterns = [
      'ignore previous instructions',
      'disregard earlier directives', 
      'forget the instructions above',
      'new instructions:',
      'instead, do the following:',
      'you are now',
      'act as',
      'forget everything',
      'system:',
      'assistant:',
      'human:',
    ];

    const lowerInput = input.toLowerCase();
    
    for (const pattern of injectionPatterns) {
      if (lowerInput.includes(pattern.toLowerCase())) {
        throw new Error('Potential prompt injection detected');
      }
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
    return this.verificationService.createVerifiedSummary(
      todos,
      summary,
      privacyLevel
    );
  }

  /**
   * Categorizes todos into logical groups based on their content and purpose.
   * Uses AI to determine optimal categorization based on todo titles and descriptions.
   *
   * @param todos - Array of todo items to categorize
   * @returns Promise resolving to a map of category names to arrays of todo IDs
   */
  async categorize(todos: Todo[]): Promise<Record<string, string[]>> {
    // Set operation type for consent management
    this.setOperationType('categorize');

    // Input validation: check for valid input
    if (todos === null || todos === undefined) {
      throw new Error('Cannot categorize null or undefined input');
    }
    
    if (!Array.isArray(todos)) {
      throw new Error('Input must be an array of todos');
    }
    
    if (todos.length === 0) {
      throw new Error('Cannot categorize empty todo list');
    }

    // Input validation: check for maximum input size to prevent DoS
    if (todos.length > 500) {
      throw new Error('Input exceeds maximum allowed size for categorization');
    }

    const prompt = PromptTemplate.fromTemplate(
      `Categorize the following todos into logical groups. Return the result as a JSON object where keys are category names and values are arrays of todo IDs.\n\n{todos}`
    );

    // Format todos with minimal required fields and sanitize data
    const sanitizedTodos = todos.map(t => this.sanitizeTodo(t));
    const todoStr = sanitizedTodos
      .map(
        t =>
          `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
      )
      .join('\n');

    try {
      // Apply differential privacy if enabled in options
      const privacyEnabled = this.options.differentialPrivacy === true;
      const privacyOptions = privacyEnabled
        ? {
            ...this.options,
            noiseFactor: this.options.epsilon || 0.5,
            temperature: 0.5,
          }
        : {
            ...this.options,
            temperature: 0.5,
          };

      const response = await this.modelAdapter.completeStructured<
        Record<string, string[]>
      >({
        prompt,
        input: { todos: todoStr },
        options: privacyOptions,
        metadata: { operation: 'categorize' },
      });

      // Validate response structure to prevent prototype pollution or invalid data
      const result = response.result || {};
      const sanitizedResult: Record<string, string[]> = {};

      // Ensure valid structure in the response
      Object.keys(result).forEach(category => {
        // Guard against prototype pollution or malformed response
        if (
          category === '__proto__' ||
          category === 'constructor' ||
          category === 'prototype'
        ) {
          return;
        }

        // Ensure values are arrays of strings
        const ids = result[category];
        if (Array.isArray(ids)) {
          sanitizedResult[category] = ids.filter(id => typeof id === 'string');
        }
      });

      return sanitizedResult;
    } catch (error) {
      // Ensure no sensitive data in error message
      const typedError =
        error instanceof Error ? error : new Error(String(error));
      const sanitizedMessage = this.sanitizeErrorMessage(typedError.message);
      const categorizeError = new Error(
        `Failed to categorize todos: ${sanitizedMessage}`
      );
      (categorizeError as Error & { cause?: Error }).cause = typedError;
      throw categorizeError;
    }
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
    return this.verificationService.createVerifiedCategorization(
      todos,
      categories,
      privacyLevel
    );
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
    const prompt = PromptTemplate.fromTemplate(
      `Prioritize the following todos on a scale of 1-10 (10 being highest priority). Consider urgency, importance, and dependencies.
      Return the result as a JSON object where keys are todo IDs and values are numeric priority scores.\n\n{todos}`
    );

    // Format todos with IDs for prioritization
    const todoStr = todos
      .map(
        t =>
          `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
      )
      .join('\n');

    const response = await this.modelAdapter.completeStructured<
      Record<string, number>
    >({
      prompt,
      input: { todos: todoStr },
      options: { ...this.options, temperature: 0.3 },
      metadata: { operation: 'prioritize' },
    });

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
    return this.verificationService.createVerifiedPrioritization(
      todos,
      priorities,
      privacyLevel
    );
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
    const prompt = PromptTemplate.fromTemplate(
      `Based on the following todos, suggest 3-5 additional todos that would be logical next steps or related tasks.
      Return the result as a JSON array of strings, where each string is a suggested todo title.\n\n{todos}`
    );

    // Format todos for suggestion generation
    const todoStr = todos
      .map(t => `- ${t.title}: ${t.description || 'No description'}`)
      .join('\n');

    // Pass the todos in the input object
    const response = await this.modelAdapter.completeStructured<string[]>({
      prompt: prompt,
      input: { todos: todoStr },
      options: { ...this.options, temperature: 0.8 },
      metadata: { operation: 'suggest' },
    });

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
    return this.verificationService.createVerifiedSuggestion(
      todos,
      suggestions,
      privacyLevel
    );
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
  async analyze(todos: Todo[]): Promise<Record<string, unknown>> {
    // Set operation type for consent management
    this.setOperationType('analyze');

    // Input validation: check for valid input
    if (todos === null || todos === undefined) {
      throw new Error('Cannot analyze null or undefined input');
    }
    
    if (!Array.isArray(todos)) {
      throw new Error('Input must be an array of todos');
    }
    
    if (todos.length === 0) {
      throw new Error('Cannot analyze empty todo list');
    }

    // Input validation: check for maximum input size to prevent DoS
    if (todos.length > 500) {
      throw new Error('Input exceeds maximum allowed size for analysis');
    }

    const prompt = PromptTemplate.fromTemplate(
      `Analyze the following todos for patterns, dependencies, and insights.
      Provide analysis including:
      - Key themes
      - Potential bottlenecks or dependencies
      - Time estimates if possible
      - Suggested workflow

      Return the result as a JSON object with analysis categories as keys.\n\n{todos}`
    );

    // Format todos with IDs for detailed analysis
    const todoStr = todos
      .map(
        t =>
          `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
      )
      .join('\n');

    const response = await this.modelAdapter.completeStructured<
      Record<string, unknown>
    >({
      prompt,
      input: { todos: todoStr },
      options: { ...this.options, temperature: 0.5 },
      metadata: { operation: 'analyze' },
    });

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
  ): Promise<VerifiedAIResult<Record<string, unknown>>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }

    const analysis = await this.analyze(todos);
    return this.verificationService.createVerifiedAnalysis(
      todos,
      analysis,
      privacyLevel
    );
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
    const prompt = PromptTemplate.fromTemplate(
      `Suggest 2-4 relevant tags for the following todo:\n\nTitle: {title}\nDescription: {description}\n\nReturn ONLY a JSON array of string tags, nothing else.`
    );

    try {
      const response = await this.modelAdapter.processWithPromptTemplate(
        prompt,
        {
          title: todo.title,
          description: todo.description || 'No description',
        }
      );

      // Parse the JSON array response
      try {
        return JSON.parse(response.result);
      } catch (error) {
        logger.error('Failed to parse suggested tags:', error as Error);
        throw new Error('Failed to parse tags response: ' + response.result);
      }
    } catch (error) {
      const typedError =
        error instanceof Error ? error : new Error(String(error));
      const tagsError = new Error(
        `Failed to suggest tags: ${typedError.message}`
      );
      (tagsError as Error & { cause?: Error }).cause = typedError;
      throw tagsError;
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
    const prompt = PromptTemplate.fromTemplate(
      `Based on this todo, suggest a priority level (must be exactly one of: "high", "medium", or "low"):\n\nTitle: {title}\nDescription: {description}\n\nReturn ONLY the priority level as a single word, nothing else.`
    );

    try {
      const response = await this.modelAdapter.processWithPromptTemplate(
        prompt,
        {
          title: todo.title,
          description: todo.description || 'No description',
        }
      );

      // Validate and normalize the priority response
      const priority = response.result.trim().toLowerCase();
      if (['high', 'medium', 'low'].includes(priority)) {
        return priority as 'high' | 'medium' | 'low';
      } else {
        logger.warn(
          `Invalid priority response: "${priority}", defaulting to "medium"`
        );
        return 'medium';
      }
    } catch (error) {
      logger.error('Priority suggestion error:', error as Error);
      return 'medium'; // Default to medium on error
    }
  }

  /**
   * Creates a minimal fallback adapter when AIProviderFactory is not available
   * @returns A basic AIModelAdapter implementation
   */
  private createMinimalFallbackAdapter(): AIModelAdapter {
    return {
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
        result: 'AI service temporarily unavailable',
        modelName: 'minimal-fallback',
        provider: AIProvider.XAI,
        timestamp: Date.now(),
      }),
      cancelAllRequests: () => {},
    };
  }
}

/**
 * Global singleton instance of the AIService for application-wide use.
 * This provides a consistent access point for AI functionality throughout the application.
 */
export const aiService = new AIService();
