/**
 * Configuration management for Waltodo
 * Handles loading, saving, and validating configuration
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ConfigError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Main configuration interface
 */
export interface WaltodoConfig {
  walrus: {
    cliPath?: string; // Path to walrus CLI binary
    aggregatorUrl: string;
    publisherUrl: string;
    timeout?: number;
    maxRetries?: number;
  };
  storage: {
    encryptionEnabled: boolean;
    compressionEnabled: boolean;
  };
  ui: {
    colorEnabled: boolean;
    tableStyle: 'compact' | 'normal' | 'expanded';
  };
  sync: {
    autoSync: boolean;
    syncInterval: number; // in seconds
    conflictStrategy?: 'local-wins' | 'remote-wins' | 'last-write-wins' | 'manual';
    batchSize?: number;
  };
  blobs: {
    publish: {
      defaultEpochs: number;
      defaultDeletable: boolean;
      enableCompression: boolean;
      enableEncryption: boolean;
      defaultTags: string[];
      maxBlobSize: number; // in bytes
    };
    history: {
      maxEntries: number; // Maximum number of blob entries to keep in history
      autoCleanup: boolean; // Whether to automatically clean up expired/deleted blobs
      cleanupInterval: number; // Days between cleanup runs
    };
    tracking: {
      statusCheckInterval: number; // Hours between automatic status checks
      enableAutoRefresh: boolean; // Whether to automatically refresh blob statuses
      retainExpired: boolean; // Whether to keep expired blobs in tracking
      retainDeleted: boolean; // Whether to keep deleted blobs in tracking
    };
  };
}

/**
 * Default configuration values
 */
export const defaultConfig: WaltodoConfig = {
  walrus: {
    cliPath: 'walrus', // Default to 'walrus' in PATH
    aggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
    publisherUrl: 'https://publisher.walrus-testnet.walrus.space',
    timeout: 30000,
    maxRetries: 3,
  },
  storage: {
    encryptionEnabled: false,
    compressionEnabled: true,
  },
  ui: {
    colorEnabled: true,
    tableStyle: 'normal',
  },
  sync: {
    autoSync: false,
    syncInterval: 300, // 5 minutes
    conflictStrategy: 'last-write-wins',
    batchSize: 10,
  },
  blobs: {
    publish: {
      defaultEpochs: 5,
      defaultDeletable: true,
      enableCompression: true,
      enableEncryption: false,
      defaultTags: ['waltodo'],
      maxBlobSize: 10 * 1024 * 1024, // 10 MB
    },
    history: {
      maxEntries: 1000, // Keep track of up to 1000 published blobs
      autoCleanup: true,
      cleanupInterval: 7, // Clean up every 7 days
    },
    tracking: {
      statusCheckInterval: 24, // Check blob status every 24 hours
      enableAutoRefresh: false, // Manual refresh by default
      retainExpired: true, // Keep expired blobs for reference
      retainDeleted: false, // Remove deleted blobs from tracking
    },
  },
};

/**
 * Get the configuration file path
 */
export function getConfigPath(): string {
  const configDir = process.env['WALTODO_CONFIG_DIR'] || path.join(os.homedir(), '.waltodo');
  return path.join(configDir, 'config.json');
}

/**
 * Get the data directory path
 */
export function getDataPath(): string {
  const dataDir = process.env['WALTODO_DATA_DIR'] || path.join(os.homedir(), '.waltodo');
  return path.join(dataDir, 'data');
}

/**
 * Configuration manager class
 */
export class ConfigManager {
  private config: WaltodoConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || getConfigPath();
    this.config = { ...defaultConfig };
  }

  /**
   * Load configuration from file
   */
  async load(): Promise<WaltodoConfig> {
    try {
      logger.debug('Loading configuration from:', this.configPath);

      const configData = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(configData);

      // Merge with defaults to ensure all fields exist
      this.config = this.mergeWithDefaults(loadedConfig);

      // Validate the configuration
      this.validate(this.config);

      logger.debug('Configuration loaded successfully');
      return this.config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Configuration file not found, using defaults');
        // File doesn't exist, create with defaults
        await this.save();
        return this.config;
      }

      logger.error('Failed to load configuration:', error);
      throw new ConfigError(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save configuration to file
   */
  async save(config?: Partial<WaltodoConfig>): Promise<void> {
    try {
      if (config) {
        this.config = this.mergeWithDefaults(config);
        this.validate(this.config);
      }

      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      // Write configuration
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );

      logger.debug('Configuration saved successfully');
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      throw new ConfigError(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current configuration
   */
  get(): WaltodoConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async update(updates: Partial<WaltodoConfig>): Promise<void> {
    const newConfig = this.mergeDeep(this.config, updates);
    this.validate(newConfig);
    this.config = newConfig;
    await this.save();
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    this.config = { ...defaultConfig };
    await this.save();
  }

  /**
   * Validate configuration
   */
  private validate(config: WaltodoConfig): void {
    // Validate Walrus URLs
    if (!config.walrus.aggregatorUrl || !this.isValidUrl(config.walrus.aggregatorUrl)) {
      throw new ValidationError('Invalid Walrus aggregator URL');
    }

    if (!config.walrus.publisherUrl || !this.isValidUrl(config.walrus.publisherUrl)) {
      throw new ValidationError('Invalid Walrus publisher URL');
    }

    // Validate timeout
    if (config.walrus.timeout !== undefined && config.walrus.timeout < 1000) {
      throw new ValidationError('Walrus timeout must be at least 1000ms');
    }

    // Validate max retries
    if (config.walrus.maxRetries !== undefined && (config.walrus.maxRetries < 0 || config.walrus.maxRetries > 10)) {
      throw new ValidationError('Walrus max retries must be between 0 and 10');
    }

    // Validate sync interval
    if (config.sync.syncInterval < 60) {
      throw new ValidationError('Sync interval must be at least 60 seconds');
    }

    // Validate table style
    if (!['compact', 'normal', 'expanded'].includes(config.ui.tableStyle)) {
      throw new ValidationError('Invalid table style');
    }

    // Validate blob configuration
    if (config.blobs) {
      // Validate publish settings
      if (config.blobs.publish) {
        if (config.blobs.publish.defaultEpochs < 1) {
          throw new ValidationError('Default epochs must be at least 1');
        }
        
        if (config.blobs.publish.maxBlobSize < 1024) {
          throw new ValidationError('Maximum blob size must be at least 1KB');
        }
        
        if (!Array.isArray(config.blobs.publish.defaultTags)) {
          throw new ValidationError('Default tags must be an array');
        }
      }

      // Validate history settings
      if (config.blobs.history) {
        if (config.blobs.history.maxEntries < 1) {
          throw new ValidationError('Max history entries must be at least 1');
        }
        
        if (config.blobs.history.cleanupInterval < 1) {
          throw new ValidationError('Cleanup interval must be at least 1 day');
        }
      }

      // Validate tracking settings
      if (config.blobs.tracking) {
        if (config.blobs.tracking.statusCheckInterval < 1) {
          throw new ValidationError('Status check interval must be at least 1 hour');
        }
      }
    }
  }

  /**
   * Check if a string is a valid URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Merge configuration with defaults
   */
  private mergeWithDefaults(config: any): WaltodoConfig {
    return this.mergeDeep(defaultConfig, config) as WaltodoConfig;
  }

  /**
   * Deep merge two objects
   */
  private mergeDeep(target: any, source: any): any {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }
}

/**
 * Helper to check if value is an object
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Global configuration instance
 */
let configInstance: ConfigManager | null = null;

/**
 * Get or create the global configuration instance
 */
export async function getConfig(): Promise<WaltodoConfig> {
  if (!configInstance) {
    configInstance = new ConfigManager();
    await configInstance.load();
  }
  return configInstance.get();
}

/**
 * Update the global configuration
 */
export async function updateConfig(updates: Partial<WaltodoConfig>): Promise<void> {
  if (!configInstance) {
    configInstance = new ConfigManager();
    await configInstance.load();
  }
  await configInstance.update(updates);
}