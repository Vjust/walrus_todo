/**
 * AIConfigManager - Configuration management for AI operations
 * 
 * Centralizes configuration for AI services including:
 * - Provider preferences and fallbacks
 * - Operation-specific settings
 * - Rate limiting and token usage
 * - Feature flags
 */

import { AIProvider, AIModelOptions } from '../../types/adapters/AIModelAdapter';
import { AI_CONFIG } from '../../constants';

export interface AIOperationConfig {
  cacheTtl: number;  // Cache TTL in milliseconds
  temperature: number;  // Randomness parameter (0.0-1.0)
  maxTokens: number;  // Max tokens to generate
  enhanced: boolean;  // Use enhanced prompts
  retryCount: number;  // Number of retries on failure
  timeout: number;  // Timeout in milliseconds
}

export interface AIGlobalConfig {
  defaultProvider: AIProvider;
  fallbackProviders: AIProvider[];
  cacheEnabled: boolean;
  maxCacheEntries: number;
  defaultTtl: number;  // Default cache TTL in milliseconds
  defaultTemperature: number;
  defaultMaxTokens: number;
  useEnhancedPrompts: boolean;
  retryEnabled: boolean;
  defaultRetryCount: number;
  defaultTimeout: number;
  rateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
  };
}

// Default configurations
const DEFAULT_GLOBAL_CONFIG: AIGlobalConfig = {
  defaultProvider: AI_CONFIG.DEFAULT_PROVIDER as AIProvider || AIProvider.XAI,
  fallbackProviders: [AIProvider.OPENAI, AIProvider.ANTHROPIC],
  cacheEnabled: true,
  maxCacheEntries: 100,
  defaultTtl: 15 * 60 * 1000,  // 15 minutes
  defaultTemperature: 0.7,
  defaultMaxTokens: 2000,
  useEnhancedPrompts: true,
  retryEnabled: true,
  defaultRetryCount: 2,
  defaultTimeout: 30000,  // 30 seconds
  rateLimit: {
    enabled: true,
    requestsPerMinute: 20
  }
};

const DEFAULT_OPERATION_CONFIGS: Record<string, Partial<AIOperationConfig>> = {
  summarize: {
    temperature: 0.7,
    maxTokens: 600
  },
  categorize: {
    temperature: 0.5,
    maxTokens: 1000
  },
  prioritize: {
    temperature: 0.3,
    maxTokens: 800
  },
  suggest: {
    temperature: 0.8,
    maxTokens: 1000
  },
  analyze: {
    temperature: 0.5,
    maxTokens: 2000
  },
  group: {
    temperature: 0.4,
    maxTokens: 1500
  },
  schedule: {
    temperature: 0.4,
    maxTokens: 1500
  },
  detect_dependencies: {
    temperature: 0.3,
    maxTokens: 1500
  },
  estimate_effort: {
    temperature: 0.4,
    maxTokens: 1200
  }
};

export class AIConfigManager {
  private static instance: AIConfigManager;
  private globalConfig: AIGlobalConfig;
  private operationConfigs: Map<string, AIOperationConfig> = new Map();
  
  private constructor() {
    this.globalConfig = { ...DEFAULT_GLOBAL_CONFIG };
    
    // Initialize operation configs with defaults
    Object.entries(DEFAULT_OPERATION_CONFIGS).forEach(([operation, config]) => {
      this.operationConfigs.set(operation, this.createOperationConfig(config));
    });
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    
    return AIConfigManager.instance;
  }
  
  /**
   * Update the global configuration
   */
  public updateGlobalConfig(config: Partial<AIGlobalConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
    
    // Update operation configs that use global defaults
    this.operationConfigs.forEach((opConfig, operation) => {
      const updatedConfig = this.createOperationConfig(opConfig);
      this.operationConfigs.set(operation, updatedConfig);
    });
  }
  
  /**
   * Get the current global configuration
   */
  public getGlobalConfig(): AIGlobalConfig {
    return { ...this.globalConfig };
  }
  
  /**
   * Update configuration for a specific operation
   */
  public updateOperationConfig(operation: string, config: Partial<AIOperationConfig>): void {
    const currentConfig = this.operationConfigs.get(operation) || this.createOperationConfig();
    this.operationConfigs.set(operation, { ...currentConfig, ...config });
  }
  
  /**
   * Get configuration for a specific operation
   */
  public getOperationConfig(operation: string): AIOperationConfig {
    return this.operationConfigs.get(operation) || this.createOperationConfig();
  }
  
  /**
   * Get all operation configs
   */
  public getAllOperationConfigs(): Record<string, AIOperationConfig> {
    const configs: Record<string, AIOperationConfig> = {};
    this.operationConfigs.forEach((config, operation) => {
      configs[operation] = { ...config };
    });
    return configs;
  }
  
  /**
   * Convert operation config to AIModelOptions
   */
  public getModelOptions(operation: string): AIModelOptions {
    const config = this.getOperationConfig(operation);
    
    return {
      temperature: config.temperature,
      maxTokens: config.maxTokens
    };
  }
  
  /**
   * Reset all configurations to defaults
   */
  public resetToDefaults(): void {
    this.globalConfig = { ...DEFAULT_GLOBAL_CONFIG };
    this.operationConfigs.clear();
    
    Object.entries(DEFAULT_OPERATION_CONFIGS).forEach(([operation, config]) => {
      this.operationConfigs.set(operation, this.createOperationConfig(config));
    });
  }
  
  /**
   * Create a complete operation config using global defaults where needed
   */
  private createOperationConfig(partialConfig: Partial<AIOperationConfig> = {}): AIOperationConfig {
    return {
      cacheTtl: partialConfig.cacheTtl ?? this.globalConfig.defaultTtl,
      temperature: partialConfig.temperature ?? this.globalConfig.defaultTemperature,
      maxTokens: partialConfig.maxTokens ?? this.globalConfig.defaultMaxTokens,
      enhanced: partialConfig.enhanced ?? this.globalConfig.useEnhancedPrompts,
      retryCount: partialConfig.retryCount ?? this.globalConfig.defaultRetryCount,
      timeout: partialConfig.timeout ?? this.globalConfig.defaultTimeout
    };
  }
}