/**
 * Network Monitor and Diagnostics System
 * 
 * Provides real-time monitoring and diagnostics for network issues
 * during Walrus Sites deployment and operations. Includes performance
 * tracking, error pattern detection, and automatic remediation suggestions.
 */

import { EventEmitter } from 'events';
import { Logger } from './Logger';
import { NetworkHealthChecker, type NetworkHealth } from './NetworkHealthChecker';
import { NetworkRetryManager } from './NetworkRetryManager';
import { EndpointFallbackManager } from './EndpointFallbackManager';

export interface NetworkMetrics {
  timestamp: number;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  networkCondition: 'excellent' | 'good' | 'degraded' | 'poor' | 'critical';
  activeEndpoints: number;
  failedEndpoints: number;
}

export interface NetworkEvent {
  timestamp: number;
  type: 'endpoint_failure' | 'endpoint_recovery' | 'network_degradation' | 'performance_alert' | 'connectivity_issue';
  severity: 'info' | 'warning' | 'error' | 'critical';
  endpoint?: string;
  message: string;
  details?: Record<string, unknown>;
  suggestion?: string;
}

export interface DiagnosticReport {
  timestamp: number;
  duration: number;
  networkHealth: NetworkHealth;
  metrics: NetworkMetrics;
  events: NetworkEvent[];
  patterns: {
    errorPattern: string;
    frequency: number;
    suggestion: string;
  }[];
  recommendations: string[];
  estimatedImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface MonitoringConfig {
  healthCheckInterval: number;
  metricsRetentionPeriod: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    endpointFailures: number;
  };
  enableAutomaticRemediation: boolean;
  enablePerformanceTracking: boolean;
  enablePatternDetection: boolean;
  maxEventHistory: number;
}

export class NetworkMonitor extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: MonitoringConfig;
  private readonly healthChecker: NetworkHealthChecker;
  private readonly retryManager?: NetworkRetryManager;
  private readonly fallbackManager?: EndpointFallbackManager;

  private isMonitoring = false;
  private monitoringTimer?: NodeJS.Timeout;
  private metricsHistory: NetworkMetrics[] = [];
  private eventHistory: NetworkEvent[] = [];
  private responseTimeHistory: number[] = [];
  private currentNetworkHealth?: NetworkHealth;

  private static readonly DEFAULT_CONFIG: MonitoringConfig = {
    healthCheckInterval: 30000, // 30 seconds
    metricsRetentionPeriod: 3600000, // 1 hour
    alertThresholds: {
      errorRate: 0.15, // 15%
      responseTime: 5000, // 5 seconds
      endpointFailures: 3,
    },
    enableAutomaticRemediation: true,
    enablePerformanceTracking: true,
    enablePatternDetection: true,
    maxEventHistory: 1000,
  };

  constructor(
    healthChecker: NetworkHealthChecker,
    config: Partial<MonitoringConfig> = {},
    retryManager?: NetworkRetryManager,
    fallbackManager?: EndpointFallbackManager
  ) {
    super();
    
    this.logger = new Logger('NetworkMonitor');
    this.config = { ...NetworkMonitor.DEFAULT_CONFIG, ...config };
    this.healthChecker = healthChecker;
    this.retryManager = retryManager;
    this.fallbackManager = fallbackManager;

    // Set up event listeners for external components
    this.setupEventListeners();
  }

  /**
   * Start network monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      this.logger.warn('Monitoring already active');
      return;
    }

    this.logger.info('Starting network monitoring', {
      interval: this.config.healthCheckInterval,
      enableRemediation: this.config.enableAutomaticRemediation,
    });

    this.isMonitoring = true;

    // Perform initial health check
    await this.performHealthCheck();

    // Start periodic monitoring
    this.monitoringTimer = setInterval(() => {
      this.performHealthCheck().catch(error => {
        this.logger.error('Health check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.config.healthCheckInterval);

    this.emit('monitoring_started');
  }

  /**
   * Stop network monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.logger.info('Stopping network monitoring');

    this.isMonitoring = false;

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    this.emit('monitoring_stopped');
  }

  /**
   * Perform health check and update metrics
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      // Get current network health
      const networkHealth = await this.healthChecker.checkHealth();
      this.currentNetworkHealth = networkHealth;

      // Calculate metrics
      const metrics = this.calculateMetrics(networkHealth);
      this.metricsHistory.push(metrics);

      // Clean old metrics
      this.cleanOldMetrics();

      // Detect and handle issues
      await this.detectAndHandleIssues(networkHealth, metrics);

      // Emit metrics update
      this.emit('metrics_updated', metrics);

      this.logger.debug('Health check completed', {
        duration: Date.now() - startTime,
        score: networkHealth.overall.score,
        condition: metrics.networkCondition,
      });

    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });

      // Record health check failure
      this.recordEvent({
        type: 'connectivity_issue',
        severity: 'error',
        message: 'Health check failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        suggestion: 'Check network connectivity and endpoint availability',
      });
    }
  }

  /**
   * Calculate current network metrics
   */
  private calculateMetrics(networkHealth: NetworkHealth): NetworkMetrics {
    const timestamp = Date.now();

    // Get retry manager stats if available
    let requestCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let averageResponseTime = 0;

    if (this.retryManager) {
      const stats = this.retryManager.getNetworkStats();
      requestCount = stats.metrics.totalRequests;
      successCount = stats.metrics.successfulRequests;
      errorCount = requestCount - successCount;
      averageResponseTime = stats.metrics.averageResponseTime;
    }

    // Calculate error rate
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;

    // Calculate P95 response time from history
    const p95ResponseTime = this.calculateP95ResponseTime();

    // Determine network condition
    const networkCondition = this.determineNetworkCondition(
      networkHealth.overall.score,
      errorRate,
      averageResponseTime
    );

    // Count active and failed endpoints
    const suiEndpoints = [networkHealth.sui.primary, ...networkHealth.sui.fallbacks].filter(Boolean);
    const walrusEndpoints = [
      networkHealth.walrus.publisher,
      networkHealth.walrus.aggregator,
      ...networkHealth.walrus.fallbackPublishers,
    ].filter(Boolean);

    const allEndpoints = [...suiEndpoints, ...walrusEndpoints];
    const activeEndpoints = allEndpoints.filter(e => e.available).length;
    const failedEndpoints = allEndpoints.filter(e => !e.available).length;

    return {
      timestamp,
      requestCount,
      successCount,
      errorCount,
      averageResponseTime,
      p95ResponseTime,
      errorRate,
      networkCondition,
      activeEndpoints,
      failedEndpoints,
    };
  }

  /**
   * Determine network condition based on metrics
   */
  private determineNetworkCondition(
    healthScore: number,
    errorRate: number,
    responseTime: number
  ): NetworkMetrics['networkCondition'] {
    if (healthScore >= 95 && errorRate < 0.01 && responseTime < 1000) {
      return 'excellent';
    } else if (healthScore >= 80 && errorRate < 0.05 && responseTime < 2000) {
      return 'good';
    } else if (healthScore >= 60 && errorRate < 0.15 && responseTime < 5000) {
      return 'degraded';
    } else if (healthScore >= 30 && errorRate < 0.30) {
      return 'poor';
    } else {
      return 'critical';
    }
  }

  /**
   * Calculate P95 response time from history
   */
  private calculateP95ResponseTime(): number {
    if (this.responseTimeHistory.length === 0) {
      return 0;
    }

    const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    return sorted[p95Index] || 0;
  }

  /**
   * Record response time for P95 calculation
   */
  recordResponseTime(responseTime: number): void {
    this.responseTimeHistory.push(responseTime);
    
    // Keep only recent response times (last 100)
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-100);
    }
  }

  /**
   * Detect and handle network issues
   */
  private async detectAndHandleIssues(
    networkHealth: NetworkHealth,
    metrics: NetworkMetrics
  ): Promise<void> {
    // Check for endpoint failures
    this.checkEndpointFailures(networkHealth);

    // Check for performance degradation
    this.checkPerformanceDegradation(metrics);

    // Check for high error rates
    this.checkErrorRates(metrics);

    // Detect patterns if enabled
    if (this.config.enablePatternDetection) {
      this.detectErrorPatterns();
    }

    // Attempt automatic remediation if enabled
    if (this.config.enableAutomaticRemediation) {
      await this.attemptAutomaticRemediation(networkHealth, metrics);
    }
  }

  /**
   * Check for endpoint failures
   */
  private checkEndpointFailures(networkHealth: NetworkHealth): void {
    const allEndpoints = [
      { ...networkHealth.sui.primary, type: 'sui-rpc' },
      ...networkHealth.sui.fallbacks.map(e => ({ ...e, type: 'sui-rpc-fallback' })),
      { ...networkHealth.walrus.publisher, type: 'walrus-publisher' },
      { ...networkHealth.walrus.aggregator, type: 'walrus-aggregator' },
      ...networkHealth.walrus.fallbackPublishers.map(e => ({ ...e, type: 'walrus-publisher-fallback' })),
    ];

    for (const endpoint of allEndpoints) {
      if (!endpoint.available) {
        this.recordEvent({
          type: 'endpoint_failure',
          severity: endpoint.type.includes('fallback') ? 'warning' : 'error',
          endpoint: endpoint.url,
          message: `Endpoint ${endpoint.url} is unavailable`,
          details: { 
            type: endpoint.type,
            errorMessage: endpoint.errorMessage,
            responseTime: endpoint.responseTime,
          },
          suggestion: this.getEndpointFailureSuggestion(endpoint.type),
        });
      }
    }
  }

  /**
   * Check for performance degradation
   */
  private checkPerformanceDegradation(metrics: NetworkMetrics): void {
    if (metrics.averageResponseTime > this.config.alertThresholds.responseTime) {
      this.recordEvent({
        type: 'performance_alert',
        severity: 'warning',
        message: `High average response time: ${metrics.averageResponseTime}ms`,
        details: { 
          averageResponseTime: metrics.averageResponseTime,
          threshold: this.config.alertThresholds.responseTime,
          p95ResponseTime: metrics.p95ResponseTime,
        },
        suggestion: 'Consider using fallback endpoints or checking network connectivity',
      });
    }

    // Check for sudden response time spikes
    if (this.metricsHistory.length >= 2) {
      const previousMetrics = this.metricsHistory[this.metricsHistory.length - 2];
      const responseTimeIncrease = metrics.averageResponseTime - previousMetrics.averageResponseTime;
      
      if (responseTimeIncrease > 2000) { // 2 second increase
        this.recordEvent({
          type: 'performance_alert',
          severity: 'warning',
          message: `Sudden response time increase: +${responseTimeIncrease}ms`,
          details: { 
            previousResponseTime: previousMetrics.averageResponseTime,
            currentResponseTime: metrics.averageResponseTime,
            increase: responseTimeIncrease,
          },
          suggestion: 'Network conditions may be degrading',
        });
      }
    }
  }

  /**
   * Check for high error rates
   */
  private checkErrorRates(metrics: NetworkMetrics): void {
    if (metrics.errorRate > this.config.alertThresholds.errorRate) {
      this.recordEvent({
        type: 'network_degradation',
        severity: metrics.errorRate > 0.3 ? 'error' : 'warning',
        message: `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        details: { 
          errorRate: metrics.errorRate,
          errorCount: metrics.errorCount,
          requestCount: metrics.requestCount,
          threshold: this.config.alertThresholds.errorRate,
        },
        suggestion: 'Check network stability and endpoint health',
      });
    }
  }

  /**
   * Detect error patterns
   */
  private detectErrorPatterns(): void {
    if (this.eventHistory.length < 5) {
      return;
    }

    // Look for patterns in recent events (last 10 minutes)
    const recentEvents = this.eventHistory.filter(
      event => Date.now() - event.timestamp < 600000
    );

    // Group events by endpoint
    const endpointEvents = new Map<string, NetworkEvent[]>();
    for (const event of recentEvents) {
      if (event.endpoint) {
        if (!endpointEvents.has(event.endpoint)) {
          endpointEvents.set(event.endpoint, []);
        }
        endpointEvents.get(event.endpoint)!.push(event);
      }
    }

    // Detect flapping endpoints
    for (const [endpoint, events] of endpointEvents) {
      const failures = events.filter(e => e.type === 'endpoint_failure');
      const recoveries = events.filter(e => e.type === 'endpoint_recovery');
      
      if (failures.length >= 3 && recoveries.length >= 2) {
        this.recordEvent({
          type: 'network_degradation',
          severity: 'warning',
          endpoint,
          message: `Endpoint ${endpoint} is flapping (${failures.length} failures, ${recoveries.length} recoveries)`,
          details: { failures: failures.length, recoveries: recoveries.length },
          suggestion: 'Endpoint may be unstable, consider using alternative endpoints',
        });
      }
    }
  }

  /**
   * Attempt automatic remediation
   */
  private async attemptAutomaticRemediation(
    networkHealth: NetworkHealth,
    metrics: NetworkMetrics
  ): Promise<void> {
    // If primary Sui endpoint is down but fallbacks are available
    if (!networkHealth.sui.primary.available) {
      const healthyFallbacks = networkHealth.sui.fallbacks.filter(f => f.available);
      if (healthyFallbacks.length > 0 && this.fallbackManager) {
        this.logger.info('Attempting automatic failover for Sui RPC', {
          healthyFallbacks: healthyFallbacks.length,
        });
        
        try {
          this.fallbackManager.forceSwitchTo(healthyFallbacks[0].url);
          this.recordEvent({
            type: 'endpoint_recovery',
            severity: 'info',
            message: `Automatically switched to fallback Sui RPC: ${healthyFallbacks[0].url}`,
            suggestion: 'Monitor primary endpoint for recovery',
          });
        } catch (error) {
          this.logger.error('Automatic failover failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // If Walrus publisher is down but fallbacks are available
    if (!networkHealth.walrus.publisher.available) {
      const healthyFallbacks = networkHealth.walrus.fallbackPublishers.filter(f => f.available);
      if (healthyFallbacks.length > 0 && this.fallbackManager) {
        this.logger.info('Attempting automatic failover for Walrus publisher', {
          healthyFallbacks: healthyFallbacks.length,
        });
        
        try {
          this.fallbackManager.forceSwitchTo(healthyFallbacks[0].url);
          this.recordEvent({
            type: 'endpoint_recovery',
            severity: 'info',
            message: `Automatically switched to fallback Walrus publisher: ${healthyFallbacks[0].url}`,
            suggestion: 'Monitor primary publisher for recovery',
          });
        } catch (error) {
          this.logger.error('Automatic publisher failover failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  /**
   * Record network event
   */
  private recordEvent(event: Omit<NetworkEvent, 'timestamp'>): void {
    const fullEvent: NetworkEvent = {
      timestamp: Date.now(),
      ...event,
    };

    this.eventHistory.push(fullEvent);

    // Limit event history size
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.config.maxEventHistory);
    }

    this.emit('network_event', fullEvent);

    // Log based on severity
    switch (event.severity) {
      case 'critical':
      case 'error':
        this.logger.error(event.message, event.details);
        break;
      case 'warning':
        this.logger.warn(event.message, event.details);
        break;
      case 'info':
      default:
        this.logger.info(event.message, event.details);
        break;
    }
  }

  /**
   * Get suggestion for endpoint failure
   */
  private getEndpointFailureSuggestion(endpointType: string): string {
    switch (endpointType) {
      case 'sui-rpc':
        return 'Check Sui network status and consider using fallback RPC endpoints';
      case 'walrus-publisher':
        return 'Check Walrus publisher status and consider using fallback publishers';
      case 'walrus-aggregator':
        return 'Check Walrus aggregator status and network connectivity';
      default:
        return 'Check endpoint configuration and network connectivity';
    }
  }

  /**
   * Clean old metrics to prevent memory growth
   */
  private cleanOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod;
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * Setup event listeners for external components
   */
  private setupEventListeners(): void {
    // Listen for fallback manager events if available
    if (this.fallbackManager) {
      // Note: This would need to be implemented in EndpointFallbackManager
      // this.fallbackManager.on('endpoint_switched', (event) => { ... });
    }
  }

  /**
   * Generate diagnostic report
   */
  generateDiagnosticReport(): DiagnosticReport {
    const timestamp = Date.now();
    const recentEvents = this.eventHistory.filter(
      event => timestamp - event.timestamp < 3600000 // Last hour
    );

    // Detect patterns
    const patterns = this.analyzeErrorPatterns(recentEvents);

    // Generate recommendations
    const recommendations = this.generateRecommendations(recentEvents, this.getCurrentMetrics());

    // Estimate impact
    const estimatedImpact = this.estimateNetworkImpact(recentEvents, this.getCurrentMetrics());

    return {
      timestamp,
      duration: this.config.metricsRetentionPeriod,
      networkHealth: this.currentNetworkHealth || {} as NetworkHealth,
      metrics: this.getCurrentMetrics(),
      events: recentEvents,
      patterns,
      recommendations,
      estimatedImpact,
    };
  }

  /**
   * Analyze error patterns in events
   */
  private analyzeErrorPatterns(events: NetworkEvent[]): Array<{
    errorPattern: string;
    frequency: number;
    suggestion: string;
  }> {
    const patterns = new Map<string, number>();

    for (const event of events.filter(e => e.severity === 'error' || e.severity === 'warning')) {
      const pattern = this.categorizeError(event.message);
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }

    return Array.from(patterns.entries()).map(([pattern, frequency]) => ({
      errorPattern: pattern,
      frequency,
      suggestion: this.getPatternSuggestion(pattern),
    }));
  }

  /**
   * Categorize error into pattern
   */
  private categorizeError(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('timeout')) return 'timeout_errors';
    if (lowerMessage.includes('connection')) return 'connection_errors';
    if (lowerMessage.includes('unavailable')) return 'availability_errors';
    if (lowerMessage.includes('response time')) return 'performance_errors';
    if (lowerMessage.includes('error rate')) return 'reliability_errors';

    return 'other_errors';
  }

  /**
   * Get suggestion for error pattern
   */
  private getPatternSuggestion(pattern: string): string {
    switch (pattern) {
      case 'timeout_errors':
        return 'Consider increasing timeout values or using faster endpoints';
      case 'connection_errors':
        return 'Check network connectivity and firewall settings';
      case 'availability_errors':
        return 'Use fallback endpoints and monitor service status';
      case 'performance_errors':
        return 'Optimize network configuration or switch to faster endpoints';
      case 'reliability_errors':
        return 'Review endpoint reliability and implement circuit breakers';
      default:
        return 'Investigate error details and check endpoint configuration';
    }
  }

  /**
   * Generate recommendations based on current state
   */
  private generateRecommendations(events: NetworkEvent[], metrics: NetworkMetrics): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (metrics.averageResponseTime > 3000) {
      recommendations.push('Consider using geographically closer endpoints for better performance');
    }

    // Reliability recommendations
    if (metrics.errorRate > 0.1) {
      recommendations.push('Implement more aggressive retry logic or use circuit breakers');
    }

    // Endpoint health recommendations
    if (metrics.failedEndpoints > 0) {
      recommendations.push('Review failed endpoint configuration and status');
    }

    // Pattern-based recommendations
    const timeoutEvents = events.filter(e => e.message.toLowerCase().includes('timeout'));
    if (timeoutEvents.length > 5) {
      recommendations.push('Increase timeout values to handle network latency');
    }

    return recommendations;
  }

  /**
   * Estimate network impact on operations
   */
  private estimateNetworkImpact(events: NetworkEvent[], metrics: NetworkMetrics): DiagnosticReport['estimatedImpact'] {
    const criticalEvents = events.filter(e => e.severity === 'critical').length;
    const errorEvents = events.filter(e => e.severity === 'error').length;

    if (criticalEvents > 0 || metrics.networkCondition === 'critical') {
      return 'critical';
    } else if (errorEvents > 3 || metrics.networkCondition === 'poor') {
      return 'high';
    } else if (metrics.errorRate > 0.1 || metrics.networkCondition === 'degraded') {
      return 'medium';
    } else if (metrics.networkCondition === 'good') {
      return 'low';
    } else {
      return 'none';
    }
  }

  /**
   * Get current metrics (latest or default)
   */
  private getCurrentMetrics(): NetworkMetrics {
    return this.metricsHistory[this.metricsHistory.length - 1] || {
      timestamp: Date.now(),
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      errorRate: 0,
      networkCondition: 'good',
      activeEndpoints: 0,
      failedEndpoints: 0,
    };
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    uptime: number;
    metricsCount: number;
    eventCount: number;
    currentCondition: NetworkMetrics['networkCondition'];
  } {
    return {
      isMonitoring: this.isMonitoring,
      uptime: this.isMonitoring ? Date.now() - (this.metricsHistory[0]?.timestamp || Date.now()) : 0,
      metricsCount: this.metricsHistory.length,
      eventCount: this.eventHistory.length,
      currentCondition: this.getCurrentMetrics().networkCondition,
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count = 10): NetworkMetrics[] {
    return this.metricsHistory.slice(-count);
  }

  /**
   * Get recent events
   */
  getRecentEvents(count = 50): NetworkEvent[] {
    return this.eventHistory.slice(-count);
  }

  /**
   * Clear monitoring data
   */
  clearData(): void {
    this.metricsHistory = [];
    this.eventHistory = [];
    this.responseTimeHistory = [];
    this.emit('data_cleared');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.clearData();
  }
}