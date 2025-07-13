/**
 * Logging utility for Waltodo
 * Provides structured logging with support for debug mode via DEBUG environment variable
 */

import chalk from 'chalk';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  message: string;
  data?: any;
  error: Error | undefined;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  colorize: boolean;
  timestamp: boolean;
  json: boolean;
}

/**
 * Logger class
 */
export class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: this.getLogLevelFromEnv(),
      colorize: process.stdout.isTTY && !process.env['NO_COLOR'],
      timestamp: true,
      json: process.env['LOG_FORMAT'] === 'json',
      ...config,
    };
  }

  /**
   * Get log level from environment variables
   */
  private getLogLevelFromEnv(): LogLevel {
    const debug = process.env['DEBUG'];
    const logLevel = process.env['LOG_LEVEL'];

    if (debug === 'waltodo' || debug === '*' || debug?.includes('waltodo')) {
      return LogLevel.DEBUG;
    }

    if (logLevel) {
      const level = logLevel.toUpperCase();
      if (level in LogLevel) {
        return LogLevel[level as keyof typeof LogLevel] as unknown as LogLevel;
      }
    }

    return LogLevel.INFO;
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, errorOrData?: Error | any, data?: any): void {
    if (errorOrData instanceof Error) {
      this.log(LogLevel.ERROR, message, data, errorOrData);
    } else {
      this.log(LogLevel.ERROR, message, errorOrData);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      timestamp: new Date(),
      message,
      data,
      error: error || undefined,
    };

    if (this.config.json) {
      this.logJson(entry);
    } else {
      this.logPretty(entry);
    }
  }

  /**
   * Log in JSON format
   */
  private logJson(entry: LogEntry): void {
    const output: any = {
      level: LogLevel[entry.level],
      timestamp: entry.timestamp.toISOString(),
      message: entry.message,
    };

    if (entry.data !== undefined) {
      output.data = entry.data;
    }

    if (entry.error) {
      output.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    console.error(JSON.stringify(output));
  }

  /**
   * Log in pretty format
   */
  private logPretty(entry: LogEntry): void {
    const parts: string[] = [];

    // Timestamp
    if (this.config.timestamp) {
      const timestamp = entry.timestamp.toISOString();
      parts.push(this.config.colorize ? chalk.gray(timestamp) : timestamp);
    }

    // Level
    const levelStr = this.formatLevel(entry.level);
    parts.push(levelStr);

    // Message
    const message = this.config.colorize 
      ? this.colorizeByLevel(entry.message, entry.level)
      : entry.message;
    parts.push(message);

    // Data
    if (entry.data !== undefined) {
      const dataStr = typeof entry.data === 'string' 
        ? entry.data 
        : JSON.stringify(entry.data, null, 2);
      parts.push(this.config.colorize ? chalk.gray(dataStr) : dataStr);
    }

    // Log to stderr for all log levels
    console.error(parts.join(' '));

    // Error stack trace
    if (entry.error && entry.error.stack) {
      const stack = this.config.colorize 
        ? chalk.red(entry.error.stack)
        : entry.error.stack;
      console.error(stack);
    }
  }

  /**
   * Format log level for display
   */
  private formatLevel(level: LogLevel): string {
    const labels: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO ',
      [LogLevel.WARN]: 'WARN ',
      [LogLevel.ERROR]: 'ERROR',
      [LogLevel.NONE]: 'NONE ',
    };

    const label = labels[level] || 'UNKNOWN';

    if (!this.config.colorize) {
      return `[${label}]`;
    }

    const coloredLabel = ({
      [LogLevel.DEBUG]: chalk.gray(label),
      [LogLevel.INFO]: chalk.blue(label),
      [LogLevel.WARN]: chalk.yellow(label),
      [LogLevel.ERROR]: chalk.red(label),
      [LogLevel.NONE]: label,
    } as Record<LogLevel, string>)[level] || label;

    return `[${coloredLabel}]`;
  }

  /**
   * Colorize message based on log level
   */
  private colorizeByLevel(message: string, level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return chalk.gray(message);
      case LogLevel.INFO:
        return message; // No color for info
      case LogLevel.WARN:
        return chalk.yellow(message);
      case LogLevel.ERROR:
        return chalk.red(message);
      default:
        return message;
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: any): Logger {
    const childLogger = new Logger(this.config);
    const originalLog = childLogger.log.bind(childLogger);

    childLogger.log = (level: LogLevel, message: string, data?: any, error?: Error) => {
      const mergedData = data ? { ...context, ...data } : context;
      originalLog(level, message, mergedData, error);
    };

    return childLogger;
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set log level
   */
  setLevel(level: string | LogLevel): void {
    if (typeof level === 'string') {
      const levelUpper = level.toUpperCase();
      if (levelUpper in LogLevel) {
        this.config.level = LogLevel[levelUpper as keyof typeof LogLevel] as unknown as LogLevel;
      }
    } else {
      this.config.level = level;
    }
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a logger for a specific module
 */
export function createLogger(module: string): Logger {
  return logger.child({ module });
}

/**
 * Timer utility for performance logging
 */
export class Timer {
  private start: number;
  private logger: Logger;
  private name: string;

  constructor(name: string, customLogger: Logger = logger) {
    this.name = name;
    this.logger = customLogger;
    this.start = Date.now();
    this.logger.debug(`Timer started: ${name}`);
  }

  /**
   * Log elapsed time and return milliseconds
   */
  end(message?: string): number {
    const elapsed = Date.now() - this.start;
    const msg = message || `Timer ended: ${this.name}`;
    this.logger.debug(msg, { elapsed: `${elapsed}ms` });
    return elapsed;
  }

  /**
   * Get elapsed time without logging
   */
  elapsed(): number {
    return Date.now() - this.start;
  }
}

/**
 * Create a timer
 */
export function timer(name: string, customLogger?: Logger): Timer {
  return new Timer(name, customLogger);
}