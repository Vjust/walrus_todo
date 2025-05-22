import type { WalrusClientExt } from '../types/client';
import { WalrusError } from '../types/error';

export type NetworkEnvironment = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

interface NetworkConfig {
  expectedEnvironment: NetworkEnvironment;
  autoSwitch: boolean;
}

export class NetworkValidator {
  private readonly config: NetworkConfig;

  constructor(config: NetworkConfig) {
    this.config = config;
  }

  /**
   * Get the current Sui client environment
   * @returns The active Sui network environment
   */
  private getSuiEnvironment(): NetworkEnvironment {
    try {
      const output = execSync('sui client active-env', { encoding: 'utf8' });
      const environment = output.trim().toLowerCase() as NetworkEnvironment;
      
      if (!this.isValidEnvironment(environment)) {
        throw new WalrusError(`Invalid Sui environment: ${environment}`);
      }

      return environment;
    } catch (_error) {
      if (error instanceof WalrusError) {
        throw error;
      }
      throw new WalrusError(
        `Failed to get Sui environment: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the current Walrus client environment
   * @param walrusClient The Walrus client instance
   * @returns The active Walrus network environment
   */
  private async getWalrusEnvironment(walrusClient: WalrusClientExt): Promise<NetworkEnvironment> {
    try {
      const config = await walrusClient.getConfig();
      const environment = config?.network?.toLowerCase() as NetworkEnvironment;

      if (!this.isValidEnvironment(environment)) {
        throw new WalrusError(`Invalid Walrus environment: ${environment}`);
      }

      return environment;
    } catch (_error) {
      throw new WalrusError(
        `Failed to get Walrus environment: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if the environment string is valid
   * @param environment The environment string to validate
   * @returns True if valid, false otherwise
   */
  private isValidEnvironment(environment: string): environment is NetworkEnvironment {
    return ['mainnet', 'testnet', 'devnet', 'localnet'].includes(environment);
  }

  /**
   * Switch the Sui client to the specified environment
   * @param targetEnvironment The environment to switch to
   */
  private switchSuiEnvironment(targetEnvironment: NetworkEnvironment): void {
    try {
      execSync(`sui client switch --env ${targetEnvironment}`, { encoding: 'utf8' });
    } catch (_error) {
      throw new WalrusError(
        `Failed to switch Sui environment: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate network environment configuration
   * @param walrusClient The Walrus client instance
   * @throws {WalrusError} if validation fails
   */
  public async validateEnvironment(walrusClient: WalrusClientExt): Promise<void> {
    // Get current environments
    const suiEnvironment = this.getSuiEnvironment();
    const walrusEnvironment = await this.getWalrusEnvironment(walrusClient);

    // Check if Sui environment matches expected
    if (suiEnvironment !== this.config.expectedEnvironment) {
      if (this.config.autoSwitch) {
        this.switchSuiEnvironment(this.config.expectedEnvironment);
      } else {
        throw new WalrusError(
          `Sui environment mismatch. Expected: ${this.config.expectedEnvironment}, got: ${suiEnvironment}`
        );
      }
    }

    // Check if Walrus environment matches Sui
    if (walrusEnvironment !== this.config.expectedEnvironment) {
      throw new WalrusError(
        `Walrus environment mismatch. Expected: ${this.config.expectedEnvironment}, got: ${walrusEnvironment}`
      );
    }
  }

  /**
   * Get current network status
   * @param walrusClient The Walrus client instance
   * @returns Network status information
   */
  public async getNetworkStatus(walrusClient: WalrusClientExt): Promise<{
    suiEnvironment: NetworkEnvironment;
    walrusEnvironment: NetworkEnvironment;
    isValid: boolean;
  }> {
    const suiEnvironment = this.getSuiEnvironment();
    const walrusEnvironment = await this.getWalrusEnvironment(walrusClient);

    return {
      suiEnvironment,
      walrusEnvironment,
      isValid: suiEnvironment === walrusEnvironment && 
               suiEnvironment === this.config.expectedEnvironment
    };
  }
}