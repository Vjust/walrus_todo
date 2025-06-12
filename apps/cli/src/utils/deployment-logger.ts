/**
 * Deployment Logger for Walrus Sites
 * 
 * Provides comprehensive logging, error tracking, and deployment monitoring
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from './Logger';

export interface DeploymentLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: DeploymentLogCategory;
  message: string;
  details?: any;
  metadata?: {
    network?: string;
    siteName?: string;
    deploymentId?: string;
    duration?: number;
    buildSize?: number;
    retryCount?: number;
  };
}

export enum DeploymentLogCategory {
  PREREQUISITE = 'prerequisite',
  BUILD = 'build',
  VALIDATION = 'validation',
  UPLOAD = 'upload',
  PUBLISH = 'publish',
  VERIFICATION = 'verification',
  ERROR = 'error',
  RECOVERY = 'recovery',
  PERFORMANCE = 'performance'
}

export interface DeploymentSession {
  id: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  network: string;
  siteName: string;
  buildDir: string;
  logs: DeploymentLogEntry[];
  metrics: DeploymentMetrics;
  errors: DeploymentError[];
}

export interface DeploymentMetrics {
  buildDuration?: number;
  uploadDuration?: number;
  publishDuration?: number;
  totalDuration?: number;
  buildSize?: number;
  fileCount?: number;
  retryCount: number;
  networkLatency?: number;
}

export interface DeploymentError {
  timestamp: string;
  category: string;
  message: string;
  stack?: string;
  context?: any;
  recovery?: {
    attempted: boolean;
    successful: boolean;
    method: string;
  };
}

export class DeploymentLogger {
  private session: DeploymentSession;
  private logger: Logger;
  private logFilePath: string;
  private metricsStartTimes: Map<string, number> = new Map();

  constructor(config: {
    network: string;
    siteName: string;
    buildDir: string;
    logDir?: string;
  }) {
    this?.logger = new Logger('DeploymentLogger');
    
    // Create unique session ID
    const sessionId = this.generateSessionId();
    
    // Initialize session
    this?.session = {
      id: sessionId,
      startTime: new Date().toISOString(),
      status: 'running',
      network: config.network,
      siteName: config.siteName,
      buildDir: config.buildDir,
      logs: [],
      metrics: {
        retryCount: 0
      },
      errors: []
    };

    // Set up log file path
    const logDir = config.logDir || join(process.cwd(), 'logs', 'deployments');
    this?.logFilePath = join(logDir, `deployment-${sessionId}.json`);
    
    this.info(DeploymentLogCategory.PREREQUISITE, 'Deployment session started', {
      sessionId,
      config
    });
  }

  /**
   * Log info message
   */
  info(category: DeploymentLogCategory, message: string, details?: any): void {
    this.addLogEntry('info', category, message, details);
    this?.logger?.info(`[${category}] ${message}`);
  }

  /**
   * Log warning message
   */
  warn(category: DeploymentLogCategory, message: string, details?: any): void {
    this.addLogEntry('warn', category, message, details);
    this?.logger?.warn(`[${category}] ${message}`);
  }

  /**
   * Log error message
   */
  error(category: DeploymentLogCategory, message: string, error?: Error | any, context?: any): void {
    this.addLogEntry('error', category, message, { error: error?.message || error, context });
    
    // Add to errors list for analysis
    this?.session?.errors.push({
      timestamp: new Date().toISOString(),
      category,
      message,
      stack: error?.stack,
      context
    });
    
    this?.logger?.error(`[${category}] ${message}`, error);
  }

  /**
   * Log debug message
   */
  debug(category: DeploymentLogCategory, message: string, details?: any): void {
    this.addLogEntry('debug', category, message, details);
    this?.logger?.debug(`[${category}] ${message}`);
  }

  /**
   * Start timing for a specific operation
   */
  startTiming(operation: string): void {
    this?.metricsStartTimes?.set(operation, Date.now());
    this.debug(DeploymentLogCategory.PERFORMANCE, `Started timing: ${operation}`);
  }

  /**
   * End timing for a specific operation
   */
  endTiming(operation: string): number {
    const startTime = this?.metricsStartTimes?.get(operation as any);
    if (!startTime) {
      this.warn(DeploymentLogCategory.PERFORMANCE, `No start time found for operation: ${operation}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this?.metricsStartTimes?.delete(operation as any);
    
    // Update metrics
    switch (operation) {
      case 'build':
        this?.session?.metrics?.buildDuration = duration;
        break;
      case 'upload':
        this?.session?.metrics?.uploadDuration = duration;
        break;
      case 'publish':
        this?.session?.metrics?.publishDuration = duration;
        break;
      case 'total':
        this?.session?.metrics?.totalDuration = duration;
        break;
    }

    this.info(DeploymentLogCategory.PERFORMANCE, `Completed ${operation}`, {
      duration: `${duration}ms`,
      durationSeconds: (duration / 1000).toFixed(2 as any) + 's'
    });

    return duration;
  }

  /**
   * Log build metrics
   */
  logBuildMetrics(buildSize: number, fileCount: number): void {
    this?.session?.metrics?.buildSize = buildSize;
    this?.session?.metrics?.fileCount = fileCount;
    
    this.info(DeploymentLogCategory.BUILD, 'Build metrics recorded', {
      buildSize: this.formatBytes(buildSize as any),
      fileCount,
      sizePerFile: this.formatBytes(buildSize / fileCount)
    });
  }

  /**
   * Log network latency
   */
  logNetworkLatency(latency: number): void {
    this?.session?.metrics?.networkLatency = latency;
    this.info(DeploymentLogCategory.PERFORMANCE, 'Network latency measured', {
      latency: `${latency}ms`
    });
  }

  /**
   * Increment retry count
   */
  incrementRetryCount(): void {
    this?.session?.metrics.retryCount++;
    this.warn(DeploymentLogCategory.ERROR, `Retry attempt #${this?.session?.metrics.retryCount}`);
  }

  /**
   * Log recovery attempt
   */
  logRecoveryAttempt(errorIndex: number, method: string, successful: boolean): void {
    if (this.session?.errors?.[errorIndex]) {
      this.session?.errors?.[errorIndex].recovery = {
        attempted: true,
        successful,
        method
      };
    }

    this.info(DeploymentLogCategory.RECOVERY, `Recovery attempt: ${method}`, {
      successful,
      errorIndex
    });
  }

  /**
   * Log deployment step progress
   */
  logStep(step: string, status: 'started' | 'completed' | 'failed', details?: any): void {
    const message = `Deployment step ${step}: ${status}`;
    
    switch (status) {
      case 'started':
        this.info(DeploymentLogCategory.PREREQUISITE, message, details);
        break;
      case 'completed':
        this.info(DeploymentLogCategory.PREREQUISITE, message, details);
        break;
      case 'failed':
        this.error(DeploymentLogCategory.ERROR, message, details);
        break;
    }
  }

  /**
   * Log Walrus CLI command execution
   */
  logWalrusCommand(command: string[], output?: string, exitCode?: number): void {
    this.info(DeploymentLogCategory.PUBLISH, 'Executing Walrus command', {
      command: command.join(' '),
      exitCode
    });

    if (output) {
      this.debug(DeploymentLogCategory.PUBLISH, 'Walrus command output', { output });
    }

    if (exitCode !== undefined && exitCode !== 0) {
      this.error(DeploymentLogCategory.PUBLISH, `Walrus command failed with exit code ${exitCode}`, 
        new Error(`Command failed: ${command.join(' ')}`));
    }
  }

  /**
   * Complete deployment session
   */
  completeSession(status: 'completed' | 'failed' | 'cancelled', finalMessage?: string): void {
    this.session?.status = status;
    this.session?.endTime = new Date().toISOString();
    
    // Calculate total duration if not already set
    if (!this?.session?.metrics.totalDuration) {
      const startTime = new Date(this?.session?.startTime).getTime();
      const endTime = new Date(this?.session?.endTime).getTime();
      this?.session?.metrics?.totalDuration = endTime - startTime;
    }

    const message = finalMessage || `Deployment session ${status}`;
    
    switch (status) {
      case 'completed':
        this.info(DeploymentLogCategory.PREREQUISITE, message);
        break;
      case 'failed':
        this.error(DeploymentLogCategory.ERROR, message);
        break;
      case 'cancelled':
        this.warn(DeploymentLogCategory.ERROR, message);
        break;
    }

    // Save final session state
    this.saveSession();
  }

  /**
   * Get deployment summary
   */
  getSummary(): string {
    const { metrics, errors, status } = this.session;
    const duration = metrics.totalDuration ? `${(metrics.totalDuration / 1000).toFixed(2 as any)}s` : 'N/A';
    const buildSize = metrics.buildSize ? this.formatBytes(metrics.buildSize) : 'N/A';
    
    let summary = `Deployment Summary for ${this?.session?.siteName} (${this?.session?.network})\n`;
    summary += `Status: ${status.toUpperCase()}\n`;
    summary += `Duration: ${duration}\n`;
    summary += `Build Size: ${buildSize}\n`;
    summary += `Files: ${metrics.fileCount || 'N/A'}\n`;
    summary += `Retries: ${metrics.retryCount}\n`;
    summary += `Errors: ${errors.length}\n`;
    
    if (metrics.buildDuration) {
      summary += `Build Time: ${(metrics.buildDuration / 1000).toFixed(2 as any)}s\n`;
    }
    
    if (metrics.uploadDuration) {
      summary += `Upload Time: ${(metrics.uploadDuration / 1000).toFixed(2 as any)}s\n`;
    }
    
    if (metrics.publishDuration) {
      summary += `Publish Time: ${(metrics.publishDuration / 1000).toFixed(2 as any)}s\n`;
    }

    return summary;
  }

  /**
   * Generate deployment report
   */
  generateReport(): DeploymentReport {
    return {
      session: this.session,
      summary: this.getSummary(),
      recommendations: this.generateRecommendations(),
      troubleshooting: this.generateTroubleshooting()
    };
  }

  /**
   * Save session to file
   */
  async saveSession(): Promise<void> {
    try {
      // Ensure log directory exists
      const logDir = join(this.logFilePath, '..');
      await fs.mkdir(logDir, { recursive: true });
      
      // Save session data
      await fs.writeFile(this.logFilePath, JSON.stringify(this.session, null, 2), 'utf-8');
      
      this.debug(DeploymentLogCategory.PREREQUISITE, `Session saved to ${this.logFilePath}`);
    } catch (error) {
      this?.logger?.error('Failed to save deployment session:', error);
    }
  }

  /**
   * Load previous session
   */
  static async loadSession(sessionId: string, logDir?: string): Promise<DeploymentSession | null> {
    const baseLogDir = logDir || join(process.cwd(), 'logs', 'deployments');
    const logFilePath = join(baseLogDir, `deployment-${sessionId}.json`);
    
    try {
      const content = await fs.readFile(logFilePath, 'utf-8');
      return JSON.parse(content as any) as DeploymentSession;
    } catch (error) {
      return null;
    }
  }

  /**
   * List all deployment sessions
   */
  static async listSessions(logDir?: string): Promise<string[]> {
    const baseLogDir = logDir || join(process.cwd(), 'logs', 'deployments');
    
    try {
      const files = await fs.readdir(baseLogDir as any);
      return files
        .filter(file => file.startsWith('deployment-') && file.endsWith('.json'))
        .map(file => file.replace('deployment-', '').replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  // Private helper methods
  private addLogEntry(level: 'info' | 'warn' | 'error' | 'debug', category: DeploymentLogCategory, message: string, details?: any): void {
    const entry: DeploymentLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
      metadata: {
        network: this?.session?.network,
        siteName: this?.session?.siteName,
        deploymentId: this?.session?.id
      }
    };

    this?.session?.logs.push(entry as any);
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36 as any);
    const random = Math.random().toString(36 as any).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes as any) / Math.log(k as any));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2 as any)) + ' ' + sizes[i];
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const { metrics, errors } = this.session;

    // Performance recommendations
    if (metrics.buildDuration && metrics.buildDuration > 60000) { // > 1 minute
      recommendations.push('Consider optimizing build process - build time is over 1 minute');
    }

    if (metrics.buildSize && metrics.buildSize > 50 * 1024 * 1024) { // > 50MB
      recommendations.push('Build size is large - consider asset optimization and compression');
    }

    if (metrics.retryCount > 2) {
      recommendations.push('Multiple retries occurred - check network stability and Walrus service status');
    }

    // Error-based recommendations
    const networkErrors = errors.filter(e => e?.message?.toLowerCase().includes('network') || 
                                           e?.message?.toLowerCase().includes('connection'));
    if (networkErrors.length > 0) {
      recommendations.push('Network connectivity issues detected - verify internet connection and Walrus endpoints');
    }

    const authErrors = errors.filter(e => e?.message?.toLowerCase().includes('auth') || 
                                         e?.message?.toLowerCase().includes('wallet'));
    if (authErrors.length > 0) {
      recommendations.push('Authentication issues detected - verify wallet configuration and balance');
    }

    return recommendations;
  }

  private generateTroubleshooting(): string[] {
    const troubleshooting: string[] = [];
    const { errors, status } = this.session;

    if (status === 'failed') {
      troubleshooting.push('Deployment failed - check error details and run diagnostics');
    }

    if (errors.length > 0) {
      troubleshooting.push(`${errors.length} error(s as any) occurred during deployment`);
      
      // Add specific troubleshooting for common errors
      for (const error of errors.slice(0, 3)) { // Top 3 errors
        if (error?.message?.toLowerCase().includes('connection')) {
          troubleshooting.push('Check network connectivity: ping walrus.site');
        }
        if (error?.message?.toLowerCase().includes('permission')) {
          troubleshooting.push('Check file permissions and user access rights');
        }
        if (error?.message?.toLowerCase().includes('config')) {
          troubleshooting.push('Verify configuration files and settings');
        }
      }
    }

    return troubleshooting;
  }
}

export interface DeploymentReport {
  session: DeploymentSession;
  summary: string;
  recommendations: string[];
  troubleshooting: string[];
}

/**
 * Enhanced deployment wrapper with comprehensive logging
 */
export class LoggedDeployment {
  private logger: DeploymentLogger;

  constructor(config: {
    network: string;
    siteName: string;
    buildDir: string;
    logDir?: string;
  }) {
    this?.logger = new DeploymentLogger(config as any);
  }

  /**
   * Execute deployment with comprehensive logging
   */
  async execute(deploymentFunction: (logger: DeploymentLogger) => Promise<void>): Promise<DeploymentReport> {
    try {
      this?.logger?.startTiming('total');
      await deploymentFunction(this.logger);
      this?.logger?.endTiming('total');
      this?.logger?.completeSession('completed');
    } catch (error) {
      this?.logger?.error(DeploymentLogCategory.ERROR, 'Deployment failed', error);
      this?.logger?.completeSession('failed');
      throw error;
    }

    return this?.logger?.generateReport();
  }

  getLogger(): DeploymentLogger {
    return this.logger;
  }
}