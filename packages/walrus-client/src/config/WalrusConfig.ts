/**
 * Walrus Configuration Management
 */

import type { WalrusConfig as IWalrusConfig, WalrusNetwork } from '../types';
import { WALRUS_NETWORKS, DEFAULT_CONFIG } from '../constants';
import { WalrusValidationError } from '../errors';

export class WalrusConfig {
  private config: IWalrusConfig;

  constructor(networkOrConfig: WalrusNetwork | Partial<IWalrusConfig> = 'testnet') {
    if (typeof networkOrConfig === 'string') {
      this.config = this.createFromNetwork(networkOrConfig);
    } else {
      this.config = this.createFromPartialConfig(networkOrConfig);
    }
    
    this.validate();
  }

  private createFromNetwork(network: WalrusNetwork): IWalrusConfig {
    const networkConfig = WALRUS_NETWORKS[network];
    if (!networkConfig) {
      throw new WalrusValidationError(`Unsupported network: ${network}`, 'network', network);
    }

    return {
      ...DEFAULT_CONFIG,
      ...networkConfig,
      network,
    } as IWalrusConfig;
  }

  private createFromPartialConfig(partialConfig: Partial<IWalrusConfig>): IWalrusConfig {
    const network = partialConfig.network || 'testnet';
    const networkDefaults = WALRUS_NETWORKS[network] || {};

    return {
      ...DEFAULT_CONFIG,
      ...networkDefaults,
      ...partialConfig,
      network,
    } as IWalrusConfig;
  }

  private validate(): void {
    const { network, publisherUrl, aggregatorUrl } = this.config;

    if (!network) {
      throw new WalrusValidationError('Network is required', 'network');
    }

    if (!publisherUrl) {
      throw new WalrusValidationError('Publisher URL is required', 'publisherUrl');
    }

    if (!aggregatorUrl) {
      throw new WalrusValidationError('Aggregator URL is required', 'aggregatorUrl');
    }

    // Validate URLs
    try {
      new URL(publisherUrl);
      new URL(aggregatorUrl);
    } catch (error) {
      throw new WalrusValidationError(
        'Invalid URL format in configuration',
        'urls',
        { publisherUrl, aggregatorUrl }
      );
    }

    // Validate numeric values
    if (this.config.timeout !== undefined && this.config.timeout <= 0) {
      throw new WalrusValidationError(
        'Timeout must be positive',
        'timeout',
        this.config.timeout
      );
    }

    if (this.config.retries !== undefined && this.config.retries < 0) {
      throw new WalrusValidationError(
        'Retries must be non-negative',
        'retries',
        this.config.retries
      );
    }
  }

  get(): IWalrusConfig {
    return { ...this.config };
  }

  getNetwork(): WalrusNetwork {
    return this.config.network;
  }

  getPublisherUrl(): string {
    return this.config.publisherUrl;
  }

  getAggregatorUrl(): string {
    return this.config.aggregatorUrl;
  }

  getTimeout(): number {
    return this.config.timeout || 30000;
  }

  getRetries(): number {
    return this.config.retries || 3;
  }

  update(updates: Partial<IWalrusConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validate();
  }

  clone(): WalrusConfig {
    return new WalrusConfig(this.config);
  }

  // Static factory methods
  static forNetwork(network: WalrusNetwork): WalrusConfig {
    return new WalrusConfig(network);
  }

  static fromEnvironment(): WalrusConfig {
    const network = (process.env.WALRUS_NETWORK as WalrusNetwork) || 'testnet';
    const publisherUrl = process.env.WALRUS_PUBLISHER_URL;
    const aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL;
    const timeout = process.env.WALRUS_TIMEOUT ? parseInt(process.env.WALRUS_TIMEOUT) : undefined;
    const retries = process.env.WALRUS_RETRIES ? parseInt(process.env.WALRUS_RETRIES) : undefined;

    const config: Partial<IWalrusConfig> = { network };
    
    if (publisherUrl) config.publisherUrl = publisherUrl;
    if (aggregatorUrl) config.aggregatorUrl = aggregatorUrl;
    if (timeout) config.timeout = timeout;
    if (retries) config.retries = retries;

    return new WalrusConfig(config);
  }

  static async fromUrl(configUrl: string): Promise<WalrusConfig> {
    try {
      const response = await fetch(configUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const config = await response.json();
      return new WalrusConfig(config);
    } catch (error) {
      throw new WalrusValidationError(
        `Failed to load config from URL: ${error instanceof Error ? error.message : String(error)}`,
        'configUrl',
        configUrl
      );
    }
  }
}