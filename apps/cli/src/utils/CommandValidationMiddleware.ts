/**
 * Command Validation Middleware
 *
 * This module provides middleware functionality for command validation
 * related to environment variables and configuration, plus specific
 * validation functions for different commands.
 *
 * The middleware pattern implemented here intercepts command execution
 * at different lifecycle hooks (init, prerun) to validate requirements
 * before command execution proceeds, ensuring that all necessary
 * preconditions are met.
 *
 * @module CommandValidationMiddleware
 * @author Walrus Todo Team
 * @license MIT
 */

import { Command, Flags, Hook } from '@oclif/core';
import { CLIError } from '../types/error';
import { envConfig } from './environment-config';
import { Logger } from './Logger';

const logger = new Logger('CommandValidationMiddleware');

/**
 * Custom type that extends the OCLIF Command class constructor with parse method
 * This allows proper typing when accessing command parsing functionality
 */
type CommandWithParse = {
  parse(
    argv: string[]
  ): Promise<{ flags: Record<string, unknown>; args: Record<string, unknown> }>;
  new (...args: unknown[]): Command;
};

/**
 * Interface representing an environment variable requirement
 *
 * @property variable - The name of the required environment variable
 * @property message - Optional custom error message if the variable is missing
 * @property validator - Optional function to validate the variable value
 * @property alternativeFlag - Optional CLI flag that can be used instead of the env var
 * @property command - Optional command name for validation context
 */
export interface EnvironmentRequirement {
  variable: string;
  message?: string;
  validator?: (value: string) => boolean;
  alternativeFlag?: string;
  command?: string; // Command field for validation context
}

/**
 * Registers environment requirements for a command
 * Requirements will be checked before command execution
 *
 * @param cmd - The command class to register requirements for
 * @param requirements - Array of environment requirements
 *
 * @example
 * ```typescript
 * requireEnvironment(MyCommand, [
 *   { variable: 'API_KEY', message: 'API key is required', alternativeFlag: 'apiKey' }
 * ]);
 * ```
 */
export function requireEnvironment(
  cmd: unknown,
  requirements: EnvironmentRequirement[]
): void {
  // Store the requirements on the command class
  (cmd as unknown as Record<string, unknown>).environmentRequirements =
    requirements;
}

/**
 * Validates environment requirements before command execution
 * This hook runs during the OCLIF 'init' lifecycle phase
 *
 * The function checks that all registered environment requirements are met,
 * validates variable values if validators are provided, and throws detailed
 * error messages if any requirements are not satisfied.
 *
 * @param options - The hook options provided by OCLIF
 * @throws Throws error if environment requirements are not met
 */
export const validateEnvironment: Hook<'init'> = async _options => {
  // For init hooks, we don't have access to the specific command class yet
  // Environment validation will be handled in prerun hooks where command info is available
  return;
};

/**
 * Validates environment requirements for commands with environment dependencies
 * This should be used as a prerun hook for specific commands that need environment validation
 */
export const validateCommandEnvironment: Hook<'prerun'> = async options => {
  const command = options.Command;
  // Skip if the command has no environment requirements
  if (
    !(command as unknown as Record<string, unknown>).environmentRequirements
  ) {
    return;
  }

  const requirements: EnvironmentRequirement[] = (
    command as unknown as Record<string, unknown>
  ).environmentRequirements as EnvironmentRequirement[];
  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  for (const req of requirements) {
    // Skip if there's an alternative flag, it will be handled by the command itself
    if (
      req.alternativeFlag &&
      process.argv.includes(`--${req.alternativeFlag}`)
    ) {
      continue;
    }

    // Check if the variable exists in our environment configuration
    const envVarNames = Object.keys(envConfig.getAllVariables());
    if (envVarNames.includes(req.variable)) {
      const value = envConfig.getAllVariables()[req.variable]?.value as string;

      // If there's a validator, check the value
      if (req.validator && typeof value === 'string' && !req.validator(value)) {
        invalidVars.push(`${req.variable}=${value} (invalid)`);
      }
    } else if (process.env[req.variable]) {
      // Check for extension variables directly in process.env
      const value = process.env[req.variable];

      // If there's a validator, check the value
      if (req.validator && value && !req.validator(value)) {
        invalidVars.push(`${req.variable}=${value} (invalid)`);
      }
    } else {
      // Variable is missing entirely
      // message would be used for detailed error reporting
      // const message = req.message || `Required environment variable ${req.variable} is missing`;
      const alternativeMessage = req.alternativeFlag
        ? ` (or use --${req.alternativeFlag} flag)`
        : '';

      missingVars.push(`${req.variable}${alternativeMessage}`);
    }
  }

  // If any variables are missing or invalid, throw an error with detailed information
  if (missingVars.length > 0 || invalidVars.length > 0) {
    let errorMessage = '';

    if (missingVars.length > 0) {
      errorMessage += `Missing required environment variables:\n`;
      missingVars.forEach(v => (errorMessage += `- ${v}\n`));
    }

    if (invalidVars.length > 0) {
      errorMessage += `Invalid environment variables:\n`;
      invalidVars.forEach(v => (errorMessage += `- ${v}\n`));
    }

    throw new CLIError(errorMessage, 'ENV_VALIDATION_FAILED');
  }
};

/**
 * API Key flag definition for commands that require API Keys
 * Provides standard flag configuration for consistency across commands
 */
export const apiKeyFlag = {
  apiKey: Flags.string({
    char: 'k',
    description: 'API key for the service',
    env: 'API_KEY',
    required: false,
  }),
};

/**
 * Standard AI flag definitions for commands that interact with AI providers
 * Provides consistent flag configuration across all AI-related commands
 *
 * Includes flags for:
 * - apiKey: The API key for the AI provider
 * - provider: The AI provider to use (xai, openai, anthropic, ollama)
 * - model: The model to use for AI operations
 * - temperature: The temperature setting for AI response randomness
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
    default: 'xai',
  }),
  model: Flags.string({
    char: 'm',
    description: 'Model to use for AI operations',
    required: false,
    default: 'grok-beta',
  }),
  temperature: Flags.integer({
    char: 't',
    description: 'Temperature for AI response (0.0-1.0)',
    required: false,
    default: 7,
  }),
};

/**
 * Sets environment variables from command flags
 * This allows flags to override environment variables when both are specified
 *
 * @param flags - The parsed command flags
 * @param mappings - Object mapping flag names to environment variable names
 *
 * @example
 * ```typescript
 * setEnvFromFlags(flags, {
 *   apiKey: 'XAI_API_KEY',
 *   network: 'SUI_NETWORK'
 * });
 * ```
 */
export function setEnvFromFlags(
  flags: Record<string, unknown>,
  mappings: Record<string, string>
): void {
  for (const [flagName, envVar] of Object.entries(mappings)) {
    if (flags[flagName] !== undefined) {
      if (typeof process.env[envVar] === 'undefined') {
        process.env[envVar] = flags[flagName]?.toString();
      }
    }
  }
}

/**
 * Creates a CLI flag for an environment-configurable option
 * This automatically determines the flag type based on the environment variable's type
 *
 * @param envVar - The name of the environment variable
 * @param options - Options for flag creation
 * @param options.char - Single character alias for the flag
 * @param options.description - Description of the flag for help text
 * @param options.required - Whether the flag is required
 * @param options.options - Valid options for the flag (enum)
 * @param options.hidden - Whether to hide the flag from help
 * @param options.default - Function to get the default value
 *
 * @returns The created flag configuration
 * @throws If the environment variable is not defined in envConfig
 *
 * @example
 * ```typescript
 * const flags = {
 *   network: createEnvFlag('SUI_NETWORK', {
 *     char: 'n',
 *     description: 'Sui network to connect to',
 *     options: ['devnet', 'testnet', 'mainnet']
 *   })
 * };
 * ```
 */
export function createEnvFlag(
  envVar: string,
  options: {
    char?: string;
    description?: string;
    required?: boolean;
    options?: string[];
    hidden?: boolean;
    default?: () => unknown;
  } = {}
): unknown {
  // Get the actual environment variable definition
  const envVarConfig = envConfig.getAllVariables()[envVar];

  if (!envVarConfig) {
    throw new Error(`Unknown environment variable: ${envVar}`);
  }

  // Determine flag type based on the environment variable type
  const type = typeof envVarConfig.value;

  // Create the flag with appropriate configuration based on type
  const baseConfig = {
    description:
      options.description || envVarConfig.description || `Set ${envVar}`,
    required: options.required || false,
    env: envVar,
    hidden: options.hidden || false,
    ...(options.char && { char: options.char }),
  };

  // Since OCLIF flag typing is very strict, let's use a simpler approach
  // and let the calling code handle the specific flag type creation
  return {
    type,
    config: baseConfig,
    value: envVarConfig.value,
    options: options.options,
  };
}

/**
 * Command-specific validation hooks
 *
 * Each hook below implements validation logic specific to a particular command
 * These hooks run during the OCLIF 'prerun' lifecycle phase
 */

/**
 * Validation middleware for add command
 * Validates AI API key and blockchain configuration if needed
 *
 * @param options - The hook options provided by OCLIF
 * @throws Throws error if validation fails
 */
export const addCommandValidation: Hook<'prerun'> = async options => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(
    argv
  );
  const flags = parsedCommand.flags;

  // Validate API key if AI features are requested
  validateAIApiKey(flags);

  // Validate blockchain config if using blockchain storage
  validateBlockchainConfig(flags);
};

/**
 * Validation middleware for complete command
 * Ensures proper flag combinations and valid storage locations
 *
 * @param options - The hook options provided by OCLIF
 * @throws Throws error if validation fails
 */
export const completeCommandValidation: Hook<'prerun'> = async options => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(
    argv
  );
  const flags = parsedCommand.flags;

  // Prevent mutually exclusive flags
  if (flags.id && flags.all) {
    throw new CLIError(
      'Cannot specify both --id and --all flags',
      'INVALID_FLAGS'
    );
  }

  // Validate storage location if provided
  if (
    flags.storage &&
    !['local', 'blockchain', 'both'].includes(flags.storage as string)
  ) {
    throw new CLIError(
      'Invalid storage location. Use: local, blockchain, or both',
      'INVALID_STORAGE'
    );
  }
};

/**
 * Validation middleware for delete command
 * Ensures required flags are provided and validates flag combinations
 *
 * @param options - The hook options provided by OCLIF
 * @throws Throws error if validation fails
 */
export const deleteCommandValidation: Hook<'prerun'> = async options => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(
    argv
  );
  const flags = parsedCommand.flags;

  // Require either --id or --all flag
  if (!flags.id && !flags.all) {
    throw new CLIError(
      'Must specify either --id or --all flag',
      'MISSING_ID_OR_ALL'
    );
  }

  // Prevent mutually exclusive flags
  if (flags.id && flags.all) {
    throw new CLIError(
      'Cannot specify both --id and --all flags',
      'INVALID_FLAGS'
    );
  }
};

/**
 * Validation middleware for update command
 * Ensures required flags are provided and at least one update field is specified
 *
 * @param options - The hook options provided by OCLIF
 * @throws Throws error if validation fails
 */
export const updateCommandValidation: Hook<'prerun'> = async options => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(
    argv
  );
  const flags = parsedCommand.flags;

  // Require --id flag
  if (!flags.id) {
    throw new CLIError('Must specify todo ID with --id flag', 'MISSING_ID');
  }

  // Check that at least one update field is provided
  const updateFields = [
    'title',
    'priority',
    'due',
    'tags',
    'private',
    'completed',
  ];
  const hasUpdate = updateFields.some(field => flags[field] !== undefined);

  if (!hasUpdate) {
    throw new CLIError(
      'Must provide at least one field to update',
      'NO_UPDATE_FIELDS'
    );
  }
};

/**
 * Validation middleware for list command
 * Validates storage location if provided
 *
 * @param options - The hook options provided by OCLIF
 * @throws Throws error if validation fails
 */
export const listCommandValidation: Hook<'prerun'> = async options => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(
    argv
  );
  const flags = parsedCommand.flags;

  // Validate storage location if provided
  if (
    flags.storage &&
    !['local', 'blockchain', 'both'].includes(flags.storage as string)
  ) {
    throw new CLIError(
      'Invalid storage location. Use: local, blockchain, or both',
      'INVALID_STORAGE'
    );
  }
};

/**
 * Validation middleware for AI command
 * Validates API key and operation type
 *
 * @param options - The hook options provided by OCLIF
 * @throws Throws error if validation fails
 */
export const aiCommandValidation: Hook<'prerun'> = async options => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(
    argv
  );
  const flags = parsedCommand.flags;

  // Validate API key
  validateAIApiKey(flags);

  // Validate operation type
  if (
    flags.operation &&
    !['summarize', 'categorize', 'prioritize', 'suggest', 'analyze'].includes(
      flags.operation as string
    )
  ) {
    throw new CLIError(
      'Invalid operation type. Available operations: summarize, categorize, prioritize, suggest, analyze',
      'INVALID_OPERATION'
    );
  }
};

/**
 * Validation middleware for image:upload command
 * Ensures required path flag is provided
 *
 * @param options - The hook options provided by OCLIF
 * @throws Throws error if validation fails
 */
export const imageUploadCommandValidation: Hook<'prerun'> = async options => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(
    argv
  );
  const flags = parsedCommand.flags;

  // Check for required path
  if (!flags.path) {
    throw new CLIError(
      'Must specify image path with --path flag',
      'MISSING_PATH'
    );
  }
};

/**
 * Validation middleware for image:create-nft command
 * Validates required image ID and creator address format if provided
 *
 * @param options - The hook options provided by OCLIF
 * @throws Throws error if validation fails
 */
export const createNFTCommandValidation: Hook<'prerun'> = async options => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(
    argv
  );
  const flags = parsedCommand.flags;

  // Check for required image ID
  if (!flags.imageId) {
    throw new CLIError(
      'Must specify image ID with --imageId flag',
      'MISSING_IMAGE_ID'
    );
  }

  // Verify creator address is valid if provided (0x followed by 40 hex characters)
  if (flags.creator && !/^0x[a-fA-F0-9]{40}$/.test(flags.creator as string)) {
    throw new CLIError('Invalid creator address format', 'INVALID_ADDRESS');
  }
};

/**
 * Validation middleware for configure command
 * Ensures at least one configuration action is specified
 *
 * @param options - The hook options provided by OCLIF
 * @throws Throws error if validation fails
 */
export const configureCommandValidation: Hook<'prerun'> = async options => {
  // Parse command arguments to get flags
  const { Command, argv } = options;
  const parsedCommand = await (Command as unknown as CommandWithParse).parse(
    argv
  );
  const flags = parsedCommand.flags;

  // Ensure at least one configuration option is provided
  const configOptions = ['set', 'unset', 'list', 'reset'];
  const hasConfigOption = configOptions.some(
    option => flags[option] !== undefined
  );

  if (!hasConfigOption) {
    throw new CLIError(
      'Must specify at least one configuration action: --set, --unset, --list, or --reset',
      'MISSING_CONFIG_ACTION'
    );
  }
};

/**
 * Validates that AI API key is available when AI features are requested
 * Allows mock keys or testing mode to bypass strict validation
 *
 * @param flags - The parsed command flags
 * @throws Throws error if API key is missing when required
 */
export function validateAIApiKey(flags: Record<string, unknown>): void {
  // Skip validation if AI flag is not set
  if (!flags.ai) {
    return;
  }

  // Check for API key from flag or environment variable
  const apiKey = flags.apiKey || process.env.XAI_API_KEY;

  // Allow mock key or testing mode to bypass validation
  // This flexibility is important for development and testing workflows
  const isMockKey =
    typeof apiKey === 'string' &&
    (apiKey.includes('mock') ||
      apiKey.includes('fake') ||
      apiKey.includes('test'));
  const isTestingMode = process.env.MODE === 'testing';

  if (!apiKey && !isTestingMode) {
    throw new CLIError(
      'AI operations require an API key. Provide it with --apiKey flag or set XAI_API_KEY environment variable.',
      'MISSING_API_KEY'
    );
  }

  // Log if using mock or testing mode
  if ((isMockKey || isTestingMode) && apiKey !== process.env.XAI_API_KEY) {
    logger.info(
      'Using mock AI functionality - AI suggestions will be simulated'
    );
  }
}

/**
 * Validates blockchain configuration when blockchain storage is used
 * Checks for required environment variables needed for blockchain operations
 *
 * @param flags - The parsed command flags
 * @throws Throws error if blockchain configuration is incomplete
 */
export function validateBlockchainConfig(flags: Record<string, unknown>): void {
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
