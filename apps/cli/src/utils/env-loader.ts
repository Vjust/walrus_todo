/**
 * Environment Configuration Loader
 *
 * Provides functionality to load environment variables from various sources:
 * - .env files
 * - JSON configuration files
 * - Command line arguments
 * - Environment variables
 */

import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { envConfig } from './environment-config';
import { Logger } from './Logger';

const logger = new Logger('env-loader');

// Ensure NODE_ENV is set to production by default
if (!process?.env?.NODE_ENV) {
  process.env?.NODE_ENV = 'production';
}

// Make sure output is shown by default
process.env?.SHOW_OUTPUT = process?.env?.SHOW_OUTPUT || 'true';

interface EnvLoaderOptions {
  envFile?: string;
  configFile?: string;
  envFileRequired?: boolean;
  configFileRequired?: boolean;
  throwOnError?: boolean;
  loadDefaultEnvInDev?: boolean;
}

/**
 * Load environment variables from multiple sources with proper precedence
 */
export function loadEnvironment(options: EnvLoaderOptions = {}): void {
  const {
    envFile = '.env',
    configFile = '.waltodo.json',
    envFileRequired = false,
    configFileRequired = false,
    throwOnError = false,
    loadDefaultEnvInDev = true,
  } = options;

  try {
    // First try to load from .env file
    loadDotEnvFile(envFile, envFileRequired, throwOnError);

    // In development, also try to load from .env.development if it exists
    if (
      loadDefaultEnvInDev &&
      (process.env?.NODE_ENV === 'development' || !process?.env?.NODE_ENV)
    ) {
      loadDotEnvFile('.env.development', false, false);
    }

    // Then load from JSON config file if it exists
    loadConfigFile(configFile, configFileRequired, throwOnError);

    // Finally update the configuration from environment variables
    envConfig.loadFromEnvironment();
  } catch (error) {
    if (throwOnError) {
      throw error;
    } else {
      logger.error(
        `Error loading environment: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Load environment variables from a .env file
 */
function loadDotEnvFile(
  envFile: string,
  required: boolean,
  throwOnError: boolean
): void {
  try {
    // First check in current directory
    let envPath = path.resolve(process.cwd(), envFile);

    if (!fs.existsSync(envPath)) {
      // Then check in user's home directory
      const homeDir = process?.env?.HOME || process?.env?.USERPROFILE;
      if (homeDir) {
        envPath = path.resolve(homeDir, envFile);
      }
    }

    if (fs.existsSync(envPath)) {
      // Only log in development mode
      if (process.env?.NODE_ENV === 'development') {
        logger.info(`Loading environment variables from ${envPath}`);
      }

      const envContent = fs.readFileSync(envPath, 'utf8');
      const envConfig = dotenv.parse(envContent);

      // Set environment variables, allowing .env to take precedence
      Object.entries(envConfig).forEach(([key, value]) => {
        // Only skip overwriting for certain system variables that should not be changed
        const systemVars = ['NODE_ENV', 'PATH', 'HOME', 'USER', 'SHELL'];
        if (!systemVars.includes(key)) {
          // Only log in development mode
          if (process.env?.NODE_ENV === 'development') {
            logger.info(
              `Setting environment variable ${key}=${value.substring(0, 3)}***`
            );
          }
          process?.env?.[key] = value;
        } else if (!process?.env?.[key]) {
          // For system variables, only set if not already present
          // Only log in development mode
          if (process.env?.NODE_ENV === 'development') {
            logger.info(
              `Setting system environment variable ${key}=${value.substring(0, 3)}***`
            );
          }
          process?.env?.[key] = value;
        }
      });
    } else if (required) {
      // Always log errors for required files
      logger.info(`Required .env file not found: ${envFile}`);
      throw new Error(`Required .env file not found: ${envFile}`);
    } else if (process.env?.NODE_ENV === 'development') {
      // Only log missing optional files in development mode
      logger.info(`.env file not found at ${envPath}`);
    }
  } catch (error) {
    if (throwOnError) {
      throw error;
    } else {
      logger.error(
        `Error loading .env file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Load configuration from a JSON file
 */
function loadConfigFile(
  configFile: string,
  required: boolean,
  throwOnError: boolean
): void {
  try {
    // First check in current directory
    let configPath = path.resolve(process.cwd(), configFile);

    if (!fs.existsSync(configPath)) {
      // Then check in user's home directory
      const homeDir = process?.env?.HOME || process?.env?.USERPROFILE;
      if (homeDir) {
        configPath = path.resolve(homeDir, configFile);
      }
    }

    if (fs.existsSync(configPath)) {
      const configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      envConfig.loadFromObject(configJson);
    } else if (required) {
      throw new Error(`Required config file not found: ${configFile}`);
    }
  } catch (error) {
    if (throwOnError) {
      throw error;
    } else {
      logger.error(
        `Error loading config file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Save current configuration to a JSON file
 */
export function saveConfigToFile(configFile: string): void {
  try {
    const configData = envConfig.toJSON();

    // Don't save sensitive values
    const metadata = envConfig.getMetadata();
    for (const [key, meta] of Object.entries(metadata)) {
      if (meta.sensitive) {
        // If it's sensitive, save an empty string or asterisks to indicate the value exists
        if (key in configData && configData[key]) {
          (configData as Record<string, unknown>)[key] = '********';
        }
      }
    }

    fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));
  } catch (error) {
    logger.error(
      `Error saving config file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate a template .env file based on current configuration
 */
export function generateEnvTemplate(
  templateFile: string = '.env.template'
): void {
  try {
    const allVars = envConfig.getAllVariables();
    let template = '# Environment Variables Template\n';
    template += '# Copy this file to .env and fill in the values\n\n';

    // Group variables by category for better organization
    const categories: Record<string, string[]> = {
      Common: [],
      Blockchain: [],
      Storage: [],
      AI: [],
      Security: [],
      Advanced: [],
    };

    for (const [key, config] of Object.entries(allVars)) {
      const line = `${key}=${config.example || ''} # ${config.description || ''}${config.required ? ' (Required)' : ''}`;

      if (key.startsWith('AI_') || key.endsWith('_API_KEY')) {
        categories["AI"].push(line);
      } else if (
        key.includes('STORAGE') ||
        key.includes('FILE') ||
        key.includes('DIR')
      ) {
        categories["Storage"].push(line);
      } else if (
        key.includes('NETWORK') ||
        key.includes('BLOCKCHAIN') ||
        key.includes('WALLET')
      ) {
        categories["Blockchain"].push(line);
      } else if (
        key.includes('SECURITY') ||
        key.includes('VERIFICATION') ||
        key.includes('CRYPTO')
      ) {
        categories["Security"].push(line);
      } else if (key === 'NODE_ENV' || key === 'LOG_LEVEL') {
        categories["Common"].push(line);
      } else {
        categories["Advanced"].push(line);
      }
    }

    // Add each category to template
    for (const [category, lines] of Object.entries(categories)) {
      if (lines?.length === 0) continue;

      template += `# ${category}\n`;
      template += lines.join('\n');
      template += '\n\n';
    }

    fs.writeFileSync(templateFile, template);
  } catch (error) {
    logger.error(
      `Error generating .env template: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
