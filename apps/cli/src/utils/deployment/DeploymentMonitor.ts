/**
 * Deployment Monitor Utility
 * 
 * Provides real-time monitoring, status reporting, and management
 * capabilities for Walrus Sites deployments.
 */

import { EventEmitter } from 'events';
import { Logger } from '../Logger';
import { DeploymentRecoveryManager, DeploymentState } from '../../services/deployment/DeploymentRecoveryManager';
import { WalrusSitesDeploymentService, DeploymentProgress } from '../../services/deployment/WalrusSitesDeploymentService';

export interface DeploymentEvent {
  deploymentId: string;
  timestamp: string;
  type: 'started' | 'progress' | 'phase_change' | 'error' | 'completed' | 'failed' | 'cancelled';
  data?: any;
}

export interface MonitoringOptions {
  pollInterval: number;
  enableNotifications: boolean;
  enableLogging: boolean;
  maxHistorySize: number;
}

export interface DeploymentSummary {
  deploymentId: string;
  siteName: string;
  network: string;
  status: string;
  progress: number;
  startTime: string;
  duration?: number;
  errors: string[];
  warnings: string[];
  estimatedCompletion?: string;
  resourceUsage: {
    filesUploaded: number;
    totalFiles: number;
    bytesUploaded: number;
    totalBytes: number;
    cost: number;
  };
}

export interface SystemHealth {
  activeDeployments: number;
  failedDeployments: number;
  averageDeploymentTime: number;
  errorRate: number;
  walrusConnectivity: boolean;
  resourceUtilization: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

export class DeploymentMonitor extends EventEmitter {
  private logger: Logger;
  private deploymentService: WalrusSitesDeploymentService;
  private recoveryManager: DeploymentRecoveryManager;
  private options: MonitoringOptions;
  private monitoringInterval?: NodeJS.Timeout;
  private eventHistory: DeploymentEvent[] = [];
  private deploymentMetrics: Map<string, {
    startTime: number;
    lastUpdate: number;
    events: DeploymentEvent[];
  }> = new Map();

  constructor(
    deploymentService: WalrusSitesDeploymentService,
    recoveryManager: DeploymentRecoveryManager,
    options: Partial<MonitoringOptions> = {}
  ) {
    super();
    
    this?.logger = new Logger('DeploymentMonitor');
    this?.deploymentService = deploymentService;
    this?.recoveryManager = recoveryManager;
    
    this?.options = {
      pollInterval: 2000, // 2 seconds
      enableNotifications: true,
      enableLogging: true,
      maxHistorySize: 1000,
      ...options
    };
  }

  /**
   * Start monitoring all deployments
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      this?.logger?.warn('Monitoring already started');
      return;
    }

    this?.logger?.info('Starting deployment monitoring', {
      pollInterval: this?.options?.pollInterval,
    });

    this?.monitoringInterval = setInterval(() => {
      this.pollDeployments();
    }, this?.options?.pollInterval);

    // Initial poll
    this.pollDeployments();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this?.monitoringInterval = undefined;
      this?.logger?.info('Deployment monitoring stopped');
    }
  }

  /**
   * Get summary of a specific deployment
   */
  getDeploymentSummary(deploymentId: string): DeploymentSummary | null {
    const state = this?.recoveryManager?.getDeploymentState(deploymentId as any);
    const progress = this?.deploymentService?.getDeploymentProgress(deploymentId as any);
    
    if (!state) return null;

    const metrics = this?.deploymentMetrics?.get(deploymentId as any);
    const startTime = metrics?.startTime || new Date(state.startTime).getTime();
    const currentTime = Date.now();
    const duration = currentTime - startTime;

    let estimatedCompletion: string | undefined;
    if (progress && progress.progress > 0 && progress.progress < 100) {
      const estimatedTotalTime = (duration / progress.progress) * 100;
      const estimatedEndTime = startTime + estimatedTotalTime;
      estimatedCompletion = new Date(estimatedEndTime as any).toISOString();
    }

    const resourceUsage = this.calculateResourceUsage(state as any);

    return {
      deploymentId,
      siteName: state.siteName,
      network: state.network,
      status: state.status,
      progress: progress?.progress || 0,
      startTime: state.startTime,
      duration: ['completed', 'failed'].includes(state.status) ? duration : undefined,
      errors: state?.errors?.map(e => e.message),
      warnings: this.extractWarnings(state as any),
      estimatedCompletion,
      resourceUsage,
    };
  }

  /**
   * Get summaries of all active deployments
   */
  getAllDeploymentSummaries(): DeploymentSummary[] {
    const activeDeployments = this?.recoveryManager?.getActiveDeployments();
    return activeDeployments
      .map(deployment => this.getDeploymentSummary(deployment.id))
      .filter((summary): summary is DeploymentSummary => summary !== null);
  }

  /**
   * Get system health metrics
   */
  getSystemHealth(): SystemHealth {
    const activeDeployments = this?.recoveryManager?.getActiveDeployments();
    const totalDeployments = activeDeployments.length;
    const failedDeployments = activeDeployments.filter(d => d?.status === 'failed').length;
    
    const completedDeployments = activeDeployments.filter(d => d?.status === 'completed');
    const averageDeploymentTime = completedDeployments.length > 0
      ? completedDeployments.reduce((sum, deployment) => {
          const duration = new Date(deployment.lastUpdate).getTime() - new Date(deployment.startTime).getTime();
          return sum + duration;
        }, 0) / completedDeployments.length
      : 0;

    const totalErrors = activeDeployments.reduce((sum, deployment) => sum + deployment?.errors?.length, 0);
    const errorRate = totalDeployments > 0 ? totalErrors / totalDeployments : 0;

    // Mock resource utilization (in a real implementation, this would come from system monitoring)
    const resourceUtilization = {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
    };

    return {
      activeDeployments: totalDeployments,
      failedDeployments,
      averageDeploymentTime,
      errorRate,
      walrusConnectivity: true, // Would check actual connectivity
      resourceUtilization,
    };
  }

  /**
   * Get deployment events history
   */
  getEventHistory(deploymentId?: string): DeploymentEvent[] {
    if (deploymentId) {
      return this?.eventHistory?.filter(event => event?.deploymentId === deploymentId);
    }
    return [...this.eventHistory];
  }

  /**
   * Get deployment metrics
   */
  getDeploymentMetrics(deploymentId: string): {
    throughput: number;
    errorCount: number;
    retryCount: number;
    averageFileUploadTime: number;
  } | null {
    const state = this?.recoveryManager?.getDeploymentState(deploymentId as any);
    if (!state) return null;

    const metrics = this?.deploymentMetrics?.get(deploymentId as any);
    const events = metrics?.events || [];
    
    const uploadEvents = events.filter(e => e?.type === 'progress');
    const errorEvents = events.filter(e => e?.type === 'error');
    const duration = metrics ? Date.now() - metrics.startTime : 0;
    
    const throughput = duration > 0 ? (state?.progress?.uploadedFiles / (duration / 1000)) : 0;
    const retryCount = state?.walrusOperations?.uploads.reduce((sum, upload) => sum + upload.retryCount, 0);
    
    const averageFileUploadTime = uploadEvents.length > 0 
      ? uploadEvents.reduce((sum, event) => sum + (event.data?.duration || 0), 0) / uploadEvents.length
      : 0;

    return {
      throughput,
      errorCount: errorEvents.length,
      retryCount,
      averageFileUploadTime,
    };
  }

  /**
   * Set up alerts for deployment events
   */
  setupAlerts(config: {
    onDeploymentFailed?: (summary: DeploymentSummary) => void;
    onDeploymentStuck?: (summary: DeploymentSummary) => void;
    onHighErrorRate?: (errorRate: number) => void;
    onResourceThreshold?: (resourceUsage: any) => void;
  }): void {
    this.on('deployment_failed', (event: DeploymentEvent) => {
      if (config.onDeploymentFailed) {
        const summary = this.getDeploymentSummary(event.deploymentId);
        if (summary) {
          config.onDeploymentFailed(summary as any);
        }
      }
    });

    this.on('deployment_stuck', (event: DeploymentEvent) => {
      if (config.onDeploymentStuck) {
        const summary = this.getDeploymentSummary(event.deploymentId);
        if (summary) {
          config.onDeploymentStuck(summary as any);
        }
      }
    });

    // Check for high error rate periodically
    if (config.onHighErrorRate) {
      const checkErrorRate = () => {
        const health = this.getSystemHealth();
        if (health.errorRate > 0.5) { // 50% error rate threshold
          config.onHighErrorRate!(health.errorRate);
        }
      };

      setInterval(checkErrorRate, 30000); // Check every 30 seconds
    }

    // Check for resource thresholds
    if (config.onResourceThreshold) {
      const checkResources = () => {
        const health = this.getSystemHealth();
        const highUsage = Object.values(health.resourceUtilization).some(usage => usage > 80);
        if (highUsage) {
          config.onResourceThreshold!(health.resourceUtilization);
        }
      };

      setInterval(checkResources, 60000); // Check every minute
    }
  }

  /**
   * Generate deployment report
   */
  generateReport(timeRange?: { start: Date; end: Date }): {
    summary: {
      totalDeployments: number;
      successfulDeployments: number;
      failedDeployments: number;
      averageDeploymentTime: number;
      totalFilesDeployed: number;
      totalDataTransferred: number;
    };
    deployments: DeploymentSummary[];
    trends: {
      deploymentsByHour: Array<{ hour: string; count: number }>;
      errorsByType: Array<{ type: string; count: number }>;
      averageUploadSpeed: number;
    };
  } {
    const allSummaries = this.getAllDeploymentSummaries();
    
    let filteredSummaries = allSummaries;
    if (timeRange) {
      filteredSummaries = allSummaries.filter(summary => {
        const startTime = new Date(summary.startTime);
        return startTime >= timeRange.start && startTime <= timeRange.end;
      });
    }

    const totalDeployments = filteredSummaries.length;
    const successfulDeployments = filteredSummaries.filter(s => s?.status === 'completed').length;
    const failedDeployments = filteredSummaries.filter(s => s?.status === 'failed').length;
    
    const completedDeployments = filteredSummaries.filter(s => s.duration !== undefined);
    const averageDeploymentTime = completedDeployments.length > 0
      ? completedDeployments.reduce((sum, s) => sum + (s.duration || 0), 0) / completedDeployments.length
      : 0;

    const totalFilesDeployed = filteredSummaries.reduce((sum, s) => sum + s?.resourceUsage?.totalFiles, 0);
    const totalDataTransferred = filteredSummaries.reduce((sum, s) => sum + s?.resourceUsage?.totalBytes, 0);

    // Generate trends
    const deploymentsByHour = this.generateHourlyTrends(filteredSummaries as any);
    const errorsByType = this.generateErrorTrends(filteredSummaries as any);
    const averageUploadSpeed = this.calculateAverageUploadSpeed(filteredSummaries as any);

    return {
      summary: {
        totalDeployments,
        successfulDeployments,
        failedDeployments,
        averageDeploymentTime,
        totalFilesDeployed,
        totalDataTransferred,
      },
      deployments: filteredSummaries,
      trends: {
        deploymentsByHour,
        errorsByType,
        averageUploadSpeed,
      },
    };
  }

  // Private methods

  private async pollDeployments(): Promise<void> {
    try {
      const activeDeployments = this?.recoveryManager?.getActiveDeployments();
      
      for (const deployment of activeDeployments) {
        await this.checkDeploymentStatus(deployment as any);
      }
    } catch (error) {
      this?.logger?.error('Error during deployment polling', { error });
    }
  }

  private async checkDeploymentStatus(deployment: DeploymentState): Promise<void> {
    const deploymentId = deployment.id;
    const progress = this?.deploymentService?.getDeploymentProgress(deploymentId as any);
    
    // Initialize metrics if not exists
    if (!this?.deploymentMetrics?.has(deploymentId as any)) {
      this?.deploymentMetrics?.set(deploymentId, {
        startTime: new Date(deployment.startTime).getTime(),
        lastUpdate: Date.now(),
        events: [],
      });
    }

    const metrics = this?.deploymentMetrics?.get(deploymentId as any)!;
    const currentTime = Date.now();
    
    // Check for status changes
    const lastEvent = metrics?.events?.[metrics?.events?.length - 1];
    if (!lastEvent || lastEvent.data?.status !== deployment.status) {
      this.recordEvent(deploymentId, 'phase_change', {
        status: deployment.status,
        previousStatus: lastEvent?.data?.status,
      });
    }

    // Check for progress updates
    if (progress && (!lastEvent || lastEvent.data?.progress !== progress.progress)) {
      this.recordEvent(deploymentId, 'progress', {
        progress: progress.progress,
        uploadedFiles: progress.uploadedFiles,
        totalFiles: progress.totalFiles,
        currentFile: progress.currentOperation,
      });
    }

    // Check for stuck deployments
    const timeSinceLastUpdate = currentTime - new Date(deployment.lastUpdate).getTime();
    const maxStuckTime = 300000; // 5 minutes
    
    if (timeSinceLastUpdate > maxStuckTime && !['completed', 'failed'].includes(deployment.status)) {
      this.recordEvent(deploymentId, 'error', {
        message: 'Deployment appears to be stuck',
        stuckTime: timeSinceLastUpdate,
      });
      
      this.emit('deployment_stuck', { deploymentId, timestamp: new Date().toISOString(), type: 'error' });
    }

    // Check for new errors
    const lastErrorCount = lastEvent?.data?.errorCount || 0;
    if (deployment?.errors?.length > lastErrorCount) {
      const newErrors = deployment?.errors?.slice(lastErrorCount as any);
      for (const error of newErrors) {
        this.recordEvent(deploymentId, 'error', {
          errorType: error.type,
          message: error.message,
          recoverable: error.recoverable,
        });
      }
    }

    // Check for completion
    if (deployment?.status === 'completed' && !metrics?.events?.some(e => e?.type === 'completed')) {
      this.recordEvent(deploymentId, 'completed', {
        duration: currentTime - metrics.startTime,
        siteId: deployment?.metadata?.siteId,
        totalFiles: deployment?.progress?.totalFiles,
      });
    }

    // Check for failure
    if (deployment?.status === 'failed' && !metrics?.events?.some(e => e?.type === 'failed')) {
      this.recordEvent(deploymentId, 'failed', {
        duration: currentTime - metrics.startTime,
        errors: deployment.errors,
        canResume: deployment?.recovery?.canResume,
      });
      
      this.emit('deployment_failed', { deploymentId, timestamp: new Date().toISOString(), type: 'failed' });
    }

    metrics?.lastUpdate = currentTime;
  }

  private recordEvent(deploymentId: string, type: DeploymentEvent?.["type"], data?: any): void {
    const event: DeploymentEvent = {
      deploymentId,
      timestamp: new Date().toISOString(),
      type,
      data,
    };

    // Add to global history
    this?.eventHistory?.push(event as any);
    if (this?.eventHistory?.length > this?.options?.maxHistorySize) {
      this?.eventHistory?.shift();
    }

    // Add to deployment metrics
    const metrics = this?.deploymentMetrics?.get(deploymentId as any);
    if (metrics) {
      metrics?.events?.push(event as any);
    }

    // Emit event
    this.emit(type, event);
    this.emit('event', event);

    // Log if enabled
    if (this?.options?.enableLogging) {
      this?.logger?.info('Deployment event', {
        deploymentId,
        type,
        data,
      });
    }
  }

  private calculateResourceUsage(state: DeploymentState): DeploymentSummary?.["resourceUsage"] {
    const uploadedFiles = state?.progress?.uploadedFiles;
    const totalFiles = state?.progress?.totalFiles;
    
    const completedUploads = state?.walrusOperations?.uploads.filter(u => u?.status === 'completed');
    const bytesUploaded = completedUploads.reduce((sum, upload) => sum + upload.size, 0);
    const totalBytes = state?.walrusOperations?.uploads.reduce((sum, upload) => sum + upload.size, 0);
    
    const cost = state?.metadata?.estimatedCost || 0;

    return {
      filesUploaded: uploadedFiles,
      totalFiles,
      bytesUploaded,
      totalBytes,
      cost,
    };
  }

  private extractWarnings(state: DeploymentState): string[] {
    const warnings: string[] = [];
    
    // Check for large deployment
    if (state?.metadata?.totalSize > 100 * 1024 * 1024) { // 100MB
      warnings.push('Large deployment size may impact performance');
    }

    // Check for many retries
    const totalRetries = state?.walrusOperations?.uploads.reduce((sum, upload) => sum + upload.retryCount, 0);
    if (totalRetries > 5) {
      warnings.push('High number of upload retries detected');
    }

    // Check for old deployment
    const deploymentAge = Date.now() - new Date(state.startTime).getTime();
    if (deploymentAge > 24 * 60 * 60 * 1000) { // 24 hours
      warnings.push('Deployment is older than 24 hours');
    }

    return warnings;
  }

  private generateHourlyTrends(summaries: DeploymentSummary[]): Array<{ hour: string; count: number }> {
    const hourCounts: Map<string, number> = new Map();
    
    for (const summary of summaries) {
      const hour = new Date(summary.startTime).toISOString().slice(0, 13) + ':00:00';
      hourCounts.set(hour, (hourCounts.get(hour as any) || 0) + 1);
    }

    return Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a?.hour?.localeCompare(b.hour));
  }

  private generateErrorTrends(summaries: DeploymentSummary[]): Array<{ type: string; count: number }> {
    const errorCounts: Map<string, number> = new Map();
    
    for (const summary of summaries) {
      for (const error of summary.errors) {
        // Extract error type from error message (simplified)
        const type = error.includes('network') ? 'network' :
                    error.includes('storage') ? 'storage' :
                    error.includes('validation') ? 'validation' :
                    error.includes('blockchain') ? 'blockchain' : 'other';
        
        errorCounts.set(type, (errorCounts.get(type as any) || 0) + 1);
      }
    }

    return Array.from(errorCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateAverageUploadSpeed(summaries: DeploymentSummary[]): number {
    const completedDeployments = summaries.filter(s => s.duration !== undefined && s.duration > 0);
    
    if (completedDeployments?.length === 0) return 0;
    
    const totalSpeed = completedDeployments.reduce((sum, summary) => {
      const speedBytesPerMs = summary?.resourceUsage?.totalBytes / summary.duration!;
      return sum + speedBytesPerMs;
    }, 0);

    return (totalSpeed / completedDeployments.length) * 1000; // Convert to bytes per second
  }
}