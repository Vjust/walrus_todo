import { CLIError } from '../../../types/error';
import { AIProvider } from '../types';
import { CredentialType } from '../../../types/adapters/AICredentialAdapter';

/**
 * Provider-specific API key validation rules
 */
interface ValidationRule {
  pattern: RegExp;
  minLength: number;
  maxLength?: number;
  description: string;
  prefix?: string;
  checksum?: boolean;
}

/**
 * API Key Validator
 * 
 * A utility class for validating API keys with provider-specific rules.
 * Helps ensure proper format and catch common errors before using keys.
 */
export class ApiKeyValidator {
  // Provider-specific validation rules
  private static readonly VALIDATION_RULES: Record<string, ValidationRule> = {
    'xai': {
      pattern: /^xai-[A-Za-z0-9]{24,}$/,
      minLength: 28,
      maxLength: 64,
      prefix: 'xai-',
      description: "XAI API keys must start with 'xai-' followed by at least 24 alphanumeric characters"
    },
    'openai': {
      pattern: /^sk-[A-Za-z0-9]{32,}$/,
      minLength: 35,
      maxLength: 100,
      prefix: 'sk-',
      description: "OpenAI API keys must start with 'sk-' followed by at least 32 alphanumeric characters"
    },
    'anthropic': {
      pattern: /^sk-ant-[A-Za-z0-9]{24,}$/,
      minLength: 32,
      maxLength: 100,
      prefix: 'sk-ant-',
      description: "Anthropic API keys must start with 'sk-ant-' followed by at least 24 alphanumeric characters"
    },
    'ollama': {
      pattern: /.+/,
      minLength: 8,
      description: "Ollama API keys must be at least 8 characters"
    },
    'custom': {
      pattern: /.+/,
      minLength: 8,
      description: "Custom API keys must be at least 8 characters"
    }
  };

  /**
   * Validate an API key for a specific provider
   * 
   * @param provider The AI provider
   * @param apiKey The API key to validate
   * @param type Optional credential type for additional checks
   * @throws CLIError if validation fails
   */
  public static validate(
    provider: AIProvider | string,
    apiKey: string,
    type: CredentialType = CredentialType.API_KEY
  ): void {
    // Convert enum to string if needed
    const providerStr = typeof provider === 'string' ? provider : AIProvider[provider];
    const rules = this.VALIDATION_RULES[providerStr] || this.VALIDATION_RULES.custom;
    
    // Basic checks
    if (!apiKey || typeof apiKey !== 'string') {
      throw new CLIError(
        'API key must be a non-empty string',
        'INVALID_API_KEY_FORMAT'
      );
    }
    
    // Trim any whitespace that might have been accidentally included
    const trimmedKey = apiKey.trim();
    if (trimmedKey !== apiKey) {
      throw new CLIError(
        'API key contains leading or trailing whitespace, which may cause authentication failures',
        'INVALID_API_KEY_FORMAT'
      );
    }
    
    // Length check
    if (apiKey.length < rules.minLength) {
      throw new CLIError(
        `API key for ${provider} is too short. ${rules.description}`,
        'INVALID_API_KEY_FORMAT'
      );
    }
    
    // Maximum length check if specified
    if (rules.maxLength && apiKey.length > rules.maxLength) {
      throw new CLIError(
        `API key for ${provider} is too long. Maximum length is ${rules.maxLength} characters.`,
        'INVALID_API_KEY_FORMAT'
      );
    }
    
    // Pattern check
    if (!rules.pattern.test(apiKey)) {
      throw new CLIError(
        `Invalid API key format for ${provider}. ${rules.description}`,
        'INVALID_API_KEY_FORMAT'
      );
    }
    
    // Check for common mistakes like including "Bearer" prefix
    if (apiKey.startsWith('Bearer ')) {
      throw new CLIError(
        'API key should not include "Bearer " prefix. Please provide only the key itself.',
        'INVALID_API_KEY_FORMAT'
      );
    }
    
    // Detect if the user might have included quotes around the key
    if ((apiKey.startsWith('"') && apiKey.endsWith('"')) || 
        (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
      throw new CLIError(
        'API key should not include surrounding quotes. Please provide only the key itself.',
        'INVALID_API_KEY_FORMAT'
      );
    }
    
    // Additional specific checks for different credential types
    if (type === CredentialType.OAUTH_TOKEN) {
      // OAUTH tokens often have specific formats that could be checked here
      if (!apiKey.includes('.') && (typeof provider === 'string' ? provider !== 'custom' : true)) {
        throw new CLIError(
          'OAuth tokens typically contain multiple segments separated by periods',
          'INVALID_OAUTH_TOKEN_FORMAT'
        );
      }
    }
  }

  /**
   * Sanitize an API key by removing common issues
   * 
   * @param apiKey The raw API key input
   * @returns A sanitized API key
   */
  public static sanitize(apiKey: string): string {
    // Trim whitespace
    let sanitized = apiKey.trim();
    
    // Remove Bearer prefix if present
    if (sanitized.startsWith('Bearer ')) {
      sanitized = sanitized.substring(7).trim();
    }
    
    // Remove surrounding quotes if present
    if ((sanitized.startsWith('"') && sanitized.endsWith('"')) || 
        (sanitized.startsWith("'") && sanitized.endsWith("'"))) {
      sanitized = sanitized.substring(1, sanitized.length - 1);
    }
    
    return sanitized;
  }

  /**
   * Get validation guidance for a provider
   * 
   * @param provider The AI provider
   * @returns A help string with validation information
   */
  public static getValidationHelp(provider: AIProvider | string): string {
    // Convert enum to string if needed
    const providerStr = typeof provider === 'string' ? provider : AIProvider[provider];
    const rules = this.VALIDATION_RULES[providerStr] || this.VALIDATION_RULES.custom;
    return rules.description;
  }

  /**
   * Mask an API key for safe display
   * 
   * @param apiKey The API key to mask
   * @returns A masked version that shows only the prefix and suffix
   */
  public static maskApiKey(apiKey: string, provider?: AIProvider | string): string {
    if (!apiKey) {
      return '';
    }

    // Simple masking for short keys
    if (apiKey.length < 8) {
      return '****';
    }

    let prefix = '';
    let suffix = '';

    // Convert enum to string if needed
    let providerStr: string | undefined;
    if (provider) {
      providerStr = typeof provider === 'string' ? provider : AIProvider[provider];
    }

    // Use provider-specific prefix if available
    if (providerStr && this.VALIDATION_RULES[providerStr] && this.VALIDATION_RULES[providerStr].prefix) {
      prefix = this.VALIDATION_RULES[providerStr].prefix;
      suffix = apiKey.slice(-4);
      const maskedLength = apiKey.length - prefix.length - 4;
      const mask = '*'.repeat(Math.min(maskedLength, 10));
      return `${prefix}${mask}${suffix}`;
    }
    
    // Default masking: show first 4 and last 4 characters
    return `${apiKey.slice(0, 4)}${'*'.repeat(Math.min(apiKey.length - 8, 10))}${apiKey.slice(-4)}`;
  }
}