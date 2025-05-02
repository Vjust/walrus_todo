import { Command, Flags } from '@oclif/core';
import { SuiClient } from '@mysten/sui/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { CLIError } from '../utils/error-handler';
import { configService } from '../services/config-service';

interface NetworkInfo {
  [key: string]: string;
}

interface DeploymentInfo {
  packageId: string;
  digest: string;
  network: string;
  timestamp: string;
}

export default class DeployCommand extends Command {
  static description = 'Deploy the Todo NFT smart contract to the Sui blockchain';

  static examples = [
    '<%= config.bin %> deploy --network testnet',
  ];

  static flags = {
    network: Flags.string({
      char: 'n',
      description: 'Network to deploy to (localnet, devnet, testnet, mainnet)',
      required: true,
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
      default: 'devnet'
    }),
    address: Flags.string({
      char: 'a',
      description: 'Sui address to use (defaults to active address in Sui CLI)',
    })
  };

  private getNetworkUrl(network: string): string {
    const networkUrls: NetworkInfo = {
      localnet: 'http://localhost:9000',
      devnet: 'https://fullnode.devnet.sui.io:443',
      testnet: 'https://fullnode.testnet.sui.io:443',
      mainnet: 'https://fullnode.mainnet.sui.io:443'
    };

    const url = networkUrls[network];
    if (!url) {
      throw new CLIError(`Invalid network: ${network}`, 'INVALID_NETWORK');
    }
    return url;
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployCommand);
    const { network, address } = flags;

    try {
      // Get active address from Sui CLI if not provided
      let deployAddress = address;
      if (!deployAddress) {
        try {
          deployAddress = execSync('sui client active-address').toString().trim();
        } catch (error) {
          throw new CLIError('Failed to get active address from Sui CLI. Please run "sui client new-address" first.', 'NO_ACTIVE_ADDRESS');
        }
      }

      this.log(chalk.blue(`\nDeploying to ${network} network with address ${deployAddress}...`));

      // Initialize Sui client for network interaction
      const networkUrl = this.getNetworkUrl(network);
      const suiClient = new SuiClient({ url: networkUrl });
      
      // Create temporary directory for deployment
      const tempDir = fs.mkdtempSync(path.join(path.resolve(os.tmpdir()), 'todo_nft_deploy_'));
      this.log(`Created temporary directory for deployment: ${tempDir}`);
      
      // Set up contract directory structure
      const sourcesDir = path.join(tempDir, 'sources');
      fs.mkdirSync(sourcesDir, { recursive: true });
      
      // Copy Move.toml to temp directory
      const moveTomlSource = path.resolve(__dirname, '../../src/move/Move.toml');
      const moveTomlDest = path.join(tempDir, 'Move.toml');
      fs.copyFileSync(moveTomlSource, moveTomlDest);
      
      // Copy contract files
      const contractFiles = ['todo_nft.move'];
      for (const file of contractFiles) {
        const sourcePath = path.resolve(__dirname, `../../src/move/sources/${file}`);
        const destPath = path.join(sourcesDir, file);
        fs.copyFileSync(sourcePath, destPath);
      }

      try {
        // Publish package using Sui CLI
        const publishCommand = `sui client publish --skip-dependency-verification --gas-budget 100000000 --json ${tempDir}`;
        const publishOutput = execSync(publishCommand, { encoding: 'utf8' });
        const publishResult = JSON.parse(publishOutput);
        
        if (!publishResult.effects?.created) {
          throw new CLIError('Could not extract package ID from publish result', 'DEPLOYMENT_FAILED');
        }
        
        // Find published package
        const packageObj = publishResult.effects.created.find((obj: { owner: string }) => obj.owner === 'Immutable');
        if (!packageObj) {
          throw new CLIError('Could not find package ID in created objects', 'DEPLOYMENT_FAILED');
        }
        
        const packageId = packageObj.reference.objectId;
        
        // Save deployment info and update configuration
        const deploymentInfo: DeploymentInfo = {
          packageId,
          digest: publishResult.digest,
          network,
          timestamp: new Date().toISOString()
        };
        // Cast to `any` to bypass excess‑property checks while persisting the deployment info.
        await configService.saveConfig({
          network,
          lastDeployment: deploymentInfo,
        } as any);

        this.log(chalk.green('\n✓ Smart contract deployed successfully!'));
        this.log(chalk.blue('Deployment Info:'));
        this.log(chalk.dim(`  Package ID: ${packageId}`));
        this.log(chalk.dim(`  Digest: ${publishResult.digest}`));
        this.log(chalk.dim(`  Network: ${network}`));
        this.log('\nConfiguration has been saved. You can now use other commands without specifying the package ID.');

      } finally {
        // Clean up temporary directory
        try {
          fs.rmSync(tempDir, { recursive: true });
          this.log('Cleaned up temporary deployment directory');
        } catch (cleanupError) {
          const error = cleanupError as Error;
          this.warn(`Warning: Failed to clean up temporary directory: ${error.message}`);
        }
      }

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Deployment failed: ${error instanceof Error ? error.message : String(error)}`,
        'DEPLOYMENT_FAILED'
      );
    }
  }
}