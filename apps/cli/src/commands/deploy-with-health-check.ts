/**
 * Deploy Walrus Site with Network Health Checking
 * 
 * Enhanced deployment command that uses the comprehensive network health
 * checking system to ensure reliable deployments with automatic retry,
 * fallback, and monitoring capabilities.
 */

import { Command, Flags } from '@oclif/core';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { BaseCommand } from '../base-command';
import { WalrusDeploymentHealthManager, type DeploymentHealthConfig } from '../utils/WalrusDeploymentHealthManager';
import { type DeploymentContext } from '../utils/PreDeploymentValidator';
import { Logger } from '../utils/Logger';
import { ValidationError, NetworkError } from '../types/errors/consolidated';

export default class DeployWithHealthCheck extends BaseCommand {
  static override description = 'Deploy Walrus site with comprehensive network health checking and automatic remediation';

  static override examples = [
    '$ waltodo deploy-with-health-check ./my-site --network testnet',
    '$ waltodo deploy-with-health-check ./my-site --network testnet --config ./walrus-config.json',
    '$ waltodo deploy-with-health-check ./my-site --network testnet --skip-validation --force',
    '$ waltodo deploy-with-health-check ./my-site --network mainnet --strict --monitor',
  ];

  static override flags = {
    ...BaseCommand.flags,
    
    // Network configuration
    network: Flags.string({
      char: 'n',
      description: 'Network to deploy to',
      options: ['mainnet', 'testnet', 'devnet', 'localnet'],
      default: 'testnet',
    }),
    
    config: Flags.string({
      char: 'c',
      description: 'Path to configuration file',
      required: false,
    }),

    // Health checking options
    'skip-validation': Flags.boolean({
      description: 'Skip pre-deployment validation',
      default: false,
    }),

    'skip-monitoring': Flags.boolean({
      description: 'Skip network monitoring during deployment',
      default: false,
    }),

    'disable-failover': Flags.boolean({
      description: 'Disable automatic endpoint failover',
      default: false,
    }),

    strict: Flags.boolean({
      description: 'Enable strict validation mode',
      default: false,
    }),

    // Deployment options
    force: Flags.boolean({
      char: 'f',
      description: 'Force deployment even with warnings',
      default: false,
    }),

    'dry-run': Flags.boolean({
      description: 'Validate and show deployment plan without executing',
      default: false,
    }),

    // Retry configuration
    'max-retries': Flags.integer({
      description: 'Maximum number of retry attempts',
      default: 5,
    }),

    'retry-delay': Flags.integer({
      description: 'Initial retry delay in milliseconds',
      default: 1000,
    }),

    timeout: Flags.integer({
      description: 'Operation timeout in milliseconds',
      default: 30000,
    }),

    // Output options
    verbose: Flags.boolean({
      char: 'v',
      description: 'Enable verbose output',
      default: false,
    }),

    monitor: Flags.boolean({
      char: 'm',
      description: 'Enable real-time monitoring display',
      default: false,
    }),

    'output-report': Flags.string({
      description: 'Save diagnostic report to file',
      required: false,
    }),
  };

  static override args = [
    {
      name: 'sitePath',
      description: 'Path to the site directory to deploy',
      required: true,
    },
  ];

  private healthManager?: WalrusDeploymentHealthManager;
  private readonly logger = new Logger('DeployWithHealthCheck');

  async run(): Promise<void> {
    const { args, flags } = await this.parse();
    const { sitePath } = args;

    // Validate site path
    if (!existsSync(sitePath)) {
      throw new ValidationError(`Site path does not exist: ${sitePath}`);
    }

    try {
      // Initialize health manager
      await this.initializeHealthManager(flags);

      // Create deployment context
      const context: DeploymentContext = {
        network: flags.network as 'mainnet' | 'testnet' | 'devnet' | 'localnet',
        sitePath,
        configPath: flags.config,
        force: flags.force,
      };

      // Perform pre-deployment validation if enabled
      if (!flags?.["skip-validation"]) {
        await this.performValidation(context, flags);
      }

      // Start monitoring if enabled
      if (!flags?.["skip-monitoring"] && flags.monitor) {
        await this.startMonitoring();
      }

      // Perform deployment
      if (!flags?.["dry-run"]) {
        await this.performDeployment(context, flags);
      } else {
        this.log('✓ Dry run completed successfully - deployment would proceed');
      }

      // Generate final report
      await this.generateFinalReport(flags);

    } catch (error) {
      await this.handleDeploymentError(error);
    } finally {
      // Cleanup resources
      if (this.healthManager) {
        this?.healthManager?.destroy();
      }
    }
  }

  /**
   * Initialize health manager with configuration
   */
  private async initializeHealthManager(flags: any): Promise<void> {
    this.log('🔧 Initializing network health management...');

    // Create configuration based on network and flags
    const config: Partial<DeploymentHealthConfig> = {
      network: flags.network,
      enableMonitoring: !flags?.["skip-monitoring"],
      enableAutomaticFailover: !flags?.["disable-failover"],
      enablePreValidation: !flags?.["skip-validation"],
      strictValidation: flags.strict,
      monitoringInterval: 30000,
      retryConfig: {
        maxRetries: flags?.["max-retries"],
        initialDelay: flags?.["retry-delay"],
        maxDelay: Math.max(flags?.["retry-delay"] * 16, 30000),
        timeoutMs: flags.timeout,
      },
    };

    // Use factory method for common configurations
    if (flags?.network === 'testnet') {
      this?.healthManager = WalrusDeploymentHealthManager.forTestnet(config);
    } else if (flags?.network === 'mainnet') {
      this?.healthManager = WalrusDeploymentHealthManager.forMainnet(config);
    } else {
      throw new ValidationError(`Network ${flags.network} not supported by health manager`);
    }

    // Setup event listeners
    this.setupEventListeners(flags);

    // Initialize components
    await this?.healthManager?.initialize();

    this.log('✓ Health management initialized');
  }

  /**
   * Setup event listeners for health manager
   */
  private setupEventListeners(flags: any): void {
    if (!this.healthManager) return;

    this?.healthManager?.on('status_changed', (status) => {
      if (flags.verbose) {
        this.log(`📊 Status: ${status.phase} | Readiness: ${status.deploymentReadiness}`);
      }
    });

    this?.healthManager?.on('network_event', (event) => {
      const icon = event?.severity === 'error' ? '❌' : event?.severity === 'warning' ? '⚠️' : 'ℹ️';
      this.log(`${icon} ${event.message}`);
      
      if (event.suggestion && flags.verbose) {
        this.log(`   💡 ${event.suggestion}`);
      }
    });

    this?.healthManager?.on('validation_completed', (summary) => {
      this.displayValidationSummary(summary);
    });

    this?.healthManager?.on('monitoring_started', () => {
      if (flags.monitor) {
        this.log('📡 Network monitoring started');
      }
    });

    this?.healthManager?.on('deployment_started', () => {
      this.log('🚀 Starting deployment...');
    });

    this?.healthManager?.on('deployment_completed', (result) => {
      this.displayDeploymentResult(result);
    });
  }

  /**
   * Perform pre-deployment validation
   */
  private async performValidation(context: DeploymentContext, flags: any): Promise<void> {
    this.log('🔍 Performing pre-deployment validation...');

    const validationSummary = await this.healthManager!.validateDeployment(context);

    // Check if deployment should proceed
    if (validationSummary?.overallStatus === 'failed') {
      if (!flags.force) {
        throw new ValidationError(`Deployment validation failed. Use --force to override.`);
      } else {
        this.log('⚠️  Validation failed but continuing due to --force flag');
      }
    } else if (validationSummary?.overallStatus === 'warnings') {
      if (flags.strict && !flags.force) {
        throw new ValidationError(`Deployment has warnings in strict mode. Use --force to override.`);
      } else if (!flags.force) {
        this.log('⚠️  Validation completed with warnings');
      }
    } else {
      this.log('✓ Validation completed successfully');
    }
  }

  /**
   * Start network monitoring
   */
  private async startMonitoring(): Promise<void> {
    this.log('📡 Starting network monitoring...');
    await this.healthManager!.startMonitoring();
  }

  /**
   * Perform the actual deployment with health management
   */
  private async performDeployment(context: DeploymentContext, flags: any): Promise<void> {
    this.log('🚀 Starting deployment with health management...');

    this.healthManager!.startDeployment();

    let deploymentSuccess = false;

    try {
      // Execute deployment with health management
      const result = await this.healthManager!.executeWithHealthManagement(
        async (endpoint) => {
          return this.executeWalrusDeployment(context, endpoint.url, flags);
        },
        'walrus-site-deployment'
      );

      this.log('✓ Deployment completed successfully');
      this.log(`📍 Site URL: ${result.siteUrl}`);
      this.log(`🔗 Site ID: ${result.siteId}`);

      deploymentSuccess = true;

    } catch (error) {
      this?.logger?.error('Deployment failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      deploymentSuccess = false;
      throw error;

    } finally {
      // Complete deployment tracking
      this.healthManager!.completeDeployment(deploymentSuccess);
    }
  }

  /**
   * Execute actual Walrus deployment
   */
  private async executeWalrusDeployment(
    context: DeploymentContext,
    publisherUrl: string,
    flags: any
  ): Promise<{ siteUrl: string; siteId: string }> {
    this.log(`📤 Deploying to Walrus publisher: ${publisherUrl}`);

    try {
      // Construct walrus site publish command
      const command = [
        'walrus',
        'site',
        'publish',
        '--publisher',
        publisherUrl,
        '--network',
        context.network,
        context.sitePath,
      ];

      if (flags.verbose) {
        this.log(`🔧 Executing: ${command.join(' ')}`);
      }

      // Execute deployment
      const output = execSync(command.join(' '), {
        encoding: 'utf8',
        timeout: flags.timeout,
      });

      // Parse output to extract site information
      const siteId = this.extractSiteId(output);
      const siteUrl = this.constructSiteUrl(siteId, context.network);

      return { siteUrl, siteId };

    } catch (error) {
      throw new NetworkError(
        `Walrus deployment failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Extract site ID from walrus command output
   */
  private extractSiteId(output: string): string {
    // Look for site ID in output (format may vary)
    const patterns = [
      /Site ID:\s*([a-zA-Z0-9]+)/,
      /site_id:\s*"([^"]+)"/,
      /SiteId\(([^)]+)\)/,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    throw new ValidationError('Could not extract site ID from deployment output');
  }

  /**
   * Construct site URL from site ID and network
   */
  private constructSiteUrl(siteId: string, network: string): string {
    switch (network) {
      case 'mainnet':
        return `https://${siteId}.walrus.site`;
      case 'testnet':
        return `https://${siteId}.walrus-testnet.site`;
      default:
        return `https://${siteId}.walrus-${network}.site`;
    }
  }

  /**
   * Display validation summary
   */
  private displayValidationSummary(summary: any): void {
    this.log('\n📋 Validation Summary:');
    this.log(`   Status: ${summary.overallStatus}`);
    this.log(`   Score: ${summary.readinessScore}/100`);
    this.log(`   Checks: ${summary.passedChecks}/${summary.totalChecks} passed`);
    
    if (summary.warnings > 0) {
      this.log(`   Warnings: ${summary.warnings}`);
    }
    
    if (summary.errors > 0) {
      this.log(`   Errors: ${summary.errors}`);
    }

    if (summary.estimatedDeploymentTime) {
      this.log(`   Estimated time: ${Math.round(summary.estimatedDeploymentTime / 1000)}s`);
    }

    // Show critical issues
    const criticalIssues = summary?.results?.filter((r: any) => !r.passed);
    if (criticalIssues.length > 0) {
      this.log('\n❌ Critical Issues:');
      for (const issue of criticalIssues.slice(0, 5)) {
        this.log(`   • ${issue.message}`);
        if (issue.suggestion) {
          this.log(`     💡 ${issue.suggestion}`);
        }
      }
    }

    // Show recommendations
    if (summary?.recommendedActions?.length > 0) {
      this.log('\n💡 Recommendations:');
      for (const action of summary?.recommendedActions?.slice(0, 3)) {
        this.log(`   • ${action}`);
      }
    }
  }

  /**
   * Display deployment result
   */
  private displayDeploymentResult(result: any): void {
    this.log('\n📊 Deployment Metrics:');
    this.log(`   Duration: ${Math.round(result.duration / 1000)}s`);
    this.log(`   Requests: ${result?.networkMetrics?.totalRequests}`);
    this.log(`   Error rate: ${(result?.networkMetrics?.errorRate * 100).toFixed(1)}%`);
    this.log(`   Avg response time: ${Math.round(result?.networkMetrics?.averageResponseTime)}ms`);
    this.log(`   Endpoint switches: ${result?.networkMetrics?.endpointSwitches}`);

    if (result?.issues?.length > 0) {
      this.log('\n⚠️  Issues encountered:');
      for (const issue of result?.issues?.slice(0, 5)) {
        const icon = issue?.severity === 'error' ? '❌' : '⚠️';
        this.log(`   ${icon} ${issue.message}`);
      }
    }

    this.log('\n🔗 Final endpoints:');
    this.log(`   Sui RPC: ${result?.finalEndpoints?.sui}`);
    this.log(`   Walrus Publisher: ${result?.finalEndpoints?.walrusPublisher}`);
    this.log(`   Walrus Aggregator: ${result?.finalEndpoints?.walrusAggregator}`);
  }

  /**
   * Generate final diagnostic report
   */
  private async generateFinalReport(flags: any): Promise<void> {
    if (!this.healthManager) return;

    const report = this?.healthManager?.generateDiagnosticReport();
    
    if (flags?.["output-report"] && report) {
      const fs = require('fs');
      fs.writeFileSync(flags?.["output-report"], JSON.stringify(report, null, 2));
      this.log(`📄 Diagnostic report saved to: ${flags?.["output-report"]}`);
    }

    if (flags.verbose && report) {
      this.log('\n📊 Network Health Summary:');
      this.log(`   Overall health: ${report?.networkHealth?.overall.healthy ? 'Healthy' : 'Issues detected'}`);
      this.log(`   Health score: ${report?.networkHealth?.overall.score}/100`);
      this.log(`   Network condition: ${report?.metrics?.networkCondition}`);
      
      if (report?.recommendations?.length > 0) {
        this.log('\n💡 Final Recommendations:');
        for (const rec of report?.recommendations?.slice(0, 3)) {
          this.log(`   • ${rec}`);
        }
      }
    }
  }

  /**
   * Handle deployment errors with context
   */
  private async handleDeploymentError(error: unknown): Promise<void> {
    this?.logger?.error('Deployment failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Generate error diagnostic report
    const report = this.healthManager?.generateDiagnosticReport();
    
    if (error instanceof ValidationError) {
      this.error(`Validation Error: ${error.message}`);
    } else if (error instanceof NetworkError) {
      this.error(`Network Error: ${error.message}`);
      
      if (report) {
        this.log('\n🔍 Network diagnostic information:');
        this.log(`   Network condition: ${report?.metrics?.networkCondition}`);
        this.log(`   Active endpoints: ${report?.metrics?.activeEndpoints}`);
        this.log(`   Failed endpoints: ${report?.metrics?.failedEndpoints}`);
      }
    } else {
      this.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Stop monitoring if it was started
    if (this.healthManager) {
      this?.healthManager?.stopMonitoring();
      this?.healthManager?.completeDeployment(false);
    }

    throw error;
  }
}