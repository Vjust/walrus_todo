/**
 * Command Validation Middleware
 *
 * This module provides middleware functionality for command validation
 * related to environment variables and configuration, plus specific
 * validation functions for different commands.
 */

import { Command, Flags, Hook } from '@oclif/core';
import { CLIError } from '../types/error';
import { envConfig, getEnv, hasEnv } from './environment-config';

// Define a type that extends the Command class constructor with the parse method
type CommandWithParse = {
  parse(argv: string[]): Promise<any>;
  new (...args: any[]): Command;
};

export interface EnvironmentRequirement {
  variable: string;
  message?: string;
  validator?: (value: any) => boolean;
  alternativeFlag?: string;
  command?: string; // Command field for validation context
}

/**
 * Registers environment requirements for a command
 * Will be checked before command execution
 */
export function requireEnvironment(cmd: unknown, requirements: EnvironmentRequirement[]): void {
  // Store the requirements on the command class
  (cmd as any).environmentRequirements = requirements;
}

/**
 * Validates environment requirements before command execution
 */
export const validateEnvironment: Hook<'init'> = async (options: any) => {
  const command = options.Command;
  // Skip if the command has no environment requirements
  if (!(command as any).environmentRequirements) {
    return;
  }

  const requirements: EnvironmentRequirement[] = (command as any).environmentRequirements;
  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  for (const req of requirements) {
    // Skip if there's an alternative flag, it will be handled by the command itself
    if (req.alternativeFlag && process.argv.includes(`--${req.alternativeFlag}`)) {
      continue;
    }

    // Check if the variable exists
    if (hasEnv(req.variable as any)) {
      const value = getEnv(req.variable as any);
      
      // If there's a validator, check the value
      if (req.validator && !req.validator(value)) {
        invalidVars.push(`${req.variable}=${value} (invalid)`);
      }
    } else if (process.env[req.variable]) {
      // Check for extension variables
      const value = process.env[req.variable];
      
      // If there's a validator, check the value
      if (req.validator && !req.validator(value)) {
        invalidVars.push(`${req.variable}=${value} (invalid)`);
      }
    } else {
      // Variable is missing
      const message = req.message || `Required environment variable ${req.variable} is missing`;
      const alternativeMessage = req.alternativeFlag ? 
        ` (or use --${req.alternativeFlag} flag)` : '';
      
      missingVars.push(`${req.variable}${alternativeMessage}`);
    }
  }

  // If any variables are missing or invalid, throw an error
  if (missingVars.length > 0 || invalidVars.length > 0) {
    let errorMessage = '';
    
    if (missingVars.length > 0) {
      errorMessage += `Missing required environment variables:\n`;
      missingVars.forEach(v => errorMessage += `- ${v}\n`);
    }
    
    if (invalidVars.length > 0) {
      errorMessage += `Invalid environment variables:\n`;
      invalidVars.forEach(v => errorMessage += `- ${v}\n`);
    }
    
    throw new CLIError(errorMessage, 'ENV_VALIDATION_FAILED');
  }
};

/**
 * Define or flag for commands that require API Keys
 */
export const apiKeyFlag = {
  apiKey: Flags.string({
    char: 'k',
    description: 'API key for the service',
    env: 'API_KEY',
    required: false,
  })
};

/**
 * Defines flags for commands that interact with AI providers
 */
export const aiFlags = {
  apiKey: Flags.string({
    char: 'k',
    description: 'AI provider API key',
    required: false,
  }),
  provider: Flags.string({
    char: 'p',
    description: 'AI provider to use (xai, openai, anthropic, ollama)',
    required: false,
    options: ['xai', 'openai', 'anthropic', 'ollama'],
    default: 'xai'
  }),
  model: Flags.string({
    char: 'm',
    description: 'Model to use for AI operations',
    required: false,
    default: 'grok-beta'
  }),
  temperature: Flags.integer({
    char: 't',
    description: 'Temperature for AI response (0.0-1.0)',
    required: false,
    default: 7
  })
};

/**
 * Sets environment variables from command flags
 */
export function setEnvFromFlags(flags: any, mappings: Record<string, string>): void {
  for (const [flagName, envVar] of Object.entries(mappings)) {
    if (flags[flagName] !== undefined) {
      if (typeof process.env[envVar] === 'undefined') {
        process.env[envVar] = flags[flagName]?.toString();
      }
    }
  }
}

/**
 * Create flags for an environment configurable option
 */
export function createEnvFlag(envVar: string, options: {
  char?: string;
  description?: string;
  required?: boolean;
  options?: string[];
  hidden?: boolean;
  default?: () => any;
} = {}): any {
  // Get the actual environment variable definition
  const envVarConfig = envConfig.getAllVariables()[envVar];
  
  if (!envVarConfig) {
    throw new Error(`Unknown environment variable: ${envVar}`);
  }
  
  // Determine flag type based on the environment variable type
  const type = typeof envVarConfig.value;
  let flagCreator;
  
  switch (type) {
    case 'boolean':
      flagCreator = Flags.boolean;
      break;
    case 'number':
      flagCreator = Flags.integer;
      break;
    case 'string':
    default:
      flagCreator = Flags.string;
      break;
  }
  
  // Create the flag
  return flagCreator({
    char: options.char,
    description: options.description || envVarConfig.description || `Set ${envVar}`,
    required: options.required || false,
    env: envVar,
    options: options.options,
    hidden: options.hidden || false,
    default: options.default || (() => envVarConfig.value)
  });
}

/**
 * Command-specific validation hooks
 */

/**
 * Validation middleware for add command
 */
export const addCommandValidation: Hook<'prerun'> = async (options) => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(argv);
  const flags = parsedCommand.flags;

  // Add any specific validation logic here
  validateAIApiKey(flags);
  validateBlockchainConfig(flags);
};

/**
 * Validation middleware for complete command
 */
export const completeCommandValidation: Hook<'prerun'> = async (options) => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(argv);
  const flags = parsedCommand.flags;

  // Add any specific validation logic here
  if (flags.id && flags.all) {
    throw new CLIError('Cannot specify both --id and --all flags', 'INVALID_FLAGS');
  }

  // Validate storage location if provided
  if (flags.storage && !['local', 'blockchain', 'both'].includes(flags.storage as string)) {
    throw new CLIError('Invalid storage location. Use: local, blockchain, or both', 'INVALID_STORAGE');
  }
};

/**
 * Validation middleware for delete command
 */
export const deleteCommandValidation: Hook<'prerun'> = async (options) => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(argv);
  const flags = parsedCommand.flags;

  // Add any specific validation logic here
  if (!flags.id && !flags.all) {
    throw new CLIError('Must specify either --id or --all flag', 'MISSING_ID_OR_ALL');
  }

  if (flags.id && flags.all) {
    throw new CLIError('Cannot specify both --id and --all flags', 'INVALID_FLAGS');
  }
};

/**
 * Validation middleware for update command
 */
export const updateCommandValidation: Hook<'prerun'> = async (options) => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(argv);
  const flags = parsedCommand.flags;

  // Add any specific validation logic here
  if (!flags.id) {
    throw new CLIError('Must specify todo ID with --id flag', 'MISSING_ID');
  }

  // Check that at least one update field is provided
  const updateFields = ['title', 'priority', 'due', 'tags', 'private', 'completed'];
  const hasUpdate = updateFields.some(field => flags[field] !== undefined);

  if (!hasUpdate) {
    throw new CLIError('Must provide at least one field to update', 'NO_UPDATE_FIELDS');
  }
};

/**
 * Validation middleware for list command
 */
export const listCommandValidation: Hook<'prerun'> = async (options) => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(argv);
  const flags = parsedCommand.flags;

  // Validate storage location if provided
  if (flags.storage && !['local', 'blockchain', 'both'].includes(flags.storage as string)) {
    throw new CLIError('Invalid storage location. Use: local, blockchain, or both', 'INVALID_STORAGE');
  }
};

/**
 * Validation middleware for AI command
 */
export const aiCommandValidation: Hook<'prerun'> = async (options) => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(argv);
  const flags = parsedCommand.flags;

  // Validate API key
  validateAIApiKey(flags);

  // Validate operation type
  if (flags.operation && !['summarize', 'categorize', 'prioritize', 'suggest', 'analyze'].includes(flags.operation as string)) {
    throw new CLIError('Invalid operation type. Available operations: summarize, categorize, prioritize, suggest, analyze', 'INVALID_OPERATION');
  }
};

/**
 * Validation middleware for image:upload command
 */
export const imageUploadCommandValidation: Hook<'prerun'> = async (options) => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(argv);
  const flags = parsedCommand.flags;

  // Check for required path
  if (!flags.path) {
    throw new CLIError('Must specify image path with --path flag', 'MISSING_PATH');
  }
};

/**
 * Validation middleware for image:create-nft command
 */
export const createNFTCommandValidation: Hook<'prerun'> = async (options) => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(argv);
  const flags = parsedCommand.flags;

  // Check for required image ID
  if (!flags.imageId) {
    throw new CLIError('Must specify image ID with --imageId flag', 'MISSING_IMAGE_ID');
  }

  // Verify creator address is valid if provided
  if (flags.creator && !/^0x[a-fA-F0-9]{40}$/.test(flags.creator as string)) {
    throw new CLIError('Invalid creator address format', 'INVALID_ADDRESS');
  }
};

/**
 * Validation middleware for configure command
 */
export const configureCommandValidation: Hook<'prerun'> = async (options) => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(argv);
  const flags = parsedCommand.flags;

  // Ensure at least one configuration option is provided
  const configOptions = ['set', 'unset', 'list', 'reset'];
  const hasConfigOption = configOptions.some(option => flags[option] !== undefined);

  if (!hasConfigOption) {
    throw new CLIError('Must specify at least one configuration action: --set, --unset, --list, or --reset', 'MISSING_CONFIG_ACTION');
  }
};

/**
 * Validate API key for AI operations
 */
export function validateAIApiKey(flags: any): void {
  // Skip validation if AI flag is not set
  if (!flags.ai) {
    return;
  }

  // Check for API key
  const apiKey = flags.apiKey || process.env.XAI_API_KEY;

  if (!apiKey) {
    throw new CLIError(
      'AI operations require an API key. Provide it with --apiKey flag or set XAI_API_KEY environment variable.',
      'MISSING_API_KEY'
    );
  }
}

/**
 * Validate blockchain configuration
 */
export function validateBlockchainConfig(flags: any): void {
  // Skip validation if not using blockchain storage
  if (flags.storage !== 'blockchain' && flags.storage !== 'both') {
    return;
  }

  // Check for required environment variables
  const missingVars = [];

  if (!process.env.WALRUS_RPC_URL) {
    missingVars.push('WALRUS_RPC_URL');
  }

  if (!process.env.SUI_NETWORK) {
    missingVars.push('SUI_NETWORK');
  }

  if (missingVars.length > 0) {
    throw new CLIError(
      `Missing required environment variables for blockchain storage: ${missingVars.join(', ')}`,
      'MISSING_BLOCKCHAIN_CONFIG'
    );
  }
}