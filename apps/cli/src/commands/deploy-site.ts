/**
 * Deploy Walrus Sites Command with Recovery Support
 * 
 * Provides comprehensive deployment capabilities with automatic recovery,
 * resumption, and rollback features for failed deployments.
 */

import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { CLIError } from '../types/errors/consolidated';
import { Logger } from '../utils/Logger';
import { WalrusSitesDeploymentService } from '../services/deployment/WalrusSitesDeploymentService';
import { WalrusClient } from '../../packages/walrus-client/src/client/WalrusClient';

const logger = new Logger('DeploySite');

export default class DeploySiteCommand extends BaseCommand {
  static description = `Deploy static sites to Walrus Sites with recovery support

Deploy your static website to Walrus Sites with comprehensive failure recovery,
automatic resumption, and rollback capabilities. The command handles network
interruptions, partial uploads, and blockchain transaction failures gracefully.

RECOVERY FEATURES:
• Automatic state tracking and checkpointing
• Resume interrupted deployments
• Rollback to previous versions
• Cleanup failed deployments
• Retry failed operations

The deployment process includes:
1. Build validation and prerequisite checks
2. File upload to Walrus storage with progress tracking
3. Site manifest creation and blockchain registration
4. Final site activation and URL generation

Failed deployments can be resumed using the --resume flag with the deployment ID.`;

  static usage = 'deploy-site [BUILD_DIRECTORY]';

  static examples = [
    '<%= config.bin %> deploy-site out/ --site-name my-app --network testnet',
    '<%= config.bin %> deploy-site dist/ --site-name production-app --network mainnet',
    '<%= config.bin %> deploy-site --resume deploy_1640995200000_a1b2',
    '<%= config.bin %> deploy-site --list-deployments',
    '<%= config.bin %> deploy-site --rollback deploy_1640995200000_a1b2',
    '<%= config.bin %> deploy-site --cleanup-old 7',
  ];

  static args = {
    buildDirectory: Args.directory({
      description: 'Directory containing the built static files to deploy',
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.flags,
    'site-name': Flags.string({
      char: 's',
      description: 'Name for the Walrus site',
      required: false,
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to deploy to',
      options: ['testnet', 'mainnet'],
      default: 'testnet',
    }),
    epochs: Flags.integer({
      description: 'Number of storage epochs',
      default: 5,
      min: 1,
      max: 100,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force deployment even if validation warnings exist',
      default: false,
    }),
    'max-retries': Flags.integer({
      description: 'Maximum number of retries for failed operations',
      default: 3,
      min: 1,
      max: 10,
    }),
    'timeout': Flags.integer({
      description: 'Deployment timeout in seconds',
      default: 300,
      min: 60,
      max: 1800,
    }),
    'no-recovery': Flags.boolean({
      description: 'Disable recovery features (not recommended)',
      default: false,
    }),
    'no-cleanup': Flags.boolean({
      description: 'Keep deployment state after failure',
      default: false,
    }),
    'skip-validation': Flags.boolean({
      description: 'Skip build validation checks',
      default: false,
    }),
    // Recovery and management flags
    resume: Flags.string({
      description: 'Resume a failed deployment by deployment ID',
      exclusive: ['buildDirectory', 'site-name', 'list-deployments', 'rollback', 'cleanup-old'],
    }),
    rollback: Flags.string({
      description: 'Rollback a deployment to previous version',
      exclusive: ['buildDirectory', 'site-name', 'resume', 'list-deployments', 'cleanup-old'],
    }),
    cancel: Flags.string({
      description: 'Cancel an active deployment',
      exclusive: ['buildDirectory', 'site-name', 'resume', 'rollback', 'list-deployments', 'cleanup-old'],
    }),
    'list-deployments': Flags.boolean({
      char: 'l',
      description: 'List all deployments (active and recent)',
      exclusive: ['buildDirectory', 'site-name', 'resume', 'rollback', 'cancel', 'cleanup-old'],
    }),
    'deployment-status': Flags.string({
      description: 'Get detailed status of a deployment',
      exclusive: ['buildDirectory', 'site-name', 'resume', 'rollback', 'cancel', 'list-deployments', 'cleanup-old'],
    }),
    'cleanup-old': Flags.integer({
      description: 'Clean up deployments older than specified days',
      exclusive: ['buildDirectory', 'site-name', 'resume', 'rollback', 'cancel', 'list-deployments', 'deployment-status'],
      min: 1,
      max: 365,
    }),
    progress: Flags.boolean({
      description: 'Show live progress updates during deployment',
      default: true,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed deployment information',
      default: false,
    }),
  };

  private deploymentService!: WalrusSitesDeploymentService;
  private progressInterval?: NodeJS.Timeout;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DeploySiteCommand);

    // Initialize deployment service
    await this.initializeDeploymentService(flags.network as 'testnet' | 'mainnet');

    try {
      // Handle management commands first
      if (flags?.["list-deployments"]) {
        await this.listDeployments();
        return;
      }

      if (flags?.["deployment-status"]) {
        await this.showDeploymentStatus(flags?.["deployment-status"]);
        return;
      }

      if (flags?.["cleanup-old"]) {
        await this.cleanupOldDeployments(flags?.["cleanup-old"]);
        return;
      }

      if (flags.resume) {
        await this.resumeDeployment(flags.resume, flags);
        return;
      }

      if (flags.rollback) {
        await this.rollbackDeployment(flags.rollback);
        return;
      }

      if (flags.cancel) {
        await this.cancelDeployment(flags.cancel);
        return;
      }

      // Main deployment flow
      await this.executeDeployment(args, flags);

    } catch (error) {
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
      }

      if (error instanceof CLIError) {
        throw error;
      }

      throw new CLIError(
        `Deployment failed: ${error instanceof Error ? error.message : String(error)}`,
        'DEPLOYMENT_FAILED'
      );
    }
  }

  private async initializeDeploymentService(network: 'testnet' | 'mainnet'): Promise<void> {
    const walrusClient = new WalrusClient({ network });
    await walrusClient.init();

    this?.deploymentService = new WalrusSitesDeploymentService(
      walrusClient,
      process?.env?.SITE_BUILDER_PATH || 'site-builder'
    );

    logger.debug('Deployment service initialized', { network });
  }

  private async executeDeployment(
    args: { buildDirectory?: string },
    flags: Record<string, any>
  ): Promise<void> {
    // Validate required parameters
    if (!args.buildDirectory) {
      throw new CLIError(
        'Build directory is required for new deployments',
        'MISSING_BUILD_DIRECTORY'
      );
    }

    if (!flags?.["site-name"]) {
      throw new CLIError(
        'Site name is required for new deployments. Use --site-name flag.',
        'MISSING_SITE_NAME'
      );
    }

    const buildDirectory = path.resolve(args.buildDirectory);

    this.log(chalk.blue('\n🚀 Starting Walrus Sites Deployment'));
    this.log(chalk.blue('━'.repeat(50)));
    this.log(chalk.cyan(`📁 Build Directory: ${chalk.bold(buildDirectory)}`));
    this.log(chalk.cyan(`🏷️  Site Name:       ${chalk.bold(flags?.["site-name"])}`));
    this.log(chalk.cyan(`🌐 Network:         ${chalk.bold(flags.network)}`));
    this.log(chalk.cyan(`⏱️  Epochs:          ${chalk.bold(flags.epochs)}`));
    this.log(chalk.blue('━'.repeat(50)));

    // Warn for mainnet deployment
    if (flags?.network === 'mainnet') {
      this.log(chalk.yellow('\n⚠️  WARNING: Deploying to MAINNET'));
      this.log(chalk.yellow('   This will use real WAL tokens and cannot be undone.'));
      this.log(chalk.dim('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n'));
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const deploymentOptions = {
      siteName: flags?.["site-name"],
      network: flags.network,
      buildDirectory,
      force: flags.force,
      skipValidation: flags?.["skip-validation"],
      maxRetries: flags?.["max-retries"],
      timeoutMs: flags.timeout * 1000,
      enableRecovery: !flags?.["no-recovery"],
      cleanupOnFailure: !flags?.["no-cleanup"],
      epochs: flags.epochs,
    };

    const result = await this?.deploymentService?.deploy(deploymentOptions);

    if (flags.progress) {
      this.startProgressTracking(result.deploymentId);
    }

    if (result.success) {
      this.displaySuccessResult(result);
    } else {
      this.displayFailureResult(result);
    }
  }

  private async resumeDeployment(deploymentId: string, flags: Record<string, any>): Promise<void> {
    this.log(chalk.blue(`\n🔄 Resuming Deployment: ${deploymentId}`));
    this.log(chalk.blue('━'.repeat(50)));

    try {
      const result = await this?.deploymentService?.resumeDeployment(deploymentId);
      
      if (flags.progress) {
        this.startProgressTracking(deploymentId);
      }

      if (result.success) {
        this.log(chalk.green('\n✅ Deployment resumed and completed successfully!'));
        this.displaySuccessResult(result);
      } else {
        this.log(chalk.red('\n❌ Deployment resume failed'));
        this.displayFailureResult(result);
      }
    } catch (error) {
      this.log(chalk.red(`\n❌ Failed to resume deployment: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async rollbackDeployment(deploymentId: string): Promise<void> {
    this.log(chalk.yellow(`\n↩️  Rolling back Deployment: ${deploymentId}`));
    this.log(chalk.yellow('━'.repeat(50)));

    const success = await this?.deploymentService?.rollbackDeployment(deploymentId);
    
    if (success) {
      this.log(chalk.green('✅ Deployment rolled back successfully!'));
    } else {
      this.log(chalk.red('❌ Rollback failed or not available'));
    }
  }

  private async cancelDeployment(deploymentId: string): Promise<void> {
    this.log(chalk.yellow(`\n🛑 Cancelling Deployment: ${deploymentId}`));
    
    await this?.deploymentService?.cancelDeployment(deploymentId, true);
    this.log(chalk.yellow('✅ Deployment cancelled'));
  }

  private async listDeployments(): Promise<void> {
    this.log(chalk.blue('\n📋 Active and Recent Deployments'));
    this.log(chalk.blue('━'.repeat(60)));

    const deployments = this?.deploymentService?.listDeployments();
    
    if (deployments?.length === 0) {
      this.log(chalk.dim('   No deployments found'));
      return;
    }

    for (const deployment of deployments) {
      const statusColor = this.getStatusColor(deployment.status);
      const progressText = deployment.progress !== undefined 
        ? ` (${deployment.progress}%)` 
        : '';
      
      this.log(`${statusColor(deployment?.status?.toUpperCase().padEnd(12))} ${deployment.deploymentId}`);
      this.log(`   Site: ${chalk.cyan(deployment.siteName)}`);
      this.log(`   Started: ${chalk.dim(new Date(deployment.startTime).toLocaleString())}${progressText}`);
      this.log('');
    }
  }

  private async showDeploymentStatus(deploymentId: string): Promise<void> {
    this.log(chalk.blue(`\n📊 Deployment Status: ${deploymentId}`));
    this.log(chalk.blue('━'.repeat(60)));

    const details = this?.deploymentService?.getDeploymentDetails(deploymentId);
    const progress = this?.deploymentService?.getDeploymentProgress(deploymentId);

    if (!details) {
      this.log(chalk.red('Deployment not found'));
      return;
    }

    // Basic information
    this.log(`${chalk.cyan('Site Name:')} ${details.siteName}`);
    this.log(`${chalk.cyan('Network:')} ${details.network}`);
    this.log(`${chalk.cyan('Status:')} ${this.getStatusColor(details.status)(details?.status?.toUpperCase())}`);
    this.log(`${chalk.cyan('Started:')} ${new Date(details.startTime).toLocaleString()}`);
    this.log(`${chalk.cyan('Last Update:')} ${new Date(details.lastUpdate).toLocaleString()}`);

    // Progress information
    if (progress) {
      this.log(`${chalk.cyan('Progress:')} ${progress.progress}% (${progress.uploadedFiles}/${progress.totalFiles} files)`);
      if (progress.currentFile) {
        this.log(`${chalk.cyan('Current File:')} ${progress.currentFile}`);
      }
      if (progress.estimatedTimeRemaining) {
        this.log(`${chalk.cyan('ETA:')} ${Math.round(progress.estimatedTimeRemaining / 60)} minutes`);
      }
    }

    // Recovery information
    this.log('\n' + chalk.blue('Recovery Options:'));
    this.log(`${chalk.cyan('Can Resume:')} ${details?.recovery?.canResume ? '✅' : '❌'}`);
    this.log(`${chalk.cyan('Rollback Available:')} ${details?.recovery?.rollbackAvailable ? '✅' : '❌'}`);
    this.log(`${chalk.cyan('Cleanup Required:')} ${details?.recovery?.cleanupRequired ? '⚠️' : '✅'}`);

    // Error information
    if (details?.errors?.length > 0) {
      this.log('\n' + chalk.red('Recent Errors:'));
      for (const error of details?.errors?.slice(-3)) {
        this.log(`${chalk.red('•')} ${error.message} (${error.type})`);
        this.log(`  ${chalk.dim(new Date(error.timestamp).toLocaleString())}`);
      }
    }

    // Site information
    if (details?.metadata?.siteId) {
      this.log('\n' + chalk.blue('Site Information:'));
      this.log(`${chalk.cyan('Site ID:')} ${details?.metadata?.siteId}`);
      if (details?.metadata?.manifestBlobId) {
        this.log(`${chalk.cyan('Manifest Blob ID:')} ${details?.metadata?.manifestBlobId}`);
      }
      this.log(`${chalk.cyan('Total Size:')} ${this.formatBytes(details?.metadata?.totalSize)}`);
      this.log(`${chalk.cyan('Estimated Cost:')} ${details?.metadata?.estimatedCost} WAL`);
    }
  }

  private async cleanupOldDeployments(days: number): Promise<void> {
    this.log(chalk.blue(`\n🧹 Cleaning up deployments older than ${days} days`));
    
    const cleaned = await this?.deploymentService?.cleanupOldDeployments(days);
    this.log(chalk.green(`✅ Cleaned up ${cleaned} old deployments`));
  }

  private startProgressTracking(deploymentId: string): void {
    let lastProgress = -1;
    
    this?.progressInterval = setInterval(() => {
      const progress = this?.deploymentService?.getDeploymentProgress(deploymentId);
      
      if (progress && progress.progress !== lastProgress) {
        lastProgress = progress.progress;
        
        const progressBar = this.createProgressBar(progress.progress);
        const currentFile = progress.currentFile ? ` | ${path.basename(progress.currentFile)}` : '';
        
        process?.stdout?.write(`\r${progressBar} ${progress.progress}% (${progress.uploadedFiles}/${progress.totalFiles})${currentFile}`);
        
        if (progress.progress >= 100) {
          clearInterval(this.progressInterval!);
          process?.stdout?.write('\n');
        }
      }
    }, 1000);
  }

  private createProgressBar(progress: number, width: number = 30): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  private displaySuccessResult(result: any): void {
    this.log(chalk.green('\n✅ Deployment Completed Successfully!'));
    this.log(chalk.green('━'.repeat(50)));
    
    if (result.siteUrl) {
      this.log(chalk.cyan(`🌐 Site URL: ${chalk?.bold?.underline(result.siteUrl)}`));
    }
    
    if (result.siteId) {
      this.log(chalk.cyan(`🆔 Site ID: ${result.siteId}`));
    }
    
    this.log(chalk.cyan(`📁 Total Files: ${result.totalFiles}`));
    this.log(chalk.cyan(`📦 Total Size: ${this.formatBytes(result.totalSize)}`));
    this.log(chalk.cyan(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`));
    
    this.log(chalk.blue('\n💡 Next Steps:'));
    this.log(chalk.dim('   • Your site is now live and accessible'));
    this.log(chalk.dim('   • Use the URL above to view your deployed site'));
    this.log(chalk.dim('   • Updates can be deployed using the same command'));
  }

  private displayFailureResult(result: any): void {
    this.log(chalk.red('\n❌ Deployment Failed'));
    this.log(chalk.red('━'.repeat(50)));
    
    this.log(chalk.cyan(`📁 Files Processed: ${result.totalFiles || 0}`));
    this.log(chalk.cyan(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`));
    
    if (result.errors && result?.errors?.length > 0) {
      this.log(chalk.red('\n🚨 Errors:'));
      for (const error of result.errors) {
        this.log(chalk.red(`   • ${error}`));
      }
    }
    
    this.log(chalk.blue('\n💡 Recovery Options:'));
    this.log(chalk.dim(`   • Resume: ${this?.config?.bin} deploy-site --resume ${result.deploymentId}`));
    this.log(chalk.dim(`   • Status: ${this?.config?.bin} deploy-site --deployment-status ${result.deploymentId}`));
    this.log(chalk.dim(`   • Cancel: ${this?.config?.bin} deploy-site --cancel ${result.deploymentId}`));
  }

  private getStatusColor(status: string): (text: string) => string {
    switch (status.toLowerCase()) {
      case 'completed': return chalk.green;
      case 'failed': return chalk.red;
      case 'uploading': 
      case 'processing': return chalk.yellow;
      case 'pending': return chalk.blue;
      default: return chalk.gray;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}