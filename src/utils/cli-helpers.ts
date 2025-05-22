import chalk from 'chalk';
import ora from 'ora';
import type { Ora } from 'ora';
import { CLIError } from './error-handler';

/**
 * Unified spinner management for CLI commands
 */
export class SpinnerManager {
  private spinner: Ora;
  
  constructor(text: string) {
    this.spinner = (ora as any).default ? (ora as any).default(text) : ora(text);
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
    console.error(chalk.red(`Error: ${message}`));
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
      throw new CLIError(`${name} must be a positive number`, 'VALIDATION_ERROR');
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
  onRetry?: (attempt: number, error: Error) => void;
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
      onRetry
    } = options;
    
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (_error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxAttempts) {
          const delay = Math.min(
            initialDelay * Math.pow(backoffFactor, attempt - 1),
            maxDelay
          );
          
          if (onRetry) {
            onRetry(attempt, lastError);
          }
          
          await this.delay(delay);
        }
      }
    }
    
    throw lastError!;
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
    console.log(chalk.green(`✓ ${message}`));
  }
  
  static error(message: string): void {
    console.error(chalk.red(`✗ ${message}`));
  }
  
  static warning(message: string): void {
    console.warn(chalk.yellow(`⚠ ${message}`));
  }
  
  static info(message: string): void {
    console.log(chalk.blue(`ℹ ${message}`));
  }
  
  static debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }
  
  static step(step: number, total: number, message: string): void {
    console.log(chalk.dim(`[${step}/${total}]`) + ` ${message}`);
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