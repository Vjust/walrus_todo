/**
 * Network Health Checker for Walrus Sites Deployment
 * 
 * Provides comprehensive network validation for Sui and Walrus endpoints
 * with retry logic, endpoint fallback, and pre-deployment validation.
 */

import { execSync } from 'child_process';
import { SuiClient } from '@mysten/sui/client';
import type { WalrusClientExt } from '../types/client';
import { BaseError as WalrusError, NetworkError, ValidationError } from '../types/errors/consolidated';
import { RetryManager, type NetworkNode } from './retry-manager';
import { Logger } from './Logger';

export interface EndpointHealth {
  url: string;
  available: boolean;
  responseTime: number;
  lastChecked: number;
  errorMessage?: string;
  status?: number;
}

export interface NetworkHealth {
  sui: {
    primary: EndpointHealth;
    fallbacks: EndpointHealth[];
    websocket?: EndpointHealth;
    faucet?: EndpointHealth;
    chainId?: string;
  };
  walrus: {
    publisher: EndpointHealth;
    aggregator: EndpointHealth;
    fallbackPublishers: EndpointHealth[];
    networkUrl?: EndpointHealth;
  };
  wallet: {
    connected: boolean;
    address?: string;
    balance?: string;
    hasGas: boolean;
    errorMessage?: string;
  };
  overall: {
    healthy: boolean;
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  };
}

export interface NetworkConfig {
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  sui: {
    primaryUrl: string;
    fallbackUrls: string[];
    websocketUrl?: string;
    faucetUrl?: string;
    expectedChainId?: string;
  };
  walrus: {
    publisherUrl: string;
    aggregatorUrl: string;
    fallbackPublisherUrls: string[];
    networkUrl?: string;
  };
  thresholds: {
    maxResponseTime: number;
    minHealthScore: number;
    minGasBalance: number;
    requiredSuccessRate: number;
  };
}

export interface HealthCheckOptions {
  timeout: number;
  retries: number;
  parallelChecks: boolean;
  skipWallet: boolean;
  skipGasCheck: boolean;
  verbose: boolean;
}

export class NetworkHealthChecker {
  private readonly logger: Logger;
  private readonly retryManager: RetryManager;
  private readonly config: NetworkConfig;
  private readonly options: HealthCheckOptions;

  private static readonly DEFAULT_OPTIONS: HealthCheckOptions = {
    timeout: 10000,
    retries: 3,
    parallelChecks: true,
    skipWallet: false,
    skipGasCheck: false,
    verbose: false,
  };

  private static readonly DEFAULT_THRESHOLDS = {
    maxResponseTime: 5000,
    minHealthScore: 75,
    minGasBalance: 1000000, // 0.001 SUI in MIST
    requiredSuccessRate: 0.8,
  };

  constructor(
    config: NetworkConfig,
    options: Partial<HealthCheckOptions> = {}
  ) {
    this.config = config;
    this.options = { ...NetworkHealthChecker.DEFAULT_OPTIONS, ...options };
    this.logger = new Logger('NetworkHealthChecker');
    
    // Initialize retry manager with all endpoints
    const allUrls = [
      this.config.sui.primaryUrl,
      ...this.config.sui.fallbackUrls,
      this.config.walrus.publisherUrl,
      this.config.walrus.aggregatorUrl,
      ...this.config.walrus.fallbackPublisherUrls,
    ].filter(Boolean);

    this.retryManager = new RetryManager(allUrls, {
      maxRetries: this.options.retries,
      timeout: this.options.timeout,
      adaptiveDelay: true,
      loadBalancing: 'health',
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 30000,
      },
    });
  }

  /**
   * Perform comprehensive network health check
   */
  async checkHealth(): Promise<NetworkHealth> {
    this.logger.info('Starting comprehensive network health check', {
      network: this.config.network,
      parallelChecks: this.options.parallelChecks,
    });

    const startTime = Date.now();

    try {
      let suiHealth: NetworkHealth['sui'];
      let walrusHealth: NetworkHealth['walrus'];
      let walletHealth: NetworkHealth['wallet'];

      if (this.options.parallelChecks) {
        // Run checks in parallel for faster results
        const [sui, walrus, wallet] = await Promise.allSettled([
          this.checkSuiHealth(),
          this.checkWalrusHealth(),
          this.options.skipWallet ? this.getEmptyWalletHealth() : this.checkWalletHealth(),
        ]);

        suiHealth = sui.status === 'fulfilled' ? sui.value : this.getFailedSuiHealth(sui.reason);
        walrusHealth = walrus.status === 'fulfilled' ? walrus.value : this.getFailedWalrusHealth(walrus.reason);
        walletHealth = wallet.status === 'fulfilled' ? wallet.value : this.getFailedWalletHealth(wallet.reason);
      } else {
        // Run checks sequentially
        suiHealth = await this.checkSuiHealth();
        walrusHealth = await this.checkWalrusHealth();
        walletHealth = this.options.skipWallet ? this.getEmptyWalletHealth() : await this.checkWalletHealth();
      }

      // Calculate overall health
      const overall = this.calculateOverallHealth(suiHealth, walrusHealth, walletHealth);

      const result: NetworkHealth = {
        sui: suiHealth,
        walrus: walrusHealth,
        wallet: walletHealth,
        overall,
      };

      const duration = Date.now() - startTime;
      this.logger.info('Network health check completed', {
        duration,
        score: overall.score,
        healthy: overall.healthy,
        issues: overall.issues.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Network health check failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      throw new NetworkError(`Network health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check Sui network health
   */
  private async checkSuiHealth(): Promise<NetworkHealth['sui']> {
    const primary = await this.checkEndpoint(this.config.sui.primaryUrl, 'sui-rpc');
    const fallbacks = await Promise.allSettled(
      this.config.sui.fallbackUrls.map(url => this.checkEndpoint(url, 'sui-rpc'))
    );

    const fallbackResults = fallbacks.map((result, index) => 
      result.status === 'fulfilled' 
        ? result.value 
        : this.getFailedEndpointHealth(this.config.sui.fallbackUrls[index], result.reason)
    );

    let websocket: EndpointHealth | undefined;
    if (this.config.sui.websocketUrl) {
      try {
        websocket = await this.checkWebSocketEndpoint(this.config.sui.websocketUrl);
      } catch (error) {
        websocket = this.getFailedEndpointHealth(this.config.sui.websocketUrl, error);
      }
    }

    let faucet: EndpointHealth | undefined;
    if (this.config.sui.faucetUrl) {
      try {
        faucet = await this.checkEndpoint(this.config.sui.faucetUrl, 'faucet');
      } catch (error) {
        faucet = this.getFailedEndpointHealth(this.config.sui.faucetUrl, error);
      }
    }

    // Verify chain ID if primary is available
    let chainId: string | undefined;
    if (primary.available) {
      try {
        chainId = await this.getSuiChainId(this.config.sui.primaryUrl);
        if (this.config.sui.expectedChainId && chainId !== this.config.sui.expectedChainId) {
          primary.available = false;
          primary.errorMessage = `Chain ID mismatch: expected ${this.config.sui.expectedChainId}, got ${chainId}`;
        }
      } catch (error) {
        this.logger.warn('Failed to verify chain ID', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return {
      primary,
      fallbacks: fallbackResults,
      websocket,
      faucet,
      chainId,
    };
  }

  /**
   * Check Walrus network health
   */
  private async checkWalrusHealth(): Promise<NetworkHealth['walrus']> {
    const [publisher, aggregator] = await Promise.allSettled([
      this.checkEndpoint(this.config.walrus.publisherUrl, 'walrus-publisher'),
      this.checkEndpoint(this.config.walrus.aggregatorUrl, 'walrus-aggregator'),
    ]);

    const publisherHealth = publisher.status === 'fulfilled' 
      ? publisher.value 
      : this.getFailedEndpointHealth(this.config.walrus.publisherUrl, publisher.reason);

    const aggregatorHealth = aggregator.status === 'fulfilled' 
      ? aggregator.value 
      : this.getFailedEndpointHealth(this.config.walrus.aggregatorUrl, aggregator.reason);

    const fallbackPublishers = await Promise.allSettled(
      this.config.walrus.fallbackPublisherUrls.map(url => 
        this.checkEndpoint(url, 'walrus-publisher')
      )
    );

    const fallbackResults = fallbackPublishers.map((result, index) => 
      result.status === 'fulfilled' 
        ? result.value 
        : this.getFailedEndpointHealth(this.config.walrus.fallbackPublisherUrls[index], result.reason)
    );

    let networkUrl: EndpointHealth | undefined;
    if (this.config.walrus.networkUrl) {
      try {
        networkUrl = await this.checkEndpoint(this.config.walrus.networkUrl, 'walrus-network');
      } catch (error) {
        networkUrl = this.getFailedEndpointHealth(this.config.walrus.networkUrl, error);
      }
    }

    return {
      publisher: publisherHealth,
      aggregator: aggregatorHealth,
      fallbackPublishers: fallbackResults,
      networkUrl,
    };
  }

  /**
   * Check wallet health and gas availability
   */
  private async checkWalletHealth(): Promise<NetworkHealth['wallet']> {
    try {
      // Check if Sui CLI is available and configured
      const activeAddress = this.getActiveWalletAddress();
      if (!activeAddress) {
        return {
          connected: false,
          hasGas: false,
          errorMessage: 'No active wallet address found. Run "sui client active-address" to check.',
        };
      }

      // Check gas balance if not skipped
      let balance: string | undefined;
      let hasGas = true;
      
      if (!this.options.skipGasCheck) {
        try {
          balance = await this.getWalletBalance(activeAddress);
          const balanceNum = parseInt(balance || '0');
          hasGas = balanceNum >= this.config.thresholds.minGasBalance;
        } catch (error) {
          hasGas = false;
          this.logger.warn('Failed to check wallet balance', { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      return {
        connected: true,
        address: activeAddress,
        balance,
        hasGas,
      };
    } catch (error) {
      return {
        connected: false,
        hasGas: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check individual endpoint health
   */
  private async checkEndpoint(url: string, type: string): Promise<EndpointHealth> {
    const startTime = Date.now();

    try {
      const response = await this.retryManager.execute(
        async (node: NetworkNode) => {
          if (node.url !== url) {
            // If retry manager gives us a different URL, use the original
            return this.performHealthCheck(url, type);
          }
          return this.performHealthCheck(node.url, type);
        },
        `health-check-${type}`
      );

      const responseTime = Date.now() - startTime;

      return {
        url,
        available: true,
        responseTime,
        lastChecked: Date.now(),
        status: response.status,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        url,
        available: false,
        responseTime,
        lastChecked: Date.now(),
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Perform actual health check for an endpoint
   */
  private async performHealthCheck(url: string, type: string): Promise<{ status: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      let checkUrl = url;
      let method = 'GET';
      let body: string | undefined;
      let headers: Record<string, string> = {};

      // Customize health check based on endpoint type
      switch (type) {
        case 'sui-rpc':
          checkUrl = url;
          method = 'POST';
          headers = { 'Content-Type': 'application/json' };
          body = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_getChainIdentifier',
            params: [],
          });
          break;

        case 'walrus-publisher':
          // Check publisher health endpoint
          checkUrl = `${url.replace(/\/$/, '')}/v1/health`;
          break;

        case 'walrus-aggregator':
          // Check aggregator health endpoint  
          checkUrl = `${url.replace(/\/$/, '')}/v1/health`;
          break;

        case 'walrus-network':
          // Simple connectivity check
          checkUrl = url;
          break;

        case 'faucet':
          // Check faucet availability
          checkUrl = `${url.replace(/\/$/, '')}/status`;
          break;

        default:
          // Default health check
          break;
      }

      const response = await fetch(checkUrl, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      return { status: response.status };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check WebSocket endpoint health
   */
  private async checkWebSocketEndpoint(url: string): Promise<EndpointHealth> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const ws = new WebSocket(url);
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve({
            url,
            available: false,
            responseTime: Date.now() - startTime,
            lastChecked: Date.now(),
            errorMessage: 'WebSocket connection timeout',
          });
        }
      }, this.options.timeout);

      ws.onopen = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({
            url,
            available: true,
            responseTime: Date.now() - startTime,
            lastChecked: Date.now(),
          });
        }
      };

      ws.onerror = (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({
            url,
            available: false,
            responseTime: Date.now() - startTime,
            lastChecked: Date.now(),
            errorMessage: `WebSocket error: ${error}`,
          });
        }
      };
    });
  }

  /**
   * Get Sui chain ID from RPC endpoint
   */
  private async getSuiChainId(url: string): Promise<string> {
    const client = new SuiClient({ url });
    const chainId = await client.getChainIdentifier();
    return chainId;
  }

  /**
   * Get active wallet address from Sui CLI
   */
  private getActiveWalletAddress(): string | undefined {
    try {
      const output = execSync('sui client active-address', { encoding: 'utf8' });
      return output.trim();
    } catch (error) {
      this.logger.debug('Failed to get active wallet address', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return undefined;
    }
  }

  /**
   * Get wallet balance for address
   */
  private async getWalletBalance(address: string): Promise<string> {
    try {
      const output = execSync(`sui client balance ${address}`, { encoding: 'utf8' });
      // Parse balance from output (format: "Balance: X SUI")
      const match = output.match(/Balance:\s+(\d+)\s+SUI/);
      if (match) {
        // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
        return (parseInt(match[1]) * 1_000_000_000).toString();
      }
      return '0';
    } catch (error) {
      this.logger.debug('Failed to get wallet balance', { 
        address,
        error: error instanceof Error ? error.message : String(error) 
      });
      return '0';
    }
  }

  /**
   * Calculate overall network health score
   */
  private calculateOverallHealth(
    sui: NetworkHealth['sui'],
    walrus: NetworkHealth['walrus'],
    wallet: NetworkHealth['wallet']
  ): NetworkHealth['overall'] {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Sui health assessment
    if (!sui.primary.available) {
      score -= 30;
      issues.push(`Primary Sui RPC endpoint unavailable: ${sui.primary.errorMessage || 'Unknown error'}`);
      
      const healthyFallbacks = sui.fallbacks.filter(f => f.available);
      if (healthyFallbacks.length === 0) {
        score -= 40;
        issues.push('No healthy Sui RPC fallback endpoints available');
        recommendations.push('Check network connectivity and Sui RPC endpoint status');
      } else {
        recommendations.push(`Use fallback Sui RPC endpoints: ${healthyFallbacks.map(f => f.url).join(', ')}`);
      }
    } else if (sui.primary.responseTime > this.config.thresholds.maxResponseTime) {
      score -= 10;
      issues.push(`Slow Sui RPC response time: ${sui.primary.responseTime}ms`);
    }

    // Walrus health assessment
    if (!walrus.publisher.available) {
      score -= 25;
      issues.push(`Walrus publisher unavailable: ${walrus.publisher.errorMessage || 'Unknown error'}`);
      
      const healthyFallbacks = walrus.fallbackPublishers.filter(f => f.available);
      if (healthyFallbacks.length === 0) {
        score -= 25;
        issues.push('No healthy Walrus publisher fallback endpoints available');
        recommendations.push('Check Walrus network status and publisher endpoints');
      } else {
        recommendations.push(`Use fallback Walrus publishers: ${healthyFallbacks.map(f => f.url).join(', ')}`);
      }
    }

    if (!walrus.aggregator.available) {
      score -= 20;
      issues.push(`Walrus aggregator unavailable: ${walrus.aggregator.errorMessage || 'Unknown error'}`);
      recommendations.push('Check Walrus aggregator endpoint status');
    }

    // Wallet health assessment
    if (!this.options.skipWallet) {
      if (!wallet.connected) {
        score -= 15;
        issues.push(`Wallet not connected: ${wallet.errorMessage || 'Unknown error'}`);
        recommendations.push('Configure Sui CLI with "sui client" commands');
      } else if (!wallet.hasGas && !this.options.skipGasCheck) {
        score -= 10;
        issues.push('Insufficient gas balance for transactions');
        recommendations.push(`Add gas funds to wallet address: ${wallet.address}`);
      }
    }

    const healthy = score >= this.config.thresholds.minHealthScore && issues.length === 0;

    return {
      healthy,
      score: Math.max(0, score),
      issues,
      recommendations,
    };
  }

  /**
   * Utility methods for handling failed checks
   */
  private getFailedEndpointHealth(url: string, error: unknown): EndpointHealth {
    return {
      url,
      available: false,
      responseTime: 0,
      lastChecked: Date.now(),
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  private getFailedSuiHealth(error: unknown): NetworkHealth['sui'] {
    return {
      primary: this.getFailedEndpointHealth(this.config.sui.primaryUrl, error),
      fallbacks: this.config.sui.fallbackUrls.map(url => 
        this.getFailedEndpointHealth(url, error)
      ),
    };
  }

  private getFailedWalrusHealth(error: unknown): NetworkHealth['walrus'] {
    return {
      publisher: this.getFailedEndpointHealth(this.config.walrus.publisherUrl, error),
      aggregator: this.getFailedEndpointHealth(this.config.walrus.aggregatorUrl, error),
      fallbackPublishers: this.config.walrus.fallbackPublisherUrls.map(url => 
        this.getFailedEndpointHealth(url, error)
      ),
    };
  }

  private getFailedWalletHealth(error: unknown): NetworkHealth['wallet'] {
    return {
      connected: false,
      hasGas: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  private getEmptyWalletHealth(): NetworkHealth['wallet'] {
    return {
      connected: true,
      hasGas: true,
    };
  }

  /**
   * Static factory methods for common configurations
   */
  static forTestnet(options?: Partial<HealthCheckOptions>): NetworkHealthChecker {
    const config: NetworkConfig = {
      network: 'testnet',
      sui: {
        primaryUrl: 'https://fullnode.testnet.sui.io:443',
        fallbackUrls: [
          'https://sui-testnet.nodeinfra.com',
          'https://sui-testnet.publicnode.com',
        ],
        websocketUrl: 'wss://fullnode.testnet.sui.io:443',
        faucetUrl: 'https://faucet.testnet.sui.io',
        expectedChainId: '4c78adac',
      },
      walrus: {
        publisherUrl: 'https://publisher-testnet.walrus.site',
        aggregatorUrl: 'https://aggregator-testnet.walrus.site',
        fallbackPublisherUrls: [
          'https://walrus-testnet-publisher.nodes.guru',
          'https://walrus-testnet-publisher.blockscope.net',
        ],
        networkUrl: 'https://wal.testnet.sui.io',
      },
      thresholds: NetworkHealthChecker.DEFAULT_THRESHOLDS,
    };

    return new NetworkHealthChecker(config, options);
  }

  static forMainnet(options?: Partial<HealthCheckOptions>): NetworkHealthChecker {
    const config: NetworkConfig = {
      network: 'mainnet',
      sui: {
        primaryUrl: 'https://fullnode.mainnet.sui.io:443',
        fallbackUrls: [
          'https://sui-mainnet.nodeinfra.com',
        ],
        websocketUrl: 'wss://fullnode.mainnet.sui.io:443',
      },
      walrus: {
        publisherUrl: 'https://publisher.walrus.space',
        aggregatorUrl: 'https://aggregator.walrus.space',
        fallbackPublisherUrls: [],
      },
      thresholds: NetworkHealthChecker.DEFAULT_THRESHOLDS,
    };

    return new NetworkHealthChecker(config, options);
  }

  /**
   * Load configuration from frontend config files
   */
  static async fromConfig(configPath: string, options?: Partial<HealthCheckOptions>): Promise<NetworkHealthChecker> {
    try {
      const configContent = await import(configPath);
      const config = configContent.default || configContent;

      const networkConfig: NetworkConfig = {
        network: config.network?.name || 'testnet',
        sui: {
          primaryUrl: config.network?.url,
          fallbackUrls: config.network?.fallbackUrls || [],
          websocketUrl: config.network?.websocketUrl,
          faucetUrl: config.network?.faucetUrl,
          expectedChainId: config.network?.chainId,
        },
        walrus: {
          publisherUrl: config.walrus?.publisherUrl,
          aggregatorUrl: config.walrus?.aggregatorUrl,
          fallbackPublisherUrls: config.walrus?.fallbackPublisherUrls || [],
          networkUrl: config.walrus?.networkUrl,
        },
        thresholds: {
          ...NetworkHealthChecker.DEFAULT_THRESHOLDS,
          ...(config.connectivity || {}),
        },
      };

      return new NetworkHealthChecker(networkConfig, options);
    } catch (error) {
      throw new ValidationError(`Failed to load network config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}