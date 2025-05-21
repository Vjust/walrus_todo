/**
 * Configuration Loader
 * 
 * This module provides utilities for loading configuration from 
 * different sources (environment variables, config files, .env files)
 * and integrating them into the centralized environment configuration.
 */

import fs from 'fs';
import path from 'path';
import { CLIError } from '../types/error';
import { envConfig, EnvironmentConfigManager } from './environment-config';
import { CLI_CONFIG } from '../constants';

// Optional dependency for .env file loading
let dotenv: any;
try {
  // Try to load dotenv if available
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  dotenv = require('dotenv');
} catch (error) {
  // dotenv is not installed, will fall back to manual parsing
  dotenv = null;
}

/**
 * Parse a .env file manually if dotenv is not available
 */
function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
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
      
      result[key] = value;
    }
  });
  
  return result;
}

/**
 * Load environment variables from a .env file
 */
export function loadEnvFile(filePath: string, override = false): void {
  try {
    if (fs.existsSync(filePath)) {
      if (dotenv) {
        // Use dotenv if available
        dotenv.config({ path: filePath, override });
      } else {
        // Fall back to manual parsing
        const envVars = parseEnvFile(filePath);
        
        for (const [key, value] of Object.entries(envVars)) {
          if (override || process.env[key] === undefined) {
            process.env[key] = value;
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
export function loadConfigFile(filePath: string): Record<string, any> {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      try {
        return JSON.parse(content);
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
    path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`),
    
    // Local development overrides
    path.resolve(process.cwd(), '.env.local'),
  ];
  
  // Load environment variables from .env files
  for (const envFile of envFiles) {
    loadEnvFile(envFile);
  }
  
  // Load variables from environment
  envConfig.loadFromEnvironment();
  
  // Look for custom config files
  const currentDirConfig = path.join(process.cwd(), CLI_CONFIG.CONFIG_FILE);
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const homeDirConfig = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);
  
  // Use current directory config if it exists, otherwise use home directory
  const configPath = fs.existsSync(currentDirConfig) ? currentDirConfig : homeDirConfig;
  
  if (fs.existsSync(configPath)) {
    const config = loadConfigFile(configPath);
    envConfig.loadFromObject(config);
  }
  
  // Apply environment-specific configuration
  envConfig.getEnvSpecificConfig();
  
  return envConfig;
}

/**
 * Save configuration to a JSON file
 */
export function saveConfigToFile(config: Record<string, any>, filePath?: string): void {
  try {
    // Default to the CLI_CONFIG file path
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const defaultPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);
    const configPath = filePath || defaultPath;
    
    // Ensure directory exists
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
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