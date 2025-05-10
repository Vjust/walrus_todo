/**
 * AI Provider Adapter Utilities
 * 
 * Utility functions for working with AI providers and converting between
 * enum and string representations.
 */

import { AIProvider } from '../../types/adapters/AIModelAdapter';

/**
 * Convert an AIProvider enum value to its string representation
 */
export function getProviderString(provider: AIProvider): string {
  // For enum values, convert to string appropriately
  switch (provider) {
    case AIProvider.XAI:
      return 'xai';
    case AIProvider.OPENAI:
      return 'openai';
    case AIProvider.ANTHROPIC:
      return 'anthropic';
    case AIProvider.OLLAMA:
      return 'ollama';
    default:
      // This shouldn't happen, but return a default if it does
      return 'xai';
  }
}

/**
 * Convert a string provider name to its AIProvider enum value
 */
export function getProviderEnum(providerString: string): AIProvider {
  // Case-insensitive matching
  const normalizedProvider = providerString.toLowerCase();
  
  switch (normalizedProvider) {
    case 'xai':
      return AIProvider.XAI;
    case 'openai':
      return AIProvider.OPENAI;
    case 'anthropic':
      return AIProvider.ANTHROPIC;
    case 'ollama':
      return AIProvider.OLLAMA;
    default:
      return AIProvider.XAI; // Default to XAI if unknown
  }
}

/**
 * Get the enum value for a provider string
 * This is an alias for getProviderEnum with clearer naming
 */
export function getProviderEnumFromString(providerString: string): AIProvider {
  return getProviderEnum(providerString);
}

/**
 * Check if a string is a valid provider name
 */
export function isValidProvider(providerString: string): boolean {
  const normalizedProvider = providerString.toLowerCase();
  return Object.values(AIProvider).includes(normalizedProvider as AIProvider);
}