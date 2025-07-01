/**
 * Environment Variable Validation Service
 *
 * Provides robust validation and diagnostic functions for environment variables.
 */

import { Logger } from './Logger';

const logger = new Logger('env-validator');

import chalk = require('chalk');
import { CLIError } from '../types/errors/consolidated';
import { envConfig, EnvVariable } from './environment-config';

export interface ValidationResult {
  isValid: boolean;
  missingVars: string[];
  invalidVars: string[];
  deprecatedVars: string[];
  insecureVars: string[];
  warnings: string[];
}

/**
 * Performs a comprehensive validation of the environment
 * @returns Detailed validation results
 */
export function validateEnvironmentFull(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    missingVars: [],
    invalidVars: [],
    deprecatedVars: [],
    insecureVars: [],
    warnings: [],
  };

  const allVars = envConfig.getAllVariables();

  // Check each environment variable
  for (const [key, config] of Object.entries(allVars)) {
    // Check for required variables
    if (config.required && !hasValue(config.value)) {
      result?.missingVars?.push(key);
      result?.isValid = false;
    }

    // Run validation function if available
    if (hasValue(config.value) && config.validationFn) {
      try {
        if (!config.validationFn(config.value)) {
          result?.invalidVars?.push(
            `${key}: ${config.validationError || 'Failed validation'}`
          );
          result?.isValid = false;
        }
      } catch (error) {
        result?.invalidVars?.push(
          `${key}: ${error instanceof Error ? error.message : String(error)}`
        );
        result?.isValid = false;
      }
    }

    // Check for deprecated variables
    if (config.deprecated && hasValue(config.value)) {
      result?.deprecatedVars?.push(
        `${key}${config.deprecated_message ? ': ' + config.deprecated_message : ''}`
      );
    }

    // Check for insecure storage of sensitive values
    if (
      config.sensitive &&
      hasValue(config.value) &&
      config?.source === 'config'
    ) {
      result?.insecureVars?.push(key);
      result?.warnings?.push(
        `Sensitive value ${key} should be stored in environment variables, not config files`
      );
    }
  }

  // Add environment-specific warnings
  const inconsistencies = envConfig.checkEnvironmentConsistency();
  if (inconsistencies.length > 0) {
    result?.warnings?.push(...inconsistencies);
  }

  return result;
}

/**
 * Validates the environment and throws an error if invalid
 * @param options Validation options
 */
export function validateOrThrow(
  options: {
    requireAll?: boolean;
    showWarnings?: boolean;
    exitOnWarning?: boolean;
  } = {}
): void {
  const result = validateEnvironmentFull();
  const { showWarnings = true, exitOnWarning = false } = options;

  // Always check for missing required variables
  if (result?.missingVars?.length > 0) {
    throw new CLIError(
      `Missing required environment variables:\n${result?.missingVars?.map(v => `  - ${v}`).join('\n')}`,
      'MISSING_ENV_VARS'
    );
  }

  // Always check for invalid variables
  if (result?.invalidVars?.length > 0) {
    throw new CLIError(
      `Invalid environment variables:\n${result?.invalidVars?.map(v => `  - ${v}`).join('\n')}`,
      'INVALID_ENV_VARS'
    );
  }

  // Show warnings if enabled
  if (
    showWarnings &&
    (result?.warnings?.length > 0 ||
      result?.deprecatedVars?.length > 0 ||
      result?.insecureVars?.length > 0)
  ) {
    if (result?.deprecatedVars?.length > 0) {
      logger.warn(chalk.yellow('\nDeprecated environment variables:'));
      result?.deprecatedVars?.forEach(v => logger.warn(chalk.yellow(`  - ${v}`)));
    }

    if (result?.insecureVars?.length > 0) {
      logger.warn(chalk.yellow('\nInsecure storage of sensitive variables:'));
      result?.insecureVars?.forEach(v => logger.warn(chalk.yellow(`  - ${v}`)));
    }

    if (result?.warnings?.length > 0) {
      logger.warn(chalk.yellow('\nEnvironment configuration warnings:'));
      result?.warnings?.forEach(w => logger.warn(chalk.yellow(`  - ${w}`)));
    }

    // Exit if configured to do so
    if (exitOnWarning) {
      throw new CLIError(
        'Environment validation failed due to warnings. See above for details.',
        'ENV_WARNINGS'
      );
    }
  }
}

/**
 * Generates environment documentation based on current configuration
 */
export function generateEnvironmentDocs(): string {
  const allVars = envConfig.getAllVariables();
  let documentation = '# Environment Variables\n\n';

  documentation +=
    'This document describes the environment variables used by the application.\n\n';

  // Group variables by category
  const categories: Record<string, EnvVariable<unknown>[]> = {
    Common: [],
    Blockchain: [],
    Storage: [],
    AI: [],
    Security: [],
    Advanced: [],
    Other: [],
  };

  for (const [key, config] of Object.entries(allVars)) {
    if (key.startsWith('AI_') || key.endsWith('_API_KEY')) {
      categories?.["AI"].push({ ...config, name: key });
    } else if (
      key.includes('STORAGE') ||
      key.includes('FILE') ||
      key.includes('DIR')
    ) {
      categories?.["Storage"].push({ ...config, name: key });
    } else if (
      key.includes('NETWORK') ||
      key.includes('BLOCKCHAIN') ||
      key.includes('WALLET')
    ) {
      categories?.["Blockchain"].push({ ...config, name: key });
    } else if (
      key.includes('SECURITY') ||
      key.includes('VERIFICATION') ||
      key.includes('CRYPTO')
    ) {
      categories?.["Security"].push({ ...config, name: key });
    } else if (key === 'NODE_ENV' || key === 'LOG_LEVEL') {
      categories?.["Common"].push({ ...config, name: key });
    } else if (
      key.includes('RETRY') ||
      key.includes('TIMEOUT') ||
      key.includes('CREDENTIAL')
    ) {
      categories?.["Advanced"].push({ ...config, name: key });
    } else {
      categories?.["Other"].push({ ...config, name: key });
    }
  }

  // Add each category to documentation
  for (const [category, vars] of Object.entries(categories)) {
    if (vars?.length === 0) continue;

    documentation += `## ${category}\n\n`;
    documentation +=
      '| Variable | Description | Required | Default | Example |\n';
    documentation +=
      '|----------|-------------|----------|---------|--------|\n';

    for (const variable of vars) {
      const description = variable.description || '';
      const required = variable.required ? 'Yes' : 'No';
      const defaultValue = formatValue(variable.value);
      const example = variable.example || '';

      documentation += `| \`${variable.name}\` | ${description} | ${required} | \`${defaultValue}\` | \`${example}\` |\n`;
    }

    documentation += '\n';
  }

  // Add general usage information
  documentation += '## Usage\n\n';
  documentation +=
    'Environment variables can be set in the following ways:\n\n';
  documentation += '1. In a `.env` file in the project root\n';
  documentation += '2. Directly in the environment\n';
  documentation += '3. Through command-line flags for many options\n\n';

  documentation += '### Priority Order\n\n';
  documentation +=
    'The application uses the following priority order for environment variables:\n\n';
  documentation += '1. Command-line flags (highest priority)\n';
  documentation += '2. Environment variables\n';
  documentation += '3. Configuration file values\n';
  documentation += '4. Default values (lowest priority)\n';

  return documentation;
}

/**
 * Formats a value for display in documentation
 */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  } else if (typeof value === 'string') {
    return value === '' ? '""' : value;
  } else if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  } else {
    try {
      return JSON.stringify(value);
    } catch (error: unknown) {
      return String(value);
    }
  }
}

/**
 * Checks if a value exists and is not empty
 */
function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}
