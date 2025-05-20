import { PromptTemplate } from '@langchain/core/prompts';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { Todo } from '../../types/todo';
import { AIVerificationService, VerifiedAIResult } from './AIVerificationService';
import { AIPrivacyLevel } from '../../types/adapters/AIVerifierAdapter';
import { AIModelAdapter, AIProvider, AIModelOptions } from '../../types/adapters/AIModelAdapter';
import { AIProviderFactory } from './AIProviderFactory';
import { ResponseParser } from './ResponseParser';
import { secureCredentialService } from './SecureCredentialService';

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
    provider?: AIProvider,
    modelName?: string,
    options: AIModelOptions = {},
    verificationService?: AIVerificationService
  ) {
    // Set default options with overrides from parameters
    this.options = {
      temperature: 0.7,
      maxTokens: 2000,
      ...options
    };

    this.verificationService = verificationService;

    // Initialize with default fallback adapter immediately
    try {
      const defaultAdapter = AIProviderFactory.createDefaultAdapter();
      this.modelAdapter = defaultAdapter;
    } catch (error) {
      console.error('Failed to initialize with default adapter:', error);
      // Set a minimal fallback adapter to avoid null reference errors
      this.modelAdapter = AIProviderFactory.createFallbackAdapter();
    }

    // Initialize the full model adapter asynchronously
    this.initializeModelAdapter(provider, modelName)
      .catch(error => {
        console.error(
          'Model adapter initialization failed:',
          error instanceof Error ? error.message : String(error),
          { provider, modelName }
        );
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
    } catch (error) {
      console.error('Failed to initialize model adapter:', error);
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
    if (this.modelAdapter && typeof this.modelAdapter.checkConsentFor === 'function') {
      const hasConsent = this.modelAdapter.checkConsentFor(operationType);
      if (!hasConsent) {
        throw new Error(`User has not provided consent for operation type: ${operationType}`);
      }
    }
    
    // Update options with the operation type for potential provider-specific handling
    this.options = {
      ...this.options,
      operation: operationType
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
  public async setProvider(provider: AIProvider, modelName?: string, options?: AIModelOptions): Promise<void> {
    try {
      this.modelAdapter = await AIProviderFactory.createProvider({
        provider,
        modelName,
        options: { ...this.options, ...options },
        credentialService: secureCredentialService
      });
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `Failed to set provider ${provider}:`,
        typedError.message,
        { modelName, provider }
      );
      throw new Error(
        `Failed to initialize AI provider ${provider}${modelName ? ` with model ${modelName}` : ''}: ${typedError.message}`,
        { cause: typedError }
      );
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
    
    // Input validation: check for empty todos
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
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
    const todoStr = sanitizedTodos.map(t => `- ${t.title}: ${t.description || 'No description'}`).join('\n');

    try {
      // Apply differential privacy if enabled in options
      const privacyEnabled = this.options.differentialPrivacy === true;
      const privacyOptions = privacyEnabled ? {
        ...this.options,
        noiseFactor: this.options.epsilon || 0.5,
      } : this.options;
      
      const response = await this.modelAdapter.processWithPromptTemplate(prompt, { todos: todoStr }, privacyOptions);
      return response.result;
    } catch (error) {
      // Ensure no sensitive data in error message
      const typedError = error instanceof Error ? error : new Error(String(error));
      const sanitizedMessage = this.sanitizeErrorMessage(typedError.message);
      throw new Error(`Failed to summarize todos: ${sanitizedMessage}`, { cause: typedError });
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
      completed: todo.completed
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
    
    // Common PII patterns
    const piiPatterns: Array<{pattern: RegExp, replacement: string}> = [
      // Email addresses
      {pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[EMAIL]'},
      // Phone numbers
      {pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE]'},
      // Social security numbers
      {pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]'},
      // Credit card numbers
      {pattern: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[CREDIT_CARD]'},
      // Physical addresses (simplified)
      {pattern: /\b\d+\s+[A-Z][a-z]+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Drive|Dr)\b/g, replacement: '[ADDRESS]'},
      // Likely names (simplified pattern)
      {pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, replacement: '[NAME]'}
    ];
    
    // Apply each pattern
    let anonymized = text;
    for (const {pattern, replacement} of piiPatterns) {
      anonymized = anonymized.replace(pattern, replacement);
    }
    
    return anonymized;
  }
  
  /**
   * Sanitizes error messages to remove any potentially sensitive information
   * 
   * @param message - The error message to sanitize
   * @returns Sanitized error message
   */
  private sanitizeErrorMessage(message: string): string {
    // Redact API keys
    const apiKeyPattern = /(?:api[-_]?key|token|secret|password|credential)[^\w\n]*?\w+[-._=]*?([a-zA-Z0-9]{5,})/gi;
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
    // Set operation type for consent management
    this.setOperationType('categorize');
    
    // Input validation: check for empty todos
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
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
    const todoStr = sanitizedTodos.map(t => 
      `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`
    ).join('\n');

    try {
      // Apply differential privacy if enabled in options
      const privacyEnabled = this.options.differentialPrivacy === true;
      const privacyOptions = privacyEnabled ? {
        ...this.options,
        noiseFactor: this.options.epsilon || 0.5,
        temperature: 0.5
      } : { 
        ...this.options, 
        temperature: 0.5 
      };
      
      const response = await this.modelAdapter.completeStructured<Record<string, string[]>>({
        prompt,
        input: { todos: todoStr },
        options: privacyOptions,
        metadata: { operation: 'categorize' }
      });
      
      // Validate response structure to prevent prototype pollution or invalid data
      const result = response.result || {};
      const sanitizedResult: Record<string, string[]> = {};
      
      // Ensure valid structure in the response
      Object.keys(result).forEach(category => {
        // Guard against prototype pollution or malformed response
        if (category === '__proto__' || category === 'constructor' || category === 'prototype') {
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
      const typedError = error instanceof Error ? error : new Error(String(error));
      const sanitizedMessage = this.sanitizeErrorMessage(typedError.message);
      throw new Error(`Failed to categorize todos: ${sanitizedMessage}`, { cause: typedError });
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
    const prompt = PromptTemplate.fromTemplate(
      `Prioritize the following todos on a scale of 1-10 (10 being highest priority). Consider urgency, importance, and dependencies.
      Return the result as a JSON object where keys are todo IDs and values are numeric priority scores.\n\n{todos}`
    );

    // Format todos with IDs for prioritization
    const todoStr = todos.map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`).join('\n');

    const response = await this.modelAdapter.completeStructured<Record<string, number>>({
      prompt,
      input: { todos: todoStr },
      options: { ...this.options, temperature: 0.3 },
      metadata: { operation: 'prioritize' }
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
    const prompt = PromptTemplate.fromTemplate(
      `Based on the following todos, suggest 3-5 additional todos that would be logical next steps or related tasks.
      Return the result as a JSON array of strings, where each string is a suggested todo title.\n\n{todos}`
    );

    // Format todos for suggestion generation
    const todoStr = todos.map(t => `- ${t.title}: ${t.description || 'No description'}`).join('\n');

    // Pass the todos in the input object
    const response = await this.modelAdapter.completeStructured<string[]>({
      prompt: prompt,
      input: { todos: todoStr },
      options: { ...this.options, temperature: 0.8 },
      metadata: { operation: 'suggest' }
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
    const todoStr = todos.map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`).join('\n');

    const response = await this.modelAdapter.completeStructured<Record<string, any>>({
      prompt,
      input: { todos: todoStr },
      options: { ...this.options, temperature: 0.5 },
      metadata: { operation: 'analyze' }
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
    const prompt = PromptTemplate.fromTemplate(
      `Suggest 2-4 relevant tags for the following todo:\n\nTitle: {title}\nDescription: {description}\n\nReturn ONLY a JSON array of string tags, nothing else.`
    );

    try {
      const response = await this.modelAdapter.processWithPromptTemplate(prompt, {
        title: todo.title,
        description: todo.description || 'No description'
      });

      // Parse the JSON array response
      try {
        return JSON.parse(response.result);
      } catch (error) {
        console.error('Failed to parse suggested tags:', error);
        throw new Error('Failed to parse tags response: ' + response.result);
      }
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Failed to suggest tags: ${typedError.message}`, { cause: typedError });
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
      const response = await this.modelAdapter.processWithPromptTemplate(prompt, {
        title: todo.title,
        description: todo.description || 'No description'
      });

      // Validate and normalize the priority response
      const priority = response.result.trim().toLowerCase();
      if (['high', 'medium', 'low'].includes(priority)) {
        return priority as 'high' | 'medium' | 'low';
      } else {
        console.warn(`Invalid priority response: "${priority}", defaulting to "medium"`);
        return 'medium';
      }
    } catch (error) {
      console.error('Priority suggestion error:', error);
      return 'medium'; // Default to medium on error
    }
  }
}

/**
 * Global singleton instance of the AIService for application-wide use.
 * This provides a consistent access point for AI functionality throughout the application.
 */
export const aiService = new AIService();