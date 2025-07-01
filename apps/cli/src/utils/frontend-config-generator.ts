/**
 * Frontend Configuration Generator
 *
 * Generates configuration files that the frontend can consume after deployment.
 * This ensures both CLI and frontend use consistent contract addresses and network settings.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './Logger';
import { CLIError } from '../types/error';
import { NETWORK_URLS } from '../constants';

const logger = new Logger('FrontendConfigGenerator');

/**
 * Network configuration for the frontend
 */
export interface NetworkConfig {
  name: string;
  url: string;
  faucetUrl?: string;
  explorerUrl: string;
}

/**
 * Walrus configuration for the frontend
 */
export interface WalrusConfig {
  networkUrl: string;
  publisherUrl: string;
  aggregatorUrl: string;
  apiPrefix: string;
}

/**
 * Deployment configuration for the frontend
 */
export interface DeploymentConfig {
  packageId: string;
  digest: string;
  timestamp: string;
  deployerAddress: string;
}

/**
 * Complete frontend configuration
 */
export interface FrontendConfig {
  network: NetworkConfig;
  walrus: WalrusConfig;
  deployment: DeploymentConfig;
  contracts: {
    todoNft: {
      packageId: string;
      moduleName: string;
      structName: string;
    };
  };
  features: {
    aiEnabled: boolean;
    blockchainVerification: boolean;
    encryptedStorage: boolean;
  };
}

/**
 * Environment-specific network configurations
 */
const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  mainnet: {
    name: 'mainnet',
    url: NETWORK_URLS.mainnet,
    explorerUrl: 'https://suiexplorer.com',
  },
  testnet: {
    name: 'testnet',
    url: NETWORK_URLS.testnet,
    faucetUrl: 'https://faucet?.testnet?.sui.io',
    explorerUrl: 'https://testnet?.suiexplorer?.com',
  },
  devnet: {
    name: 'devnet',
    url: NETWORK_URLS.devnet,
    faucetUrl: 'https://faucet?.devnet?.sui.io',
    explorerUrl: 'https://devnet?.suiexplorer?.com',
  },
  localnet: {
    name: 'localnet',
    url: NETWORK_URLS.localnet,
    explorerUrl: 'http://localhost:9001',
  },
};

/**
 * Environment-specific Walrus configurations
 */
const WALRUS_CONFIGS: Record<string, WalrusConfig> = {
  mainnet: {
    networkUrl: 'https://wal?.devnet?.sui.io',
    publisherUrl: 'https://publisher?.walrus?.site',
    aggregatorUrl: 'https://aggregator?.walrus?.site',
    apiPrefix: 'https://api?.walrus?.tech/1.0',
  },
  testnet: {
    networkUrl: 'https://wal?.testnet?.sui.io',
    publisherUrl: 'https://publisher-testnet?.walrus?.site',
    aggregatorUrl: 'https://aggregator-testnet?.walrus?.site',
    apiPrefix: 'https://api-testnet?.walrus?.tech/1.0',
  },
  devnet: {
    networkUrl: 'https://wal?.devnet?.sui.io',
    publisherUrl: 'https://publisher-devnet?.walrus?.site',
    aggregatorUrl: 'https://aggregator-devnet?.walrus?.site',
    apiPrefix: 'https://api-devnet?.walrus?.tech/1.0',
  },
  localnet: {
    networkUrl: 'http://localhost:31415',
    publisherUrl: 'http://localhost:31416',
    aggregatorUrl: 'http://localhost:31417',
    apiPrefix: 'http://localhost:31418/1.0',
  },
};

/**
 * Generates frontend configuration based on deployment information
 */
export class FrontendConfigGenerator {
  private readonly frontendPath: string;
  private readonly configDir: string;

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this?.frontendPath = path.join(root, 'waltodo-frontend');
    this?.configDir = path.join(this.frontendPath, 'src', 'config');
  }

  /**
   * Generates and saves frontend configuration files after deployment
   */
  async generateConfig(
    network: string,
    packageId: string,
    digest: string,
    deployerAddress: string,
    options?: {
      aiEnabled?: boolean;
      blockchainVerification?: boolean;
      encryptedStorage?: boolean;
    }
  ): Promise<void> {
    logger.info(`Generating frontend config for ${network} network`);

    try {
      // Ensure config directory exists
      await this.ensureConfigDirectory();

      // Get network and Walrus configurations
      const networkConfig = this.getNetworkConfig(network);
      const walrusConfig = this.getWalrusConfig(network);

      // Create deployment configuration
      const deploymentConfig: DeploymentConfig = {
        packageId,
        digest,
        timestamp: new Date().toISOString(),
        deployerAddress,
      };

      // Build complete frontend configuration
      const frontendConfig: FrontendConfig = {
        network: networkConfig,
        walrus: walrusConfig,
        deployment: deploymentConfig,
        contracts: {
          todoNft: {
            packageId,
            moduleName: 'todo_nft',
            structName: 'TodoNFT',
          },
        },
        features: {
          aiEnabled: options?.aiEnabled ?? true,
          blockchainVerification: options?.blockchainVerification ?? true,
          encryptedStorage: options?.encryptedStorage ?? false,
        },
      };

      // Save configurations
      await this.saveNetworkConfig(network, frontendConfig);
      await this.saveEnvironmentConfig(network, frontendConfig);
      await this.generateConfigIndex();

      logger.info(`Frontend configuration generated successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Failed to generate frontend config: ${errorMessage}`);
      throw new CLIError(
        `Failed to generate frontend configuration: ${errorMessage}`,
        'CONFIG_GENERATION_FAILED'
      );
    }
  }

  /**
   * Ensures the config directory exists
   */
  private async ensureConfigDirectory(): Promise<void> {
    try {
      await fs?.promises?.mkdir(this.configDir, { recursive: true });
    } catch (error) {
      throw new CLIError(
        `Failed to create config directory: ${error instanceof Error ? error.message : String(error)}`,
        'CONFIG_DIR_CREATE_FAILED'
      );
    }
  }

  /**
   * Gets network configuration for the specified network
   */
  private getNetworkConfig(network: string): NetworkConfig {
    const config = NETWORK_CONFIGS[network];
    if (!config) {
      throw new CLIError(
        `Unsupported network: ${network}`,
        'UNSUPPORTED_NETWORK'
      );
    }
    return config;
  }

  /**
   * Gets Walrus configuration for the specified network
   */
  private getWalrusConfig(network: string): WalrusConfig {
    const config = WALRUS_CONFIGS[network];
    if (!config) {
      throw new CLIError(
        `Unsupported Walrus network: ${network}`,
        'UNSUPPORTED_WALRUS_NETWORK'
      );
    }
    return config;
  }

  /**
   * Saves network-specific configuration file
   */
  private async saveNetworkConfig(
    network: string,
    config: FrontendConfig
  ): Promise<void> {
    const configPath = path.join(this.configDir, `${network}.ts`);
    const content = this.generateNetworkConfigContent(network, config);

    await fs?.promises?.writeFile(configPath, content, 'utf-8');
    logger.debug(`Saved network config: ${configPath}`);
  }

  /**
   * Saves environment configuration (JSON format for runtime loading)
   */
  private async saveEnvironmentConfig(
    network: string,
    config: FrontendConfig
  ): Promise<void> {
    const configPath = path.join(this.configDir, `${network}.json`);
    const content = JSON.stringify(config, null, 2);

    await fs?.promises?.writeFile(configPath, content, 'utf-8');
    logger.debug(`Saved environment config: ${configPath}`);
  }

  /**
   * Generates TypeScript content for network configuration
   */
  private generateNetworkConfigContent(
    network: string,
    config: FrontendConfig
  ): string {
    return `/**
 * Auto-generated configuration for ${network} network
 * Generated at: ${config?.deployment?.timestamp}
 * Package ID: ${config?.deployment?.packageId}
 */

export const ${network.toUpperCase()}_CONFIG = {
  network: {
    name: '${config?.network?.name}',
    url: '${config?.network?.url}',
    ${config?.network?.faucetUrl ? `faucetUrl: '${config?.network?.faucetUrl}',` : ''}
    explorerUrl: '${config?.network?.explorerUrl}',
  },
  
  walrus: {
    networkUrl: '${config?.walrus?.networkUrl}',
    publisherUrl: '${config?.walrus?.publisherUrl}',
    aggregatorUrl: '${config?.walrus?.aggregatorUrl}',
    apiPrefix: '${config?.walrus?.apiPrefix}',
  },
  
  deployment: {
    packageId: '${config?.deployment?.packageId}',
    digest: '${config?.deployment?.digest}',
    timestamp: '${config?.deployment?.timestamp}',
    deployerAddress: '${config?.deployment?.deployerAddress}',
  },
  
  contracts: {
    todoNft: {
      packageId: '${config?.contracts?.todoNft.packageId}',
      moduleName: '${config?.contracts?.todoNft.moduleName}',
      structName: '${config?.contracts?.todoNft.structName}',
    },
  },
  
  features: {
    aiEnabled: ${config?.features?.aiEnabled},
    blockchainVerification: ${config?.features?.blockchainVerification},
    encryptedStorage: ${config?.features?.encryptedStorage},
  },
} as const;

export default ${network.toUpperCase()}_CONFIG;
`;
  }

  /**
   * Generates the main config index file that exports all network configurations
   */
  private async generateConfigIndex(): Promise<void> {
    const indexPath = path.join(this.configDir, 'index.ts');

    // Get all existing network config files
    const configFiles = await fs?.promises?.readdir(this.configDir);
    const networkFiles = configFiles
      .filter(file => file.endsWith('.ts') && file !== 'index.ts')
      .map(file => file.replace('.ts', ''));

    const content = `/**
 * Auto-generated configuration index
 * Exports all network configurations
 */

${networkFiles
  .map(network => `import ${network.toUpperCase()}_CONFIG from './${network}';`)
  .join('\n')}

export type NetworkName = ${networkFiles.map(n => `'${n}'`).join(' | ')};

export const NETWORK_CONFIGS = {
${networkFiles
  .map(network => `  ${network}: ${network.toUpperCase()}_CONFIG,`)
  .join('\n')}
} as const;

export { ${networkFiles.map(n => `${n.toUpperCase()}_CONFIG`).join(', ')} };

/**
 * Get configuration for a specific network
 */
export function getNetworkConfig(network: NetworkName) {
  const config = NETWORK_CONFIGS[network];
  if (!config) {
    throw new Error(\`Configuration not found for network: \${network}\`);
  }
  return config;
}

/**
 * Get current network configuration from environment
 */
export function getCurrentNetworkConfig() {
  const network = (process?.env?.NEXT_PUBLIC_NETWORK || 'testnet') as NetworkName;
  return getNetworkConfig(network);
}
`;

    await fs?.promises?.writeFile(indexPath, content, 'utf-8');
    logger.debug(`Generated config index: ${indexPath}`);
  }

  /**
   * Checks if frontend directory exists
   */
  async frontendExists(): Promise<boolean> {
    try {
      const stats = await fs?.promises?.stat(this.frontendPath);
      return stats.isDirectory();
    } catch (error: unknown) {
      return false;
    }
  }

  /**
   * Gets the frontend configuration directory path
   */
  getConfigDirectory(): string {
    return this.configDir;
  }
}

/**
 * Creates a new frontend configuration generator
 */
export function createFrontendConfigGenerator(
  projectRoot?: string
): FrontendConfigGenerator {
  return new FrontendConfigGenerator(projectRoot);
}
