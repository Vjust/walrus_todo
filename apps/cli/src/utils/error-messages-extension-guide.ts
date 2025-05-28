/**
 * Guide for extending the enhanced error messaging system
 * Shows how to add new error types and custom messages
 */

import { Logger } from './Logger';
import { WalrusError } from '../types/errors';
import { ErrorContext } from './error-messages';

const logger = new Logger('error-messages-extension-guide');

/**
 * Example: Adding a new error type for AI operations
 */
export class AIError extends WalrusError {
  public readonly model?: string;
  public readonly prompt?: string;

  constructor(
    message: string,
    options: {
      model?: string;
      prompt?: string;
      code?: string;
      recoverable?: boolean;
    } = {}
  ) {
    super(message, {
      code: options.code || 'AI_ERROR',
      publicMessage: 'AI operation failed',
      shouldRetry: options.recoverable || true,
    });

    this.model = options.model;
    this.prompt = options.prompt;
  }
}

/**
 * Step 1: Add error messages to ERROR_MESSAGES in error-messages.ts
 */
export const AI_ERROR_MESSAGES = {
  AI_ERROR: {
    title: 'AI Service Error',
    emoji: '🤖',
    urgency: 'medium' as const,
    suggestions: [
      'Check your AI API key configuration',
      'Verify the AI service is available',
      'Try a simpler prompt or request',
    ],
    quickTips: [
      'Set AI API key: walrus ai:credentials --set-key YOUR_KEY',
      'Test AI connection: walrus ai:verify',
    ],
  },

  AI_RATE_LIMIT: {
    title: 'AI Rate Limit Exceeded',
    emoji: '⏱️',
    urgency: 'low' as const,
    suggestions: [
      'Wait a few minutes before trying again',
      'Consider upgrading your AI plan',
      'Use caching for repeated requests',
    ],
    quickTips: [
      'Check rate limits: walrus ai:limits',
      'Enable AI caching: walrus config --ai-cache true',
    ],
  },

  AI_INVALID_RESPONSE: {
    title: 'Invalid AI Response',
    emoji: '🤯',
    urgency: 'medium' as const,
    suggestions: [
      'Try rephrasing your request',
      'Check the AI model capabilities',
      'Use a different AI provider',
    ],
  },
};

/**
 * Step 2: Add command-specific guidance to COMMAND_ERROR_GUIDANCE
 */
export const AI_COMMAND_GUIDANCE = {
  'ai:suggest': {
    AI_ERROR: {
      suggestions: [
        'Provide more context in your todo description',
        'Use simpler language for better AI understanding',
        'Try the --model flag to use a different AI model',
      ],
      quickTips: [
        'Example: walrus ai:suggest "Plan project" --context "software development"',
        'Available models: gpt-4, claude-3, grok-2',
      ],
    },
  },

  'ai:categorize': {
    AI_INVALID_RESPONSE: {
      suggestions: [
        'Ensure your todos have descriptive titles',
        'Use the --custom-categories flag for specific domains',
        'Try categorizing fewer todos at once',
      ],
    },
  },
};

/**
 * Step 3: Add custom context extraction for your error type
 */
export function extractAIErrorContext(error: AIError): ErrorContext {
  return {
    operation: 'ai_operation',
    // Add any AI-specific context
    ...(error.model && { model: error.model }),
    ...(error.prompt && { prompt: error.prompt.substring(0, 50) + '...' }),
  };
}

/**
 * Step 4: Add typo mappings for AI commands if needed
 */
export const AI_COMMAND_TYPOS = {
  'ai:sugget': ['ai:suggest'],
  'ai:sugest': ['ai:suggest'],
  'ai:category': ['ai:categorize'],
  'ai:catergorize': ['ai:categorize'],
  'ai:creds': ['ai:credentials'],
  'ai:auth': ['ai:credentials'],
};

/**
 * Example usage in an AI command
 */
export class AICommandExample {
  async suggestTags(todoTitle: string, apiKey: string) {
    try {
      // AI operation that might fail
      const response = await this.callAIService(todoTitle, apiKey);
      return response;
    } catch (_error) {
      // Throw a specific AI error with context
      throw new AIError('Failed to get AI suggestions', {
        code: 'AI_ERROR',
        model: 'gpt-4',
        prompt: todoTitle,
        recoverable: true,
      });
    }
  }

  async handleRateLimit() {
    throw new AIError('Rate limit exceeded', {
      code: 'AI_RATE_LIMIT',
      recoverable: true,
    });
  }

  async handleInvalidResponse() {
    throw new AIError('AI returned invalid response format', {
      code: 'AI_INVALID_RESPONSE',
      recoverable: false,
    });
  }

  private async callAIService(_prompt: string, _apiKey: string): Promise<unknown> {
    // Mock AI service call
    throw new Error('Not implemented');
  }
}

/**
 * Step 5: Test your custom error messages
 */
export function testAIErrorMessages() {
  // Test basic AI error
  const basicError = new AIError('Connection failed', {
    code: 'AI_ERROR',
    model: 'gpt-4',
  });

  logger.info('Basic AI Error:');
  logger.info(basicError);

  // Test rate limit error
  const rateLimitError = new AIError('Too many requests', {
    code: 'AI_RATE_LIMIT',
  });

  logger.info('\nRate Limit Error:');
  logger.info(rateLimitError);

  // Test invalid response error
  const invalidResponseError = new AIError('Unexpected format', {
    code: 'AI_INVALID_RESPONSE',
    prompt: 'Generate tags for: Complete project documentation',
  });

  logger.info('\nInvalid Response Error:');
  logger.info(invalidResponseError);
}

/**
 * Best practices for extending error messages:
 *
 * 1. Use descriptive error codes (AI_RATE_LIMIT vs RATE_LIMIT)
 * 2. Include specific suggestions for each error type
 * 3. Add quick tips for immediate actions users can take
 * 4. Consider the urgency level (low/medium/high)
 * 5. Keep messages concise but helpful
 * 6. Include examples in quick tips when possible
 * 7. Add command-specific guidance for better context
 * 8. Map common typos to help users
 * 9. Test error messages with real scenarios
 * 10. Consider internationalization for global users
 */
