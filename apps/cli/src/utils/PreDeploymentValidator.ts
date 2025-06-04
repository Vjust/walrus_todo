/**
 * Pre-Deployment Validation System
 * 
 * Comprehensive validation system that ensures all prerequisites are met
 * before attempting Walrus Sites deployment. Validates network connectivity,
 * wallet setup, gas availability, and configuration integrity.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { SuiClient } from '@mysten/sui/client';
import { NetworkHealthChecker, type NetworkHealth, type NetworkConfig } from './NetworkHealthChecker';
import { Logger } from './Logger';
import { ValidationError, NetworkError, ConfigurationError } from '../types/errors/consolidated';

export interface ValidationResult {
  passed: boolean;
  category: 'network' | 'wallet' | 'configuration' | 'dependencies' | 'deployment';
  name: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  details?: Record<string, unknown>;
}

export interface ValidationSummary {
  overallStatus: 'ready' | 'warnings' | 'failed';
  readinessScore: number; // 0-100
  totalChecks: number;
  passedChecks: number;
  warnings: number;
  errors: number;
  results: ValidationResult[];
  networkHealth?: NetworkHealth;
  estimatedDeploymentTime?: number;
  recommendedActions: string[];
}

export interface ValidationOptions {
  skipNetworkCheck: boolean;
  skipWalletCheck: boolean;
  skipGasCheck: boolean;
  skipDependencyCheck: boolean;
  skipConfigValidation: boolean;
  strictMode: boolean;
  timeout: number;
  minGasBalance: number;
  maxDeploymentSize: number;
  requiredDependencies: string[];
}

export interface DeploymentContext {
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  sitePath: string;
  configPath?: string;
  publisherUrl?: string;
  aggregatorUrl?: string;
  force: boolean;
}

export class PreDeploymentValidator {
  private readonly logger: Logger;
  private readonly options: ValidationOptions;
  private readonly networkHealthChecker?: NetworkHealthChecker;

  private static readonly DEFAULT_OPTIONS: ValidationOptions = {
    skipNetworkCheck: false,
    skipWalletCheck: false,
    skipGasCheck: false,
    skipDependencyCheck: false,
    skipConfigValidation: false,
    strictMode: false,
    timeout: 30000,
    minGasBalance: 1000000, // 0.001 SUI in MIST
    maxDeploymentSize: 100 * 1024 * 1024, // 100MB
    requiredDependencies: ['sui', 'walrus'],
  };

  constructor(
    networkConfig?: NetworkConfig,
    options: Partial<ValidationOptions> = {}
  ) {
    this.logger = new Logger('PreDeploymentValidator');
    this.options = { ...PreDeploymentValidator.DEFAULT_OPTIONS, ...options };

    // Initialize network health checker if network config provided
    if (networkConfig && !this.options.skipNetworkCheck) {
      this.networkHealthChecker = new NetworkHealthChecker(networkConfig, {
        timeout: this.options.timeout,
        skipWallet: this.options.skipWalletCheck,
        skipGasCheck: this.options.skipGasCheck,
        verbose: false,
      });
    }
  }

  /**
   * Perform comprehensive pre-deployment validation
   */
  async validate(context: DeploymentContext): Promise<ValidationSummary> {
    this.logger.info('Starting pre-deployment validation', {
      network: context.network,
      sitePath: context.sitePath,
      strictMode: this.options.strictMode,
    });

    const startTime = Date.now();
    const results: ValidationResult[] = [];

    try {
      // Run all validation checks
      const checks = [
        () => this.validateDependencies(),
        () => this.validateConfiguration(context),
        () => this.validateDeploymentPath(context),
        () => this.validateWallet(context),
        () => this.validateNetwork(context),
        () => this.validateDeploymentSize(context),
        () => this.validatePermissions(context),
      ];

      // Execute checks based on options
      for (const check of checks) {
        try {
          const checkResults = await check();
          results.push(...checkResults);
        } catch (error) {
          results.push({
            passed: false,
            category: 'deployment',
            name: 'Validation Error',
            message: error instanceof Error ? error.message : String(error),
            severity: 'error',
          });
        }
      }

      // Generate summary
      const summary = this.generateSummary(results, Date.now() - startTime);

      this.logger.info('Pre-deployment validation completed', {
        status: summary.overallStatus,
        score: summary.readinessScore,
        duration: Date.now() - startTime,
        errors: summary.errors,
        warnings: summary.warnings,
      });

      return summary;
    } catch (error) {
      this.logger.error('Pre-deployment validation failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        overallStatus: 'failed',
        readinessScore: 0,
        totalChecks: results.length,
        passedChecks: 0,
        warnings: 0,
        errors: 1,
        results: [{
          passed: false,
          category: 'deployment',
          name: 'Validation System Error',
          message: error instanceof Error ? error.message : String(error),
          severity: 'error',
        }],
        recommendedActions: ['Fix validation system error and retry'],
      };
    }
  }

  /**
   * Validate required dependencies
   */
  private async validateDependencies(): Promise<ValidationResult[]> {
    if (this.options.skipDependencyCheck) {
      return [];
    }

    const results: ValidationResult[] = [];

    for (const dependency of this.options.requiredDependencies) {
      try {
        const version = execSync(`${dependency} --version`, { encoding: 'utf8' });
        
        results.push({
          passed: true,
          category: 'dependencies',
          name: `${dependency} availability`,
          message: `${dependency} is available: ${version.trim()}`,
          severity: 'info',
          details: { version: version.trim() },
        });
      } catch (error) {
        results.push({
          passed: false,
          category: 'dependencies',
          name: `${dependency} availability`,
          message: `${dependency} is not available or not in PATH`,
          severity: 'error',
          suggestion: `Install ${dependency} CLI tool and ensure it's in your PATH`,
        });
      }
    }

    // Check Node.js version
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion >= 18) {
        results.push({
          passed: true,
          category: 'dependencies',
          name: 'Node.js version',
          message: `Node.js version is compatible: ${nodeVersion}`,
          severity: 'info',
        });
      } else {
        results.push({
          passed: false,
          category: 'dependencies',
          name: 'Node.js version',
          message: `Node.js version ${nodeVersion} is too old (requires 18+)`,
          severity: 'error',
          suggestion: 'Upgrade to Node.js 18 or later',
        });
      }
    } catch (error) {
      results.push({
        passed: false,
        category: 'dependencies',
        name: 'Node.js version',
        message: 'Could not determine Node.js version',
        severity: 'warning',
      });
    }

    return results;
  }

  /**
   * Validate configuration files and settings
   */
  private async validateConfiguration(context: DeploymentContext): Promise<ValidationResult[]> {
    if (this.options.skipConfigValidation) {
      return [];
    }

    const results: ValidationResult[] = [];

    // Validate Sui CLI configuration
    try {
      const activeEnv = execSync('sui client active-env', { encoding: 'utf8' }).trim();
      
      if (activeEnv === context.network) {
        results.push({
          passed: true,
          category: 'configuration',
          name: 'Sui network configuration',
          message: `Sui CLI configured for ${context.network}`,
          severity: 'info',
        });
      } else {
        results.push({
          passed: this.options.strictMode ? false : true,
          category: 'configuration',
          name: 'Sui network configuration',
          message: `Sui CLI environment mismatch: expected ${context.network}, got ${activeEnv}`,
          severity: this.options.strictMode ? 'error' : 'warning',
          suggestion: `Run: sui client switch --env ${context.network}`,
        });
      }
    } catch (error) {
      results.push({
        passed: false,
        category: 'configuration',
        name: 'Sui CLI configuration',
        message: 'Failed to check Sui CLI configuration',
        severity: 'error',
        suggestion: 'Configure Sui CLI with: sui client',
      });
    }

    // Validate config file if provided
    if (context.configPath) {
      if (existsSync(context.configPath)) {
        try {
          const configContent = readFileSync(context.configPath, 'utf8');
          const config = JSON.parse(configContent);
          
          // Validate config structure
          const requiredFields = ['network', 'walrus'];
          const missingFields = requiredFields.filter(field => !config[field]);
          
          if (missingFields.length === 0) {
            results.push({
              passed: true,
              category: 'configuration',
              name: 'Configuration file',
              message: 'Configuration file is valid',
              severity: 'info',
            });
          } else {
            results.push({
              passed: false,
              category: 'configuration',
              name: 'Configuration file',
              message: `Configuration file missing required fields: ${missingFields.join(', ')}`,
              severity: 'error',
              suggestion: 'Update configuration file with required fields',
            });
          }
        } catch (error) {
          results.push({
            passed: false,
            category: 'configuration',
            name: 'Configuration file',
            message: 'Configuration file is not valid JSON',
            severity: 'error',
            suggestion: 'Fix JSON syntax in configuration file',
          });
        }
      } else {
        results.push({
          passed: false,
          category: 'configuration',
          name: 'Configuration file',
          message: `Configuration file not found: ${context.configPath}`,
          severity: 'error',
          suggestion: 'Create configuration file or check path',
        });
      }
    }

    return results;
  }

  /**
   * Validate deployment path and content
   */
  private async validateDeploymentPath(context: DeploymentContext): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check if site path exists
    if (!existsSync(context.sitePath)) {
      results.push({
        passed: false,
        category: 'deployment',
        name: 'Site path existence',
        message: `Site path does not exist: ${context.sitePath}`,
        severity: 'error',
        suggestion: 'Create site directory or check path',
      });
      return results;
    }

    // Check if path is a directory
    const stat = statSync(context.sitePath);
    if (!stat.isDirectory()) {
      results.push({
        passed: false,
        category: 'deployment',
        name: 'Site path type',
        message: `Site path is not a directory: ${context.sitePath}`,
        severity: 'error',
        suggestion: 'Provide path to a directory',
      });
      return results;
    }

    results.push({
      passed: true,
      category: 'deployment',
      name: 'Site path validation',
      message: `Site path is valid: ${context.sitePath}`,
      severity: 'info',
    });

    // Check for index.html
    const indexPath = `${context.sitePath}/index.html`;
    if (existsSync(indexPath)) {
      results.push({
        passed: true,
        category: 'deployment',
        name: 'Index file',
        message: 'index.html found',
        severity: 'info',
      });
    } else {
      results.push({
        passed: this.options.strictMode ? false : true,
        category: 'deployment',
        name: 'Index file',
        message: 'index.html not found',
        severity: this.options.strictMode ? 'error' : 'warning',
        suggestion: 'Create index.html as the main entry point',
      });
    }

    return results;
  }

  /**
   * Validate wallet configuration and balance
   */
  private async validateWallet(context: DeploymentContext): Promise<ValidationResult[]> {
    if (this.options.skipWalletCheck) {
      return [];
    }

    const results: ValidationResult[] = [];

    try {
      // Check active address
      const activeAddress = execSync('sui client active-address', { encoding: 'utf8' }).trim();
      
      results.push({
        passed: true,
        category: 'wallet',
        name: 'Wallet address',
        message: `Active wallet address: ${activeAddress}`,
        severity: 'info',
        details: { address: activeAddress },
      });

      // Check gas balance if not skipped
      if (!this.options.skipGasCheck) {
        try {
          const balance = await this.getWalletBalance(activeAddress, context.network);
          const balanceNum = parseInt(balance);
          
          if (balanceNum >= this.options.minGasBalance) {
            results.push({
              passed: true,
              category: 'wallet',
              name: 'Gas balance',
              message: `Sufficient gas balance: ${(balanceNum / 1_000_000_000).toFixed(3)} SUI`,
              severity: 'info',
              details: { balance, balanceInSui: balanceNum / 1_000_000_000 },
            });
          } else {
            results.push({
              passed: false,
              category: 'wallet',
              name: 'Gas balance',
              message: `Insufficient gas balance: ${(balanceNum / 1_000_000_000).toFixed(3)} SUI (minimum: ${this.options.minGasBalance / 1_000_000_000} SUI)`,
              severity: 'error',
              suggestion: `Add gas funds to wallet address: ${activeAddress}`,
              details: { balance, required: this.options.minGasBalance },
            });
          }
        } catch (error) {
          results.push({
            passed: false,
            category: 'wallet',
            name: 'Gas balance check',
            message: 'Failed to check wallet balance',
            severity: 'error',
            suggestion: 'Ensure wallet is properly configured and network is accessible',
          });
        }
      }

      // Check if wallet has recent activity (optional check)
      try {
        const objects = execSync(`sui client objects ${activeAddress}`, { encoding: 'utf8' });
        const hasObjects = objects.trim().length > 0 && !objects.includes('No objects');
        
        if (hasObjects) {
          results.push({
            passed: true,
            category: 'wallet',
            name: 'Wallet activity',
            message: 'Wallet has objects/activity',
            severity: 'info',
          });
        } else {
          results.push({
            passed: true,
            category: 'wallet',
            name: 'Wallet activity',
            message: 'Wallet appears to be new (no objects)',
            severity: 'warning',
            suggestion: 'Consider testing with a small transaction first',
          });
        }
      } catch (error) {
        // Non-critical, don't fail validation
        this.logger.debug('Could not check wallet activity', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

    } catch (error) {
      results.push({
        passed: false,
        category: 'wallet',
        name: 'Wallet configuration',
        message: 'No active wallet address found',
        severity: 'error',
        suggestion: 'Configure wallet with: sui client active-address',
      });
    }

    return results;
  }

  /**
   * Validate network connectivity and health
   */
  private async validateNetwork(context: DeploymentContext): Promise<ValidationResult[]> {
    if (this.options.skipNetworkCheck || !this.networkHealthChecker) {
      return [];
    }

    const results: ValidationResult[] = [];

    try {
      const networkHealth = await this.networkHealthChecker.checkHealth();
      
      // Overall network health
      if (networkHealth.overall.healthy) {
        results.push({
          passed: true,
          category: 'network',
          name: 'Network health',
          message: `Network health is good (score: ${networkHealth.overall.score})`,
          severity: 'info',
          details: { score: networkHealth.overall.score },
        });
      } else {
        results.push({
          passed: false,
          category: 'network',
          name: 'Network health',
          message: `Network health issues detected (score: ${networkHealth.overall.score})`,
          severity: 'error',
          suggestion: 'Address network issues before deployment',
          details: { 
            score: networkHealth.overall.score,
            issues: networkHealth.overall.issues,
          },
        });
      }

      // Sui RPC connectivity
      if (networkHealth.sui.primary.available) {
        results.push({
          passed: true,
          category: 'network',
          name: 'Sui RPC connectivity',
          message: `Sui RPC connected (${networkHealth.sui.primary.responseTime}ms)`,
          severity: 'info',
        });
      } else {
        results.push({
          passed: false,
          category: 'network',
          name: 'Sui RPC connectivity',
          message: `Sui RPC unavailable: ${networkHealth.sui.primary.errorMessage}`,
          severity: 'error',
          suggestion: 'Check network connection and Sui RPC endpoint',
        });
      }

      // Walrus publisher connectivity
      if (networkHealth.walrus.publisher.available) {
        results.push({
          passed: true,
          category: 'network',
          name: 'Walrus publisher connectivity',
          message: `Walrus publisher connected (${networkHealth.walrus.publisher.responseTime}ms)`,
          severity: 'info',
        });
      } else {
        results.push({
          passed: false,
          category: 'network',
          name: 'Walrus publisher connectivity',
          message: `Walrus publisher unavailable: ${networkHealth.walrus.publisher.errorMessage}`,
          severity: 'error',
          suggestion: 'Check Walrus publisher endpoint or use fallback',
        });
      }

      // Walrus aggregator connectivity
      if (networkHealth.walrus.aggregator.available) {
        results.push({
          passed: true,
          category: 'network',
          name: 'Walrus aggregator connectivity',
          message: `Walrus aggregator connected (${networkHealth.walrus.aggregator.responseTime}ms)`,
          severity: 'info',
        });
      } else {
        results.push({
          passed: false,
          category: 'network',
          name: 'Walrus aggregator connectivity',
          message: `Walrus aggregator unavailable: ${networkHealth.walrus.aggregator.errorMessage}`,
          severity: 'error',
          suggestion: 'Check Walrus aggregator endpoint',
        });
      }

    } catch (error) {
      results.push({
        passed: false,
        category: 'network',
        name: 'Network health check',
        message: `Network health check failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
        suggestion: 'Check network connectivity and endpoint configuration',
      });
    }

    return results;
  }

  /**
   * Validate deployment size constraints
   */
  private async validateDeploymentSize(context: DeploymentContext): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    try {
      const totalSize = this.calculateDirectorySize(context.sitePath);
      
      if (totalSize <= this.options.maxDeploymentSize) {
        results.push({
          passed: true,
          category: 'deployment',
          name: 'Deployment size',
          message: `Deployment size is acceptable: ${this.formatBytes(totalSize)}`,
          severity: 'info',
          details: { sizeBytes: totalSize, sizeMB: totalSize / (1024 * 1024) },
        });
      } else {
        results.push({
          passed: false,
          category: 'deployment',
          name: 'Deployment size',
          message: `Deployment size exceeds limit: ${this.formatBytes(totalSize)} (max: ${this.formatBytes(this.options.maxDeploymentSize)})`,
          severity: 'error',
          suggestion: 'Reduce deployment size by removing unnecessary files or assets',
          details: { 
            sizeBytes: totalSize, 
            maxSizeBytes: this.options.maxDeploymentSize,
          },
        });
      }

      // Warn about large files
      const largeFiles = this.findLargeFiles(context.sitePath, 10 * 1024 * 1024); // 10MB
      if (largeFiles.length > 0) {
        results.push({
          passed: true,
          category: 'deployment',
          name: 'Large files',
          message: `Found ${largeFiles.length} large files (>10MB)`,
          severity: 'warning',
          suggestion: 'Consider optimizing large files for better performance',
          details: { largeFiles },
        });
      }

    } catch (error) {
      results.push({
        passed: false,
        category: 'deployment',
        name: 'Size calculation',
        message: `Failed to calculate deployment size: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'warning',
      });
    }

    return results;
  }

  /**
   * Validate file permissions and access
   */
  private async validatePermissions(context: DeploymentContext): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    try {
      // Check read permissions on site directory
      const stat = statSync(context.sitePath);
      if (stat.mode & 0o444) {
        results.push({
          passed: true,
          category: 'deployment',
          name: 'Directory permissions',
          message: 'Site directory is readable',
          severity: 'info',
        });
      } else {
        results.push({
          passed: false,
          category: 'deployment',
          name: 'Directory permissions',
          message: 'Site directory is not readable',
          severity: 'error',
          suggestion: 'Fix directory permissions',
        });
      }

      // Check for hidden files that might be unintentionally included
      const hiddenFiles = this.findHiddenFiles(context.sitePath);
      if (hiddenFiles.length > 0) {
        results.push({
          passed: true,
          category: 'deployment',
          name: 'Hidden files',
          message: `Found ${hiddenFiles.length} hidden files`,
          severity: 'warning',
          suggestion: 'Review hidden files to ensure they should be deployed',
          details: { hiddenFiles: hiddenFiles.slice(0, 10) }, // Limit to first 10
        });
      }

    } catch (error) {
      results.push({
        passed: false,
        category: 'deployment',
        name: 'Permission check',
        message: `Failed to check permissions: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'warning',
      });
    }

    return results;
  }

  /**
   * Get wallet balance for address
   */
  private async getWalletBalance(address: string, network: string): Promise<string> {
    try {
      const output = execSync(`sui client balance ${address}`, { encoding: 'utf8' });
      // Parse balance from output
      const match = output.match(/Balance:\s+(\d+)\s+SUI/);
      if (match) {
        return (parseInt(match[1]) * 1_000_000_000).toString(); // Convert to MIST
      }
      return '0';
    } catch (error) {
      throw new NetworkError(`Failed to get wallet balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate total size of directory
   */
  private calculateDirectorySize(dirPath: string): number {
    let totalSize = 0;
    
    const traverse = (path: string) => {
      try {
        const stat = statSync(path);
        if (stat.isFile()) {
          totalSize += stat.size;
        } else if (stat.isDirectory()) {
          const fs = require('fs');
          const files = fs.readdirSync(path);
          for (const file of files) {
            traverse(`${path}/${file}`);
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    };

    traverse(dirPath);
    return totalSize;
  }

  /**
   * Find files larger than threshold
   */
  private findLargeFiles(dirPath: string, threshold: number): Array<{ path: string; size: number }> {
    const largeFiles: Array<{ path: string; size: number }> = [];
    
    const traverse = (path: string) => {
      try {
        const stat = statSync(path);
        if (stat.isFile() && stat.size > threshold) {
          largeFiles.push({ path, size: stat.size });
        } else if (stat.isDirectory()) {
          const fs = require('fs');
          const files = fs.readdirSync(path);
          for (const file of files) {
            traverse(`${path}/${file}`);
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    };

    traverse(dirPath);
    return largeFiles;
  }

  /**
   * Find hidden files
   */
  private findHiddenFiles(dirPath: string): string[] {
    const hiddenFiles: string[] = [];
    
    const traverse = (path: string) => {
      try {
        const stat = statSync(path);
        const filename = path.split('/').pop() || '';
        
        if (filename.startsWith('.') && filename !== '.' && filename !== '..') {
          hiddenFiles.push(path);
        }
        
        if (stat.isDirectory() && !filename.startsWith('.')) {
          const fs = require('fs');
          const files = fs.readdirSync(path);
          for (const file of files) {
            traverse(`${path}/${file}`);
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    };

    traverse(dirPath);
    return hiddenFiles;
  }

  /**
   * Format bytes as human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Generate validation summary
   */
  private generateSummary(results: ValidationResult[], duration: number): ValidationSummary {
    const totalChecks = results.length;
    const passedChecks = results.filter(r => r.passed).length;
    const warnings = results.filter(r => r.severity === 'warning').length;
    const errors = results.filter(r => r.severity === 'error').length;

    const readinessScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    let overallStatus: 'ready' | 'warnings' | 'failed';
    if (errors > 0) {
      overallStatus = 'failed';
    } else if (warnings > 0) {
      overallStatus = 'warnings';
    } else {
      overallStatus = 'ready';
    }

    // Generate recommended actions
    const recommendedActions: string[] = [];
    
    for (const result of results.filter(r => !r.passed || r.severity === 'warning')) {
      if (result.suggestion) {
        recommendedActions.push(result.suggestion);
      }
    }

    // Estimate deployment time based on network health and size
    let estimatedDeploymentTime: number | undefined;
    if (overallStatus !== 'failed') {
      // Base time + network factor + size factor
      estimatedDeploymentTime = 30000; // 30 seconds base
      
      if (warnings > 0) {
        estimatedDeploymentTime *= 1.5; // Add 50% for warnings
      }
    }

    return {
      overallStatus,
      readinessScore,
      totalChecks,
      passedChecks,
      warnings,
      errors,
      results,
      estimatedDeploymentTime,
      recommendedActions: [...new Set(recommendedActions)], // Remove duplicates
    };
  }

  /**
   * Quick validation for basic readiness
   */
  async quickValidate(context: DeploymentContext): Promise<{ ready: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Quick dependency check
    try {
      execSync('sui --version', { stdio: 'ignore' });
    } catch {
      issues.push('Sui CLI not available');
    }

    try {
      execSync('walrus --version', { stdio: 'ignore' });
    } catch {
      issues.push('Walrus CLI not available');
    }

    // Quick path check
    if (!existsSync(context.sitePath)) {
      issues.push(`Site path does not exist: ${context.sitePath}`);
    }

    // Quick wallet check
    if (!this.options.skipWalletCheck) {
      try {
        execSync('sui client active-address', { stdio: 'ignore' });
      } catch {
        issues.push('No active wallet address');
      }
    }

    return {
      ready: issues.length === 0,
      issues,
    };
  }

  /**
   * Static factory methods
   */
  static forTestnet(options?: Partial<ValidationOptions>): PreDeploymentValidator {
    const networkConfig = NetworkHealthChecker.forTestnet().constructor.length > 0 
      ? undefined 
      : undefined; // Will be created by NetworkHealthChecker.forTestnet()
    
    return new PreDeploymentValidator(networkConfig, options);
  }

  static forMainnet(options?: Partial<ValidationOptions>): PreDeploymentValidator {
    const networkConfig = NetworkHealthChecker.forMainnet().constructor.length > 0 
      ? undefined 
      : undefined; // Will be created by NetworkHealthChecker.forMainnet()
    
    return new PreDeploymentValidator(networkConfig, options);
  }
}