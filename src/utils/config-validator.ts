/**
 * Configuration Validator
 *
 * Validates configuration consistency between CLI and frontend.
 * Helps identify configuration mismatches and missing settings.
 */

import * as fs from 'fs';
import * as path from 'path';
import { configService } from '../services/config-service';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ConfigComparison {
  cli: Record<string, unknown>;
  frontend: Record<string, unknown>;
  differences: string[];
}

/**
 * Validates CLI and frontend configuration consistency
 */
export class ConfigValidator {
  private readonly projectRoot: string;
  private readonly frontendConfigDir: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.frontendConfigDir = path.join(
      this.projectRoot,
      'waltodo-frontend',
      'src',
      'config'
    );
  }

  /**
   * Performs comprehensive configuration validation
   */
  async validateConfiguration(network?: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      // Get CLI configuration
      const cliConfig = configService.getConfig();
      const targetNetwork = network || cliConfig.network || 'testnet';

      // Validate CLI configuration
      this.validateCliConfig(cliConfig, result);

      // Check if frontend exists
      const frontendExists = await this.frontendExists();
      if (!frontendExists) {
        result.warnings.push('Frontend directory not found');
        result.suggestions.push(
          'Ensure waltodo-frontend directory exists in project root'
        );
        return result;
      }

      // Validate frontend configuration
      await this.validateFrontendConfig(targetNetwork, result);

      // Compare CLI and frontend configurations
      await this.compareConfigurations(cliConfig, targetNetwork, result);

      // Validate deployment consistency
      this.validateDeploymentConsistency(cliConfig, result);

      // Check environment variables
      this.validateEnvironmentVariables(result);

      // Set overall validity
      result.valid = result.errors.length === 0;
    } catch (error) {
      result.errors.push(
        `Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
      result.valid = false;
    }

    return result;
  }

  /**
   * Validates CLI configuration
   */
  private validateCliConfig(
    config: Record<string, unknown>,
    result: ValidationResult
  ): void {
    if (!config.network) {
      result.errors.push('Network not configured in CLI');
      result.suggestions.push('Run: waltodo configure --network <network>');
    }

    if (!config.walletAddress) {
      result.warnings.push('Wallet address not configured');
      result.suggestions.push('Run: waltodo configure --address <address>');
    }

    if (!config.packageId && !config.lastDeployment?.packageId) {
      result.errors.push('Package ID not found in configuration');
      result.suggestions.push('Run: waltodo deploy --network <network>');
    }

    // Validate network format
    if (
      config.network &&
      typeof config.network === 'string' &&
      !['mainnet', 'testnet', 'devnet', 'localnet'].includes(config.network)
    ) {
      result.errors.push(`Invalid network: ${config.network}`);
    }

    // Validate package ID format
    const lastDeployment = config.lastDeployment as
      | Record<string, unknown>
      | undefined;
    const packageId = config.packageId || lastDeployment?.packageId;
    if (
      packageId &&
      typeof packageId === 'string' &&
      !packageId.startsWith('0x')
    ) {
      result.errors.push('Package ID must start with 0x');
    }
  }

  /**
   * Validates frontend configuration
   */
  private async validateFrontendConfig(
    network: string,
    result: ValidationResult
  ): Promise<void> {
    const configPath = path.join(this.frontendConfigDir, `${network}.json`);

    if (!fs.existsSync(configPath)) {
      result.errors.push(
        `Frontend configuration not found for ${network} network`
      );
      result.suggestions.push(
        `Run: waltodo generate-frontend-config --network ${network}`
      );
      return;
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const frontendConfig = JSON.parse(configContent);

      // Validate required fields
      const requiredFields = [
        'network.name',
        'network.url',
        'deployment.packageId',
        'contracts.todoNft.packageId',
      ];

      for (const field of requiredFields) {
        if (!this.getNestedValue(frontendConfig, field)) {
          result.errors.push(
            `Missing required field in frontend config: ${field}`
          );
        }
      }

      // Validate network consistency
      if (frontendConfig.network?.name !== network) {
        result.errors.push(
          `Frontend config network mismatch: expected ${network}, got ${frontendConfig.network?.name}`
        );
      }

      // Validate package ID format
      if (
        frontendConfig.deployment?.packageId &&
        !frontendConfig.deployment.packageId.startsWith('0x')
      ) {
        result.errors.push('Frontend config package ID must start with 0x');
      }
    } catch (error) {
      result.errors.push(
        `Invalid JSON in frontend config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Compares CLI and frontend configurations
   */
  private async compareConfigurations(
    cliConfig: Record<string, unknown>,
    network: string,
    result: ValidationResult
  ): Promise<void> {
    const configPath = path.join(this.frontendConfigDir, `${network}.json`);

    if (!fs.existsSync(configPath)) {
      return; // Already handled in validateFrontendConfig
    }

    try {
      const frontendConfigContent = fs.readFileSync(configPath, 'utf-8');
      const frontendConfig = JSON.parse(frontendConfigContent);

      const cliPackageId =
        cliConfig.packageId || cliConfig.lastDeployment?.packageId;
      const frontendPackageId = frontendConfig.deployment?.packageId;

      if (
        cliPackageId &&
        frontendPackageId &&
        cliPackageId !== frontendPackageId
      ) {
        result.errors.push(
          `Package ID mismatch: CLI (${cliPackageId}) vs Frontend (${frontendPackageId})`
        );
        result.suggestions.push(
          'Run: waltodo generate-frontend-config --force'
        );
      }

      if (cliConfig.network !== frontendConfig.network?.name) {
        result.warnings.push(
          `Network mismatch: CLI (${cliConfig.network}) vs Frontend (${frontendConfig.network?.name})`
        );
      }

      if (
        cliConfig.walletAddress !== frontendConfig.deployment?.deployerAddress
      ) {
        result.warnings.push(
          'Deployer address mismatch between CLI and frontend config'
        );
      }
    } catch (error) {
      // Already handled in validateFrontendConfig
    }
  }

  /**
   * Validates deployment consistency
   */
  private validateDeploymentConsistency(
    config: Record<string, unknown>,
    result: ValidationResult
  ): void {
    if (config.lastDeployment) {
      const lastDeployment = config.lastDeployment as Record<string, unknown>;
      const { packageId, digest, network, timestamp } = lastDeployment;

      if (!packageId) {
        result.errors.push('Last deployment missing package ID');
      }

      if (!digest) {
        result.warnings.push('Last deployment missing transaction digest');
      }

      if (network !== config.network) {
        result.warnings.push(
          `Deployment network (${network}) differs from current network (${config.network})`
        );
        result.suggestions.push(
          `Consider redeploying to ${config.network} network`
        );
      }

      // Check if deployment is recent (within 30 days)
      if (timestamp) {
        const deploymentDate = new Date(timestamp);
        const daysSinceDeployment =
          (Date.now() - deploymentDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceDeployment > 30) {
          result.warnings.push(
            `Deployment is ${Math.floor(daysSinceDeployment)} days old`
          );
          result.suggestions.push(
            'Consider redeploying for latest contract improvements'
          );
        }
      }
    }
  }

  /**
   * Validates environment variables
   */
  private validateEnvironmentVariables(result: ValidationResult): void {
    const requiredEnvVars = ['NETWORK'];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        result.warnings.push(`Environment variable ${envVar} not set`);
      }
    }

    // Check NEXT_PUBLIC_NETWORK for frontend
    if (!process.env.NEXT_PUBLIC_NETWORK) {
      result.suggestions.push(
        'Set NEXT_PUBLIC_NETWORK environment variable for frontend'
      );
    }
  }

  /**
   * Gets nested object value by dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Checks if frontend directory exists
   */
  private async frontendExists(): Promise<boolean> {
    try {
      const frontendPath = path.join(this.projectRoot, 'waltodo-frontend');
      const stats = await fs.promises.stat(frontendPath);
      return stats.isDirectory();
    } catch (error: unknown) {
      return false;
    }
  }

  /**
   * Gets available frontend configurations
   */
  async getAvailableConfigurations(): Promise<string[]> {
    try {
      if (!fs.existsSync(this.frontendConfigDir)) {
        return [];
      }

      const files = await fs.promises.readdir(this.frontendConfigDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error: unknown) {
      return [];
    }
  }

  /**
   * Generates a validation report
   */
  generateReport(result: ValidationResult): string {
    const lines: string[] = [];

    lines.push('# Configuration Validation Report');
    lines.push('');
    lines.push(`**Status**: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push('');

    if (result.errors.length > 0) {
      lines.push('## Errors');
      result.errors.forEach(error => lines.push(`- ❌ ${error}`));
      lines.push('');
    }

    if (result.warnings.length > 0) {
      lines.push('## Warnings');
      result.warnings.forEach(warning => lines.push(`- ⚠️ ${warning}`));
      lines.push('');
    }

    if (result.suggestions.length > 0) {
      lines.push('## Suggestions');
      result.suggestions.forEach(suggestion =>
        lines.push(`- 💡 ${suggestion}`)
      );
      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Creates a new configuration validator
 */
export function createConfigValidator(projectRoot?: string): ConfigValidator {
  return new ConfigValidator(projectRoot);
}
