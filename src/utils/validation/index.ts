/**
 * Validation utilities index
 * Exports all validation-related utilities for easy import
 */

import { CommandSanitizer } from '../CommandSanitizer';
import { InputValidator, ValidationRule, ValidationSchema, CommonValidationRules } from '../InputValidator';
import { SchemaValidator, Schemas } from '../SchemaValidator';
import { PromptValidator } from '../PromptValidator';
import { ApiInputValidator } from '../ApiInputValidator';
import { ApiValidationMiddleware } from '../ApiValidationMiddleware';
import {
  addCommandValidation,
  completeCommandValidation,
  deleteCommandValidation,
  updateCommandValidation,
  listCommandValidation,
  aiCommandValidation,
  imageUploadCommandValidation,
  createNFTCommandValidation,
  configureCommandValidation,
  validateAIApiKey,
  validateBlockchainConfig
} from '../CommandValidationMiddleware';

export {
  CommandSanitizer,
  InputValidator,
  SchemaValidator,
  Schemas,
  PromptValidator,
  ApiInputValidator,
  ApiValidationMiddleware,
  addCommandValidation,
  completeCommandValidation,
  deleteCommandValidation,
  updateCommandValidation,
  listCommandValidation,
  aiCommandValidation,
  imageUploadCommandValidation,
  createNFTCommandValidation,
  configureCommandValidation,
  validateAIApiKey,
  validateBlockchainConfig
};

// Re-export types with correct syntax for isolatedModules
export type { ValidationRule, ValidationSchema, CommonValidationRules };