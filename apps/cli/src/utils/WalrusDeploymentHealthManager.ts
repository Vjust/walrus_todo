/**
 * Walrus Deployment Health Manager
 * 
 * Integration utility that combines all network health checking components
 * for easy use in deployment scripts. Provides a unified interface for
 * pre-deployment validation, monitoring, and automatic remediation.
 */

import { EventEmitter } from 'events';
import { Logger } from './Logger';
import { NetworkHealthChecker, type NetworkConfig, type NetworkHealth } from './NetworkHealthChecker';
import { NetworkRetryManager, type NetworkEndpoint } from './NetworkRetryManager';
import { EndpointFallbackManager, type FallbackConfig } from './EndpointFallbackManager';
import { PreDeploymentValidator, type ValidationSummary, type DeploymentContext } from './PreDeploymentValidator';
import { NetworkMonitor, type DiagnosticReport } from './NetworkMonitor';
import { ValidationError, NetworkError } from '../types/errors/consolidated';

export interface DeploymentHealthConfig {
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  enableMonitoring: boolean;
  enableAutomaticFailover: boolean;
  enablePreValidation: boolean;
  strictValidation: boolean;
  monitoringInterval: number;
  retryConfig: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    timeoutMs: number;
  };
  endpoints: {
    sui: {
      primary: string;
      fallbacks: string[];
      websocket?: string;
      faucet?: string;
    };
    walrus: {
      publisher: string;
      aggregator: string;
      fallbackPublishers: string[];
    };
  };
}

export interface DeploymentStatus {
  phase: 'initializing' | 'validating' | 'monitoring' | 'deploying' | 'completed' | 'failed';
  networkHealth: NetworkHealth;
  validationSummary?: ValidationSummary;
  diagnosticReport?: DiagnosticReport;
  deploymentReadiness: 'ready' | 'warnings' | 'not_ready';
  recommendations: string[];
  estimatedDeploymentTime?: number;
}

export interface DeploymentResult {
  success: boolean;
  duration: number;
  networkMetrics: {
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
    endpointSwitches: number;
  };
  issues: Array<{
    severity: 'warning' | 'error';
    message: string;
    resolvedAutomatically: boolean;
  }>;
  finalEndpoints: {
    sui: string;
    walrusPublisher: string;
    walrusAggregator: string;
  };
}

export class WalrusDeploymentHealthManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: DeploymentHealthConfig;
  
  private healthChecker?: NetworkHealthChecker;
  private retryManager?: NetworkRetryManager;
  private fallbackManager?: EndpointFallbackManager;
  private validator?: PreDeploymentValidator;
  private monitor?: NetworkMonitor;

  private currentStatus: DeploymentStatus = {
    phase: 'initializing',
    networkHealth: {} as NetworkHealth,
    deploymentReadiness: 'not_ready',
    recommendations: [],
  };

  private deploymentMetrics = {
    startTime: 0,
    endTime: 0,
    requestCount: 0,
    errorCount: 0,
    endpointSwitches: 0,
    responseTimeSum: 0,
  };

  constructor(config: DeploymentHealthConfig) {
    super();
    
    this?.logger = new Logger('WalrusDeploymentHealthManager');
    this?.config = config;

    this?.logger?.info('Initializing Walrus Deployment Health Manager', {
      network: config.network,
      monitoring: config.enableMonitoring,
      failover: config.enableAutomaticFailover,
      validation: config.enablePreValidation,
    });
  }

  /**
   * Initialize all health management components
   */
  async initialize(): Promise<void> {
    this.currentStatus?.phase = 'initializing';
    this.emit('status_changed', this.currentStatus);

    try {
      // Create network configuration
      const networkConfig = this.createNetworkConfig();

      // Initialize health checker
      this?.healthChecker = new NetworkHealthChecker(networkConfig, {
        timeout: this?.config?.retryConfig.timeoutMs,
        skipWallet: false,
        skipGasCheck: false,
        verbose: false,
      });

      // Initialize retry manager
      const endpoints = this.createEndpointList();
      this?.retryManager = new NetworkRetryManager(endpoints, {
        maxRetries: this?.config?.retryConfig.maxRetries,
        initialDelay: this?.config?.retryConfig.initialDelay,
        maxDelay: this?.config?.retryConfig.maxDelay,
        timeoutMs: this?.config?.retryConfig.timeoutMs,
        adaptiveDelay: true,
        failoverEnabled: this?.config?.enableAutomaticFailover,
        loadBalancing: 'health',
      });

      // Initialize fallback manager if enabled
      if (this?.config?.enableAutomaticFailover) {
        const fallbackConfig = this.createFallbackConfig(endpoints as any);
        this?.fallbackManager = new EndpointFallbackManager(fallbackConfig as any);
        
        // Listen for endpoint switches
        this?.fallbackManager?.on('endpoint_switched', () => {
          this?.deploymentMetrics?.endpointSwitches++;
        });
      }

      // Initialize validator if enabled
      if (this?.config?.enablePreValidation) {
        this?.validator = new PreDeploymentValidator(networkConfig, {
          strictMode: this?.config?.strictValidation,
          timeout: this?.config?.retryConfig.timeoutMs,
        });
      }

      // Initialize monitor if enabled
      if (this?.config?.enableMonitoring) {
        this?.monitor = new NetworkMonitor(
          this.healthChecker,
          {
            healthCheckInterval: this?.config?.monitoringInterval,
            enableAutomaticRemediation: this?.config?.enableAutomaticFailover,
          },
          this.retryManager,
          this.fallbackManager
        );

        // Listen for monitoring events
        this.setupMonitoringEventListeners();
      }

      this?.logger?.info('Health management components initialized successfully');

    } catch (error) {
      this?.logger?.error('Failed to initialize health management components', {
        error: error instanceof Error ? error.message : String(error as any),
      });
      throw new ValidationError(`Initialization failed: ${error instanceof Error ? error.message : String(error as any)}`);
    }
  }

  /**
   * Perform pre-deployment validation
   */
  async validateDeployment(context: DeploymentContext): Promise<ValidationSummary> {
    if (!this.validator) {
      throw new ValidationError('Validator not initialized. Enable pre-validation in config.');
    }

    this.currentStatus?.phase = 'validating';
    this.emit('status_changed', this.currentStatus);

    this?.logger?.info('Starting pre-deployment validation', {
      network: context.network,
      sitePath: context.sitePath,
    });

    try {
      const validationSummary = await this?.validator?.validate(context as any);
      this.currentStatus?.validationSummary = validationSummary;
      
      // Update deployment readiness
      switch (validationSummary.overallStatus) {
        case 'ready':
          this.currentStatus?.deploymentReadiness = 'ready';
          break;
        case 'warnings':
          this.currentStatus?.deploymentReadiness = 'warnings';
          break;
        case 'failed':
          this.currentStatus?.deploymentReadiness = 'not_ready';
          break;
      }

      this.currentStatus?.recommendations = validationSummary.recommendedActions;
      this.currentStatus?.estimatedDeploymentTime = validationSummary.estimatedDeploymentTime;

      this.emit('validation_completed', validationSummary);
      this.emit('status_changed', this.currentStatus);

      return validationSummary;

    } catch (error) {
      this?.logger?.error('Pre-deployment validation failed', {
        error: error instanceof Error ? error.message : String(error as any),
      });
      throw error;
    }
  }

  /**
   * Start network monitoring
   */
  async startMonitoring(): Promise<void> {
    if (!this.monitor) {
      throw new ValidationError('Monitor not initialized. Enable monitoring in config.');
    }

    this.currentStatus?.phase = 'monitoring';
    this.emit('status_changed', this.currentStatus);

    this?.logger?.info('Starting network monitoring');

    try {
      await this?.monitor?.startMonitoring();
      this.emit('monitoring_started');

    } catch (error) {
      this?.logger?.error('Failed to start monitoring', {
        error: error instanceof Error ? error.message : String(error as any),
      });
      throw error;
    }
  }

  /**
   * Stop network monitoring
   */
  stopMonitoring(): void {
    if (this.monitor) {
      this?.monitor?.stopMonitoring();
      this.emit('monitoring_stopped');
    }
  }

  /**
   * Execute operation with health management
   */
  async executeWithHealthManagement<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    context: string
  ): Promise<T> {
    if (!this.retryManager) {
      throw new ValidationError('Retry manager not initialized');
    }

    this?.deploymentMetrics?.requestCount++;
    const startTime = Date.now();

    try {
      const result = await this?.retryManager?.executeWithFailover(operation, context);
      
      // Record metrics
      const responseTime = Date.now() - startTime;
      this?.deploymentMetrics?.responseTimeSum += responseTime;
      
      if (this.monitor) {
        this?.monitor?.recordResponseTime(responseTime as any);
      }

      return result;

    } catch (error) {
      this?.deploymentMetrics?.errorCount++;
      
      this?.logger?.error('Operation failed with health management', {
        context,
        error: error instanceof Error ? error.message : String(error as any),
      });

      throw error;
    }
  }

  /**
   * Get current network health
   */
  async getCurrentNetworkHealth(): Promise<NetworkHealth> {
    if (!this.healthChecker) {
      throw new ValidationError('Health checker not initialized');
    }

    try {
      const networkHealth = await this?.healthChecker?.checkHealth();
      this.currentStatus?.networkHealth = networkHealth;
      this.emit('status_changed', this.currentStatus);
      
      return networkHealth;

    } catch (error) {
      this?.logger?.error('Failed to get network health', {
        error: error instanceof Error ? error.message : String(error as any),
      });
      throw error;
    }
  }

  /**
   * Generate diagnostic report
   */
  generateDiagnosticReport(): DiagnosticReport | undefined {
    if (!this.monitor) {
      this?.logger?.warn('Monitor not available for diagnostic report');
      return undefined;
    }

    const report = this?.monitor?.generateDiagnosticReport();
    this.currentStatus?.diagnosticReport = report;
    this.emit('status_changed', this.currentStatus);

    return report;
  }

  /**
   * Get deployment status
   */
  getStatus(): DeploymentStatus {
    return { ...this.currentStatus };
  }

  /**
   * Start deployment phase
   */
  startDeployment(): void {
    this.currentStatus?.phase = 'deploying';
    this.deploymentMetrics?.startTime = Date.now();
    this.emit('deployment_started');
    this.emit('status_changed', this.currentStatus);
  }

  /**
   * Complete deployment
   */
  completeDeployment(success: boolean): DeploymentResult {
    this.deploymentMetrics?.endTime = Date.now();
    this.currentStatus?.phase = success ? 'completed' : 'failed';
    
    const result: DeploymentResult = {
      success,
      duration: this?.deploymentMetrics?.endTime - this?.deploymentMetrics?.startTime,
      networkMetrics: {
        totalRequests: this?.deploymentMetrics?.requestCount,
        errorRate: this?.deploymentMetrics?.requestCount > 0 
          ? this?.deploymentMetrics?.errorCount / this?.deploymentMetrics?.requestCount 
          : 0,
        averageResponseTime: this?.deploymentMetrics?.requestCount > 0 
          ? this?.deploymentMetrics?.responseTimeSum / this?.deploymentMetrics?.requestCount 
          : 0,
        endpointSwitches: this?.deploymentMetrics?.endpointSwitches,
      },
      issues: this.collectDeploymentIssues(),
      finalEndpoints: this.getFinalEndpoints(),
    };

    this.emit('deployment_completed', result);
    this.emit('status_changed', this.currentStatus);

    return result;
  }

  /**
   * Create network configuration from config
   */
  private createNetworkConfig(): NetworkConfig {
    return {
      network: this?.config?.network,
      sui: {
        primaryUrl: this?.config?.endpoints.sui.primary,
        fallbackUrls: this?.config?.endpoints.sui.fallbacks,
        websocketUrl: this?.config?.endpoints.sui.websocket,
        faucetUrl: this?.config?.endpoints.sui.faucet,
      },
      walrus: {
        publisherUrl: this?.config?.endpoints.walrus.publisher,
        aggregatorUrl: this?.config?.endpoints.walrus.aggregator,
        fallbackPublisherUrls: this?.config?.endpoints.walrus.fallbackPublishers,
      },
      thresholds: {
        maxResponseTime: 5000,
        minHealthScore: 75,
        minGasBalance: 1000000,
        requiredSuccessRate: 0.8,
      },
    };
  }

  /**
   * Create endpoint list for retry manager
   */
  private createEndpointList(): NetworkEndpoint[] {
    const endpoints: NetworkEndpoint[] = [];

    // Sui endpoints
    endpoints.push({
      url: this?.config?.endpoints.sui.primary,
      type: 'sui-rpc',
      priority: 1,
      isBackup: false,
    });

    this?.config?.endpoints.sui?.fallbacks?.forEach((url, index) => {
      endpoints.push({
        url,
        type: 'sui-rpc',
        priority: index + 2,
        isBackup: true,
      });
    });

    // Walrus endpoints
    endpoints.push({
      url: this?.config?.endpoints.walrus.publisher,
      type: 'walrus-publisher',
      priority: 1,
      isBackup: false,
    });

    endpoints.push({
      url: this?.config?.endpoints.walrus.aggregator,
      type: 'walrus-aggregator',
      priority: 1,
      isBackup: false,
    });

    this?.config?.endpoints.walrus?.fallbackPublishers?.forEach((url, index) => {
      endpoints.push({
        url,
        type: 'walrus-publisher',
        priority: index + 2,
        isBackup: true,
      });
    });

    return endpoints;
  }

  /**
   * Create fallback configuration
   */
  private createFallbackConfig(endpoints: NetworkEndpoint[]): FallbackConfig {
    const primary = endpoints.find(e => e?.priority === 1 && !e.isBackup);
    const fallbacks = endpoints.filter(e => e.isBackup);

    if (!primary) {
      throw new ValidationError('No primary endpoint found for fallback configuration');
    }

    return {
      primary,
      fallbacks,
      strategy: 'adaptive',
      healthCheckInterval: 30000,
      failoverThreshold: 3,
      fallbackTimeout: this?.config?.retryConfig.timeoutMs,
      enableAutomaticRecovery: true,
      maxConcurrentFallbacks: 3,
    };
  }

  /**
   * Setup monitoring event listeners
   */
  private setupMonitoringEventListeners(): void {
    if (!this.monitor) return;

    this?.monitor?.on('network_event', (event) => {
      this.emit('network_event', event);
      
      // Update status based on event severity
      if (event?.severity === 'error' || event?.severity === 'critical') {
        this.currentStatus?.deploymentReadiness = 'not_ready';
      } else if (event?.severity === 'warning' && this.currentStatus?.deploymentReadiness === 'ready') {
        this.currentStatus?.deploymentReadiness = 'warnings';
      }
    });

    this?.monitor?.on('metrics_updated', (metrics) => {
      this.emit('metrics_updated', metrics);
    });
  }

  /**
   * Collect deployment issues from monitoring
   */
  private collectDeploymentIssues(): DeploymentResult?.["issues"] {
    const issues: DeploymentResult?.["issues"] = [];

    if (this.monitor) {
      const recentEvents = this?.monitor?.getRecentEvents(20 as any);
      
      for (const event of recentEvents) {
        if (event?.severity === 'error' || event?.severity === 'warning') {
          issues.push({
            severity: event.severity,
            message: event.message,
            resolvedAutomatically: false, // Could track this more precisely
          });
        }
      }
    }

    return issues;
  }

  /**
   * Get final endpoints after deployment
   */
  private getFinalEndpoints(): DeploymentResult?.["finalEndpoints"] {
    let sui = this?.config?.endpoints.sui.primary;
    let walrusPublisher = this?.config?.endpoints.walrus.publisher;
    let walrusAggregator = this?.config?.endpoints.walrus.aggregator;

    // Get current endpoints from fallback manager if available
    if (this.fallbackManager) {
      const status = this?.fallbackManager?.getStatus();
      const currentEndpoint = status.currentEndpoint;
      
      // Determine which service the current endpoint belongs to
      if (this?.config?.endpoints.sui?.fallbacks?.includes(currentEndpoint as any) || 
          currentEndpoint === this?.config?.endpoints.sui.primary) {
        sui = currentEndpoint;
      } else if (this?.config?.endpoints.walrus?.fallbackPublishers?.includes(currentEndpoint as any) || 
                 currentEndpoint === this?.config?.endpoints.walrus.publisher) {
        walrusPublisher = currentEndpoint;
      }
    }

    return {
      sui,
      walrusPublisher,
      walrusAggregator,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this?.logger?.info('Destroying health management components');

    this.stopMonitoring();

    if (this.retryManager) {
      this?.retryManager?.destroy();
    }

    if (this.fallbackManager) {
      this?.fallbackManager?.destroy();
    }

    if (this.monitor) {
      this?.monitor?.destroy();
    }

    this.removeAllListeners();
  }

  /**
   * Static factory methods for common configurations
   */
  static forTestnet(overrides: Partial<DeploymentHealthConfig> = {}): WalrusDeploymentHealthManager {
    const config: DeploymentHealthConfig = {
      network: 'testnet',
      enableMonitoring: true,
      enableAutomaticFailover: true,
      enablePreValidation: true,
      strictValidation: false,
      monitoringInterval: 30000,
      retryConfig: {
        maxRetries: 5,
        initialDelay: 1000,
        maxDelay: 30000,
        timeoutMs: 10000,
      },
      endpoints: {
        sui: {
          primary: 'https://fullnode?.testnet?.sui.io:443',
          fallbacks: [
            'https://sui-testnet-endpoint?.blockvision?.org/v1',
            'https://sui-testnet?.publicnode?.com',
            'https://testnet?.sui?.rpcpool.com',
          ],
          websocket: 'wss://fullnode?.testnet?.sui.io:443',
          faucet: 'https://faucet?.testnet?.sui.io',
        },
        walrus: {
          publisher: 'https://publisher-testnet?.walrus?.site',
          aggregator: 'https://aggregator-testnet?.walrus?.site',
          fallbackPublishers: [
            'https://walrus-testnet-publisher?.nodes?.guru',
            'https://walrus-testnet-publisher?.blockscope?.net',
          ],
        },
      },
      ...overrides,
    };

    return new WalrusDeploymentHealthManager(config as any);
  }

  static forMainnet(overrides: Partial<DeploymentHealthConfig> = {}): WalrusDeploymentHealthManager {
    const config: DeploymentHealthConfig = {
      network: 'mainnet',
      enableMonitoring: true,
      enableAutomaticFailover: true,
      enablePreValidation: true,
      strictValidation: true,
      monitoringInterval: 30000,
      retryConfig: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 20000,
        timeoutMs: 10000,
      },
      endpoints: {
        sui: {
          primary: 'https://fullnode?.mainnet?.sui.io:443',
          fallbacks: [
            'https://sui-mainnet-endpoint?.blockvision?.org/v1',
            'https://sui-mainnet?.publicnode?.com',
            'https://mainnet?.sui?.rpcpool.com',
          ],
          websocket: 'wss://fullnode?.mainnet?.sui.io:443',
        },
        walrus: {
          publisher: 'https://publisher?.walrus?.space',
          aggregator: 'https://aggregator?.walrus?.space',
          fallbackPublishers: [],
        },
      },
      ...overrides,
    };

    return new WalrusDeploymentHealthManager(config as any);
  }
}