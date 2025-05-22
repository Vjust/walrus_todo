/**
 * Safe AI Service Wrapper
 * 
 * A robust wrapper around the AI service that prevents AI failures from halting
 * the core system. This wrapper provides graceful degradation, extensive error
 * handling, and fallback responses when AI services are unavailable.
 * 
 * Key features:
 * - Catches all AI service errors without throwing
 * - Provides graceful fallback responses
 * - Health checking for AI service availability
 * - API key validation without system crashes
 * - Default responses for all AI operations
 * - Makes all AI operations optional and non-blocking
 * 
 * @module services/ai/SafeAIService
 */

import { Todo } from '../../types/todo';
import { AIService } from './aiService';
import { AIProvider } from './types';
import { AIPrivacyLevel } from '../../types/adapters/AIVerifierAdapter';
import { VerifiedAIResult } from './AIVerificationService';
import { Logger } from '../../utils/Logger';
import { AIProviderFactory } from './AIProviderFactory';

/**
 * Interface for AI operation results with error handling
 */
export interface SafeAIResult<T> {
  /** Whether the operation was successful */
  success: boolean;
  /** The result data if successful */
  result?: T;
  /** Error message if failed */
  error?: string;
  /** Whether AI was available during the operation */
  aiAvailable: boolean;
  /** Whether a fallback response was used */
  usedFallback: boolean;
  /** The operation that was attempted */
  operation: string;
}

/**
 * Default fallback responses for different AI operations
 */
const DEFAULT_RESPONSES = {
  summarize: (todoCount: number) => 
    `Summary: You have ${todoCount} todo${todoCount !== 1 ? 's' : ''} in your list. Consider reviewing and prioritizing them.`,
  
  categorize: (todos: Todo[]) => {
    const categories: Record<string, string[]> = { 'General': [] };
    todos.forEach(todo => categories.General.push(todo.id));
    return categories;
  },
  
  prioritize: (todos: Todo[]) => {
    const priorities: Record<string, number> = {};
    todos.forEach(todo => {
      // Assign priority based on existing todo priority field or default to medium (5)
      if (todo.priority === 'high') {
        priorities[todo.id] = 8;
      } else if (todo.priority === 'low') {
        priorities[todo.id] = 3;
      } else {
        priorities[todo.id] = 5; // medium
      }
    });
    return priorities;
  },
  
  suggest: () => [
    "Review completed tasks for insights",
    "Set realistic deadlines for pending items",
    "Break down complex tasks into smaller steps"
  ],
  
  analyze: (todoCount: number) => ({
    keyThemes: ['Task management', 'Productivity'],
    totalTasks: todoCount,
    completedTasks: 0,
    suggestions: ['Consider organizing tasks by priority', 'Review and update task descriptions'],
    workflow: 'Review → Prioritize → Execute → Complete'
  }),
  
  suggestTags: () => ['general', 'task'],
  
  suggestPriority: () => 'medium' as const
};

/**
 * Safe AI Service that wraps the core AI service with comprehensive error handling
 * and fallback mechanisms to ensure AI failures never halt the core system.
 */
export class SafeAIService {
  private aiService: AIService | null = null;
  private logger: Logger;
  private isInitialized = false;
  private initializationError: string | null = null;
  private lastHealthCheck = 0;
  private readonly healthCheckInterval = 30000; // 30 seconds
  private aiHealthy = false;

  constructor() {
    this.logger = Logger.getInstance();
    this.initializeAIService();
  }

  /**
   * Initializes the AI service with comprehensive error handling
   */
  private async initializeAIService(): Promise<void> {
    try {
      this.logger.debug('Initializing Safe AI Service...');
      
      // Try to create AI service
      this.aiService = new AIService();
      this.isInitialized = true;
      this.initializationError = null;
      
      // Perform initial health check
      await this.performHealthCheck();
      
      this.logger.debug('Safe AI Service initialized successfully');
    } catch (_error) {
      this.isInitialized = false;
      this.aiHealthy = false;
      this.initializationError = error instanceof Error ? error.message : String(error);
      
      this.logger.warn(`AI Service initialization failed: ${this.initializationError}. Fallback mode enabled.`);
      
      // Don't throw - just log and continue in fallback mode
      this.aiService = null;
    }
  }

  /**
   * Performs a health check on the AI service
   */
  private async performHealthCheck(): Promise<boolean> {
    const now = Date.now();
    
    // Skip if we checked recently
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.aiHealthy;
    }
    
    this.lastHealthCheck = now;
    
    if (!this.aiService) {
      this.aiHealthy = false;
      return false;
    }

    try {
      // Try a simple test with minimal todos
      const testTodos: Todo[] = [{
        id: 'health-check',
        title: 'Test todo',
        description: 'Health check test',
        completed: false,
        priority: 'medium',
        tags: [],
        private: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];

      // Attempt a simple summarize operation with short timeout
      const testResult = await Promise.race([
        this.aiService.summarize(testTodos),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )
      ]);

      this.aiHealthy = typeof testResult === 'string' && testResult.length > 0;
      
      if (this.aiHealthy) {
        this.logger.debug('AI service health check passed');
      } else {
        this.logger.warn('AI service health check failed: invalid response');
      }
      
      return this.aiHealthy;
    } catch (_error) {
      this.aiHealthy = false;
      this.logger.warn(`AI service health check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Checks if AI service is available and healthy
   */
  public async isAIAvailable(): Promise<boolean> {
    if (!this.isInitialized || !this.aiService) {
      return false;
    }

    return await this.performHealthCheck();
  }

  /**
   * Gets the current AI service status
   */
  public getAIStatus(): {
    initialized: boolean;
    healthy: boolean;
    error: string | null;
    lastHealthCheck: Date | null;
  } {
    return {
      initialized: this.isInitialized,
      healthy: this.aiHealthy,
      error: this.initializationError,
      lastHealthCheck: this.lastHealthCheck > 0 ? new Date(this.lastHealthCheck) : null
    };
  }

  /**
   * Safely executes an AI operation with comprehensive error handling
   */
  private async safeExecute<T>(
    operation: string,
    aiOperation: () => Promise<T>,
    fallbackResult: T
  ): Promise<SafeAIResult<T>> {
    const aiAvailable = await this.isAIAvailable();
    
    if (!aiAvailable) {
      this.logger.debug(`AI not available for ${operation}, using fallback`);
      return {
        success: true,
        result: fallbackResult,
        aiAvailable: false,
        usedFallback: true,
        operation
      };
    }

    try {
      // Set AI feature requested flag
      AIProviderFactory.setAIFeatureRequested(true);
      
      const result = await Promise.race([
        aiOperation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`${operation} operation timeout`)), 15000)
        )
      ]);

      this.logger.debug(`AI operation ${operation} completed successfully`);
      
      return {
        success: true,
        result,
        aiAvailable: true,
        usedFallback: false,
        operation
      };
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI operation ${operation} failed: ${errorMessage}, using fallback`);
      
      // Mark AI as unhealthy if operation failed
      this.aiHealthy = false;
      
      return {
        success: true, // Still successful due to fallback
        result: fallbackResult,
        error: errorMessage,
        aiAvailable: true,
        usedFallback: true,
        operation
      };
    }
  }

  /**
   * Safely summarizes todos with fallback
   */
  public async summarize(todos: Todo[]): Promise<SafeAIResult<string>> {
    const fallback = DEFAULT_RESPONSES.summarize(todos.length);
    
    return this.safeExecute(
      'summarize',
      () => this.aiService.summarize(todos),
      fallback
    );
  }

  /**
   * Safely summarizes todos with blockchain verification
   */
  public async summarizeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<SafeAIResult<VerifiedAIResult<string>>> {
    const aiAvailable = await this.isAIAvailable();
    
    if (!aiAvailable || !this.aiService) {
      const fallbackSummary = DEFAULT_RESPONSES.summarize(todos.length);
      const fallbackResult: VerifiedAIResult<string> = {
        result: fallbackSummary,
        verification: {
          id: 'fallback-summary',
          requestHash: '',
          responseHash: '',
          user: '',
          provider: 'fallback',
          timestamp: Date.now(),
          verificationType: 0, // AIActionType.SUMMARIZE
          metadata: { usedFallback: 'true' }
        }
      };
      
      return {
        success: true,
        result: fallbackResult,
        aiAvailable: false,
        usedFallback: true,
        operation: 'summarizeWithVerification'
      };
    }

    try {
      const result = await this.aiService.summarizeWithVerification(todos, privacyLevel);
      return {
        success: true,
        result,
        aiAvailable: true,
        usedFallback: false,
        operation: 'summarizeWithVerification'
      };
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI verification summarize failed: ${errorMessage}, using fallback`);
      
      const fallbackSummary = DEFAULT_RESPONSES.summarize(todos.length);
      const fallbackResult: VerifiedAIResult<string> = {
        result: fallbackSummary,
        verification: {
          id: 'fallback-summary',
          requestHash: '',
          responseHash: '',
          user: '',
          provider: 'fallback',
          timestamp: Date.now(),
          verificationType: 0, // AIActionType.SUMMARIZE
          metadata: { usedFallback: 'true', error: errorMessage }
        }
      };
      
      return {
        success: true,
        result: fallbackResult,
        error: errorMessage,
        aiAvailable: true,
        usedFallback: true,
        operation: 'summarizeWithVerification'
      };
    }
  }

  /**
   * Safely categorizes todos with fallback
   */
  public async categorize(todos: Todo[]): Promise<SafeAIResult<Record<string, string[]>>> {
    const fallback = DEFAULT_RESPONSES.categorize(todos);
    
    return this.safeExecute(
      'categorize',
      () => this.aiService.categorize(todos),
      fallback
    );
  }

  /**
   * Safely categorizes todos with blockchain verification
   */
  public async categorizeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<SafeAIResult<VerifiedAIResult<Record<string, string[]>>>> {
    const aiAvailable = await this.isAIAvailable();
    
    if (!aiAvailable || !this.aiService) {
      const fallbackCategories = DEFAULT_RESPONSES.categorize(todos);
      const fallbackResult: VerifiedAIResult<Record<string, string[]>> = {
        result: fallbackCategories,
        verification: {
          id: 'fallback-categorize',
          requestHash: '',
          responseHash: '',
          user: '',
          provider: 'fallback',
          timestamp: Date.now(),
          verificationType: 1, // AIActionType.CATEGORIZE
          metadata: { usedFallback: 'true' }
        }
      };
      
      return {
        success: true,
        result: fallbackResult,
        aiAvailable: false,
        usedFallback: true,
        operation: 'categorizeWithVerification'
      };
    }

    try {
      const result = await this.aiService.categorizeWithVerification(todos, privacyLevel);
      return {
        success: true,
        result,
        aiAvailable: true,
        usedFallback: false,
        operation: 'categorizeWithVerification'
      };
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI verification categorize failed: ${errorMessage}, using fallback`);
      
      const fallbackCategories = DEFAULT_RESPONSES.categorize(todos);
      const fallbackResult: VerifiedAIResult<Record<string, string[]>> = {
        result: fallbackCategories,
        verification: {
          id: 'fallback-categorize',
          requestHash: '',
          responseHash: '',
          user: '',
          provider: 'fallback',
          timestamp: Date.now(),
          verificationType: 1, // AIActionType.CATEGORIZE
          metadata: { usedFallback: 'true', error: errorMessage }
        }
      };
      
      return {
        success: true,
        result: fallbackResult,
        error: errorMessage,
        aiAvailable: true,
        usedFallback: true,
        operation: 'categorizeWithVerification'
      };
    }
  }

  /**
   * Safely prioritizes todos with fallback
   */
  public async prioritize(todos: Todo[]): Promise<SafeAIResult<Record<string, number>>> {
    const fallback = DEFAULT_RESPONSES.prioritize(todos);
    
    return this.safeExecute(
      'prioritize',
      () => this.aiService.prioritize(todos),
      fallback
    );
  }

  /**
   * Safely prioritizes todos with blockchain verification
   */
  public async prioritizeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<SafeAIResult<VerifiedAIResult<Record<string, number>>>> {
    const aiAvailable = await this.isAIAvailable();
    
    if (!aiAvailable || !this.aiService) {
      const fallbackPriorities = DEFAULT_RESPONSES.prioritize(todos);
      const fallbackResult: VerifiedAIResult<Record<string, number>> = {
        result: fallbackPriorities,
        verification: {
          id: 'fallback-prioritize',
          requestHash: '',
          responseHash: '',
          user: '',
          provider: 'fallback',
          timestamp: Date.now(),
          verificationType: 2, // AIActionType.PRIORITIZE
          metadata: { usedFallback: 'true' }
        }
      };
      
      return {
        success: true,
        result: fallbackResult,
        aiAvailable: false,
        usedFallback: true,
        operation: 'prioritizeWithVerification'
      };
    }

    try {
      const result = await this.aiService.prioritizeWithVerification(todos, privacyLevel);
      return {
        success: true,
        result,
        aiAvailable: true,
        usedFallback: false,
        operation: 'prioritizeWithVerification'
      };
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI verification prioritize failed: ${errorMessage}, using fallback`);
      
      const fallbackPriorities = DEFAULT_RESPONSES.prioritize(todos);
      const fallbackResult: VerifiedAIResult<Record<string, number>> = {
        result: fallbackPriorities,
        verification: {
          id: 'fallback-prioritize',
          requestHash: '',
          responseHash: '',
          user: '',
          provider: 'fallback',
          timestamp: Date.now(),
          verificationType: 2, // AIActionType.PRIORITIZE
          metadata: { usedFallback: 'true', error: errorMessage }
        }
      };
      
      return {
        success: true,
        result: fallbackResult,
        error: errorMessage,
        aiAvailable: true,
        usedFallback: true,
        operation: 'prioritizeWithVerification'
      };
    }
  }

  /**
   * Safely suggests new todos with fallback
   */
  public async suggest(todos: Todo[]): Promise<SafeAIResult<string[]>> {
    const fallback = DEFAULT_RESPONSES.suggest();
    
    return this.safeExecute(
      'suggest',
      () => this.aiService.suggest(todos),
      fallback
    );
  }

  /**
   * Safely suggests new todos with blockchain verification
   */
  public async suggestWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<SafeAIResult<VerifiedAIResult<string[]>>> {
    const aiAvailable = await this.isAIAvailable();
    
    if (!aiAvailable || !this.aiService) {
      const fallbackSuggestions = DEFAULT_RESPONSES.suggest();
      const fallbackResult: VerifiedAIResult<string[]> = {
        result: fallbackSuggestions,
        verification: {
          id: 'fallback-suggest',
          requestHash: '',
          responseHash: '',
          user: '',
          provider: 'fallback',
          timestamp: Date.now(),
          verificationType: 3, // AIActionType.SUGGEST
          metadata: { usedFallback: 'true' }
        }
      };
      
      return {
        success: true,
        result: fallbackResult,
        aiAvailable: false,
        usedFallback: true,
        operation: 'suggestWithVerification'
      };
    }

    try {
      const result = await this.aiService.suggestWithVerification(todos, privacyLevel);
      return {
        success: true,
        result,
        aiAvailable: true,
        usedFallback: false,
        operation: 'suggestWithVerification'
      };
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI verification suggest failed: ${errorMessage}, using fallback`);
      
      const fallbackSuggestions = DEFAULT_RESPONSES.suggest();
      const fallbackResult: VerifiedAIResult<string[]> = {
        result: fallbackSuggestions,
        verification: {
          id: 'fallback-suggest',
          requestHash: '',
          responseHash: '',
          user: '',
          provider: 'fallback',
          timestamp: Date.now(),
          verificationType: 3, // AIActionType.SUGGEST
          metadata: { usedFallback: 'true', error: errorMessage }
        }
      };
      
      return {
        success: true,
        result: fallbackResult,
        error: errorMessage,
        aiAvailable: true,
        usedFallback: true,
        operation: 'suggestWithVerification'
      };
    }
  }

  /**
   * Safely analyzes todos with fallback
   */
  public async analyze(todos: Todo[]): Promise<SafeAIResult<Record<string, unknown>>> {
    const fallback = DEFAULT_RESPONSES.analyze(todos.length);
    
    return this.safeExecute(
      'analyze',
      () => this.aiService.analyze(todos),
      fallback
    );
  }

  /**
   * Safely analyzes todos with blockchain verification
   */
  public async analyzeWithVerification(
    todos: Todo[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<SafeAIResult<VerifiedAIResult<Record<string, unknown>>>> {
    const aiAvailable = await this.isAIAvailable();
    
    if (!aiAvailable || !this.aiService) {
      const fallbackAnalysis = DEFAULT_RESPONSES.analyze(todos.length);
      const fallbackResult: VerifiedAIResult<Record<string, unknown>> = {
        result: fallbackAnalysis,
        verification: {
          id: 'fallback-analyze',
          requestHash: '',
          responseHash: '',
          user: '',
          provider: 'fallback',
          timestamp: Date.now(),
          verificationType: 4, // AIActionType.ANALYZE
          metadata: { usedFallback: 'true' }
        }
      };
      
      return {
        success: true,
        result: fallbackResult,
        aiAvailable: false,
        usedFallback: true,
        operation: 'analyzeWithVerification'
      };
    }

    try {
      const result = await this.aiService.analyzeWithVerification(todos, privacyLevel);
      return {
        success: true,
        result,
        aiAvailable: true,
        usedFallback: false,
        operation: 'analyzeWithVerification'
      };
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI verification analyze failed: ${errorMessage}, using fallback`);
      
      const fallbackAnalysis = DEFAULT_RESPONSES.analyze(todos.length);
      const fallbackResult: VerifiedAIResult<Record<string, unknown>> = {
        result: fallbackAnalysis,
        verification: {
          id: 'fallback-analyze',
          requestHash: '',
          responseHash: '',
          user: '',
          provider: 'fallback',
          timestamp: Date.now(),
          verificationType: 4, // AIActionType.ANALYZE
          metadata: { usedFallback: 'true', error: errorMessage }
        }
      };
      
      return {
        success: true,
        result: fallbackResult,
        error: errorMessage,
        aiAvailable: true,
        usedFallback: true,
        operation: 'analyzeWithVerification'
      };
    }
  }

  /**
   * Safely suggests tags for a todo with fallback
   */
  public async suggestTags(todo: Todo): Promise<SafeAIResult<string[]>> {
    const fallback = DEFAULT_RESPONSES.suggestTags();
    
    return this.safeExecute(
      'suggestTags',
      () => this.aiService.suggestTags(todo),
      fallback
    );
  }

  /**
   * Safely suggests priority for a todo with fallback
   */
  public async suggestPriority(todo: Todo): Promise<SafeAIResult<'high' | 'medium' | 'low'>> {
    const fallback = DEFAULT_RESPONSES.suggestPriority();
    
    return this.safeExecute(
      'suggestPriority',
      () => this.aiService.suggestPriority(todo),
      fallback
    );
  }

  /**
   * Attempts to change the AI provider safely
   */
  public async setProvider(
    provider: AIProvider,
    modelName?: string,
    options?: Record<string, unknown>
  ): Promise<SafeAIResult<boolean>> {
    if (!this.aiService) {
      return {
        success: false,
        error: 'AI service not initialized',
        aiAvailable: false,
        usedFallback: false,
        operation: 'setProvider'
      };
    }

    try {
      await this.aiService.setProvider(provider, modelName, options);
      
      // Reset health status to trigger new health check
      this.lastHealthCheck = 0;
      await this.performHealthCheck();
      
      return {
        success: true,
        result: true,
        aiAvailable: this.aiHealthy,
        usedFallback: false,
        operation: 'setProvider'
      };
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to set AI provider to ${provider}: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        aiAvailable: false,
        usedFallback: false,
        operation: 'setProvider'
      };
    }
  }

  /**
   * Cancels all pending AI operations safely
   */
  public cancelAllOperations(reason?: string): void {
    try {
      if (this.aiService) {
        this.aiService.cancelAllOperations(reason);
      }
      this.logger.debug(`Cancelled all AI operations${reason ? `: ${reason}` : ''}`);
    } catch (_error) {
      this.logger.warn(`Error cancelling AI operations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets the underlying AI service (use with caution)
   */
  public getUnderlyingService(): AIService | null {
    return this.aiService;
  }
}

/**
 * Global singleton instance of the Safe AI Service
 */
export const safeAIService = new SafeAIService();