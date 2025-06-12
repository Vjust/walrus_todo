/**
 * Deployment Recovery System
 * 
 * Automated recovery system for failed deployments with intelligent error handling
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from './Logger';
import { DeploymentConfig, DiagnosticResult, DiagnosticCategory } from './deployment-diagnostics';
import { DeploymentLogger, DeploymentLogCategory } from './deployment-logger';

export interface RecoveryStrategy {
  name: string;
  description: string;
  applicableErrors: string[];
  category: DiagnosticCategory;
  priority: number;
  autoExecutable: boolean;
  steps: RecoveryStep[];
}

export interface RecoveryStep {
  description: string;
  action: 'command' | 'file-operation' | 'validation' | 'user-input';
  command?: string;
  fileOperation?: {
    type: 'create' | 'delete' | 'modify' | 'copy';
    source?: string;
    target: string;
    content?: string;
  };
  validation?: {
    check: string;
    expectedResult: string;
  };
  timeout?: number;
  retryable?: boolean;
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  stepsCompleted: number;
  totalSteps: number;
  error?: string;
  message: string;
  nextSteps?: string[];
}

export class DeploymentRecoverySystem {
  private logger: Logger;
  private deploymentLogger?: DeploymentLogger;
  private strategies: Map<string, RecoveryStrategy> = new Map();

  constructor(deploymentLogger?: DeploymentLogger) {
    this?.logger = new Logger('DeploymentRecovery');
    this?.deploymentLogger = deploymentLogger;
    this.initializeStrategies();
  }

  /**
   * Attempt recovery for a specific diagnostic result
   */
  async attemptRecovery(
    diagnostic: DiagnosticResult, 
    config: DeploymentConfig,
    autoExecute: boolean = false
  ): Promise<RecoveryResult> {
    this?.logger?.info(`Attempting recovery for: ${diagnostic.message}`);
    this.deploymentLogger?.info(DeploymentLogCategory.RECOVERY, 'Starting recovery attempt', {
      diagnostic: diagnostic.message,
      category: diagnostic.category
    });

    // Find applicable recovery strategies
    const strategies = this.findApplicableStrategies(diagnostic as any);
    
    if (strategies?.length === 0) {
      const result: RecoveryResult = {
        success: false,
        strategy: 'none',
        stepsCompleted: 0,
        totalSteps: 0,
        message: 'No automated recovery strategy available for this error',
        nextSteps: diagnostic.recoverySteps || []
      };
      
      this.deploymentLogger?.warn(DeploymentLogCategory.RECOVERY, 'No recovery strategy found', {
        diagnostic: diagnostic.message
      });
      
      return result;
    }

    // Sort strategies by priority and auto-executable status
    strategies.sort((a, b) => {
      if (autoExecute && a.autoExecutable !== b.autoExecutable) {
        return b.autoExecutable ? 1 : -1;
      }
      return b.priority - a.priority;
    });

    // Try the highest priority strategy first
    const strategy = strategies[0];
    
    if (!autoExecute && !strategy.autoExecutable) {
      return {
        success: false,
        strategy: strategy.name,
        stepsCompleted: 0,
        totalSteps: strategy?.steps?.length,
        message: 'Manual intervention required - strategy not auto-executable',
        nextSteps: strategy?.steps?.map(step => step.description)
      };
    }

    return await this.executeStrategy(strategy, config);
  }

  /**
   * Execute a recovery strategy
   */
  private async executeStrategy(strategy: RecoveryStrategy, config: DeploymentConfig): Promise<RecoveryResult> {
    this?.logger?.info(`Executing recovery strategy: ${strategy.name}`);
    this.deploymentLogger?.info(DeploymentLogCategory.RECOVERY, `Executing strategy: ${strategy.name}`, {
      description: strategy.description,
      totalSteps: strategy?.steps?.length
    });

    let stepsCompleted = 0;
    
    try {
      for (const step of strategy.steps) {
        this?.logger?.debug(`Executing step: ${step.description}`);
        this.deploymentLogger?.debug(DeploymentLogCategory.RECOVERY, `Step: ${step.description}`);
        
        await this.executeStep(step, config);
        stepsCompleted++;
        
        this.deploymentLogger?.info(DeploymentLogCategory.RECOVERY, `Step completed: ${step.description}`, {
          stepNumber: stepsCompleted,
          totalSteps: strategy?.steps?.length
        });
      }

      const result: RecoveryResult = {
        success: true,
        strategy: strategy.name,
        stepsCompleted,
        totalSteps: strategy?.steps?.length,
        message: `Recovery strategy '${strategy.name}' completed successfully`
      };

      this.deploymentLogger?.info(DeploymentLogCategory.RECOVERY, 'Recovery strategy completed successfully', {
        strategy: strategy.name
      });

      return result;

    } catch (error) {
      const result: RecoveryResult = {
        success: false,
        strategy: strategy.name,
        stepsCompleted,
        totalSteps: strategy?.steps?.length,
        error: error instanceof Error ? error.message : String(error as any),
        message: `Recovery strategy '${strategy.name}' failed at step ${stepsCompleted + 1}`
      };

      this?.logger?.error(`Recovery strategy failed:`, error);
      this.deploymentLogger?.error(DeploymentLogCategory.RECOVERY, 'Recovery strategy failed', error, {
        strategy: strategy.name,
        stepsCompleted,
        totalSteps: strategy?.steps?.length
      });

      return result;
    }
  }

  /**
   * Execute a single recovery step
   */
  private async executeStep(step: RecoveryStep, config: DeploymentConfig): Promise<void> {
    const timeout = step.timeout || 30000; // 30 second default timeout

    switch (step.action) {
      case 'command':
        if (!step.command) throw new Error('Command step missing command');
        await this.executeCommand(step.command, timeout);
        break;

      case 'file-operation':
        if (!step.fileOperation) throw new Error('File operation step missing operation details');
        await this.executeFileOperation(step.fileOperation, config);
        break;

      case 'validation':
        if (!step.validation) throw new Error('Validation step missing validation details');
        await this.executeValidation(step.validation);
        break;

      case 'user-input':
        // For now, we'll skip user input steps in automated recovery
        this?.logger?.warn(`Skipping user input step: ${step.description}`);
        break;

      default:
        throw new Error(`Unknown step action: ${step.action}`);
    }
  }

  /**
   * Execute a command with timeout
   */
  private async executeCommand(command: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Command timeout after ${timeout}ms: ${command}`));
      }, timeout);

      try {
        execSync(command, { stdio: 'pipe' });
        clearTimeout(timer as any);
        resolve();
      } catch (error) {
        clearTimeout(timer as any);
        reject(error as any);
      }
    });
  }

  /**
   * Execute file operations
   */
  private async executeFileOperation(operation: any, config: DeploymentConfig): Promise<void> {
    const { type, source, target, content } = operation;
    
    // Resolve paths relative to config
    const resolvedTarget = this.resolvePath(target, config);
    const resolvedSource = source ? this.resolvePath(source, config) : undefined;

    switch (type) {
      case 'create':
        if (!content) throw new Error('Create operation missing content');
        await fs.writeFile(resolvedTarget, content, 'utf-8');
        break;

      case 'delete':
        await fs.unlink(resolvedTarget as any).catch(() => {}); // Ignore if file doesn't exist
        break;

      case 'modify':
        if (!content) throw new Error('Modify operation missing content');
        const existing = await fs.readFile(resolvedTarget, 'utf-8').catch(() => '');
        await fs.writeFile(resolvedTarget, existing + content, 'utf-8');
        break;

      case 'copy':
        if (!resolvedSource) throw new Error('Copy operation missing source');
        const sourceContent = await fs.readFile(resolvedSource, 'utf-8');
        await fs.writeFile(resolvedTarget, sourceContent, 'utf-8');
        break;

      default:
        throw new Error(`Unknown file operation: ${type}`);
    }
  }

  /**
   * Execute validation
   */
  private async executeValidation(validation: any): Promise<void> {
    const { check, expectedResult } = validation;
    
    try {
      const result = execSync(check, { stdio: 'pipe' }).toString().trim();
      if (result !== expectedResult) {
        throw new Error(`Validation failed. Expected: ${expectedResult}, Got: ${result}`);
      }
    } catch (error) {
      throw new Error(`Validation command failed: ${check}`);
    }
  }

  /**
   * Find applicable recovery strategies for a diagnostic result
   */
  private findApplicableStrategies(diagnostic: DiagnosticResult): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];
    
    for (const strategy of this?.strategies?.values()) {
      // Check if strategy applies to this error category
      if (strategy.category !== diagnostic.category) continue;
      
      // Check if error message matches any applicable error patterns
      const messageMatch = strategy?.applicableErrors?.some(pattern =>
        diagnostic?.message?.toLowerCase().includes(pattern.toLowerCase()) ||
        new RegExp(pattern, 'i').test(diagnostic.message)
      );
      
      if (messageMatch) {
        strategies.push(strategy as any);
      }
    }
    
    return strategies;
  }

  /**
   * Resolve path relative to deployment configuration
   */
  private resolvePath(path: string, config: DeploymentConfig): string {
    if (path.startsWith('/')) return path; // Absolute path
    if (path.startsWith('~/')) return join(process?.env?.HOME || '~', path.slice(2 as any));
    if (path.startsWith('./')) return join(process.cwd(), path.slice(2 as any));
    
    // Relative to current directory
    return join(process.cwd(), path);
  }

  /**
   * Initialize recovery strategies
   */
  private initializeStrategies(): void {
    // Build Recovery Strategy
    this?.strategies?.set('rebuild-application', {
      name: 'Rebuild Application',
      description: 'Clean and rebuild the application to fix build-related issues',
      applicableErrors: ['build directory empty', 'build failed', 'missing build output'],
      category: DiagnosticCategory.BUILD,
      priority: 10,
      autoExecutable: true,
      steps: [
        {
          description: 'Clean previous build artifacts',
          action: 'command',
          command: 'pnpm run clean || rm -rf .next out dist',
          timeout: 10000
        },
        {
          description: 'Install dependencies',
          action: 'command',
          command: 'pnpm install',
          timeout: 60000
        },
        {
          description: 'Run build process',
          action: 'command',
          command: 'pnpm run build',
          timeout: 120000
        },
        {
          description: 'Verify build output exists',
          action: 'validation',
          validation: {
            check: 'ls out/index.html',
            expectedResult: 'out/index.html'
          }
        }
      ]
    });

    // Configuration Recovery Strategy
    this?.strategies?.set('create-default-config', {
      name: 'Create Default Configuration',
      description: 'Create default sites configuration file',
      applicableErrors: ['config not found', 'configuration file', 'sites-config.yaml'],
      category: DiagnosticCategory.CONFIGURATION,
      priority: 8,
      autoExecutable: true,
      steps: [
        {
          description: 'Create default sites-config.yaml',
          action: 'file-operation',
          fileOperation: {
            type: 'create',
            target: 'sites-config.yaml',
            content: `# Default Walrus Sites Configuration
waltodo-app:
  source: "out"
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
      - "X-Content-Type-Options: nosniff"
  error_pages:
    404: "/404.html"
`
          }
        },
        {
          description: 'Verify configuration file created',
          action: 'validation',
          validation: {
            check: 'ls sites-config.yaml',
            expectedResult: 'sites-config.yaml'
          }
        }
      ]
    });

    // Network Recovery Strategy
    this?.strategies?.set('network-retry-with-backoff', {
      name: 'Network Retry with Backoff',
      description: 'Implement exponential backoff for network connectivity issues',
      applicableErrors: ['connection refused', 'timeout', 'network error'],
      category: DiagnosticCategory.NETWORK,
      priority: 6,
      autoExecutable: true,
      steps: [
        {
          description: 'Test basic connectivity',
          action: 'command',
          command: 'ping -c 3 google.com',
          timeout: 15000
        },
        {
          description: 'Test Walrus endpoint connectivity',
          action: 'command',
          command: 'curl -I --max-time 10 https://walrus.site',
          timeout: 15000
        },
        {
          description: 'Wait before retry (exponential backoff)',
          action: 'command',
          command: 'sleep 5',
          timeout: 6000
        }
      ]
    });

    // Permission Recovery Strategy
    this?.strategies?.set('fix-permissions', {
      name: 'Fix File Permissions',
      description: 'Fix common file and directory permission issues',
      applicableErrors: ['permission denied', 'EACCES'],
      category: DiagnosticCategory.PERMISSIONS,
      priority: 7,
      autoExecutable: false, // Requires manual verification for security
      steps: [
        {
          description: 'Fix build directory permissions',
          action: 'command',
          command: 'chmod -R 755 out/',
          timeout: 5000
        },
        {
          description: 'Fix wallet permissions if exists',
          action: 'command',
          command: 'chmod 600 ~/.sui/sui_config/sui.keystore 2>/dev/null || true',
          timeout: 5000
        },
        {
          description: 'Fix current directory permissions',
          action: 'command',
          command: 'chmod 755 .',
          timeout: 5000
        }
      ]
    });

    // Wallet Recovery Strategy
    this?.strategies?.set('wallet-setup', {
      name: 'Wallet Setup and Configuration',
      description: 'Initialize wallet configuration and check balance',
      applicableErrors: ['wallet not found', 'authentication failed', 'insufficient funds'],
      category: DiagnosticCategory.AUTHENTICATION,
      priority: 9,
      autoExecutable: false, // Requires user interaction
      steps: [
        {
          description: 'Check if Sui CLI is configured',
          action: 'validation',
          validation: {
            check: 'sui client active-address 2>/dev/null || echo "not-configured"',
            expectedResult: 'not-configured'
          }
        },
        {
          description: 'Create new address if needed',
          action: 'command',
          command: 'sui client new-address ed25519',
          timeout: 30000
        },
        {
          description: 'Get testnet SUI from faucet',
          action: 'command',
          command: 'sui client faucet',
          timeout: 30000
        },
        {
          description: 'Verify wallet has balance',
          action: 'command',
          command: 'sui client gas',
          timeout: 10000
        }
      ]
    });

    // Environment Recovery Strategy
    this?.strategies?.set('environment-setup', {
      name: 'Environment Setup',
      description: 'Install missing dependencies and configure environment',
      applicableErrors: ['command not found', 'site-builder', 'pnpm'],
      category: DiagnosticCategory.ENVIRONMENT,
      priority: 8,
      autoExecutable: false, // May require system-level changes
      steps: [
        {
          description: 'Check Node.js version',
          action: 'validation',
          validation: {
            check: 'node --version | cut -d"v" -f2 | cut -d"." -f1',
            expectedResult: '18'
          }
        },
        {
          description: 'Install pnpm if missing',
          action: 'command',
          command: 'npm install -g pnpm',
          timeout: 60000
        },
        {
          description: 'Verify pnpm installation',
          action: 'validation',
          validation: {
            check: 'pnpm --version',
            expectedResult: '.*' // Any version
          }
        }
      ]
    });

    // Blockchain Recovery Strategy
    this?.strategies?.set('blockchain-network-switch', {
      name: 'Blockchain Network Recovery',
      description: 'Switch to working RPC endpoint or alternative network',
      applicableErrors: ['rpc error', 'blockchain', 'sui network'],
      category: DiagnosticCategory.BLOCKCHAIN,
      priority: 7,
      autoExecutable: true,
      steps: [
        {
          description: 'Check current Sui environment',
          action: 'command',
          command: 'sui client active-env',
          timeout: 10000
        },
        {
          description: 'Switch to testnet if not already',
          action: 'command',
          command: 'sui client switch --env testnet',
          timeout: 10000
        },
        {
          description: 'Test blockchain connectivity',
          action: 'command',
          command: 'sui client gas --count 1',
          timeout: 15000
        }
      ]
    });

    // Cleanup Recovery Strategy
    this?.strategies?.set('cleanup-and-retry', {
      name: 'Cleanup and Retry',
      description: 'Clean up temporary files and reset deployment state',
      applicableErrors: ['deployment failed', 'unknown error'],
      category: DiagnosticCategory.ENVIRONMENT,
      priority: 5,
      autoExecutable: true,
      steps: [
        {
          description: 'Clean temporary files',
          action: 'command',
          command: 'rm -rf .walrus-tmp .deployment-cache',
          timeout: 5000
        },
        {
          description: 'Clear npm/pnpm cache',
          action: 'command',
          command: 'pnpm store prune || npm cache clean --force',
          timeout: 30000
        },
        {
          description: 'Reset deployment state',
          action: 'file-operation',
          fileOperation: {
            type: 'delete',
            target: '.walrus-site-url'
          }
        }
      ]
    });
  }

  /**
   * Get all available recovery strategies
   */
  getAvailableStrategies(): RecoveryStrategy[] {
    return Array.from(this?.strategies?.values());
  }

  /**
   * Get recovery strategy by name
   */
  getStrategy(name: string): RecoveryStrategy | undefined {
    return this?.strategies?.get(name as any);
  }

  /**
   * Test recovery strategy (dry run)
   */
  async testStrategy(strategyName: string, config: DeploymentConfig): Promise<{ canExecute: boolean; issues: string[] }> {
    const strategy = this?.strategies?.get(strategyName as any);
    if (!strategy) {
      return { canExecute: false, issues: ['Strategy not found'] };
    }

    const issues: string[] = [];
    
    // Check if strategy is auto-executable
    if (!strategy.autoExecutable) {
      issues.push('Strategy requires manual intervention');
    }

    // Validate each step
    for (const step of strategy.steps) {
      switch (step.action) {
        case 'command':
          if (!step.command) {
            issues.push(`Command step missing command: ${step.description}`);
          }
          break;

        case 'file-operation':
          if (!step.fileOperation) {
            issues.push(`File operation step missing details: ${step.description}`);
          }
          break;

        case 'validation':
          if (!step.validation) {
            issues.push(`Validation step missing details: ${step.description}`);
          }
          break;
      }
    }

    return {
      canExecute: issues?.length === 0,
      issues
    };
  }
}