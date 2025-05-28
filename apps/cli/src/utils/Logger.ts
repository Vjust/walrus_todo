import { WalrusError } from '../types/errors/consolidated';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: ErrorLogInfo;
}

interface ErrorLogInfo {
  name: string;
  code: string;
  message: string;
  stack?: string;
  cause?: string;
}

export class Logger {
  private static instance: Logger;
  private logHandlers: ((entry: LogEntry) => void)[] = [];
  private componentName: string = '';

  // Constructor access set to public to fix TypeScript errors in existing code
  public constructor(componentName: string = '') {
    // Add default console handler
    this.componentName = componentName;
    this.addHandler(entry => {
      // Skip debug messages unless NODE_ENV is development
      if (
        entry.level === LogLevel.DEBUG &&
        process.env.NODE_ENV !== 'development'
      ) {
        return;
      }

      const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      const error = entry.error
        ? `\n${JSON.stringify(entry.error, null, 2)}`
        : '';
      const component = this.componentName ? `[${this.componentName}] ` : '';
      const logMessage = `[${entry.timestamp}] ${component}${entry.message}${context}${error}`;
      
      // Safely map log levels to console methods with type guards
      const consoleMethod = this.getConsoleMethod(entry.level);
      // eslint-disable-next-line no-console
      consoleMethod(logMessage);
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Safely get console method for log level
   * @param level Log level
   * @returns Console method function
   */
  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        // Fallback to console.log for unknown levels
        return console.log;
    }
  }

  /**
   * Add a log handler
   * @param handler Function to handle log entries
   */
  public addHandler(handler: (entry: LogEntry) => void): void {
    this.logHandlers.push(handler);
  }

  /**
   * Remove all log handlers
   */
  public clearHandlers(): void {
    this.logHandlers = [];
  }

  /**
   * Create a log entry
   * @param level Log level
   * @param message Log message
   * @param context Additional context
   * @param error Error object
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    // Validate parameters
    if (!level || !Object.values(LogLevel).includes(level)) {
      level = LogLevel.INFO; // Default fallback
    }
    if (typeof message !== 'string') {
      message = String(message || ''); // Convert to string
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.sanitizeContext(context),
    };

    if (error) {
      entry.error = {
        name: error.name || 'Error',
        code: error instanceof WalrusError ? error.code : 'UNKNOWN_ERROR',
        message: error.message || 'No error message provided',
        stack: error.stack,
      };
    }

    // Safely execute handlers with error handling
    this.logHandlers.forEach(handler => {
      try {
        handler(entry);
      } catch (handlerError) {
        // Prevent handler errors from breaking logging
        console.error('Logger handler error:', handlerError);
      }
    });
  }

  /**
   * Remove sensitive information from context
   */
  private sanitizeContext(
    context?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!context) return undefined;

    const sanitized: Record<string, unknown> = {};
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /auth/i,
      /signature/i,
      /seed/i,
    ];

    for (const [key, value] of Object.entries(context)) {
      if (sensitivePatterns.some(pattern => pattern.test(key))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    this.log(LogLevel.ERROR, message, context, error);
  }
}
