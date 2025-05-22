import { Request, Response, NextFunction } from 'express';
import { SchemaValidator } from './SchemaValidator';
import { CommandSanitizer } from './CommandSanitizer';

/**
 * Express middleware for request validation
 * Validates and sanitizes request bodies, query parameters, and URL parameters
 */
export class ApiValidationMiddleware {
  /**
   * Creates middleware for validating request body
   * @param schema Schema to validate against
   * @returns Express middleware function
   */
  static validateBody(schema: any) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Sanitize the request body
        const sanitizedBody = this.sanitizeObject(req.body);
        
        // Validate against schema
        SchemaValidator.validate(sanitizedBody, schema);
        
        // Replace request body with sanitized version
        req.body = sanitizedBody;
        
        next();
      } catch (_error) {
        res.status(400).json({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : String(error),
          code: 'VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Creates middleware for validating URL parameters
   * @param schema Schema to validate against
   * @returns Express middleware function
   */
  static validateParams(schema: any) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Sanitize URL parameters
        const sanitizedParams = this.sanitizeObject(req.params);
        
        // Validate against schema
        SchemaValidator.validate(sanitizedParams, schema);
        
        // Replace request params with sanitized version
        req.params = sanitizedParams;
        
        next();
      } catch (_error) {
        res.status(400).json({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : String(error),
          code: 'VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Creates middleware for validating query parameters
   * @param schema Schema to validate against
   * @returns Express middleware function
   */
  static validateQuery(schema: any) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Sanitize query parameters
        const sanitizedQuery = this.sanitizeObject(req.query);
        
        // Validate against schema
        SchemaValidator.validate(sanitizedQuery, schema);
        
        // Replace request query with sanitized version
        req.query = sanitizedQuery;
        
        next();
      } catch (_error) {
        res.status(400).json({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : String(error),
          code: 'VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Creates middleware for validating file uploads
   * @param allowedMimeTypes Array of allowed MIME types
   * @param maxSize Maximum file size in bytes
   * @returns Express middleware function
   */
  static validateFileUpload(allowedMimeTypes: string[], maxSize: number) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          throw new Error('No file uploaded');
        }
        
        // Check file type
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
          throw new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
        }
        
        // Check file size
        if (req.file.size > maxSize) {
          throw new Error(`File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)} MB`);
        }
        
        // Sanitize filename
        if (req.file.originalname) {
          req.file.originalname = CommandSanitizer.sanitizeFilename(req.file.originalname);
        }
        
        next();
      } catch (_error) {
        res.status(400).json({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : String(error),
          code: 'FILE_VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Creates middleware for validating authentication
   * @param authType The type of authentication to validate
   * @returns Express middleware function
   */
  static validateAuth(authType: 'bearer' | 'api-key' = 'bearer') {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          throw new Error('Authorization header is required');
        }
        
        if (authType === 'bearer') {
          // Validate Bearer token
          if (!authHeader.startsWith('Bearer ')) {
            throw new Error('Authorization must use Bearer scheme');
          }
          
          const token = authHeader.substring(7);
          if (!token || token.length < 10) {
            throw new Error('Invalid token format');
          }
          
          // Add sanitized token to request
          (req as any).token = CommandSanitizer.sanitizeString(token);
        } else if (authType === 'api-key') {
          // Validate API key
          if (!authHeader.startsWith('ApiKey ')) {
            throw new Error('Authorization must use ApiKey scheme');
          }
          
          const apiKey = authHeader.substring(7);
          if (!apiKey || apiKey.length < 16) {
            throw new Error('Invalid API key format');
          }
          
          // Add sanitized API key to request
          (req as any).apiKey = CommandSanitizer.sanitizeApiKey(apiKey);
        }
        
        next();
      } catch (_error) {
        res.status(401).json({
          error: 'Unauthorized',
          message: error instanceof Error ? error.message : String(error),
          code: 'AUTH_VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Recursively sanitize an object's string properties
   * @param obj Object to sanitize
   * @returns Sanitized object
   */
  private static sanitizeObject(obj: any): any {
    return CommandSanitizer.sanitizeForJson(obj);
  }
}