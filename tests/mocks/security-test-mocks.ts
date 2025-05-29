/**
 * Comprehensive mock module for security tests
 * This module provides all the mocks needed for security testing
 * without depending on the actual CLI implementation files
 */

const { jest } = require('@jest/globals');

// Re-export all the individual mocks
export * from './AIService.mock';
export * from './AIVerificationService.mock';
export * from './BlockchainAIVerificationService.mock';
export * from './SecureCredentialManager.mock';
export * from './AuditLogger.mock';
export * from './AIProviderFactory.mock';
export * from './AIPermissionManager.mock';

// Import the mock instances
import { MockAIService } from './AIService.mock';
import { MockAIVerificationService } from './AIVerificationService.mock';
import { MockBlockchainAIVerificationService } from './BlockchainAIVerificationService.mock';
import { MockSecureCredentialManager, mockSecureCredentialManager } from './SecureCredentialManager.mock';
import { MockAuditLogger } from './AuditLogger.mock';
import { MockAIProviderFactory } from './AIProviderFactory.mock';
import { mockInitializePermissionManager, mockPermissionManager } from './AIPermissionManager.mock';

// Create a unified mock export for security tests
export const SecurityTestMocks = {
  // AI Services
  AIService: MockAIService,
  AIVerificationService: MockAIVerificationService,
  BlockchainAIVerificationService: MockBlockchainAIVerificationService,
  
  // Credential Management
  SecureCredentialManager: MockSecureCredentialManager,
  secureCredentialManager: mockSecureCredentialManager,
  
  // Logging
  AuditLogger: MockAuditLogger,
  
  // AI Providers
  AIProviderFactory: MockAIProviderFactory,
  
  // Permissions
  initializePermissionManager: mockInitializePermissionManager,
  permissionManager: mockPermissionManager,
};

// Default export for easy importing
export default SecurityTestMocks;