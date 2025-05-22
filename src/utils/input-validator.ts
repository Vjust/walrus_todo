/**
 * Input Validator
 *
 * Utility for validating user-provided input to prevent security vulnerabilities
 * such as command injection, path traversal, and other common attack vectors.
 */

import { ValidationError } from '../types/errors/ValidationError';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Validation rules for different types of input
 */
export interface ValidationRule {
  /**
   * The regular expression to test against
   */
  pattern: RegExp;
  
  /**
   * The error message to display if validation fails
   */
  message: string;
}

/**
 * Commonly used validation rules
 */
export const ValidationRules = {
  /**
   * Validates Sui blockchain addresses (0x followed by hex characters)
   */
  SuiAddress: {
    pattern: /^0x[a-fA-F0-9]+$/,
    message: 'Must be a valid Sui address (0x followed by hex characters)'
  },
  
  /**
   * Validates gas budget (positive integers only)
   */
  GasBudget: {
    pattern: /^[1-9]\d*$/,
    message: 'Must be a positive integer'
  },
  
  /**
   * Validates object IDs (0x followed by hex characters)
   */
  ObjectId: {
    pattern: /^0x[a-fA-F0-9]+$/,
    message: 'Must be a valid object ID (0x followed by hex characters)'
  },
  
  /**
   * Validates network names (lowercase alphabetical only)
   */
  NetworkName: {
    pattern: /^[a-z]+$/,
    message: 'Must contain only lowercase letters'
  },
  
  /**
   * Validates file paths (no shell metacharacters)
   */
  FilePath: {
    pattern: /^[^;&|<>$`\\!]+$/,
    message: 'Must not contain shell metacharacters'
  },
  
  /**
   * Validates URLs
   */
  Url: {
    pattern: /^https?:\/\/[\w.-]+(:\d+)?(\/[\w.-]*)*\/?(\?\S*)?$/,
    message: 'Must be a valid HTTP or HTTPS URL'
  },
  
  /**
   * Validates package names (alphanumeric, hyphens, and underscores)
   */
  PackageName: {
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: 'Must contain only alphanumeric characters, hyphens, or underscores'
  },
  
  /**
   * Validates module names (alphanumeric and underscores)
   */
  ModuleName: {
    pattern: /^[a-zA-Z0-9_]+$/,
    message: 'Must contain only alphanumeric characters and underscores'
  },
  
  /**
   * Validates function names (alphanumeric and underscores)
   */
  FunctionName: {
    pattern: /^[a-zA-Z0-9_]+$/,
    message: 'Must contain only alphanumeric characters and underscores'
  }
};

/**
 * Validates input against a specific rule
 * @param input The input to validate
 * @param rule The validation rule to use
 * @param field Optional field name for error reporting
 * @throws ValidationError if validation fails
 */
export function validateInput(input: string, rule: ValidationRule, field?: string): void {
  if (!rule.pattern.test(input)) {
    throw new ValidationError(rule.message, field, { value: input });
  }
}

/**
 * Validates multiple inputs against their respective rules
 * @param inputs Object containing field-value pairs to validate
 * @param rules Object containing field-rule pairs to validate against
 * @returns True if all validations pass, throws otherwise
 * @throws ValidationError if any validation fails
 */
export function validateInputs<T extends Record<string, string>>(
  inputs: T,
  rules: Partial<Record<keyof T, ValidationRule>>
): boolean {
  const fieldNames = Object.keys(rules) as Array<keyof T>;
  
  for (const field of fieldNames) {
    const value = inputs[field];
    const rule = rules[field];
    
    if (value !== undefined && rule !== undefined) {
      validateInput(value, rule, String(field));
    }
  }
  
  return true;
}

/**
 * Validates a file path to prevent path traversal attacks
 * @param inputPath The file path to validate
 * @param options Options for validation
 * @throws ValidationError if validation fails
 */
export function validateFilePath(
  inputPath: string,
  options: {
    allowedDirectories?: string[];
    mustExist?: boolean;
    fileType?: 'file' | 'directory' | 'both';
  } = {}
): void {
  // Normalize the path to resolve '..' and '.' segments
  const normalizedPath = path.normalize(inputPath);
  
  // Check for shell metacharacters
  validateInput(normalizedPath, ValidationRules.FilePath, 'path');
  
  // Define allowed directories
  const allowedDirectories = options.allowedDirectories || [
    process.cwd(),
    os.tmpdir(),
    path.resolve(os.homedir(), '.sui'),
    path.resolve(os.homedir(), '.walrus'),
    path.resolve(os.homedir(), '.waltodo')
  ];
  
  // Check if the path is within allowed directories
  const isPathAllowed = allowedDirectories.some(dir => {
    const normalizedDir = path.normalize(dir);
    return normalizedPath.startsWith(normalizedDir);
  });
  
  if (!isPathAllowed) {
    throw new ValidationError(
      `Path must be within allowed directories: ${allowedDirectories.join(', ')}`,
      'path',
      { value: inputPath }
    );
  }
  
  // Check if the path exists if required
  if (options.mustExist) {
    if (!fs.existsSync(normalizedPath)) {
      throw new ValidationError(`Path does not exist: ${normalizedPath}`, 'path', { value: inputPath });
    }
    
    // Check if the file type matches the expected type
    if (options.fileType) {
      const stats = fs.statSync(normalizedPath);
      
      if (options.fileType === 'file' && !stats.isFile()) {
        throw new ValidationError(`Path is not a file: ${normalizedPath}`, 'path', { value: inputPath });
      }
      
      if (options.fileType === 'directory' && !stats.isDirectory()) {
        throw new ValidationError(`Path is not a directory: ${normalizedPath}`, 'path', { value: inputPath });
      }
    }
  }
}

/**
 * Validates a network URL
 * @param url The URL to validate
 * @param allowedDomains Optional array of allowed domains
 * @throws ValidationError if validation fails
 */
export function validateUrl(url: string, allowedDomains?: string[]): void {
  // Basic URL validation
  validateInput(url, ValidationRules.Url, 'url');
  
  if (allowedDomains && allowedDomains.length > 0) {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      
      const isDomainAllowed = allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
      
      if (!isDomainAllowed) {
        throw new ValidationError(
          `URL domain not allowed. Must be one of: ${allowedDomains.join(', ')}`,
          'url',
          { value: url }
        );
      }
    } catch (_error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Invalid URL format: ${url}`, 'url', { value: url });
    }
  }
}

/**
 * Validates a package ID, module name, and function name for Move call
 * @param packageId The package ID to validate
 * @param moduleName The module name to validate
 * @param functionName The function name to validate
 * @throws ValidationError if any validation fails
 */
export function validateMoveTarget(packageId: string, moduleName: string, functionName: string): void {
  validateInput(packageId, ValidationRules.ObjectId, 'packageId');
  validateInput(moduleName, ValidationRules.ModuleName, 'moduleName');
  validateInput(functionName, ValidationRules.FunctionName, 'functionName');
}

/**
 * Sanitizes a string for use in command-line arguments by removing shell metacharacters
 * @param input The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeCommandInput(input: string): string {
  return input.replace(/[;&|<>$`\\!]/g, '');
}

/**
 * Validates and sanitizes a command-line argument
 * @param input The argument to validate and sanitize
 * @param rule The validation rule to use
 * @param field Optional field name for error reporting
 * @returns Sanitized argument
 * @throws ValidationError if validation fails
 */
export function validateAndSanitizeArgument(input: string, rule: ValidationRule, field?: string): string {
  // First validate the argument
  validateInput(input, rule, field);
  
  // Then sanitize it to be extra safe
  return sanitizeCommandInput(input);
}