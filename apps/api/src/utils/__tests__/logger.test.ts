import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';
import { config } from '../../config';

// Mock dependencies
jest.mock('../../config');
jest.mock('fs');
jest.mock('winston', () => {
  const mockTransports = {
    File: jest.fn().mockImplementation(() => ({
      filename: '',
      level: '',
      maxsize: 0,
      maxFiles: 0,
      format: {},
    })),
    Console: jest.fn().mockImplementation(() => ({
      level: '',
      handleExceptions: true,
      format: {},
    })),
  };

  const mockFormat = {
    combine: jest.fn().mockReturnValue('combined-format'),
    timestamp: jest.fn().mockReturnValue('timestamp-format'),
    errors: jest.fn().mockReturnValue('errors-format'),
    json: jest.fn().mockReturnValue('json-format'),
    colorize: jest.fn().mockReturnValue('colorize-format'),
    printf: jest.fn().mockReturnValue('printf-format'),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(),
    level: 'info',
  };

  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    transports: mockTransports,
    format: mockFormat,
  };
});

const mockConfig = {
  env: 'development',
  logging: {
    level: 'info',
    enabled: true,
  },
};

const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
};

describe('Logger Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (config as any) = mockConfig;
    (fs.existsSync as jest.Mock) = mockFs.existsSync;
    (fs.mkdirSync as jest.Mock) = mockFs.mkdirSync;
  });

  describe('Initialization', () => {
    it('should create logs directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      // Re-import to trigger initialization
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'logs')
      );
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'logs'),
        { recursive: true }
      );
    });

    it('should not create logs directory if it already exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'logs')
      );
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should create winston logger with correct configuration', () => {
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          format: 'combined-format',
          defaultMeta: { service: 'waltodo-api' },
          transports: expect.any(Array),
          handleExceptions: true,
          handleRejections: true,
          exitOnError: false,
        })
      );
    });
  });

  describe('Log Level Validation', () => {
    it('should use valid log level from config', () => {
      mockConfig.logging.level = 'debug';
      
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
        })
      );
    });

    it('should normalize log level to lowercase', () => {
      mockConfig.logging.level = 'DEBUG';
      
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
        })
      );
    });

    it('should default to info for invalid log level', () => {
      mockConfig.logging.level = 'invalid-level';
      
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
        })
      );
    });

    it('should handle empty log level', () => {
      mockConfig.logging.level = '';
      
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
        })
      );
    });
  });

  describe('Transport Configuration', () => {
    it('should configure file transport for error logs', () => {
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(winston.transports.File).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error',
          maxsize: 5242880,
          maxFiles: 5,
          format: 'combined-format',
        })
      );
    });

    it('should configure file transport for combined logs', () => {
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(winston.transports.File).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: path.join(process.cwd(), 'logs', 'combined.log'),
          maxsize: 5242880,
          maxFiles: 5,
          format: 'combined-format',
        })
      );
    });

    it('should add console transport in development environment', () => {
      mockConfig.env = 'development';
      const mockLogger = { add: jest.fn() };
      (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);
      
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(mockLogger.add).toHaveBeenCalledWith(
        expect.any(winston.transports.Console)
      );
    });

    it('should not add console transport in production environment', () => {
      mockConfig.env = 'production';
      const mockLogger = { add: jest.fn() };
      (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);
      
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(mockLogger.add).not.toHaveBeenCalled();
    });
  });

  describe('Format Configuration', () => {
    it('should configure winston formats correctly', () => {
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(winston.format.combine).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalledWith({
        format: 'YYYY-MM-DD HH:mm:ss',
      });
      expect(winston.format.errors).toHaveBeenCalledWith({ stack: true });
      expect(winston.format.json).toHaveBeenCalled();
    });

    it('should configure console format for development', () => {
      mockConfig.env = 'development';
      const mockLogger = { add: jest.fn() };
      (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);
      
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(winston.format.colorize).toHaveBeenCalledWith({ all: true });
      expect(winston.format.printf).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle console transport addition failure gracefully', () => {
      mockConfig.env = 'development';
      const mockLogger = {
        add: jest.fn().mockImplementation(() => {
          throw new Error('Console transport failed');
        }),
      };
      (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      jest.isolateModules(() => {
        require('../logger');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to add console transport to logger:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Logger Methods', () => {
    it('should provide logging methods', () => {
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should be callable as logger methods', () => {
      logger.info('Test info message');
      logger.error('Test error message');
      logger.warn('Test warn message');
      logger.debug('Test debug message');

      // Verify methods are callable (winston mock will track calls)
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Meta Data Handling', () => {
    it('should handle meta data in printf format', () => {
      const printfCallback = (winston.format.printf as jest.Mock).mock.calls[0]?.[0];
      
      if (printfCallback) {
        const logInfo = {
          timestamp: '2023-01-01 12:00:00',
          level: 'info',
          message: 'Test message',
          service: 'waltodo-api',
          extra: 'data',
        };

        const result = printfCallback(logInfo);
        expect(typeof result).toBe('string');
      }
    });

    it('should handle empty meta data in printf format', () => {
      const printfCallback = (winston.format.printf as jest.Mock).mock.calls[0]?.[0];
      
      if (printfCallback) {
        const logInfo = {
          timestamp: '2023-01-01 12:00:00',
          level: 'info',
          message: 'Test message',
        };

        const result = printfCallback(logInfo);
        expect(typeof result).toBe('string');
      }
    });
  });

  describe('Integration', () => {
    it('should export logger as default', () => {
      jest.isolateModules(() => {
        const loggerModule = require('../logger');
        expect(loggerModule.default).toBeDefined();
        expect(loggerModule.logger).toBeDefined();
      });
    });

    it('should maintain logger configuration across imports', () => {
      const logger1 = require('../logger').logger;
      const logger2 = require('../logger').logger;
      
      expect(logger1).toBe(logger2);
    });
  });
});