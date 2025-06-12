/**
 * Walrus Sites Deployment Diagnostics Command
 * 
 * Comprehensive diagnostic and troubleshooting command for Walrus Sites deployments
 */

import { Command, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command';
import { DeploymentDiagnostics, DeploymentRecovery, DeploymentConfig } from '../../utils/deployment-diagnostics';
import { Logger } from '../../utils/Logger';
import { join } from 'path';
import chalk from 'chalk';

export default class DeployDiagnostics extends BaseCommand {
  static description = 'Run comprehensive diagnostics for Walrus Sites deployment issues';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --network mainnet',
    '<%= config.bin %> <%= command.id %> --analyze-error "connection refused"',
    '<%= config.bin %> <%= command.id %> --fix --auto-recovery',
  ];

  static flags = {
    ...BaseCommand.flags,
    network: Flags.string({
      char: 'n',
      description: 'Network to check (testnet or mainnet)',
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
    'analyze-error': Flags.string({
      char: 'a',
      description: 'Analyze specific error output',
    }),
    'save-report': Flags.string({
      description: 'Save diagnostic report to file',
    }),
    fix: Flags.boolean({
      char: 'f',
      description: 'Attempt to fix detected issues automatically',
      default: false,
    }),
    'auto-recovery': Flags.boolean({
      description: 'Enable automatic recovery for fixable issues',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed diagnostic output',
      default: false,
    }),
  };

  private diagnostics!: DeploymentDiagnostics;
  private recovery!: DeploymentRecovery;
  private logger!: Logger;

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployDiagnostics as any);

    this?.logger = new Logger('DeployDiagnostics');
    this?.diagnostics = new DeploymentDiagnostics();
    this?.recovery = new DeploymentRecovery();

    // Build configuration from flags
    const config: DeploymentConfig = {
      network: flags.network as 'testnet' | 'mainnet',
      buildDir: flags?.["build-dir"],
      siteName: flags?.["site-name"],
      siteConfigFile: flags?.["config-file"],
      walletPath: flags?.["wallet-path"],
      configDir: join(process?.env?.HOME || '~', '.walrus'),
    };

    this.log(chalk?.blue?.bold('🔍 Walrus Sites Deployment Diagnostics'));
    this.log(chalk.gray('================================================'));
    this.log();

    try {
      // Handle specific error analysis
      if (flags?.["analyze-error"]) {
        await this.analyzeSpecificError(flags?.["analyze-error"], config, flags.verbose);
        return;
      }

      // Run comprehensive diagnostics
      this.log(chalk.cyan('Running comprehensive deployment diagnostics...'));
      this.log();

      const results = await this?.diagnostics?.runDiagnostics(config as any);

      // Display results
      await this.displayResults(results, flags.verbose);

      // Generate and save report
      const report = this?.diagnostics?.generateReport(results, config);
      
      if (flags?.["save-report"]) {
        const reportPath = await this?.diagnostics?.saveReport(report, flags?.["save-report"]);
        this.log();
        this.log(chalk.green(`📄 Report saved to: ${reportPath}`));
      }

      // Attempt automatic recovery if requested
      if (flags.fix || flags?.["auto-recovery"]) {
        await this.attemptRecovery(results, config, flags?.["auto-recovery"]);
      }

      // Provide summary and next steps
      this.provideSummaryAndNextSteps(results as any);

    } catch (error) {
      this?.logger?.error('Diagnostics failed:', error);
      this.error(`Diagnostics failed: ${error instanceof Error ? error.message : String(error as any)}`);
    }
  }

  private async analyzeSpecificError(errorOutput: string, config: DeploymentConfig, verbose: boolean): Promise<void> {
    this.log(chalk.cyan('🔬 Analyzing specific error...'));
    this.log();

    const results = this?.diagnostics?.analyzeDeploymentError(errorOutput, config);

    if (results?.length === 0) {
      this.log(chalk.yellow('⚠️  No specific error patterns identified.'));
      this.log(chalk.gray('The error may be uncommon or require manual analysis.'));
      return;
    }

    this.log(chalk.green(`✅ Identified ${results.length} potential issue(s as any):`));
    this.log();

    for (const result of results) {
      this.displaySingleResult(result, verbose);
    }
  }

  private async displayResults(results: any[], verbose: boolean): Promise<void> {
    const critical = results.filter(r => r?.severity === 'critical');
    const warnings = results.filter(r => r?.severity === 'warning');
    const info = results.filter(r => r?.severity === 'info');

    // Summary
    this.log(chalk.bold('📊 Diagnostic Summary'));
    this.log(chalk.gray('-------------------'));
    this.log(`${chalk.red('Critical Issues:')} ${critical.length}`);
    this.log(`${chalk.yellow('Warnings:')} ${warnings.length}`);
    this.log(`${chalk.blue('Information:')} ${info.length}`);
    this.log();

    // Display critical issues first
    if (critical.length > 0) {
      this.log(chalk?.red?.bold('🚨 Critical Issues (Must Fix)'));
      this.log(chalk.red('================================'));
      for (const result of critical) {
        this.displaySingleResult(result, verbose);
      }
    }

    // Display warnings
    if (warnings.length > 0) {
      this.log(chalk?.yellow?.bold('⚠️  Warnings (Should Fix)'));
      this.log(chalk.yellow('========================'));
      for (const result of warnings) {
        this.displaySingleResult(result, verbose);
      }
    }

    // Display info (only in verbose mode)
    if (info.length > 0 && verbose) {
      this.log(chalk?.blue?.bold('ℹ️  Information'));
      this.log(chalk.blue('==============='));
      for (const result of info) {
        this.displaySingleResult(result, verbose);
      }
    }
  }

  private displaySingleResult(result: any, verbose: boolean): void {
    const severityIcon = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️'
    }[result.severity];

    const severityColor = {
      critical: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue
    }[result.severity];

    this.log(severityColor.bold(`${severityIcon} ${result.message}`));
    
    if (result.errorCode) {
      this.log(chalk.gray(`   Error Code: ${result.errorCode}`));
    }
    
    this.log(chalk.gray(`   Category: ${result.category}`));
    
    if (result.details && verbose) {
      this.log(chalk.gray(`   Details: ${result.details}`));
    }
    
    if (result.suggestion) {
      this.log(chalk.cyan(`   💡 Suggestion: ${result.suggestion}`));
    }
    
    if (result.recoverySteps && result?.recoverySteps?.length > 0) {
      this.log(chalk.green('   🔧 Recovery Steps:'));
      for (const step of result.recoverySteps) {
        this.log(chalk.green(`      • ${step}`));
      }
    }
    
    this.log();
  }

  private async attemptRecovery(results: any[], config: DeploymentConfig, autoRecovery: boolean): Promise<void> {
    const criticalIssues = results.filter(r => r?.severity === 'critical');
    
    if (criticalIssues?.length === 0) {
      this.log(chalk.green('✅ No critical issues require recovery'));
      return;
    }

    this.log(chalk?.cyan?.bold('🔧 Attempting Recovery'));
    this.log(chalk.cyan('====================='));

    if (!autoRecovery) {
      this.log(chalk.yellow('⚠️  Manual recovery mode. Review suggestions above.'));
      return;
    }

    const success = await this?.recovery?.attemptRecovery(results, config);
    
    if (success) {
      this.log(chalk.green('✅ Automatic recovery completed successfully!'));
      this.log(chalk.green('   Re-run diagnostics to verify fixes.'));
    } else {
      this.log(chalk.red('❌ Automatic recovery failed or incomplete.'));
      this.log(chalk.yellow('   Manual intervention required for some issues.'));
    }
  }

  private provideSummaryAndNextSteps(results: any[]): void {
    const critical = results.filter(r => r?.severity === 'critical');
    const warnings = results.filter(r => r?.severity === 'warning');

    this.log();
    this.log(chalk?.bold?.underline('📋 Next Steps'));

    if (critical?.length === 0 && warnings?.length === 0) {
      this.log(chalk?.green?.bold('🎉 All checks passed! Your deployment should succeed.'));
      this.log();
      this.log(chalk.cyan('Recommended deployment command:'));
      this.log(chalk.gray('  ./scripts/deploy-walrus-site.sh'));
      return;
    }

    if (critical.length > 0) {
      this.log(chalk.red('🚨 Fix critical issues before deploying:'));
      const criticalSteps = critical
        .filter(r => r.recoverySteps && r?.recoverySteps?.length > 0)
        .flatMap(r => r.recoverySteps)
        .slice(0, 5); // Top 5 steps

      for (let i = 0; i < criticalSteps.length; i++) {
        this.log(chalk.red(`   ${i + 1}. ${criticalSteps[i]}`));
      }
      this.log();
    }

    if (warnings.length > 0) {
      this.log(chalk.yellow('⚠️  Consider fixing warnings for optimal deployment:'));
      const warningSteps = warnings
        .filter(r => r.recoverySteps && r?.recoverySteps?.length > 0)
        .flatMap(r => r.recoverySteps)
        .slice(0, 3); // Top 3 steps

      for (let i = 0; i < warningSteps.length; i++) {
        this.log(chalk.yellow(`   ${i + 1}. ${warningSteps[i]}`));
      }
      this.log();
    }

    // Provide helpful commands
    this.log(chalk.cyan('🛠️  Helpful Commands:'));
    this.log(chalk.gray('   waltodo deploy:diagnostics --fix          # Attempt automatic fixes'));
    this.log(chalk.gray('   waltodo deploy:diagnostics --save-report  # Save detailed report'));
    this.log(chalk.gray('   waltodo deploy:diagnostics --verbose       # Show detailed output'));
    this.log();

    // Contact information
    this.log(chalk.blue('📞 Need Help?'));
    this.log(chalk.gray('   • Check Walrus documentation: https://docs?.walrus?.site'));
    this.log(chalk.gray('   • Sui network status: https://status?.sui?.io'));
    this.log(chalk.gray('   • WalTodo issues: https://github.com/your-repo/issues'));
  }
}