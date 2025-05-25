import {
  SecureCredentialStore,
  secureCredentialStore,
} from './SecureCredentialStore';
import { EnhancedCredentialManager } from './EnhancedCredentialManager';
import { CredentialVerifier } from './CredentialVerifier';
import { ApiKeyValidator } from './ApiKeyValidator';

/**
 * Use the SecureCredentialStore as the main credential manager
 * This provides enhanced security features over the EnhancedCredentialManager
 */
export const credentialManager = secureCredentialStore;

// Export all classes for custom implementations
export {
  SecureCredentialStore,
  EnhancedCredentialManager,
  CredentialVerifier,
  ApiKeyValidator,
};
