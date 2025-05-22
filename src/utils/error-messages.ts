import chalk from 'chalk';
import { commandRegistry } from './CommandRegistry';
import { ICONS } from '../base-command';
import { NetworkError, ValidationError, StorageError, BlockchainError, WalrusError } from '../types/errors/compatibility';

/**
 * Enhanced error messaging system for better user experience
 * Provides context-aware error messages, helpful actions, and user-friendly formatting
 */

// Error type definitions for enhanced error handling
export interface ErrorContext {
  command?: string;
  resource?: string;
  field?: string;
  value?: unknown;
  operation?: string;
  transactionId?: string;
  blobId?: string;
  attempt?: number;
  maxAttempts?: number;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestions: string[];
  quickTips?: string[];
  didYouMean?: string[];
  emoji: string;
  urgency: 'low' | 'medium' | 'high';
}

/**
 * Map common error codes to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, Partial<UserFriendlyError>> = {
  // Network errors
  NETWORK_ERROR: {
    title: 'Network Connection Issue',
    emoji: '🌐',
    urgency: 'medium',
    suggestions: [
      'Check your internet connection',
      'Verify that the service is accessible',
      'Try again in a few moments'
    ],
    quickTips: [
      'You can retry this command with the --retry flag',
      'Check service status at status.walrus.io'
    ]
  },
  
  // Validation errors
  VALIDATION_ERROR: {
    title: 'Invalid Input',
    emoji: '⚠️',
    urgency: 'low',
    suggestions: [
      'Review the command syntax',
      'Check the input format',
      'Use --help to see valid options'
    ]
  },
  
  // Auth errors
  AUTHORIZATION_ERROR: {
    title: 'Authentication Required',
    emoji: '🔐',
    urgency: 'high',
    suggestions: [
      'Login with: walrus account:auth --login YOUR_USERNAME',
      'Check your authentication status: walrus account:show',
      'Ensure you have proper permissions for this operation'
    ],
    quickTips: [
      'Your session might have expired',
      'Some operations require specific permissions'
    ]
  },
  
  // Storage errors
  STORAGE_ERROR: {
    title: 'Storage Operation Failed',
    emoji: '💾',
    urgency: 'medium',
    suggestions: [
      'Check available storage space',
      'Verify the blob ID is correct',
      'Ensure you have sufficient WAL tokens'
    ],
    quickTips: [
      'Get more WAL tokens: walrus --context testnet get-wal',
      'Check storage status: walrus storage:info'
    ]
  },
  
  // Transaction errors
  TRANSACTION_ERROR: {
    title: 'Blockchain Transaction Failed',
    emoji: '⛓️',
    urgency: 'high',
    suggestions: [
      'Check the transaction status on the blockchain explorer',
      'Verify you have sufficient funds/tokens',
      'Review the transaction parameters'
    ],
    quickTips: [
      'Transaction may still be pending',
      'Gas fees might have increased'
    ]
  }
};

/**
 * Command-specific error guidance
 */
const COMMAND_ERROR_GUIDANCE: Record<string, Record<string, Partial<UserFriendlyError>>> = {
  add: {
    VALIDATION_ERROR: {
      suggestions: [
        'Use quotes for todo titles with spaces: walrus add "Buy groceries"',
        'Specify priority with -p flag: walrus add -p high "Important task"',
        'Add due date with --due flag: walrus add --due 2024-12-31 "Task"'
      ],
      quickTips: [
        'You can add multiple todos at once with -t flag',
        'Use --ai to let AI suggest tags and priority'
      ]
    }
  },
  
  list: {
    NOT_FOUND: {
      suggestions: [
        'Create the list first: walrus add list-name -t "First todo"',
        'Check available lists: walrus list',
        'List names are case-sensitive'
      ]
    }
  },
  
  complete: {
    NOT_FOUND: {
      suggestions: [
        'Check if the todo ID is correct: walrus list [list-name]',
        'The todo might already be completed',
        'Use tab completion for todo IDs'
      ]
    }
  },
  
  store: {
    STORAGE_ERROR: {
      suggestions: [
        'Ensure Walrus CLI is installed: curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh',
        'Check Walrus configuration: cat ~/.config/walrus/client_config.yaml',
        'Use --mock flag for testing without real storage'
      ],
      quickTips: [
        'Get WAL tokens: walrus --context testnet get-wal',
        'Test with local storage first: walrus store --storage local'
      ]
    }
  }
};

/**
 * Common typos and their corrections
 */
const COMMON_TYPOS: Record<string, string[]> = {
  'ad': ['add'],
  'addd': ['add'],
  'crete': ['create'],
  'lst': ['list'],
  'ls': ['list'],
  'complet': ['complete'],
  'compelte': ['complete'],
  'done': ['complete'],
  'delet': ['delete'],
  'del': ['delete'],
  'rm': ['delete'],
  'stor': ['store'],
  'stroe': ['store'],
  'retrive': ['retrieve'],
  'retreive': ['retrieve'],
  'get': ['retrieve'],
  'confg': ['config'],
  'conf': ['config'],
  'upadte': ['update'],
  'updaet': ['update']
};

/**
 * Create a user-friendly error message with context and suggestions
 */
export function createErrorMessage(
  error: Error,
  context?: ErrorContext
): UserFriendlyError {
  // Get base error info
  let baseError = ERROR_MESSAGES[error.constructor.name] || ERROR_MESSAGES[getErrorCode(error)];
  
  // Get command-specific guidance if available
  if (context?.command) {
    const commandGuidance = COMMAND_ERROR_GUIDANCE[context.command]?.[getErrorCode(error)];
    if (commandGuidance) {
      baseError = { ...baseError, ...commandGuidance };
    }
  }
  
  // Default error if nothing matches
  if (!baseError) {
    baseError = {
      title: 'Unexpected Error',
      emoji: '❌',
      urgency: 'medium',
      suggestions: [
        'Try running the command again',
        'Check the logs with --verbose flag',
        'Report this issue if it persists'
      ]
    };
  }
  
  // Enhance with context-specific information
  const userError: UserFriendlyError = {
    title: baseError.title || 'Error',
    message: formatErrorMessage(error, context),
    suggestions: baseError.suggestions || [],
    quickTips: baseError.quickTips,
    emoji: baseError.emoji || '❌',
    urgency: baseError.urgency || 'medium',
    didYouMean: getDidYouMeanSuggestions(error, context)
  };
  
  // Add context-specific suggestions
  if (context) {
    userError.suggestions = enhanceSuggestionsWithContext(userError.suggestions, context);
  }
  
  return userError;
}

/**
 * Format the error message with context
 */
function formatErrorMessage(error: Error, context?: ErrorContext): string {
  let message = error.message;
  
  // Add context information
  if (context) {
    if (context.field) {
      message = `Invalid value for ${context.field}: ${message}`;
    }
    if (context.resource) {
      message = `Error with ${context.resource}: ${message}`;
    }
    if (context.operation) {
      message = `Failed to ${context.operation}: ${message}`;
    }
    if (context.attempt && context.maxAttempts) {
      message += ` (attempt ${context.attempt}/${context.maxAttempts})`;
    }
  }
  
  return message;
}

/**
 * Get the error code from various error types
 */
function getErrorCode(error: Error): string {
  if (error instanceof WalrusError) {
    return error.code;
  }
  if ('code' in error) {
    return (error as any).code;
  }
  return error.constructor.name.toUpperCase();
}

/**
 * Generate "Did you mean?" suggestions for typos
 */
function getDidYouMeanSuggestions(error: Error, context?: ErrorContext): string[] | undefined {
  if (!context?.command) return undefined;
  
  const suggestions: string[] = [];
  
  // Check for command typos
  const commandTypos = COMMON_TYPOS[context.command];
  if (commandTypos) {
    suggestions.push(...commandTypos.map(cmd => `walrus ${cmd}`));
  }
  
  // Check for similar commands using the registry
  const similarCommands = commandRegistry.suggestCommands(context.command, 3);
  if (similarCommands.length > 0) {
    suggestions.push(...similarCommands.map(cmd => `walrus ${cmd.name}`));
  }
  
  return suggestions.length > 0 ? suggestions : undefined;
}

/**
 * Enhance suggestions with specific context
 */
function enhanceSuggestionsWithContext(
  suggestions: string[],
  context: ErrorContext
): string[] {
  const enhanced = [...suggestions];
  
  // Add transaction-specific suggestions
  if (context.transactionId) {
    enhanced.push(`Check transaction status: walrus tx:status ${context.transactionId}`);
  }
  
  // Add storage-specific suggestions
  if (context.blobId) {
    enhanced.push(`Verify blob exists: walrus storage:check ${context.blobId}`);
  }
  
  // Add field-specific suggestions
  if (context.field && context.value) {
    switch (context.field) {
      case 'priority':
        enhanced.push('Valid priorities are: low, medium, high');
        break;
      case 'due':
      case 'dueDate':
        enhanced.push('Date format should be: YYYY-MM-DD');
        break;
      case 'tags':
        enhanced.push('Tags should be comma-separated: work,urgent,important');
        break;
    }
  }
  
  return enhanced;
}

/**
 * Create a formatted error display with all information
 */
export function displayFriendlyError(error: Error, context?: ErrorContext): string {
  const userError = createErrorMessage(error, context);
  const lines: string[] = [];
  
  // Title with emoji and urgency color
  const titleColor = userError.urgency === 'high' ? chalk.red.bold :
                    userError.urgency === 'medium' ? chalk.yellow.bold :
                    chalk.blue.bold;
  
  lines.push(`\n${userError.emoji} ${titleColor(userError.title)}`);
  lines.push(chalk.red(userError.message));
  
  // Did you mean suggestions
  if (userError.didYouMean && userError.didYouMean.length > 0) {
    lines.push(`\n${chalk.cyan('Did you mean:')}`);
    userError.didYouMean.forEach(suggestion => {
      lines.push(`  ${chalk.green('→')} ${suggestion}`);
    });
  }
  
  // Suggestions
  if (userError.suggestions.length > 0) {
    lines.push(`\n${chalk.yellow(ICONS.INFO)} ${chalk.yellow('How to fix:')}`);
    userError.suggestions.forEach((suggestion, i) => {
      lines.push(`  ${chalk.cyan(`${i + 1}.`)} ${suggestion}`);
    });
  }
  
  // Quick tips
  if (userError.quickTips && userError.quickTips.length > 0) {
    lines.push(`\n${chalk.magenta(ICONS.INFO)} ${chalk.magenta('Quick tips:')}`);
    userError.quickTips.forEach(tip => {
      lines.push(`  ${chalk.gray('•')} ${chalk.italic(tip)}`);
    });
  }
  
  // Encouragement for high urgency errors
  if (userError.urgency === 'high') {
    lines.push(`\n${chalk.green('Don\'t worry, we\'ll get through this! 💪')}`);
  }
  
  return lines.join('\n');
}

/**
 * Integration with BaseCommand error handling
 */
export function enhanceBaseCommandError(
  baseCommand: any,
  error: Error,
  context?: ErrorContext
): void {
  const friendlyError = displayFriendlyError(error, context);
  
  // Use console.error to ensure it's displayed even in quiet mode
  console.error(friendlyError);
  
  // Throw the original error to maintain compatibility
  throw error;
}

/**
 * Get error context from command flags and arguments
 */
export function getErrorContext(command: any, error: Error): ErrorContext {
  const context: ErrorContext = {
    command: command.id || command.constructor.name.toLowerCase().replace('command', '')
  };
  
  // Extract context from error properties
  if (error instanceof ValidationError) {
    context.field = (error as any).field;
    context.value = (error as any).value;
  }
  
  if (error instanceof TransactionError) {
    context.transactionId = (error as any).transactionId;
    context.operation = (error as any).operation;
  }
  
  if (error instanceof StorageError) {
    context.blobId = (error as any).blobId;
    context.operation = (error as any).operation;
  }
  
  if (error instanceof NetworkError) {
    context.operation = (error as any).operation;
    const networkError = error as any;
    if (networkError.attempt) {
      context.attempt = networkError.attempt;
      context.maxAttempts = networkError.maxAttempts;
    }
  }
  
  return context;
}