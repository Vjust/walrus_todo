import winston from 'winston';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Validate and normalize log level
const getValidLogLevel = (level: string): string => {
  const validLevels = [
    'error',
    'warn',
    'info',
    'http',
    'verbose',
    'debug',
    'silly',
  ];
  const normalizedLevel = level.toLowerCase();
  return validLevels.includes(normalizedLevel) ? normalizedLevel : 'info';
};

// Define proper transport options interfaces
interface FileTransportOptions extends winston.transports.FileTransportOptions {
  level?: string;
  format?: winston.Logform.Format;
}

interface ConsoleTransportOptions extends winston.transports.ConsoleTransportOptions {
  level?: string;
  format?: winston.Logform.Format;
  handleExceptions?: boolean;
}

// Create logger instance with safe configuration
export const logger = winston.createLogger({
  level: getValidLogLevel(config.logging.level),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'waltodo-api' },
  transports: [
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    } as FileTransportOptions),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    } as FileTransportOptions),
  ],
  handleExceptions: true,
  handleRejections: true,
  exitOnError: false,
});

// Add console transport for development and non-production environments
if (config.env !== 'production') {
  try {
    logger.add(
      new winston.transports.Console({
        level: getValidLogLevel(config.logging.level),
        handleExceptions: true,
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(
            (info: winston.Logform.TransformableInfo) => {
              const { timestamp, level, message, service, ...meta } = info as any;
              // Safely handle meta object
              const metaStr =
                Object.keys(meta).length > 0
                  ? `\n${JSON.stringify(meta, null, 2)}`
                  : '';
              const serviceTag = service ? `[${service}] ` : '';
              return `${timestamp} ${serviceTag}${level}: ${message}${metaStr}`;
            }
          )
        ),
      } as ConsoleTransportOptions)
    );
  } catch (error) {
    // Fallback to basic console logging if Winston console transport fails
    console.error('Failed to add console transport to logger:', error);
  }
}

export default logger;
