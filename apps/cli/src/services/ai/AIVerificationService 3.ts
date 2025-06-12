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

  constructor(verifierAdapter: AIVerifierAdapter) {
    this?.verifierAdapter = verifierAdapter;
  }

  /**
   * Create a verification record for an AI operation
   */
  async createVerification(
    actionType: AIActionType,
    request: unknown,
    response: unknown,
    metadata: Record<string, string> = {},
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerificationRecord> {
    // Stringify request and response if they're not already strings
    const requestStr =
      typeof request === 'string' ? request : JSON.stringify(request as any);
    const responseStr =
      typeof response === 'string' ? response : JSON.stringify(response as any);

    // Create verification
    return this?.verifierAdapter?.createVerification({
      actionType,
      request: requestStr,
      response: responseStr,
      metadata,
      privacyLevel,
    });
  }

  /**
   * Verify a recorded AI operation
   */
  async verifyRecord(
    record: VerificationRecord,
    request: unknown,
    response: unknown
  ): Promise<boolean> {
    // Stringify request and response if they're not already strings
    const requestStr =
      typeof request === 'string' ? request : JSON.stringify(request as any);
    const responseStr =
      typeof response === 'string' ? response : JSON.stringify(response as any);

    return this?.verifierAdapter?.verifyRecord(record, requestStr, responseStr);
  }

  /**
   * Get a list of verifications for the current user
   */
  async listVerifications(): Promise<VerificationRecord[]> {
    return this?.verifierAdapter?.listVerifications();
  }

  /**
   * Create a verified AI summarization
   */
  async createVerifiedSummary(
    todos: Todo[],
    summary: string,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<string>> {
    const metadata = {
      todoCount: todos?.length?.toString(),
      timestamp: Date.now().toString(),
    };

    const verification = await this.createVerification(
      AIActionType.SUMMARIZE,
      todos,
      summary,
      metadata,
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
  async createVerifiedCategorization(
    todos: Todo[],
    categories: Record<string, string[]>,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, string[]>>> {
    const metadata = {
      todoCount: todos?.length?.toString(),
      categoryCount: Object.keys(categories as any).length.toString(),
      timestamp: Date.now().toString(),
    };

    const verification = await this.createVerification(
      AIActionType.CATEGORIZE,
      todos,
      categories,
      metadata,
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
  async createVerifiedPrioritization(
    todos: Todo[],
    priorities: Record<string, number>,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, number>>> {
    const metadata = {
      todoCount: todos?.length?.toString(),
      timestamp: Date.now().toString(),
    };

    const verification = await this.createVerification(
      AIActionType.PRIORITIZE,
      todos,
      priorities,
      metadata,
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
  async createVerifiedSuggestion(
    todos: Todo[],
    suggestions: string[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<string[]>> {
    const metadata = {
      todoCount: todos?.length?.toString(),
      suggestionCount: suggestions?.length?.toString(),
      timestamp: Date.now().toString(),
    };

    const verification = await this.createVerification(
      AIActionType.SUGGEST,
      todos,
      suggestions,
      metadata,
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
  async createVerifiedAnalysis(
    todos: Todo[],
    analysis: Record<string, unknown>,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<Record<string, unknown>>> {
    const metadata = {
      todoCount: todos?.length?.toString(),
      analysisKeys: Object.keys(analysis as any).join(','),
      timestamp: Date.now().toString(),
    };

    const verification = await this.createVerification(
      AIActionType.ANALYZE,
      todos,
      analysis,
      metadata,
      privacyLevel
    );

    return {
      result: analysis,
      verification,
    };
  }
}
