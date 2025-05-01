import { Command } from 'commander';
import { SuiClient } from '@mysten/sui.js/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { handleError } from '../utils/error-handler';

export const deploy = new Command('deploy')
  .description('Deploy Todo NFT smart contract to Sui blockchain')
  .option('-n, --network <network>', 'Network to deploy to (localnet, devnet, testnet, mainnet)', 'devnet')
  .option('-a, --address <address>', 'Sui address to use (defaults to active address in Sui CLI)')
  .option('-o, --output <path>', 'Path to save deployment info', './todo_nft_deployment.json')
  .action(async (options) => {
    try {
      // Determine network URL
      const networkUrls = {
        localnet: 'http://localhost:9000',
        devnet: 'https://fullnode.devnet.sui.io:443',
        testnet: 'https://fullnode.testnet.sui.io:443',
        mainnet: 'https://fullnode.mainnet.sui.io:443'
      };

      const networkUrl = networkUrls[options.network];
      if (!networkUrl) {
        console.error(`Error: Invalid network "${options.network}". Valid options are: localnet, devnet, testnet, mainnet`);
        process.exit(1);
      }

      // Use Sui CLI to get active address if not provided
      let address = options.address;
      if (!address) {
        try {
          const activeAddressOutput = execSync('sui client active-address', { encoding: 'utf8' });
          address = activeAddressOutput.trim();
          if (!address) throw new Error('No active address found');
          console.log(`Using active Sui address: ${address}`);
        } catch (error) {
          console.error('Error getting active address from Sui CLI:', error.message);
          console.error('Please provide an address with --address or set an active address in Sui CLI');
          process.exit(1);
        }
      }

      console.log(`Deploying to ${options.network} network with address ${address}...`);

      // Initialize Sui client for network interaction
      const suiClient = new SuiClient({ url: networkUrl });
      
      // Create the todo_nft.move file in a temporary directory
      const tempDir = fs.mkdtempSync(path.join(path.resolve(os.tmpdir()), 'todo_nft_deploy_'));
      console.log(`Created temporary directory for deployment: ${tempDir}`);
      
      // Create the directory structure
      const sourcesDir = path.join(tempDir, 'sources');
      fs.mkdirSync(sourcesDir, { recursive: true });
      
      // Write the Move contract to the temporary directory
      const todoNftPath = path.join(sourcesDir, 'todo_nft.move');
      fs.writeFileSync(todoNftPath, `
module todo_nft::todo_nft {
    use sui::url::{Self, Url};
    use std::string;
    use sui::object::{Self, UID};
    use sui::event;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    // Define the TodoNFT structure
    struct TodoNFT has key, store {
        id: UID,
        title: string::String,
        description: string::String,
        completed: bool,
        walrus_blob_id: string::String,
        url: Url
    }

    // Event emitted when a TodoNFT is created
    struct TodoCreated has copy, drop {
        object_id: UID,
        title: string::String,
        walrus_blob_id: string::String
    }

    // Create a new TodoNFT and transfer it to the sender
    public entry fun create_todo(
        title: vector<u8>,
        description: vector<u8>,
        walrus_blob_id: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let todo_nft = TodoNFT {
            id: object::new(ctx),
            title: string::utf8(title),
            description: string::utf8(description),
            completed: false,
            walrus_blob_id: string::utf8(walrus_blob_id),
            url: url::new_unsafe_from_bytes(b"https://todo-app.example/api/todo/")
        };
        
        event::emit(TodoCreated {
            object_id: todo_nft.id,
            title: todo_nft.title,
            walrus_blob_id: todo_nft.walrus_blob_id
        });
        
        transfer::transfer(todo_nft, sender);
    }

    // Mark a todo as completed
    public entry fun complete_todo(todo: &mut TodoNFT) {
        todo.completed = true;
    }
}
      `);
      
      // Write the Move.toml file
      const moveTomlContent = `
[package]
name = "todo_nft"
version = "0.1.0"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/devnet" }

[addresses]
todo_nft = "0x0"
      `;
      
      fs.writeFileSync(path.join(tempDir, 'Move.toml'), moveTomlContent);
      
      console.log('Contract files created. Publishing to the network using Sui CLI...');
      
      try {
        // Use sui client CLI to publish the package
        const publishCommand = `sui client publish --gas-budget 100000000 --json ${tempDir}`;
        const publishOutput = execSync(publishCommand, { encoding: 'utf8' });
        
        // Parse the output to extract the package ID
        const publishResult = JSON.parse(publishOutput);
        const effects = publishResult.effects;
        
        if (!effects || !effects.created) {
          throw new Error('Could not extract package ID from publish result');
        }
        
        // Find the published package in the created objects
        const packageObj = effects.created.find(obj => obj.owner === 'Immutable');
        if (!packageObj) {
          throw new Error('Could not find package ID in created objects');
        }
        
        const packageId = packageObj.reference.objectId;
        console.log('Package published successfully!');
        console.log('Transaction digest:', publishResult.digest);
        console.log('Package ID:', packageId);
        
        // Save deployment info to file
        const deploymentInfo = {
          network: options.network,
          deploymentDate: new Date().toISOString(),
          packageId,
          deployerAddress: address,
          transactionDigest: publishResult.digest,
        };
        
        fs.writeFileSync(options.output, JSON.stringify(deploymentInfo, null, 2));
        console.log(`Deployment information saved to ${options.output}`);
        
        // Print usage instructions
        console.log('\nHow to use the deployed contract:');
        console.log('1. Update your configuration with the package ID:');
        console.log(`   - Module address: ${packageId}`);
        console.log('2. Use the store command to create todos with NFT references:');
        console.log(`   - waltodo store -t "My Todo" -d "Description" -m ${packageId} -n ${options.network}`);
        
        // Clean up temporary directory
        try {
          fs.rmSync(tempDir, { recursive: true });
          console.log('Cleaned up temporary deployment directory');
        } catch (cleanupError) {
          console.warn('Warning: Failed to clean up temporary directory:', cleanupError.message);
        }
      } catch (execError) {
        console.error('Error during compilation or deployment:', execError.message);
        if (execError.stdout) console.error('stdout:', execError.stdout.toString());
        if (execError.stderr) console.error('stderr:', execError.stderr.toString());
        process.exit(1);
      }
    } catch (error) {
      handleError('Deployment failed', error);
      process.exit(1);
    }
  });import { Command, Flags } from '@oclif/core';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { CLIError } from '../utils/error-handler';

interface DeploymentInfo {
  packageId: string;
  digest: string;
  network: string;
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
    }),
    address: Flags.string({
      char: 'a',
      description: 'Sui address to use (defaults to active address in Sui CLI)',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Path to save deployment info',
      default: 'todo_nft_deployment.json',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployCommand);
    const { network, address, output } = flags;

    try {
      this.log(chalk.blue(`\nDeploying smart contract to ${network} network...`));

      let command = `sui client publish --json --gas-budget 10000000 --skip-dependency-verification --network ${network}`;
      if (address) {
        command += ` --sender ${address}`;
      }
      command += ` ${path.join(__dirname, '..', 'move')}`;

      const result = execSync(command).toString();
      const deploymentOutput = JSON.parse(result);

      if (!deploymentOutput.published || deploymentOutput.published.length === 0) {
        throw new CLIError('Deployment failed: Could not find published package in output.', 'DEPLOYMENT_FAILED');
      }

      const packageInfo = deploymentOutput.published.find((pkg: any) => pkg.packageId);

      if (!packageInfo) {
        throw new CLIError('Deployment failed: Could not find package ID in output.', 'DEPLOYMENT_FAILED');
      }

      const deploymentInfo: DeploymentInfo = {
        packageId: packageInfo.packageId,
        digest: deploymentOutput.digest,
        network: network,
      };

      fs.writeFileSync(output, JSON.stringify(deploymentInfo, null, 2));

      this.log(chalk.green('\n✓ Smart contract deployed successfully!'));
      this.log(chalk.blue('Deployment Info:'));
      this.log(chalk.dim(`  Package ID: ${deploymentInfo.packageId}`));
      this.log(chalk.dim(`  Digest: ${deploymentInfo.digest}`));
      this.log(chalk.dim(`  Network: ${deploymentInfo.network}`));
      this.log(chalk.dim(`  Saved to: ${output}`));

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`, 'DEPLOYMENT_FAILED');
    }
  }
}
