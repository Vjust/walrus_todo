import { WalrusError } from '../types/error';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
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
    this.addHandler((entry) => {
      // Skip debug messages unless NODE_ENV is development
      if (entry.level === LogLevel.DEBUG && process.env.NODE_ENV !== 'development') {
        return;
      }

      const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      const error = entry.error ? `\n${JSON.stringify(entry.error, null, 2)}` : '';
      const component = this.componentName ? `[${this.componentName}] ` : '';
      console[entry.level](`[${entry.timestamp}] ${component}${entry.message}${context}${error}`);
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
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
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.sanitizeContext(context)
    };

    if (error) {
      entry.error = {
        name: error.name,
        code: error instanceof WalrusError ? error.code : 'UNKNOWN_ERROR',
        message: error.message,
        stack: error.stack
      };
    }

    this.logHandlers.forEach(handler => handler(entry));
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
      /seed/i
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