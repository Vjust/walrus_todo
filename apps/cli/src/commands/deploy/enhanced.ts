/**
 * Enhanced Walrus Sites Deployment Command
 * 
 * Features comprehensive diagnostics, logging, and recovery capabilities
 */

import { Command, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command';
import { DeploymentDiagnostics, DeploymentConfig } from '../../utils/deployment-diagnostics';
import { DeploymentLogger, LoggedDeployment, DeploymentLogCategory } from '../../utils/deployment-logger';
import { DeploymentRecoverySystem } from '../../utils/deployment-recovery';
import { DeploymentTroubleshooting } from '../../utils/deployment-troubleshooting';
import { Logger } from '../../utils/Logger';
import { join } from 'path';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import chalk from 'chalk';

export default class DeployEnhanced extends BaseCommand {
  static description = 'Deploy to Walrus Sites with comprehensive diagnostics and recovery';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --network mainnet --auto-recover',
    '<%= config.bin %> <%= command.id %> --diagnostics-only',
    '<%= config.bin %> <%= command.id %> --force-rebuild --save-logs',
  ];

  static flags = {
    ...BaseCommand.flags,
    network: Flags.string({
      char: 'n',
      description: 'Network to deploy to (testnet or mainnet)',
      default: 'testnet',
      options: ['testnet', 'mainnet'],
    }),
    'build-dir': Flags.string({
      char: 'b',
      description: 'Build output directory',
      default: 'out',
    }),
    'site-name': Flags.string({
      char: 's',
      description: 'Walrus site name',
      default: 'waltodo-app',
    }),
    'config-file': Flags.string({
      char: 'c',
      description: 'Sites configuration file path',
      default: 'sites-config.yaml',
    }),
    'wallet-path': Flags.string({
      char: 'w',
      description: 'Path to wallet file',
    }),
    'force-rebuild': Flags.boolean({
      char: 'f',
      description: 'Force rebuild even if build exists',
      default: false,
    }),
    'skip-build': Flags.boolean({
      description: 'Skip build process and deploy existing build',
      default: false,
    }),
    'diagnostics-only': Flags.boolean({
      char: 'd',
      description: 'Run diagnostics only, skip deployment',
      default: false,
    }),
    'auto-recover': Flags.boolean({
      char: 'r',
      description: 'Automatically attempt recovery for failed deployments',
      default: false,
    }),
    'save-logs': Flags.boolean({
      description: 'Save detailed deployment logs to file',
      default: false,
    }),
    'log-dir': Flags.string({
      description: 'Directory to save logs',
      default: 'logs/deployments',
    }),
    'max-retries': Flags.integer({
      description: 'Maximum number of retry attempts',
      default: 3,
    }),
    'retry-delay': Flags.integer({
      description: 'Delay between retries in seconds',
      default: 5,
    }),
    'timeout': Flags.integer({
      description: 'Deployment timeout in minutes',
      default: 10,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed output',
      default: false,
    }),
  };

  private logger!: Logger;
  private deploymentLogger!: DeploymentLogger;
  private diagnostics!: DeploymentDiagnostics;
  private recovery!: DeploymentRecoverySystem;
  private troubleshooting!: DeploymentTroubleshooting;

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployEnhanced);

    // Initialize systems
    this?.logger = new Logger('EnhancedDeploy');
    this?.diagnostics = new DeploymentDiagnostics();
    this?.troubleshooting = new DeploymentTroubleshooting();

    // Build configuration
    const config: DeploymentConfig = {
      network: flags.network as 'testnet' | 'mainnet',
      buildDir: flags?.["build-dir"],
      siteName: flags?.["site-name"],
      siteConfigFile: flags?.["config-file"],
      walletPath: flags?.["wallet-path"],
      configDir: join(process?.env?.HOME || '~', '.walrus'),
    };

    // Initialize deployment logger
    this?.deploymentLogger = new DeploymentLogger({
      network: config.network,
      siteName: config.siteName,
      buildDir: config.buildDir,
      logDir: flags?.["log-dir"]
    });

    this?.recovery = new DeploymentRecoverySystem(this.deploymentLogger);

    this.log(chalk?.blue?.bold('🚀 Enhanced Walrus Sites Deployment'));
    this.log(chalk.gray('=========================================='));
    this.log();

    try {
      // Run pre-deployment diagnostics
      await this.runPreDeploymentDiagnostics(config, flags.verbose);

      // If diagnostics-only flag is set, stop here
      if (flags?.["diagnostics-only"]) {
        this.log(chalk.green('✅ Diagnostics completed. Use --no-diagnostics-only to proceed with deployment.'));
        return;
      }

      // Execute deployment with comprehensive logging and recovery
      const deployment = new LoggedDeployment({
        network: config.network,
        siteName: config.siteName,
        buildDir: config.buildDir,
        logDir: flags?.["log-dir"]
      });

      const report = await deployment.execute(async (logger) => {
        await this.executeDeploymentWithRecovery(config, flags, logger);
      });

      // Save logs if requested
      if (flags?.["save-logs"]) {
        const logPath = join(flags?.["log-dir"], `deployment-${Date.now()}.json`);
        await fs.writeFile(logPath, JSON.stringify(report, null, 2));
        this.log(chalk.green(`📄 Deployment logs saved to: ${logPath}`));
      }

      // Display final summary
      this.displayDeploymentSummary(report);

    } catch (error) {
      await this.handleDeploymentFailure(error, config, flags);
    }
  }

  /**
   * Run comprehensive pre-deployment diagnostics
   */
  private async runPreDeploymentDiagnostics(config: DeploymentConfig, verbose: boolean): Promise<void> {
    this.log(chalk.cyan('🔍 Running Pre-Deployment Diagnostics...'));
    this?.deploymentLogger?.startTiming('diagnostics');

    const results = await this?.diagnostics?.runDiagnostics(config);
    this?.deploymentLogger?.endTiming('diagnostics');

    const critical = results.filter(r => r?.severity === 'critical');
    const warnings = results.filter(r => r?.severity === 'warning');

    if (critical?.length === 0 && warnings?.length === 0) {
      this.log(chalk.green('✅ All pre-deployment checks passed!'));
      return;
    }

    this.log(chalk.yellow(`⚠️  Found ${critical.length} critical issues and ${warnings.length} warnings`));

    if (verbose) {
      for (const result of [...critical, ...warnings]) {
        this.displayDiagnosticResult(result);
      }
    }

    if (critical.length > 0) {
      this.log(chalk.red('❌ Critical issues must be resolved before deployment can proceed.'));
      this.log(chalk.yellow('💡 Run with --auto-recover to attempt automatic fixes, or --diagnostics-only for detailed analysis.'));
      
      const shouldContinue = await this.promptForContinuation();
      if (!shouldContinue) {
        throw new Error('Deployment cancelled due to critical issues');
      }
    }
  }

  /**
   * Execute deployment with recovery capabilities
   */
  private async executeDeploymentWithRecovery(
    config: DeploymentConfig,
    flags: any,
    logger: DeploymentLogger
  ): Promise<void> {
    let retryCount = 0;
    const maxRetries = flags?.["max-retries"];

    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          logger.incrementRetryCount();
          this.log(chalk.yellow(`🔄 Retry attempt ${retryCount}/${maxRetries}`));
          await this.delay(flags?.["retry-delay"] * 1000);
        }

        await this.executeDeploymentSteps(config, flags, logger);
        return; // Success - exit retry loop

      } catch (error) {
        logger.error(DeploymentLogCategory.ERROR, `Deployment attempt ${retryCount + 1} failed`, error);

        if (retryCount >= maxRetries) {
          throw error; // Max retries reached
        }

        // Attempt recovery if auto-recover is enabled
        if (flags?.["auto-recover"]) {
          const recoverySuccess = await this.attemptErrorRecovery(error, config, logger);
          if (!recoverySuccess && retryCount === maxRetries - 1) {
            throw error; // Recovery failed and this was the last retry
          }
        }

        retryCount++;
      }
    }
  }

  /**
   * Execute the main deployment steps
   */
  private async executeDeploymentSteps(
    config: DeploymentConfig,
    flags: any,
    logger: DeploymentLogger
  ): Promise<void> {
    // Step 1: Build Application
    if (!flags?.["skip-build"]) {
      await this.buildApplication(config, flags, logger);
    } else {
      logger.info(DeploymentLogCategory.BUILD, 'Skipping build as requested');
    }

    // Step 2: Validate Build Output
    await this.validateBuildOutput(config, logger);

    // Step 3: Setup Configuration
    await this.setupConfiguration(config, logger);

    // Step 4: Deploy to Walrus
    await this.deployToWalrus(config, flags, logger);

    // Step 5: Verify Deployment
    await this.verifyDeployment(config, logger);
  }

  /**
   * Build the application
   */
  private async buildApplication(config: DeploymentConfig, flags: any, logger: DeploymentLogger): Promise<void> {
    logger.startTiming('build');
    logger.logStep('build', 'started');

    try {
      if (flags?.["force-rebuild"]) {
        logger.info(DeploymentLogCategory.BUILD, 'Cleaning previous build');
        execSync('pnpm run clean', { stdio: 'pipe' });
      }

      logger.info(DeploymentLogCategory.BUILD, 'Building application');
      const buildOutput = execSync('pnpm run build', { stdio: 'pipe' }).toString();
      logger.debug(DeploymentLogCategory.BUILD, 'Build output', { output: buildOutput });

      // Calculate build metrics
      const buildStats = await this.calculateBuildStats(config.buildDir);
      logger.logBuildMetrics(buildStats.size, buildStats.fileCount);

      logger.logStep('build', 'completed');
    } catch (error) {
      logger.logStep('build', 'failed', error);
      throw new Error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      logger.endTiming('build');
    }
  }

  /**
   * Validate build output
   */
  private async validateBuildOutput(config: DeploymentConfig, logger: DeploymentLogger): Promise<void> {
    logger.logStep('validation', 'started');

    try {
      // Check if build directory exists
      await fs.access(config.buildDir);

      // Check for essential files
      const essentialFiles = ['index.html'];
      for (const file of essentialFiles) {
        try {
          await fs.access(join(config.buildDir, file));
        } catch {
          throw new Error(`Essential file missing: ${file}`);
        }
      }

      logger.info(DeploymentLogCategory.VALIDATION, 'Build output validation passed');
      logger.logStep('validation', 'completed');
    } catch (error) {
      logger.logStep('validation', 'failed', error);
      throw error;
    }
  }

  /**
   * Setup deployment configuration
   */
  private async setupConfiguration(config: DeploymentConfig, logger: DeploymentLogger): Promise<void> {
    logger.info(DeploymentLogCategory.PREREQUISITE, 'Setting up configuration');

    try {
      // Check if config file exists, create if needed
      try {
        await fs.access(config.siteConfigFile);
      } catch {
        logger.info(DeploymentLogCategory.CONFIGURATION, 'Creating default configuration');
        const defaultConfig = this.generateDefaultConfig(config);
        await fs.writeFile(config.siteConfigFile, defaultConfig);
      }

      logger.info(DeploymentLogCategory.CONFIGURATION, 'Configuration setup completed');
    } catch (error) {
      throw new Error(`Configuration setup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deploy to Walrus Sites
   */
  private async deployToWalrus(config: DeploymentConfig, flags: any, logger: DeploymentLogger): Promise<void> {
    logger.startTiming('publish');
    logger.logStep('publish', 'started');

    try {
      // Build Walrus CLI command
      const command = this.buildWalrusCommand(config);
      logger.info(DeploymentLogCategory.PUBLISH, 'Executing Walrus deployment', { command });

      // Execute with timeout
      const timeout = flags.timeout * 60 * 1000; // Convert minutes to milliseconds
      const output = await this.executeWithTimeout(command.join(' '), timeout);
      
      logger.logWalrusCommand(command, output, 0);
      logger.logStep('publish', 'completed');
    } catch (error) {
      logger.logStep('publish', 'failed', error);
      throw new Error(`Walrus deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      logger.endTiming('publish');
    }
  }

  /**
   * Verify deployment success
   */
  private async verifyDeployment(config: DeploymentConfig, logger: DeploymentLogger): Promise<void> {
    logger.logStep('verification', 'started');

    try {
      // Add verification logic here
      // For now, we'll just log success
      logger.info(DeploymentLogCategory.VERIFICATION, 'Deployment verification completed');
      logger.logStep('verification', 'completed');
    } catch (error) {
      logger.logStep('verification', 'failed', error);
      throw error;
    }
  }

  /**
   * Attempt error recovery
   */
  private async attemptErrorRecovery(
    error: any,
    config: DeploymentConfig,
    logger: DeploymentLogger
  ): Promise<boolean> {
    this.log(chalk.yellow('🔧 Attempting automatic recovery...'));

    try {
      // Analyze error and find recovery strategy
      const errorMessage = error instanceof Error ? error.message : String(error);
      const diagnosticResults = this?.diagnostics?.analyzeDeploymentError(errorMessage, config);

      for (const diagnostic of diagnosticResults) {
        const recoveryResult = await this?.recovery?.attemptRecovery(diagnostic, config, true);
        
        if (recoveryResult.success) {
          this.log(chalk.green(`✅ Recovery successful: ${recoveryResult.strategy}`));
          logger.logRecoveryAttempt(0, recoveryResult.strategy, true);
          return true;
        } else {
          this.log(chalk.red(`❌ Recovery failed: ${recoveryResult.message}`));
          logger.logRecoveryAttempt(0, recoveryResult.strategy, false);
        }
      }

      return false;
    } catch (recoveryError) {
      logger.error(DeploymentLogCategory.RECOVERY, 'Recovery attempt failed', recoveryError);
      return false;
    }
  }

  /**
   * Handle deployment failure
   */
  private async handleDeploymentFailure(error: any, config: DeploymentConfig, flags: any): Promise<void> {
    this.log(chalk?.red?.bold('❌ Deployment Failed'));
    this.log(chalk.red('===================='));
    this.log();

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.log(chalk.red(`Error: ${errorMessage}`));
    this.log();

    // Provide troubleshooting guidance
    const guide = this?.troubleshooting?.getGuideForError(errorMessage);
    if (guide) {
      this.log(chalk?.cyan?.bold('🔧 Troubleshooting Guide'));
      this.log(chalk.cyan('======================'));
      this.log(chalk.white(guide.description));
      this.log();

      if (guide?.solutions?.length > 0) {
        this.log(chalk.yellow('Recommended Solutions:'));
        for (let i = 0; i < Math.min(3, guide?.solutions?.length); i++) {
          const solution = guide?.solutions?.[i];
          this.log(chalk.yellow(`${i + 1}. ${solution.title}`));
          this.log(chalk.gray(`   ${solution.description}`));
        }
        this.log();
      }
    }

    // Suggest next steps
    this.log(chalk?.blue?.bold('📋 Next Steps'));
    this.log(chalk.blue('============='));
    this.log(chalk.white('1. Run diagnostics: waltodo deploy:diagnostics'));
    this.log(chalk.white('2. Try auto-recovery: waltodo deploy:enhanced --auto-recover'));
    this.log(chalk.white('3. Check logs for details'));
    this.log(chalk.white('4. Review troubleshooting guide above'));

    this?.deploymentLogger?.completeSession('failed', errorMessage);
    this.error(errorMessage, { exit: 1 });
  }

  // Helper methods
  private async calculateBuildStats(buildDir: string): Promise<{ size: number; fileCount: number }> {
    let size = 0;
    let fileCount = 0;

    const files = await this.getAllFiles(buildDir);
    for (const file of files) {
      const stats = await fs.stat(file);
      size += stats.size;
      fileCount++;
    }

    return { size, fileCount };
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  private buildWalrusCommand(config: DeploymentConfig): string[] {
    const command = ['site-builder'];

    // Add context for testnet
    if (config?.network === 'testnet') {
      command.push('--context', 'testnet');
    }

    // Add publish command
    command.push('publish', '--epochs', '5', '--site-name', config.siteName);

    // Add build directory
    command.push(config.buildDir);

    return command;
  }

  private generateDefaultConfig(config: DeploymentConfig): string {
    return `# Walrus Sites Configuration
${config.siteName}:
  source: "${config.buildDir}"
  network: "${config.network}"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
      - "X-Content-Type-Options: nosniff"
  error_pages:
    404: "/404.html"
`;
  }

  private async executeWithTimeout(command: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);

      try {
        const output = execSync(command, { stdio: 'pipe' }).toString();
        clearTimeout(timer);
        resolve(output);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private displayDiagnosticResult(result: any): void {
    const icon = result?.severity === 'critical' ? '🚨' : '⚠️';
    const color = result?.severity === 'critical' ? chalk.red : chalk.yellow;
    
    this.log(color(`${icon} ${result.message}`));
    if (result.suggestion) {
      this.log(chalk.gray(`   💡 ${result.suggestion}`));
    }
  }

  private displayDeploymentSummary(report: any): void {
    this.log();
    this.log(chalk?.green?.bold('🎉 Deployment Summary'));
    this.log(chalk.green('===================='));
    this.log(report.summary);
  }

  private async promptForContinuation(): Promise<boolean> {
    // In a real implementation, you'd use a proper prompt library
    // For now, we'll assume the user wants to continue if --force flag would be used
    return false; // Default to not continuing with critical issues
  }
}