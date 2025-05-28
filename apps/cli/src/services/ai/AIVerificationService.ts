import {
  AIVerifierAdapter,
  AIActionType,
  AIPrivacyLevel,
  VerificationRecord,
} from '../../types/adapters/AIVerifierAdapter';
import { Todo } from '../../types/todo';

export interface VerifiedAIResult<T> {
  result: T;
  verification: VerificationRecord;
}

export class AIVerificationService {
  private verifierAdapter: AIVerifierAdapter;

  constructor(verifierAdapter?: AIVerifierAdapter) {
    this.verifierAdapter = verifierAdapter;
  }

  /**
   * Create a verification record for an AI operation
   */
  async createVerification(
    verificationType: AIActionType,
    request: unknown,
    response: unknown,
    metadata: Record<string, string> = {},
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerificationRecord> {
    // Stringify request and response if they're not already strings
    const requestStr =
      typeof request === 'string' ? request : JSON.stringify(request);
    const responseStr =
      typeof response === 'string' ? response : JSON.stringify(response);

    // Sanitize request and response to prevent prompt injection
    const sanitizedRequestStr = this.sanitizeInput(requestStr);
    const sanitizedResponseStr = this.sanitizeInput(responseStr);

    // Create verification
    return this.verifierAdapter.createVerification({
      actionType: verificationType, // Map to the expected parameter name in the adapter
      request: sanitizedRequestStr,
      response: sanitizedResponseStr,
      metadata,
      privacyLevel,
      provider: 'default_provider',
    });
  }

  /**
   * Sanitizes input to prevent prompt injection and other security issues
   *
   * @param input - The input string to sanitize
   * @returns Sanitized input string
   */
  private sanitizeInput(input: string): string {
    if (!input) return input;

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

    let sanitized = input;
    for (const pattern of injectionPatterns) {
      // Create case-insensitive regex for each pattern
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      sanitized = sanitized.replace(regex, '[FILTERED]');
    }

    // Remove HTML/script tags to prevent XSS
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '[SCRIPT_REMOVED]');
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Remove potential command injection patterns
    sanitized = sanitized.replace(/\$\([^)]*\)/g, '[CMD_FILTERED]');
    sanitized = sanitized.replace(/`[^`]*`/g, '[CMD_FILTERED]');

    return sanitized;
  }

  /**
   * Verify a todo operation
   */
  async verifyTodoOperation(
    todo: Todo,
    operation: string,
    metadata: Record<string, string> = {}
  ): Promise<VerifiedAIResult<Todo>> {
    // Map operation to verification type
    let verificationType: AIActionType;

    switch (operation) {
      case 'summarize':
        verificationType = AIActionType.SUMMARIZE;
        break;
      case 'categorize':
        verificationType = AIActionType.CATEGORIZE;
        break;
      case 'prioritize':
        verificationType = AIActionType.PRIORITIZE;
        break;
      case 'suggest':
        verificationType = AIActionType.SUGGEST;
        break;
      case 'analyze':
        verificationType = AIActionType.ANALYZE;
        break;
      default:
        verificationType = AIActionType.SUMMARIZE; // Default to summarize as CUSTOM is removed
        metadata = { ...metadata, operation };
    }

    // Create verification
    const verification = await this.createVerification(
      verificationType,
      todo,
      todo,
      {
        ...metadata,
        todoId: todo.id,
        timestamp: Date.now().toString(),
      }
    );

    return {
      result: todo,
      verification,
    };
  }

  /**
   * Verify a verification record using original request and response
   */
  async verifyRecord(
    record: VerificationRecord,
    request: unknown,
    response: unknown
  ): Promise<boolean> {
    // Stringify request and response if they're not already strings
    const requestStr =
      typeof request === 'string' ? request : JSON.stringify(request);
    const responseStr =
      typeof response === 'string' ? response : JSON.stringify(response);

    return this.verifierAdapter.verifyRecord(record, requestStr, responseStr);
  }

  /**
   * Verify an existing operation by its verification ID
   */
  async verifyExistingOperation(verificationId: string): Promise<boolean> {
    const verification =
      await this.verifierAdapter.getVerification(verificationId);

    if (!verification) {
      return false;
    }

    // For simple verification ID checks, we don't validate the content
    // Just check that the verification exists and is valid
    return verification !== null;
  }

  /**
   * Create a verified AI summarization
   */
  public async createVerifiedSummary(
    todos: Todo[],
    summary: string,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<string>> {
    const verification = await this.createVerification(
      AIActionType.SUMMARIZE,
      todos,
      summary,
      {
        todoCount: todos.length.toString(),
        summaryLength: summary.length.toString(),
        timestamp: Date.now().toString(),
      },
      privacyLevel
    );

    return {
      result: summary,
      verification,
    };
  }

  /**
   * Create a verified AI categorization
   */
  public async createVerifiedCategorization(
    todos: Todo[],
    categories: Record<string, string[]>,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, string[]>>> {
    const verification = await this.createVerification(
      AIActionType.CATEGORIZE,
      todos,
      categories,
      {
        todoCount: todos.length.toString(),
        categoryCount: Object.keys(categories).length.toString(),
        timestamp: Date.now().toString(),
      },
      privacyLevel
    );

    return {
      result: categories,
      verification,
    };
  }

  /**
   * Create a verified AI prioritization
   */
  public async createVerifiedPrioritization(
    todos: Todo[],
    priorities: Record<string, number>,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, number>>> {
    const verification = await this.createVerification(
      AIActionType.PRIORITIZE,
      todos,
      priorities,
      {
        todoCount: todos.length.toString(),
        timestamp: Date.now().toString(),
      },
      privacyLevel
    );

    return {
      result: priorities,
      verification,
    };
  }

  /**
   * Create a verified AI suggestion
   */
  public async createVerifiedSuggestion(
    todos: Todo[],
    suggestions: string[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<string[]>> {
    const verification = await this.createVerification(
      AIActionType.SUGGEST,
      todos,
      suggestions,
      {
        todoCount: todos.length.toString(),
        suggestionCount: suggestions.length.toString(),
        timestamp: Date.now().toString(),
      },
      privacyLevel
    );

    return {
      result: suggestions,
      verification,
    };
  }

  /**
   * Create a verified AI analysis
   */
  public async createVerifiedAnalysis(
    todos: Todo[],
    analysis: Record<string, unknown>,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, unknown>>> {
    const verification = await this.createVerification(
      AIActionType.ANALYZE,
      todos,
      analysis,
      {
        todoCount: todos.length.toString(),
        analysisKeys: Object.keys(analysis).join(','),
        timestamp: Date.now().toString(),
      },
      privacyLevel
    );

    return {
      result: analysis,
      verification,
    };
  }
}
