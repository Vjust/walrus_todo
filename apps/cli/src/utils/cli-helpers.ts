import chalk = require('chalk');
import type { Ora } from 'ora';

// Safe ora import with fallback
let ora:
  | typeof import('ora').default
  | (() => {
      start: () => { succeed: () => void; fail: () => void; stop: () => void };
      succeed: () => void;
      fail: () => void;
      stop: () => void;
    });
try {
  // Using import instead of require - still dynamic for safety
  void import('ora')
    .then(module => {
      ora = module.default || module;
    })
    .catch(() => {
      // Fallback for missing ora
      ora = () => ({
        start: () => ({ succeed: () => {}, fail: () => {}, stop: () => {} }),
        succeed: () => {},
        fail: () => {},
        stop: () => {},
      });
    });
} catch {
  // Fallback for missing ora
  ora = () => ({
    start: () => ({ succeed: () => {}, fail: () => {}, stop: () => {} }),
    succeed: () => {},
    fail: () => {},
    stop: () => {},
  });
}
import { CLIError } from './error-handler';
import { Logger as BaseLogger } from './Logger';

const logger = new BaseLogger('cli-helpers');

/**
 * Unified spinner management for CLI commands
 */
export class SpinnerManager {
  private spinner: Ora;

  constructor(text: string) {
    // Handle both CommonJS and ES module imports
    const oraFn =
      typeof ora === 'function'
        ? ora
        : (ora as { default: typeof import('ora').default }).default;
    this.spinner = oraFn(text);
  }

  start(text?: string): void {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.start();
  }

  succeed(text?: string): void {
    if (text) {
      this.spinner.succeed(text);
    } else {
      this.spinner.succeed();
    }
  }

  fail(text?: string): void {
    if (text) {
      this.spinner.fail(text);
    } else {
      this.spinner.fail();
    }
  }

  info(text: string): void {
    this.spinner.info(text);
  }

  warn(text: string): void {
    this.spinner.warn(text);
  }

  stop(): void {
    this.spinner.stop();
  }

  update(text: string): void {
    this.spinner.text = text;
  }
}

/**
 * Centralized error handling utilities
 */
export class ErrorHandler {
  static handle(error: unknown, context: string): never {
    if (error instanceof CLIError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new CLIError(`${context}: ${message}`, 'CLI_ERROR');
  }

  static formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  static exit(message: string, code: number = 1): never {
    logger.error(chalk.red(`Error: ${message}`));
    process.exit(code);
  }
}

/**
 * Common flag validation patterns
 */
export class FlagValidator {
  static validatePositiveNumber(value: string, name: string): number {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      throw new CLIError(
        `${name} must be a positive number`,
        'VALIDATION_ERROR'
      );
    }
    return num;
  }

  static validateNonEmpty(value: string, name: string): string {
    if (!value || value.trim().length === 0) {
      throw new CLIError(`${name} cannot be empty`, 'VALIDATION_ERROR');
    }
    return value.trim();
  }

  static validateEnum<T extends string>(
    value: string,
    validValues: T[],
    name: string
  ): T {
    if (!validValues.includes(value as T)) {
      throw new CLIError(
        `${name} must be one of: ${validValues.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }
    return value as T;
  }

  static validatePath(path: string, name: string): string {
    if (!path || path.trim().length === 0) {
      throw new CLIError(`${name} cannot be empty`, 'VALIDATION_ERROR');
    }
    // Additional path validation can be added here
    return path.trim();
  }
}

/**
 * Retry logic utilities
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

export class RetryManager {
  static async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffFactor = 2,
      onRetry,
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts) {
          const delay = Math.min(
            initialDelay * Math.pow(backoffFactor, attempt - 1),
            maxDelay
          );

          if (onRetry) {
            onRetry(lastError, attempt, delay);
          }

          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Common logging utilities
 */
export class Logger {
  static success(message: string): void {
    logger.info(chalk.green(`✓ ${message}`));
  }

  static error(message: string): void {
    logger.error(chalk.red(`✗ ${message}`));
  }

  static warning(message: string): void {
    logger.warn(chalk.yellow(`⚠ ${message}`));
  }

  static info(message: string): void {
    logger.info(chalk.blue(`ℹ ${message}`));
  }

  static debug(message: string): void {
    if (process.env.DEBUG) {
      logger.info(chalk.gray(`[DEBUG] ${message}`));
    }
  }

  static step(step: number, total: number, message: string): void {
    logger.info(chalk.dim(`[${step}/${total}]`) + ` ${message}`);
  }
}

/**
 * Format utilities for consistent output
 */
export class Formatter {
  static table(data: Record<string, unknown>): string {
    const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));
    return Object.entries(data)
      .map(([key, value]) => `${key.padEnd(maxKeyLength)} : ${value}`)
      .join('\n');
  }

  static list(items: string[], bullet = '•'): string {
    return items.map(item => `${bullet} ${item}`).join('\n');
  }

  static code(text: string): string {
    return chalk.cyan(text);
  }

  static highlight(text: string): string {
    return chalk.bold(text);
  }

  static dim(text: string): string {
    return chalk.dim(text);
  }
}
