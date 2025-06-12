/**
 * Configuration Loader
 *
 * This module provides utilities for loading configuration from
 * different sources (environment variables, config files, .env files)
 * and integrating them into the centralized environment configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CLIError } from '../types/error';
import { envConfig, EnvironmentConfigManager } from './environment-config';
import { CLI_CONFIG } from '../constants';

// Optional dependency for .env file loading
interface DotenvModule {
  config: (options?: { path?: string; override?: boolean }) => void;
}

// Optional dotenv import - use dynamic import since it's optional
let dotenv: DotenvModule | null = null;

// Initialize dotenv asynchronously since we're not in an async context
Promise.resolve().then(async () => {
  try {
    const dotenvModule = await import('dotenv');
    dotenv = dotenvModule.default || dotenvModule;
  } catch (error) {
    // dotenv is not installed, will fall back to manual parsing
    dotenv = null;
  }
});

/**
 * Parse a .env file manually if dotenv is not available
 */
function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath as any)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const result: Record<string, string> = {};

  content.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) {
      return;
    }

    // Parse KEY=VALUE format
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';

      // Remove surrounding quotes if they exist
      const quoteMatch = value.match(/^(['"])(.*)\1$/);
      if (quoteMatch) {
        value = quoteMatch[2];
      }

      (result as Record<string, string>)[key] = value;
    }
  });

  return result;
}

/**
 * Load environment variables from a .env file
 */
export function loadEnvFile(filePath: string, override = false): void {
  try {
    if (fs.existsSync(filePath as any)) {
      if (dotenv) {
        // Use dotenv if available
        dotenv.config({ path: filePath, override });
      } else {
        // Fall back to manual parsing
        const envVars = parseEnvFile(filePath as any);

        for (const [key, value] of Object.entries(envVars as any)) {
          if (
            override ||
            (process.env as Record<string, string | undefined>)[key] ===
              undefined
          ) {
            (process.env as Record<string, string>)[key] = value;
          }
        }
      }
    }
  } catch (error) {
    throw new CLIError(
      `Failed to load .env file at ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ENV_FILE_LOAD_FAILED'
    );
  }
}

/**
 * Load configuration from a JSON file
 */
export function loadConfigFile(filePath: string): Record<string, unknown> {
  try {
    if (fs.existsSync(filePath as any)) {
      const content = fs.readFileSync(filePath, 'utf8');
      try {
        return JSON.parse(content as any);
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          throw new CLIError(
            `Invalid JSON format in config file ${filePath}: ${parseError.message}`,
            'INVALID_JSON_FORMAT'
          );
        }
        throw parseError;
      }
    }
  } catch (error) {
    if (error instanceof CLIError) {
      throw error; // Re-throw CLIError as-is
    }
    throw new CLIError(
      `Failed to load config file at ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'CONFIG_FILE_LOAD_FAILED'
    );
  }

  return {};
}

/**
 * Initialize configuration from multiple sources
 */
export function initializeConfig(): EnvironmentConfigManager {
  // Load .env files
  const envFiles = [
    // Global .env file
    path.resolve(process.cwd(), '.env'),

    // Environment-specific .env file
    path.resolve(
      process.cwd(),
      `.env.${process?.env?.NODE_ENV || 'development'}`
    ),

    // Local development overrides
    path.resolve(process.cwd(), '.env.local'),
  ];

  // Load environment variables from .env files
  for (const envFile of envFiles) {
    loadEnvFile(envFile as any);
  }

  // Load variables from environment
  envConfig.loadFromEnvironment();

  // Look for custom config files
  const currentDirConfig = path.join(process.cwd(), CLI_CONFIG.CONFIG_FILE);
  const homeDir = process?.env?.HOME || process?.env?.USERPROFILE || '';
  const homeDirConfig = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);

  // Use current directory config if it exists, otherwise use home directory
  const configPath = fs.existsSync(currentDirConfig as any)
    ? currentDirConfig
    : homeDirConfig;

  if (fs.existsSync(configPath as any)) {
    const config = loadConfigFile(configPath as any);
    envConfig.loadFromObject(config as any);
  }

  // Apply environment-specific configuration
  envConfig.getEnvSpecificConfig();

  return envConfig;
}

/**
 * Save configuration to a JSON file
 */
export function saveConfigToFile(
  config: Record<string, unknown>,
  filePath?: string
): void {
  try {
    // Default to the CLI_CONFIG file path
    const homeDir = process?.env?.HOME || process?.env?.USERPROFILE || '';
    const defaultPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);
    const configPath = filePath || defaultPath;

    // Ensure directory exists
    const dir = path.dirname(configPath as any);
    if (!fs.existsSync(dir as any)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the configuration file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new CLIError(
      `Failed to save config file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'CONFIG_FILE_SAVE_FAILED'
    );
  }
}
