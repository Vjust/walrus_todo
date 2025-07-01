/**
import { Logger } from './Logger';

const logger = new Logger('startup-validator');
 * Startup Validation Service
 * 
 * This module provides validation functionality for application startup,
 * ensuring proper environment configuration and dependencies are in place.
 */

import chalk = require('chalk');
import { CLIError } from '../types/error';
import { envConfig } from './environment-config';
import { validateEnvironmentFull } from './env-validator';
import * as fs from 'fs';
import * as path from 'path';

interface StartupCheckResult {
  success: boolean;
  message?: string;
  critical: boolean;
}

/**
 * Performs all startup validation checks
 * @returns True if all checks passed successfully
 */
export function validateStartup(
  options: {
    throwOnError?: boolean;
    showBanner?: boolean;
    exitOnCritical?: boolean;
  } = {}
): boolean {
  const {
    throwOnError = true,
    showBanner = true,
    exitOnCritical = true,
  } = options;
  let isValid = true;
  let critical = false;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Show startup banner
  if (showBanner) {
    showStartupBanner();
  }

  try {
    // Validate environment
    const envResult = validateEnvironmentFull();
    if (!envResult.isValid) {
      isValid = false;

      if (envResult?.missingVars?.length > 0) {
        critical = true;
        errors.push(
          `Missing required environment variables: ${envResult?.missingVars?.join(', ')}`
        );
      }

      if (envResult?.invalidVars?.length > 0) {
        critical = true;
        errors.push(
          `Invalid environment variables:\n- ${envResult?.invalidVars?.join('\n- ')}`
        );
      }

      if (envResult?.deprecatedVars?.length > 0) {
        warnings.push(
          `Deprecated environment variables:\n- ${envResult?.deprecatedVars?.join('\n- ')}`
        );
      }

      if (envResult?.warnings?.length > 0) {
        warnings.push(
          `Environment warnings:\n- ${envResult?.warnings?.join('\n- ')}`
        );
      }
    }

    // Check for storage directory
    const storageDirCheck = checkStorageDirectory();
    if (!storageDirCheck.success) {
      isValid = false;
      if (storageDirCheck.critical) {
        critical = true;
        errors.push(
          storageDirCheck.message || 'Storage directory check failed'
        );
      } else {
        warnings.push(
          storageDirCheck.message || 'Storage directory check warning'
        );
      }
    }

    // Check for temporary directory
    const tempDirCheck = checkTemporaryDirectory();
    if (!tempDirCheck.success) {
      isValid = false;
      if (tempDirCheck.critical) {
        critical = true;
        errors.push(tempDirCheck.message || 'Temporary directory check failed');
      } else {
        warnings.push(
          tempDirCheck.message || 'Temporary directory check warning'
        );
      }
    }

    // Display results
    if (!isValid) {
      if (errors.length > 0) {
        logger.error(chalk.red('\nStartup validation errors:'));
        errors.forEach(error => logger.error(chalk.red(`  - ${error}`)));
      }

      if (warnings.length > 0) {
        logger.warn(chalk.yellow('\nStartup validation warnings:'));
        warnings.forEach(warning =>
          logger.warn(chalk.yellow(`  - ${warning}`))
        );
      }

      if (throwOnError && critical) {
        throw new CLIError(
          'Startup validation failed with critical errors. See above for details.',
          'STARTUP_VALIDATION_FAILED'
        );
      } else if (exitOnCritical && critical) {
        process.exit(1);
      }
    } else {
      if (warnings.length > 0) {
        logger.warn(chalk.yellow('\nStartup validation warnings:'));
        warnings.forEach(warning =>
          logger.warn(chalk.yellow(`  - ${warning}`))
        );
      }
    }

    return isValid;
  } catch (error) {
    if (throwOnError) {
      throw error;
    } else {
      logger.error(chalk.red('\nUnexpected startup validation error:'));
      logger.error(
        chalk.red(
          `  - ${error instanceof Error ? error.message : String(error)}`
        )
      );
      if (exitOnCritical) {
        process.exit(1);
      }
      return false;
    }
  }
}

/**
 * Show startup banner with application and environment info
 */
function showStartupBanner(): void {
  // Use string values for the environment variables
  const appName = (envConfig.getExtension('CLI_CONFIG') || 'waltodo') as string;
  const version = (envConfig.getExtension('CLI_VERSION') || '1?.0?.0') as string;
  const env = envConfig.get('NODE_ENV');

  // Convert app name to string and uppercase it safely
  const appNameUpper =
    typeof appName === 'string'
      ? appName.toUpperCase()
      : String(appName).toUpperCase();

  logger.info(chalk.blue('\n======================================'));
  logger.info(chalk.blue(`  ${appNameUpper} v${version}`));
  logger.info(chalk.blue(`  Environment: ${env}`));
  logger.info(chalk.blue('======================================\n'));
}

/**
 * Check if storage directory exists and is writable
 */
function checkStorageDirectory(): StartupCheckResult {
  const storagePath = envConfig.get('STORAGE_PATH');
  if (!storagePath) {
    return {
      success: false,
      message:
        'Storage path is not defined. Set the STORAGE_PATH environment variable.',
      critical: true,
    };
  }

  try {
    if (!fs.existsSync(storagePath)) {
      try {
        fs.mkdirSync(storagePath, { recursive: true });
        return {
          success: true,
          message: `Created storage directory at ${storagePath}`,
          critical: false,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create storage directory at ${storagePath}: ${error instanceof Error ? error.message : String(error)}`,
          critical: true,
        };
      }
    }

    // Check if directory is writable
    const testFile = path.join(storagePath, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    return {
      success: true,
      critical: false,
    };
  } catch (error) {
    return {
      success: false,
      message: `Storage directory at ${storagePath} is not writable: ${error instanceof Error ? error.message : String(error)}`,
      critical: true,
    };
  }
}

/**
 * Check if temporary directory exists and is writable
 */
function checkTemporaryDirectory(): StartupCheckResult {
  const tempPath = envConfig.get('TEMPORARY_STORAGE');
  if (!tempPath) {
    return {
      success: false,
      message:
        'Temporary storage path is not defined. Set the TEMPORARY_STORAGE environment variable.',
      critical: false, // Not critical as it might not be used immediately
    };
  }

  try {
    if (!fs.existsSync(tempPath)) {
      try {
        fs.mkdirSync(tempPath, { recursive: true });
        return {
          success: true,
          message: `Created temporary directory at ${tempPath}`,
          critical: false,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create temporary directory at ${tempPath}: ${error instanceof Error ? error.message : String(error)}`,
          critical: false, // Not critical as it might not be used immediately
        };
      }
    }

    // Check if directory is writable
    const testFile = path.join(tempPath, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    return {
      success: true,
      critical: false,
    };
  } catch (error) {
    return {
      success: false,
      message: `Temporary directory at ${tempPath} is not writable: ${error instanceof Error ? error.message : String(error)}`,
      critical: false, // Not critical as it might not be used immediately
    };
  }
}
