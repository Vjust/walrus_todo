import { Hook } from '@oclif/core';
import { CLIError } from '../types/error';
import { InputValidator, ValidationSchema } from './InputValidator';

/**
 * Input validation middleware factory
 * Creates a hook function that validates command inputs before execution
 * 
 * @param schema Validation schema for command flags
 * @param validateArgs Function to validate command arguments
 * @returns Hook function for command validation
 */
import { Command } from '@oclif/core';

interface CommandWithParse {
  parse(argv: string[]): Promise<any>;
  new (...args: any[]): Command;
}

export function createValidationMiddleware(
  schema: ValidationSchema,
  validateArgs?: (args: Record<string, any>) => void
): Hook<'prerun'> {
  return async (options) => {
    try {
      const { Command: CommandClass, argv } = options;
      const command = CommandClass as unknown as CommandWithParse;
      const parsedCommand = await command.parse(argv);
      const { flags, args } = parsedCommand;

      // Validate flags using schema
      if (schema && flags) {
        InputValidator.validateObject(flags, schema);
      }

      // Validate arguments if function is provided
      if (validateArgs && args) {
        validateArgs(args);
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Input validation failed: ${error instanceof Error ? error.message : String(error)}`,
        'VALIDATION_FAILED'
      );
    }
  };
}

/**
 * Common argument validation functions
 */
export const ArgumentValidators = {
  /**
   * Validate todo title argument
   * @param args Command arguments
   */
  todoTitle: (args: Record<string, any>) => {
    const title = args.title;
    if (title !== undefined) {
      InputValidator.validate(title, [
        {
          test: (value) => typeof value === 'string' && value.trim().length > 0,
          message: 'Todo title cannot be empty',
          code: 'EMPTY_TITLE'
        },
        {
          test: (value) => value.length <= 100,
          message: 'Todo title must be 100 characters or less',
          code: 'TITLE_TOO_LONG'
        }
      ], 'title');
    }
  },

  /**
   * Validate list name argument
   * @param args Command arguments
   */
  listName: (args: Record<string, any>) => {
    const name = args.name;
    if (name !== undefined) {
      InputValidator.validate(name, [
        {
          test: (value) => typeof value === 'string' && value.trim().length > 0,
          message: 'List name cannot be empty',
          code: 'EMPTY_LIST_NAME'
        },
        {
          test: (value) => /^[a-zA-Z0-9_-]+$/.test(value),
          message: 'List name can only contain letters, numbers, underscores, and hyphens',
          code: 'INVALID_LIST_NAME'
        }
      ], 'name');
    }
  }
};

/**
 * Common flag validation schemas
 */
export const CommonValidationSchemas = {
  priorityFlag: {
    priority: [
      {
        test: (value) => ['high', 'medium', 'low'].includes(value),
        message: 'Priority must be high, medium, or low',
        code: 'INVALID_PRIORITY'
      }
    ]
  },
  
  dueDateFlag: {
    due: [
      {
        test: (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
        message: 'Invalid date format. Use YYYY-MM-DD',
        code: 'INVALID_DATE_FORMAT'
      }
    ]
  },
  
  storageFlag: {
    storage: [
      {
        test: (value) => ['local', 'blockchain', 'both'].includes(value),
        message: 'Storage location must be local, blockchain, or both',
        code: 'INVALID_STORAGE_LOCATION'
      }
    ]
  },
  
  networkFlag: {
    network: [
      {
        test: (value) => !value || ['mainnet', 'testnet', 'devnet', 'local'].includes(value),
        message: 'Network must be mainnet, testnet, devnet, or local',
        code: 'INVALID_NETWORK'
      }
    ]
  },
  
  walletAddressFlag: {
    walletAddress: [
      {
        test: (value) => !value || /^0x[a-fA-F0-9]{40,}$/.test(value),
        message: 'Invalid wallet address format. Must be a valid hex address starting with 0x',
        code: 'INVALID_WALLET_ADDRESS'
      }
    ]
  },
  
  apiKeyFlag: {
    apiKey: [
      {
        test: (value) => !value || value.length >= 16,
        message: 'API key must be at least 16 characters',
        code: 'INVALID_API_KEY'
      }
    ]
  }
};