import { Command, Flags } from '@oclif/core';
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

/**
 * @class DeployCommand
 * @description This command deploys the Todo NFT smart contract to the Sui blockchain on a specified network.
 * It handles the preparation of contract files, executes the deployment using the Sui CLI, and saves the deployment information for future use.
 * The command requires the Sui CLI to be installed and a wallet address to be configured or provided.
 *
 * @param {string} network - The blockchain network to deploy the contract to ('localnet', 'devnet', 'testnet', 'mainnet'). (Required flag: -n, --network)
 * @param {string} [address] - The Sui wallet address to use for deployment. If not provided, it attempts to use the active address from Sui CLI or saved configuration. (Optional flag: -a, --address)
 * @param {string} [gas-budget='100000000'] - The gas budget for the deployment transaction. (Optional flag: --gas-budget)
 */
export default class DeployCommand extends Command {
  static description = 'Deploy the Todo NFT smart contract to the Sui blockchain';

  static examples = [
    '<%= config.bin %> deploy --network testnet',
    '<%= config.bin %> deploy --network devnet --address 0x123456...',
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
    }),
    'gas-budget': Flags.string({
      description: 'Gas budget for the deployment transaction',
      default: '100000000'
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
    const { network, address, 'gas-budget': gasBudget } = flags;

    try {
      // Check if sui client is installed
      try {
        execSync('sui --version', { stdio: 'ignore' });
      } catch (error) {
        throw new CLIError(
          'Sui CLI not found. Please install it first: cargo install --locked --git https://github.com/MystenLabs/sui.git sui',
          'SUI_CLI_NOT_FOUND'
        );
      }

      // Get active address from Sui CLI if not provided
      let deployAddress = address;
      if (!deployAddress) {
        try {
          deployAddress = (await configService.getConfig()).walletAddress;
          if (!deployAddress) {
            // Try to get it from Sui CLI
            const activeAddressOutput = execSync('sui client active-address', { encoding: 'utf8' }).trim();
            if (activeAddressOutput && activeAddressOutput.startsWith('0x')) {
              deployAddress = activeAddressOutput;
              // Save it to config for future use
              await configService.saveConfig({
                walletAddress: deployAddress,
              });
            }
          }
        } catch (error) {
          // Continue silently, we'll check for deployAddress below
        }
      }

      if (!deployAddress) {
        throw new CLIError(
          'No wallet address configured. Please run "waltodo configure" first or provide --address flag.',
          'NO_WALLET_ADDRESS'
        );
      }

      this.log(chalk.blue(`\nDeploying to ${network} network with address ${deployAddress}...`));

      // Get and log network URL
      const networkUrl = this.getNetworkUrl(network);
      this.log(chalk.dim(`Network URL: ${networkUrl}`));
      
      // Create temporary directory for deployment
      const tempDir = fs.mkdtempSync(path.join(path.resolve(os.tmpdir()), 'todo_nft_deploy_'));
      this.log(chalk.dim(`Created temporary directory for deployment: ${tempDir}`));
      
      // Set up contract directory structure
      const sourcesDir = path.join(tempDir, 'sources');
      fs.mkdirSync(sourcesDir, { recursive: true });
      
      // Copy Move.toml to temp directory with existence check
      const moveTomlSource = path.resolve(__dirname, '../../src/move/Move.toml');
      const moveTomlDest = path.join(tempDir, 'Move.toml');
      if (!fs.existsSync(moveTomlSource)) {
        throw new CLIError('Move.toml not found in src/move. Ensure the file exists.', 'FILE_NOT_FOUND');
      }
      fs.copyFileSync(moveTomlSource, moveTomlDest);
      this.log(chalk.dim('Copied Move.toml to temporary directory'));
      
      // Copy contract files
      const contractFiles = ['todo_nft.move'];
      for (const file of contractFiles) {
        const sourcePath = path.resolve(__dirname, `../../src/move/sources/${file}`);
        const destPath = path.join(sourcesDir, file);
        
        if (!fs.existsSync(sourcePath)) {
          throw new CLIError(`Contract file ${file} not found in src/move/sources. Ensure the file exists.`, 'FILE_NOT_FOUND');
        }
        
        fs.copyFileSync(sourcePath, destPath);
        this.log(chalk.dim(`Copied ${file} to temporary directory`));
      }

      this.log(chalk.blue('\nPublishing package to the Sui blockchain...'));
      
      try {
        // Publish package using Sui CLI
        const publishCommand = `sui client publish --skip-dependency-verification --gas-budget ${gasBudget} --json ${tempDir}`;
        this.log(chalk.dim(`Executing: ${publishCommand}`));
        
        const publishOutput = execSync(publishCommand, { encoding: 'utf8' });
        let publishResult;
        
        try {
          publishResult = JSON.parse(publishOutput);
        } catch (parseError) {
          throw new CLIError(`Failed to parse Sui CLI output: ${publishOutput}`, 'INVALID_OUTPUT');
        }
        
        if (!publishResult.effects?.created) {
          throw new CLIError('Could not extract package ID from publish result. Transaction may have failed.', 'DEPLOYMENT_FAILED');
        }
        
        // Find published package
        const packageObj = publishResult.effects.created.find((obj: { owner: string }) => obj.owner === 'Immutable');
        if (!packageObj) {
          throw new CLIError('Could not find package ID in created objects. Transaction may have succeeded but package creation failed.', 'DEPLOYMENT_FAILED');
        }
        
        const packageId = packageObj.reference.objectId;
        
        // Save deployment info and update configuration
        const deploymentInfo: DeploymentInfo = {
          packageId,
          digest: publishResult.digest,
          network,
          timestamp: new Date().toISOString()
        };
        
        const currentConfig = await configService.getConfig();
        await configService.saveConfig({
          ...currentConfig,  // Preserve other settings
          network,
          walletAddress: deployAddress,  // Save this for future use
          lastDeployment: deploymentInfo,
        });

        this.log(chalk.green('\n✓ Smart contract deployed successfully!'));
        this.log(chalk.blue('Deployment Info:'));
        this.log(chalk.bold(chalk.cyan(`  Package ID: ${packageId}`)));
        this.log(chalk.dim(`  Digest: ${publishResult.digest}`));
        this.log(chalk.dim(`  Network: ${network}`));
        this.log(chalk.dim(`  Address: ${deployAddress}`));
        
        this.log('\nConfiguration has been saved. You can now use other commands without specifying the package ID.');
        this.log(chalk.blue('\nView your package on Sui Explorer:'));
        this.log(chalk.cyan(`  https://explorer.sui.io/object/${packageId}?network=${network}`));

      } catch (execError: unknown) {
        const errorObj = execError as { status?: number; stderr?: { toString(): string }; message?: string };
        if (errorObj.status === 1) {
          // Sui CLI execution failed
          const errorOutput = errorObj.stderr?.toString() || errorObj.message || '';
          if (errorOutput.includes('gas budget')) {
            throw new CLIError(
              `Insufficient gas budget. Try increasing with --gas-budget flag. Error: ${errorOutput}`,
              'INSUFFICIENT_GAS'
            );
          } else if (errorOutput.includes('Balance insufficient')) {
            throw new CLIError(
              `Insufficient balance for deployment. Add funds to your wallet address. Error: ${errorOutput}`,
              'INSUFFICIENT_BALANCE'
            );
          } else {
            throw new CLIError(`Sui CLI execution failed: ${errorOutput}`, 'SUI_CLI_ERROR');
          }
        }
        throw execError; // Re-throw if it's not a CLI execution error
      } finally {
        // Clean up temporary directory
        try {
          fs.rmSync(tempDir, { recursive: true });
          this.log(chalk.dim('Cleaned up temporary deployment directory'));
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
