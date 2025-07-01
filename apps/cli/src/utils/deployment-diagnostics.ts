/**
 * Comprehensive Walrus Sites Deployment Diagnostics System
 * 
 * This module provides detailed diagnostics, error analysis, and recovery
 * procedures for Walrus Sites deployment failures.
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { Logger } from './Logger';
import { NetworkValidator } from './NetworkValidator';

export interface DiagnosticResult {
  category: DiagnosticCategory;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
  suggestion?: string;
  recoverySteps?: string[];
  errorCode?: string;
}

export enum DiagnosticCategory {
  NETWORK = 'network',
  CONFIGURATION = 'configuration',
  BUILD = 'build',
  AUTHENTICATION = 'authentication',
  BLOCKCHAIN = 'blockchain',
  ENVIRONMENT = 'environment',
  PERMISSIONS = 'permissions',
  RESOURCES = 'resources'
}

export interface DeploymentConfig {
  network: 'testnet' | 'mainnet';
  buildDir: string;
  siteConfigFile: string;
  walletPath?: string;
  configDir: string;
  siteName: string;
}

export interface EnvironmentInfo {
  nodeVersion: string;
  npmVersion: string;
  pnpmVersion?: string;
  osVersion: string;
  architecture: string;
  walrusCliVersion?: string;
  suiCliVersion?: string;
  gitCommit?: string;
  buildTimestamp?: string;
}

export class DeploymentDiagnostics {
  private logger: Logger;
  private networkValidator: NetworkValidator;
  private results: DiagnosticResult[] = [];

  constructor() {
    this?.logger = new Logger('DeploymentDiagnostics');
    this?.networkValidator = new NetworkValidator();
  }

  /**
   * Run comprehensive deployment diagnostics
   */
  async runDiagnostics(config: DeploymentConfig): Promise<DiagnosticResult[]> {
    this?.results = [];
    this?.logger?.info('Starting comprehensive deployment diagnostics...');

    // Run all diagnostic checks
    await this.checkEnvironment();
    await this.checkNetworkConnectivity(config.network);
    await this.checkConfiguration(config);
    await this.checkBuildOutput(config.buildDir);
    await this.checkAuthentication(config);
    await this.checkBlockchainAccess(config.network);
    await this.checkPermissions(config);
    await this.checkResources();

    this?.logger?.info(`Diagnostics completed. Found ${this?.results?.length} issues.`);
    return this.results;
  }

  /**
   * Analyze deployment error from log output
   */
  analyzeDeploymentError(errorOutput: string, config: DeploymentConfig): DiagnosticResult[] {
    const errorResults: DiagnosticResult[] = [];
    
    // Common error patterns and their diagnostics
    const errorPatterns = [
      {
        pattern: /connection\s+refused|ECONNREFUSED/i,
        category: DiagnosticCategory.NETWORK,
        severity: 'critical' as const,
        message: 'Network connection refused',
        suggestion: 'Check internet connectivity and Walrus network status',
        recoverySteps: [
          'Verify internet connection',
          'Check Walrus network status at walrus.site',
          'Try switching networks (testnet/mainnet)',
          'Wait and retry in a few minutes'
        ]
      },
      {
        pattern: /timeout|timed\s+out/i,
        category: DiagnosticCategory.NETWORK,
        severity: 'critical' as const,
        message: 'Request timeout during deployment',
        suggestion: 'Network may be slow or Walrus services unavailable',
        recoverySteps: [
          'Check network speed and stability',
          'Retry deployment with increased timeout',
          'Try deploying during off-peak hours',
          'Consider reducing asset size'
        ]
      },
      {
        pattern: /authentication\s+failed|unauthorized|invalid\s+credentials/i,
        category: DiagnosticCategory.AUTHENTICATION,
        severity: 'critical' as const,
        message: 'Authentication failed',
        suggestion: 'Check wallet configuration and credentials',
        recoverySteps: [
          'Verify wallet file exists and is readable',
          'Check wallet has sufficient SUI tokens',
          'Ensure correct network configuration',
          'Re-import wallet if necessary'
        ]
      },
      {
        pattern: /insufficient\s+funds|not\s+enough\s+(sui|gas)/i,
        category: DiagnosticCategory.BLOCKCHAIN,
        severity: 'critical' as const,
        message: 'Insufficient funds for deployment',
        suggestion: 'Add SUI tokens to your wallet',
        recoverySteps: [
          'Check wallet balance',
          'Get testnet SUI from faucet (for testnet)',
          'Purchase SUI tokens (for mainnet)',
          'Verify gas price settings'
        ]
      },
      {
        pattern: /build\s+failed|compilation\s+error|build\s+error/i,
        category: DiagnosticCategory.BUILD,
        severity: 'critical' as const,
        message: 'Build process failed',
        suggestion: 'Fix build errors before deployment',
        recoverySteps: [
          'Run "pnpm run build" locally to identify issues',
          'Check for TypeScript errors',
          'Verify all dependencies are installed',
          'Clear build cache and retry'
        ]
      },
      {
        pattern: /config.*not\s+found|configuration\s+error/i,
        category: DiagnosticCategory.CONFIGURATION,
        severity: 'critical' as const,
        message: 'Configuration file not found or invalid',
        suggestion: 'Check configuration file paths and content',
        recoverySteps: [
          'Verify sites-config.yaml exists',
          'Check configuration file syntax',
          'Ensure all required fields are present',
          'Use default configuration if needed'
        ]
      },
      {
        pattern: /permission\s+denied|EACCES/i,
        category: DiagnosticCategory.PERMISSIONS,
        severity: 'critical' as const,
        message: 'Permission denied',
        suggestion: 'Check file and directory permissions',
        recoverySteps: [
          'Verify read/write permissions on build directory',
          'Check wallet file permissions',
          'Run with appropriate user permissions',
          'Fix directory ownership if needed'
        ]
      },
      {
        pattern: /site-builder.*not\s+found|command\s+not\s+found/i,
        category: DiagnosticCategory.ENVIRONMENT,
        severity: 'critical' as const,
        message: 'Walrus site-builder CLI not found',
        suggestion: 'Install or configure Walrus CLI tools',
        recoverySteps: [
          'Install Walrus CLI: curl -fLJO https://docs?.walrus?.site/walrus',
          'Add Walrus CLI to PATH',
          'Verify installation: site-builder --version',
          'Check SITE_BUILDER_PATH environment variable'
        ]
      },
      {
        pattern: /invalid\s+network|network.*not\s+supported/i,
        category: DiagnosticCategory.CONFIGURATION,
        severity: 'critical' as const,
        message: 'Invalid network configuration',
        suggestion: 'Use supported network (testnet or mainnet)',
        recoverySteps: [
          'Verify network parameter is "testnet" or "mainnet"',
          'Check Walrus CLI network configuration',
          'Update sites-config.yaml network setting',
          'Ensure wallet is configured for correct network'
        ]
      },
      {
        pattern: /too\s+large|size\s+limit|file.*too\s+big/i,
        category: DiagnosticCategory.BUILD,
        severity: 'warning' as const,
        message: 'Build output too large',
        suggestion: 'Optimize build size and assets',
        recoverySteps: [
          'Run build analysis to identify large files',
          'Optimize images and compress assets',
          'Remove unused dependencies',
          'Enable tree shaking and code splitting'
        ]
      }
    ];

    // Analyze error output against patterns
    for (const pattern of errorPatterns) {
      if (pattern?.pattern?.test(errorOutput)) {
        errorResults.push({
          category: pattern.category,
          severity: pattern.severity,
          message: pattern.message,
          details: this.extractErrorDetails(errorOutput, pattern.pattern),
          suggestion: pattern.suggestion,
          recoverySteps: pattern.recoverySteps,
          errorCode: this.generateErrorCode(pattern.category, pattern.message)
        });
      }
    }

    // If no specific patterns match, provide generic analysis
    if (errorResults?.length === 0) {
      errorResults.push({
        category: DiagnosticCategory.ENVIRONMENT,
        severity: 'warning',
        message: 'Unrecognized deployment error',
        details: errorOutput.substring(0, 500),
        suggestion: 'Review error output and check common issues',
        recoverySteps: [
          'Check all prerequisites are installed',
          'Verify network connectivity',
          'Try deploying with verbose logging',
          'Contact support with error details'
        ]
      });
    }

    return errorResults;
  }

  /**
   * Check environment prerequisites
   */
  private async checkEnvironment(): Promise<void> {
    try {
      // Check Node.js version
      const nodeVersion = process.version;
      const minNodeVersion = '18?.0?.0';
      if (!this.isVersionValid(nodeVersion.slice(1), minNodeVersion)) {
        this.addResult({
          category: DiagnosticCategory.ENVIRONMENT,
          severity: 'critical',
          message: `Node.js version ${nodeVersion} is below minimum required ${minNodeVersion}`,
          suggestion: 'Upgrade Node.js to v18 or higher',
          recoverySteps: [
            'Install Node.js v18+ from nodejs.org',
            'Use nvm to manage Node.js versions',
            'Verify installation: node --version'
          ]
        });
      }

      // Check pnpm availability
      try {
        execSync('pnpm --version', { stdio: 'pipe' });
      } catch {
        this.addResult({
          category: DiagnosticCategory.ENVIRONMENT,
          severity: 'critical',
          message: 'pnpm package manager not found',
          suggestion: 'Install pnpm package manager',
          recoverySteps: [
            'Install pnpm: npm install -g pnpm',
            'Or use corepack: corepack enable',
            'Verify installation: pnpm --version'
          ]
        });
      }

      // Check Walrus CLI
      try {
        execSync('site-builder --version', { stdio: 'pipe' });
      } catch {
        this.addResult({
          category: DiagnosticCategory.ENVIRONMENT,
          severity: 'critical',
          message: 'Walrus site-builder CLI not found',
          suggestion: 'Install Walrus CLI tools',
          recoverySteps: [
            'Download from https://docs?.walrus?.site/',
            'Add to PATH environment variable',
            'Set SITE_BUILDER_PATH if needed'
          ]
        });
      }

      // Check git availability (for build metadata)
      try {
        execSync('git --version', { stdio: 'pipe' });
      } catch {
        this.addResult({
          category: DiagnosticCategory.ENVIRONMENT,
          severity: 'warning',
          message: 'Git not available',
          suggestion: 'Install git for build metadata',
          recoverySteps: ['Install git from git-scm.com']
        });
      }

    } catch (error) {
      this.addResult({
        category: DiagnosticCategory.ENVIRONMENT,
        severity: 'critical',
        message: 'Environment check failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check network connectivity
   */
  private async checkNetworkConnectivity(network: string): Promise<void> {
    const endpoints = {
      testnet: [
        'https://testnet?.walrus?.site',
        'https://publisher-devnet?.walrus?.space',
        'https://aggregator-devnet?.walrus?.space'
      ],
      mainnet: [
        'https://walrus.site',
        'https://publisher?.walrus?.space',
        'https://aggregator?.walrus?.space'
      ]
    };

    const urls = endpoints[network as keyof typeof endpoints] || endpoints.testnet;

    for (const url of urls) {
      try {
        const isConnected = await this?.networkValidator?.checkConnection(url, 10000);
        if (!isConnected) {
          this.addResult({
            category: DiagnosticCategory.NETWORK,
            severity: 'critical',
            message: `Cannot connect to ${url}`,
            suggestion: 'Check internet connectivity and Walrus network status',
            recoverySteps: [
              'Verify internet connection',
              'Check firewall settings',
              'Try different network',
              'Contact network administrator'
            ]
          });
        }
      } catch (error) {
        this.addResult({
          category: DiagnosticCategory.NETWORK,
          severity: 'warning',
          message: `Network check failed for ${url}`,
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Check configuration files and settings
   */
  private async checkConfiguration(config: DeploymentConfig): Promise<void> {
    // Check sites config file
    try {
      await fs.access(config.siteConfigFile);
      const configContent = await fs.readFile(config.siteConfigFile, 'utf-8');
      
      // Basic YAML validation
      if (!configContent.includes(config.siteName)) {
        this.addResult({
          category: DiagnosticCategory.CONFIGURATION,
          severity: 'warning',
          message: 'Site name not found in configuration',
          suggestion: 'Verify sites-config.yaml contains correct site configuration'
        });
      }

      // Check for required fields
      const requiredFields = ['source', 'network'];
      for (const field of requiredFields) {
        if (!configContent.includes(field)) {
          this.addResult({
            category: DiagnosticCategory.CONFIGURATION,
            severity: 'critical',
            message: `Missing required field '${field}' in configuration`,
            suggestion: 'Add missing configuration fields'
          });
        }
      }

    } catch (error) {
      this.addResult({
        category: DiagnosticCategory.CONFIGURATION,
        severity: 'critical',
        message: 'Sites configuration file not found or unreadable',
        details: config.siteConfigFile,
        suggestion: 'Create or fix sites-config.yaml file',
        recoverySteps: [
          'Create sites-config.yaml with required configuration',
          'Verify file permissions',
          'Check file path is correct'
        ]
      });
    }

    // Check Walrus config directory
    try {
      await fs.access(config.configDir);
    } catch {
      this.addResult({
        category: DiagnosticCategory.CONFIGURATION,
        severity: 'warning',
        message: 'Walrus config directory not found',
        details: config.configDir,
        suggestion: 'Initialize Walrus configuration',
        recoverySteps: [
          'Run: site-builder init',
          'Create config directory manually',
          'Check --config-dir parameter'
        ]
      });
    }
  }

  /**
   * Check build output
   */
  private async checkBuildOutput(buildDir: string): Promise<void> {
    try {
      await fs.access(buildDir);
      
      // Check if build directory has content
      const files = await fs.readdir(buildDir);
      if (files?.length === 0) {
        this.addResult({
          category: DiagnosticCategory.BUILD,
          severity: 'critical',
          message: 'Build directory is empty',
          suggestion: 'Run build process before deployment',
          recoverySteps: [
            'Run: pnpm run build',
            'Check for build errors',
            'Verify build configuration'
          ]
        });
      }

      // Check for essential files
      const essentialFiles = ['index.html', '404.html'];
      for (const file of essentialFiles) {
        try {
          await fs.access(join(buildDir, file));
        } catch {
          this.addResult({
            category: DiagnosticCategory.BUILD,
            severity: 'warning',
            message: `Missing essential file: ${file}`,
            suggestion: 'Ensure complete build output'
          });
        }
      }

      // Check build size
      const stats = await this.getBuildStats(buildDir);
      if (stats.totalSize > 100 * 1024 * 1024) { // 100MB
        this.addResult({
          category: DiagnosticCategory.BUILD,
          severity: 'warning',
          message: `Build size is large (${this.formatBytes(stats.totalSize)})`,
          suggestion: 'Consider optimizing build output',
          recoverySteps: [
            'Run bundle analyzer',
            'Optimize images and assets',
            'Remove unused dependencies',
            'Enable compression'
          ]
        });
      }

    } catch (error) {
      this.addResult({
        category: DiagnosticCategory.BUILD,
        severity: 'critical',
        message: 'Build directory not found or inaccessible',
        details: buildDir,
        suggestion: 'Run build process to generate output',
        recoverySteps: [
          'Run: pnpm run build',
          'Check build configuration',
          'Verify output directory path'
        ]
      });
    }
  }

  /**
   * Check authentication and wallet configuration
   */
  private async checkAuthentication(config: DeploymentConfig): Promise<void> {
    if (config.walletPath) {
      try {
        await fs.access(config.walletPath);
        
        // Check wallet file permissions
        const stats = await fs.stat(config.walletPath);
        if (stats.mode & 0o077) {
          this.addResult({
            category: DiagnosticCategory.PERMISSIONS,
            severity: 'warning',
            message: 'Wallet file has overly permissive permissions',
            suggestion: 'Secure wallet file permissions (chmod 600)',
            recoverySteps: [
              'Run: chmod 600 ' + config.walletPath,
              'Verify only owner can read wallet file'
            ]
          });
        }

      } catch (error) {
        this.addResult({
          category: DiagnosticCategory.AUTHENTICATION,
          severity: 'critical',
          message: 'Wallet file not found or unreadable',
          details: config.walletPath,
          suggestion: 'Check wallet file path and permissions',
          recoverySteps: [
            'Verify wallet file exists',
            'Check file permissions',
            'Import wallet if missing',
            'Use correct wallet path'
          ]
        });
      }
    }

    // Check Sui CLI configuration
    try {
      execSync('sui client active-address', { stdio: 'pipe' });
    } catch {
      this.addResult({
        category: DiagnosticCategory.AUTHENTICATION,
        severity: 'warning',
        message: 'Sui CLI not configured or no active address',
        suggestion: 'Configure Sui CLI with wallet',
        recoverySteps: [
          'Run: sui client new-address',
          'Import existing wallet: sui keytool import',
          'Set active address: sui client switch --address'
        ]
      });
    }
  }

  /**
   * Check blockchain access and network connectivity
   */
  private async checkBlockchainAccess(network: string): Promise<void> {
    const rpcEndpoints = {
      testnet: 'https://fullnode?.testnet?.sui.io:443',
      mainnet: 'https://fullnode?.mainnet?.sui.io:443'
    };

    const endpoint = rpcEndpoints[network as keyof typeof rpcEndpoints];
    if (endpoint) {
      try {
        const isConnected = await this?.networkValidator?.checkConnection(endpoint, 10000);
        if (!isConnected) {
          this.addResult({
            category: DiagnosticCategory.BLOCKCHAIN,
            severity: 'critical',
            message: `Cannot connect to Sui ${network} network`,
            suggestion: 'Check Sui network connectivity',
            recoverySteps: [
              'Verify internet connection',
              'Check Sui network status',
              'Try alternative RPC endpoint',
              'Check firewall settings'
            ]
          });
        }
      } catch (error) {
        this.addResult({
          category: DiagnosticCategory.BLOCKCHAIN,
          severity: 'warning',
          message: `Blockchain connectivity check failed for ${network}`,
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Check if wallet has sufficient balance (if wallet is configured)
    try {
      const balance = execSync('sui client gas', { stdio: 'pipe' }).toString();
      if (balance.includes('0 SUI') || !balance.includes('SUI')) {
        this.addResult({
          category: DiagnosticCategory.BLOCKCHAIN,
          severity: 'critical',
          message: 'Wallet has insufficient SUI balance',
          suggestion: 'Add SUI tokens to wallet for deployment fees',
          recoverySteps: [
            network === 'testnet' ? 'Get testnet SUI from faucet' : 'Purchase SUI tokens',
            'Check: sui client gas',
            'Verify correct wallet is active'
          ]
        });
      }
    } catch {
      // Wallet not configured or other error - already handled in authentication check
    }
  }

  /**
   * Check file and directory permissions
   */
  private async checkPermissions(config: DeploymentConfig): Promise<void> {
    const pathsToCheck = [
      config.buildDir,
      config.configDir,
      process.cwd()
    ];

    for (const path of pathsToCheck) {
      try {
        await fs.access(path, fs?.constants?.R_OK | fs?.constants?.W_OK);
      } catch (error) {
        this.addResult({
          category: DiagnosticCategory.PERMISSIONS,
          severity: 'critical',
          message: `Insufficient permissions for path: ${path}`,
          suggestion: 'Fix directory permissions',
          recoverySteps: [
            'Check directory ownership',
            'Fix permissions: chmod 755',
            'Run with appropriate user account'
          ]
        });
      }
    }
  }

  /**
   * Check system resources
   */
  private async checkResources(): Promise<void> {
    try {
      // Check available disk space
      const stats = await fs.stat(process.cwd());
      // Note: This is a simplified check - in production, you'd use statvfs or similar
      
      // Check memory usage
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
        this.addResult({
          category: DiagnosticCategory.RESOURCES,
          severity: 'warning',
          message: 'High memory usage detected',
          suggestion: 'Monitor resource usage during deployment'
        });
      }

    } catch (error) {
      this.addResult({
        category: DiagnosticCategory.RESOURCES,
        severity: 'info',
        message: 'Resource check unavailable',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Generate comprehensive diagnostic report
   */
  generateReport(results: DiagnosticResult[], config: DeploymentConfig): string {
    const critical = results.filter(r => r?.severity === 'critical');
    const warnings = results.filter(r => r?.severity === 'warning');
    const info = results.filter(r => r?.severity === 'info');

    let report = `# Walrus Sites Deployment Diagnostic Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Network:** ${config.network}\n`;
    report += `**Site:** ${config.siteName}\n\n`;

    report += `## Summary\n`;
    report += `- **Critical Issues:** ${critical.length}\n`;
    report += `- **Warnings:** ${warnings.length}\n`;
    report += `- **Information:** ${info.length}\n\n`;

    if (critical.length > 0) {
      report += `## 🚨 Critical Issues (Must Fix)\n\n`;
      for (const result of critical) {
        report += this.formatDiagnosticResult(result);
      }
    }

    if (warnings.length > 0) {
      report += `## ⚠️ Warnings (Should Fix)\n\n`;
      for (const result of warnings) {
        report += this.formatDiagnosticResult(result);
      }
    }

    if (info.length > 0) {
      report += `## ℹ️ Information\n\n`;
      for (const result of info) {
        report += this.formatDiagnosticResult(result);
      }
    }

    // Add recovery recommendations
    if (critical.length > 0) {
      report += `## 🔧 Quick Recovery Steps\n\n`;
      const allRecoverySteps = critical
        .filter(r => r.recoverySteps)
        .flatMap(r => r.recoverySteps!);
      
      const uniqueSteps = [...new Set(allRecoverySteps)];
      for (let i = 0; i < uniqueSteps.length; i++) {
        report += `${i + 1}. ${uniqueSteps[i]}\n`;
      }
      report += '\n';
    }

    return report;
  }

  /**
   * Save diagnostic report to file
   */
  async saveReport(report: string, outputPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = outputPath || `walrus-deployment-diagnostics-${timestamp}.md`;
    
    await fs.writeFile(filename, report, 'utf-8');
    this?.logger?.info(`Diagnostic report saved to: ${filename}`);
    
    return filename;
  }

  // Helper methods
  private addResult(result: DiagnosticResult): void {
    this?.results?.push({
      ...result,
      errorCode: result.errorCode || this.generateErrorCode(result.category, result.message)
    });
  }

  private generateErrorCode(category: DiagnosticCategory, message: string): string {
    const categoryCode = category.toUpperCase().substring(0, 3);
    const messageHash = message.split(' ').slice(0, 2).join('').toLowerCase();
    return `${categoryCode}-${messageHash.substring(0, 4)}`;
  }

  private extractErrorDetails(errorOutput: string, pattern: RegExp): string {
    const match = errorOutput.match(pattern);
    if (match) {
      const lines = errorOutput.split('\n');
      const matchLineIndex = lines.findIndex(line => pattern.test(line));
      if (matchLineIndex !== -1) {
        return lines.slice(Math.max(0, matchLineIndex - 1), matchLineIndex + 2).join('\n');
      }
    }
    return errorOutput.substring(0, 200) + '...';
  }

  private isVersionValid(current: string, minimum: string): boolean {
    const currentParts = current.split('.').map(Number);
    const minimumParts = minimum.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, minimumParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const minimumPart = minimumParts[i] || 0;
      
      if (currentPart > minimumPart) return true;
      if (currentPart < minimumPart) return false;
    }
    
    return true;
  }

  private async getBuildStats(buildDir: string): Promise<{ totalSize: number; fileCount: number }> {
    let totalSize = 0;
    let fileCount = 0;

    async function traverse(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
          fileCount++;
        }
      }
    }

    await traverse(buildDir);
    return { totalSize, fileCount };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatDiagnosticResult(result: DiagnosticResult): string {
    let formatted = `### ${result.message}\n\n`;
    formatted += `**Category:** ${result.category}\n`;
    formatted += `**Severity:** ${result.severity}\n`;
    
    if (result.errorCode) {
      formatted += `**Error Code:** ${result.errorCode}\n`;
    }
    
    if (result.details) {
      formatted += `**Details:** ${result.details}\n`;
    }
    
    if (result.suggestion) {
      formatted += `**Suggestion:** ${result.suggestion}\n`;
    }
    
    if (result.recoverySteps && result?.recoverySteps?.length > 0) {
      formatted += `**Recovery Steps:**\n`;
      for (const step of result.recoverySteps) {
        formatted += `- ${step}\n`;
      }
    }
    
    formatted += '\n---\n\n';
    return formatted;
  }
}

/**
 * Deployment Recovery System
 */
export class DeploymentRecovery {
  private logger: Logger;

  constructor() {
    this?.logger = new Logger('DeploymentRecovery');
  }

  /**
   * Attempt automatic recovery based on diagnostic results
   */
  async attemptRecovery(results: DiagnosticResult[], config: DeploymentConfig): Promise<boolean> {
    this?.logger?.info('Attempting automatic recovery...');
    
    const criticalIssues = results.filter(r => r?.severity === 'critical');
    let recoverySuccess = true;

    for (const issue of criticalIssues) {
      try {
        const recovered = await this.recoverFromIssue(issue, config);
        if (!recovered) {
          recoverySuccess = false;
          this?.logger?.error(`Failed to recover from: ${issue.message}`);
        }
      } catch (error) {
        this?.logger?.error(`Recovery failed for ${issue.message}:`, error);
        recoverySuccess = false;
      }
    }

    return recoverySuccess;
  }

  private async recoverFromIssue(issue: DiagnosticResult, config: DeploymentConfig): Promise<boolean> {
    switch (issue.category) {
      case DiagnosticCategory.BUILD:
        return this.recoverBuildIssues(issue, config);
      
      case DiagnosticCategory.CONFIGURATION:
        return this.recoverConfigurationIssues(issue, config);
      
      case DiagnosticCategory.PERMISSIONS:
        return this.recoverPermissionIssues(issue, config);
      
      default:
        this?.logger?.info(`No automatic recovery available for ${issue.category} issues`);
        return false;
    }
  }

  private async recoverBuildIssues(issue: DiagnosticResult, config: DeploymentConfig): Promise<boolean> {
    if (issue?.message?.includes('empty')) {
      this?.logger?.info('Attempting to rebuild application...');
      try {
        execSync('pnpm run build', { stdio: 'inherit', cwd: process.cwd() });
        return true;
      } catch (error) {
        this?.logger?.error('Build recovery failed:', error);
        return false;
      }
    }
    return false;
  }

  private async recoverConfigurationIssues(issue: DiagnosticResult, config: DeploymentConfig): Promise<boolean> {
    if (issue?.message?.includes('not found')) {
      this?.logger?.info('Creating default configuration...');
      try {
        const defaultConfig = this.generateDefaultSitesConfig(config);
        await fs.writeFile(config.siteConfigFile, defaultConfig, 'utf-8');
        return true;
      } catch (error) {
        this?.logger?.error('Configuration recovery failed:', error);
        return false;
      }
    }
    return false;
  }

  private async recoverPermissionIssues(issue: DiagnosticResult, config: DeploymentConfig): Promise<boolean> {
    // Note: Automatic permission fixing can be dangerous, so we log suggestions instead
    this?.logger?.info('Permission issues detected. Manual intervention required.');
    this?.logger?.info('Run the following commands to fix permissions:');
    
    if (issue.details) {
      this?.logger?.info(`chmod 755 ${issue.details}`);
    }
    
    return false; // Require manual intervention for security
  }

  private generateDefaultSitesConfig(config: DeploymentConfig): string {
    return `# Default Walrus Sites Configuration
# Generated by deployment recovery system

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
}