import { PromptTemplate } from '@langchain/core/prompts';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { Todo } from '../../types/todo';
import { AIVerificationService, VerifiedAIResult } from './AIVerificationService';
import { AIPrivacyLevel } from '../../types/adapters/AIVerifierAdapter';
import { AIModelAdapter, AIProvider, AIModelOptions } from '../../types/adapters/AIModelAdapter';
import { AIProviderFactory } from './AIProviderFactory';
import { ResponseParser } from './ResponseParser';
import { secureCredentialService } from './SecureCredentialService';

export class AIService {
  private modelAdapter: AIModelAdapter;
  private verificationService?: AIVerificationService;
  private options: AIModelOptions;

  constructor(
    provider?: AIProvider,
    modelName?: string,
    options: AIModelOptions = {},
    verificationService?: AIVerificationService
  ) {
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
   * Initialize the model adapter asynchronously
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
   * Get the underlying provider adapter
   */
  public getProvider(): AIModelAdapter {
    return this.modelAdapter;
  }

  /**
   * Cancel all pending AI operations
   * @param reason Optional reason for cancellation
   */
  public cancelAllOperations(reason: string = 'User cancelled operation'): void {
    if (this.modelAdapter && typeof this.modelAdapter.cancelAllRequests === 'function') {
      this.modelAdapter.cancelAllRequests(reason);
    }
  }

  /**
   * Set a different provider adapter
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
   * Generate a summary of the todos
   */
  async summarize(todos: Todo[]): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(
      `Summarize the following todos in 2-3 sentences, focusing on key themes and priorities:\n\n{todos}`
    );

    const todoStr = todos.map(t => `- ${t.title}: ${t.description || 'No description'}`).join('\n');

    try {
      const response = await this.modelAdapter.processWithPromptTemplate(prompt, { todos: todoStr });
      return response.result;
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Failed to summarize todos: ${typedError.message}`, { cause: typedError });
    }
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
    
    const summary = await this.summarize(todos);
    return this.verificationService.createVerifiedSummary(todos, summary, privacyLevel);
  }

  /**
   * Categorize todos into logical groups
   */
  async categorize(todos: Todo[]): Promise<Record<string, string[]>> {
    const prompt = PromptTemplate.fromTemplate(
      `Categorize the following todos into logical groups. Return the result as a JSON object where keys are category names and values are arrays of todo IDs.\n\n{todos}`
    );

    const todoStr = todos.map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`).join('\n');
    
    const response = await this.modelAdapter.completeStructured<Record<string, string[]>>({
      prompt,
      options: { ...this.options, temperature: 0.5 },
      metadata: { operation: 'categorize' }
    });
    
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
    
    const categories = await this.categorize(todos);
    return this.verificationService.createVerifiedCategorization(todos, categories, privacyLevel);
  }

  /**
   * Prioritize todos based on importance and urgency
   */
  async prioritize(todos: Todo[]): Promise<Record<string, number>> {
    const prompt = PromptTemplate.fromTemplate(
      `Prioritize the following todos on a scale of 1-10 (10 being highest priority). Consider urgency, importance, and dependencies.
      Return the result as a JSON object where keys are todo IDs and values are numeric priority scores.\n\n{todos}`
    );

    const todoStr = todos.map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`).join('\n');
    
    const response = await this.modelAdapter.completeStructured<Record<string, number>>({
      prompt,
      options: { ...this.options, temperature: 0.3 },
      metadata: { operation: 'prioritize' }
    });
    
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
    
    const priorities = await this.prioritize(todos);
    return this.verificationService.createVerifiedPrioritization(todos, priorities, privacyLevel);
  }

  /**
   * Suggest new todos based on existing ones
   */
  async suggest(todos: Todo[]): Promise<string[]> {
    const prompt = PromptTemplate.fromTemplate(
      `Based on the following todos, suggest 3-5 additional todos that would be logical next steps or related tasks.
      Return the result as a JSON array of strings, where each string is a suggested todo title.\n\n{todos}`
    );

    const todoStr = todos.map(t => `- ${t.title}: ${t.description || 'No description'}`).join('\n');
    
    const response = await this.modelAdapter.completeStructured<string[]>({
      prompt,
      options: { ...this.options, temperature: 0.8 },
      metadata: { operation: 'suggest' }
    });
    
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
    
    const suggestions = await this.suggest(todos);
    return this.verificationService.createVerifiedSuggestion(todos, suggestions, privacyLevel);
  }

  /**
   * Analyze todos for patterns, dependencies, and insights
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

    const todoStr = todos.map(t => `- ID: ${t.id}, Title: ${t.title}, Description: ${t.description || 'No description'}`).join('\n');
    
    const response = await this.modelAdapter.completeStructured<Record<string, any>>({
      prompt,
      options: { ...this.options, temperature: 0.5 },
      metadata: { operation: 'analyze' }
    });
    
    return response.result || {};
  }
  
  /**
   * Analyze todos with blockchain verification
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
   * Suggest tags for a todo based on its content
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
   * Suggest priority for a todo based on its content
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

// Export singleton instance
export const aiService = new AIService();