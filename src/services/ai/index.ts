/**
 * AI Service exports
 */

// Export the main AI Service (original)
export { aiService } from './aiService';

// Export the Safe AI Service (robust wrapper)
export { SafeAIService, safeAIService } from './SafeAIService';
export type { SafeAIResult } from './SafeAIService';

// Export the secure credential service
export { secureCredentialService } from './SecureCredentialService';

// Export verification service
export { AIVerificationService } from './AIVerificationService';
export type { VerifiedAIResult } from './AIVerificationService';

// Export credential interfaces
export type { CredentialInfo } from './SecureCredentialService';

// Export types
export { AIProvider } from './types';
export type * from './types';
