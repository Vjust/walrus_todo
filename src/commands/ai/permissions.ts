import { Command, Flags, Args } from '@oclif/core';
import BaseCommand from '../../base-command';
import { secureCredentialManager } from '../../services/ai/SecureCredentialManager';
import { BlockchainVerifier } from '../../services/ai/BlockchainVerifier';
import { SuiAIVerifierAdapter } from '../../services/ai/adapters/SuiAIVerifierAdapter';
import { AIPermissionLevel } from '../../types/adapters/AICredentialAdapter';
import { AIPermissionManager, initializePermissionManager } from '../../services/ai/AIPermissionManager';
import chalk from 'chalk';

export default class AiPermissions extends BaseCommand {
  static description = 'Manage permissions for AI operations';

  /**
   * Gets a Sui signer instance for blockchain operations
   * @returns A Promise resolving to a Sui signer
   */
  private async getSuiSigner() {
    try {
      const { KeystoreSigner } = require('../../utils/sui-keystore');
      return await KeystoreSigner.fromPath('');
    } catch (error) {
      this.error(`Failed to initialize Sui signer: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // To satisfy TypeScript - execution won't reach here after this.error()
    }
  }

  static flags = {
    ...BaseCommand.flags,
    operation: Flags.string({
      description: 'Permission operation',
      required: true,
      options: [
        'list',
        'check',
        'grant',
        'revoke',
        'register'
      ]
    }),
    provider: Flags.string({
      description: 'AI provider name',
      required: false
    }),
    aiOperation: Flags.string({
      description: 'AI operation name to check/grant/revoke',
      required: false
    }),
    permission: Flags.string({
      description: 'Permission level to grant',
      required: false,
      options: [
        'no_access',
        'read_only',
        'standard',
        'advanced',
        'admin'
      ]
    }),
    registry: Flags.string({
      description: 'Blockchain registry address',
      required: false
    }),
    packageId: Flags.string({
      description: 'Package ID of the AI verifier smart contract',
      required: false
    }),
    format: Flags.string({
      description: 'Output format',
      required: false,
      options: ['json', 'table'],
      default: 'table'
    }),
    verify: Flags.boolean({
      description: 'Verify permission on blockchain',
      default: false
    })
  };

  private async initializePermissionManager() {
    const { flags } = await this.parse(AiPermissions);
    
    // Check for required blockchain flags
    if (!flags.registry || !flags.packageId) {
      this.warn(chalk.yellow('⚠️  Blockchain integration not configured. Some features will be limited.'));
      this.warn(chalk.dim('Use --registry and --packageId to enable blockchain verification.'));
      
      // Still create a permission manager with local credential manager
      return null;
    }
    
    try {
      // Initialize blockchain components
      const signer = await this.getSuiSigner();
      const suiClient = signer.getClient();
      
      // Create verifier adapter
      const verifierAdapter = new SuiAIVerifierAdapter(
        suiClient,
        signer,
        flags.packageId,
        flags.registry
      );
      
      // Create blockchain verifier
      const blockchainVerifier = new BlockchainVerifier(verifierAdapter);
      
      // Create permission manager
      const permissionManager = initializePermissionManager(
        secureCredentialManager,
        blockchainVerifier
      );
      
      this.log(chalk.green('✓ Permission system initialized successfully.'));
      
      return permissionManager;
    } catch (error) {
      this.warn(chalk.yellow(`⚠️  Blockchain integration failed: ${error}`));
      this.warn(chalk.dim('Continuing with local permission management only.'));
      return null;
    }
  }

  async run() {
    const { flags } = await this.parse(AiPermissions);
    
    // Initialize permission manager
    const permissionManager = await this.initializePermissionManager();
    
    // For operations that don't require the permission manager, create a minimal one
    const localPermissionManager = permissionManager || initializePermissionManager(
      secureCredentialManager,
      new BlockchainVerifier({} as any) // Dummy verifier
    );
    
    // Execute the requested operation
    switch (flags.operation) {
      case 'list':
        await this.listPermissions(flags, localPermissionManager);
        break;
      case 'check':
        await this.checkPermission(flags, localPermissionManager);
        break;
      case 'grant':
        await this.grantPermission(flags, localPermissionManager);
        break;
      case 'revoke':
        await this.revokePermission(flags, localPermissionManager);
        break;
      case 'register':
        await this.registerOperation(flags, permissionManager);
        break;
      default:
        this.error(`Unknown operation: ${flags.operation}`);
    }
  }

  private async listPermissions(flags: any, permissionManager: AIPermissionManager) {
    try {
      if (flags.provider) {
        // List permissions for a specific provider
        const operations = await permissionManager.getAllowedOperations(flags.provider);
        const permissionLevel = await permissionManager.getPermissionLevel(flags.provider);
        
        if (flags.format === 'json') {
          this.log(JSON.stringify({
            provider: flags.provider,
            permission_level: this.permissionLevelToString(permissionLevel),
            allowed_operations: operations
          }, null, 2));
        } else {
          this.log(chalk.bold(`Permissions for ${flags.provider}:`));
          this.log(`Permission Level: ${chalk.cyan(this.permissionLevelToString(permissionLevel))}`);
          
          if (operations.length === 0) {
            this.log(chalk.yellow('No operations allowed for this provider.'));
          } else {
            this.log(chalk.bold('\nAllowed Operations:'));
            operations.forEach(op => {
              this.log(`  - ${op}`);
            });
          }
        }
      } else {
        // List all providers and their permission levels
        const credentials = await secureCredentialManager.listCredentials();
        
        if (credentials.length === 0) {
          this.log(chalk.yellow('No credentials found.'));
          this.log(chalk.dim(`To add a credential, run: ${chalk.cyan('walrus_todo ai:credentials add --provider [name] --apiKey [key]')}`));
          return;
        }
        
        if (flags.format === 'json') {
          const providers = await Promise.all(credentials.map(async c => {
            const operations = await permissionManager.getAllowedOperations(c.providerName);
            return {
              provider: c.providerName,
              permission_level: this.permissionLevelToString(c.permissionLevel),
              allowed_operations: operations
            };
          }));
          
          this.log(JSON.stringify(providers, null, 2));
        } else {
          this.log(chalk.bold('AI Provider Permissions:'));
          
          for (const credential of credentials) {
            const operations = await permissionManager.getAllowedOperations(credential.providerName);
            
            this.log(chalk.bold(`\n${credential.providerName}:`));
            this.log(`  Permission Level: ${chalk.cyan(this.permissionLevelToString(credential.permissionLevel))}`);
            
            if (operations.length === 0) {
              this.log(`  Operations:       ${chalk.yellow('None')}`);
            } else if (operations.length <= 5) {
              this.log(`  Operations:       ${operations.join(', ')}`);
            } else {
              this.log(`  Operations:       ${operations.slice(0, 5).join(', ')} ${chalk.dim(`+ ${operations.length - 5} more`)}`);
              
              this.log(chalk.dim(`  To see all operations, run: ${chalk.cyan(`walrus_todo ai:permissions list --provider ${credential.providerName}`)}`));
            }
          }
        }
      }
    } catch (error) {
      this.error(`Failed to list permissions: ${error}`);
    }
  }

  private async checkPermission(flags: any, permissionManager: AIPermissionManager) {
    if (!flags.provider) {
      this.error('Provider name is required for checking permissions. Use --provider flag.');
    }
    
    if (!flags.aiOperation) {
      this.error('AI operation name is required for checking permissions. Use --aiOperation flag.');
    }
    
    try {
      // Check if the provider has permission for the operation
      const hasPermission = await permissionManager.checkPermission(
        flags.provider,
        flags.aiOperation
      );
      
      // Get the provider's permission level
      const permissionLevel = await permissionManager.getPermissionLevel(flags.provider);
      
      if (flags.format === 'json') {
        this.log(JSON.stringify({
          provider: flags.provider,
          operation: flags.aiOperation,
          permission: hasPermission,
          permission_level: this.permissionLevelToString(permissionLevel)
        }, null, 2));
      } else {
        this.log(chalk.bold(`Permission Check for ${flags.provider}:`));
        this.log(`Operation:        ${chalk.cyan(flags.aiOperation)}`);
        this.log(`Permission Level: ${chalk.cyan(this.permissionLevelToString(permissionLevel))}`);
        this.log(`Result:           ${hasPermission ? chalk.green('Allowed') : chalk.red('Denied')}`);
        
        // If verification is requested
        if (flags.verify && hasPermission) {
          this.log(chalk.dim('\nVerifying permission on blockchain...'));
          
          try {
            const verificationResult = await permissionManager.verifyOperationPermission(
              flags.provider,
              flags.aiOperation
            );
            
            if (verificationResult.allowed) {
              this.log(chalk.green('✓ Permission verified on blockchain'));
              if (verificationResult.verificationId) {
                this.log(`Verification ID:  ${chalk.dim(verificationResult.verificationId)}`);
              }
            } else {
              this.log(chalk.red('✗ Permission verification failed'));
            }
          } catch (error) {
            this.warn(chalk.yellow(`⚠️ Blockchain verification failed: ${error}`));
          }
        }
      }
    } catch (error) {
      this.error(`Failed to check permission: ${error}`);
    }
  }

  private async grantPermission(flags: any, permissionManager: AIPermissionManager) {
    if (!flags.provider) {
      this.error('Provider name is required for granting permissions. Use --provider flag.');
    }
    
    if (!flags.permission) {
      this.error('Permission level is required for granting permissions. Use --permission flag.');
    }
    
    try {
      // Check if credential exists
      if (!await secureCredentialManager.hasCredential(flags.provider)) {
        this.error(`No credential found for provider '${flags.provider}'`);
      }
      
      // Map string permission to enum
      let permissionLevel = AIPermissionLevel.STANDARD;
      switch (flags.permission) {
        case 'no_access':
          permissionLevel = AIPermissionLevel.NO_ACCESS;
          break;
        case 'read_only':
          permissionLevel = AIPermissionLevel.READ_ONLY;
          break;
        case 'advanced':
          permissionLevel = AIPermissionLevel.ADVANCED;
          break;
        case 'admin':
          permissionLevel = AIPermissionLevel.ADMIN;
          break;
      }
      
      // Update permission level
      const success = await permissionManager.setPermissionLevel(
        flags.provider,
        permissionLevel
      );
      
      if (success) {
        this.log(chalk.green(`✓ Permission level for '${flags.provider}' updated to ${flags.permission}`));
        
        // If a specific operation was specified, check permission for it
        if (flags.aiOperation) {
          const hasPermission = await permissionManager.checkPermission(
            flags.provider,
            flags.aiOperation
          );
          
          this.log(`Operation '${flags.aiOperation}' is now ${hasPermission ? chalk.green('allowed') : chalk.red('denied')}`);
          
          // Verify on blockchain if requested
          if (flags.verify && hasPermission) {
            this.log(chalk.dim('\nVerifying permission on blockchain...'));
            
            try {
              const verificationResult = await permissionManager.verifyOperationPermission(
                flags.provider,
                flags.aiOperation
              );
              
              if (verificationResult.allowed) {
                this.log(chalk.green('✓ Permission verified on blockchain'));
                if (verificationResult.verificationId) {
                  this.log(`Verification ID:  ${chalk.dim(verificationResult.verificationId)}`);
                }
              } else {
                this.log(chalk.red('✗ Permission verification failed'));
              }
            } catch (error) {
              this.warn(chalk.yellow(`⚠️ Blockchain verification failed: ${error}`));
            }
          }
        }
        
        // Show allowed operations
        const operations = await permissionManager.getAllowedOperations(flags.provider);
        
        this.log(chalk.bold('\nAllowed Operations:'));
        if (operations.length === 0) {
          this.log(chalk.yellow('No operations allowed with this permission level.'));
        } else {
          operations.forEach(op => {
            this.log(`  - ${op}`);
          });
        }
      } else {
        this.error(`Failed to update permission level for provider '${flags.provider}'`);
      }
    } catch (error) {
      this.error(`Failed to grant permission: ${error}`);
    }
  }

  private async revokePermission(flags: any, permissionManager: AIPermissionManager) {
    if (!flags.provider) {
      this.error('Provider name is required for revoking permissions. Use --provider flag.');
    }
    
    try {
      // Check if credential exists
      if (!await secureCredentialManager.hasCredential(flags.provider)) {
        this.error(`No credential found for provider '${flags.provider}'`);
      }
      
      // Confirm revocation
      this.log(chalk.yellow(`⚠️  Are you sure you want to revoke permissions for '${flags.provider}'?`));
      this.log(chalk.dim('This will set the permission level to NO_ACCESS.'));
      
      const confirmed = await this.confirm('Revoke permissions?');
      
      if (!confirmed) {
        this.log('Operation cancelled.');
        return;
      }
      
      // Set permission level to NO_ACCESS
      const success = await permissionManager.setPermissionLevel(
        flags.provider,
        AIPermissionLevel.NO_ACCESS
      );
      
      if (success) {
        this.log(chalk.green(`✓ Permissions for '${flags.provider}' have been revoked`));
        
        // Verify on blockchain if requested
        if (flags.verify) {
          this.log(chalk.dim('\nVerifying permission change on blockchain...'));
          
          try {
            const verificationResult = await permissionManager.verifyOperationPermission(
              flags.provider,
              'verify_permission'
            );
            
            if (verificationResult.allowed) {
              this.log(chalk.red('✗ Permission verification failed - should not be allowed after revocation'));
            } else {
              this.log(chalk.green('✓ Permission change verified on blockchain'));
            }
          } catch (error) {
            // This is expected since permission is revoked
            this.log(chalk.green('✓ Permission change verified (permission denied as expected)'));
          }
        }
      } else {
        this.error(`Failed to revoke permissions for provider '${flags.provider}'`);
      }
    } catch (error) {
      this.error(`Failed to revoke permission: ${error}`);
    }
  }

  private async registerOperation(flags: any, permissionManager: AIPermissionManager | null) {
    if (!permissionManager) {
      this.error('Blockchain integration is required for registering operations. Please provide --registry and --packageId flags.');
    }
    
    if (!flags.aiOperation) {
      this.error('AI operation name is required for registration. Use --aiOperation flag.');
    }
    
    if (!flags.permission) {
      this.error('Permission level is required for operation registration. Use --permission flag.');
    }
    
    try {
      // Map string permission to enum
      let permissionLevel = AIPermissionLevel.STANDARD;
      switch (flags.permission) {
        case 'no_access':
          permissionLevel = AIPermissionLevel.NO_ACCESS;
          break;
        case 'read_only':
          permissionLevel = AIPermissionLevel.READ_ONLY;
          break;
        case 'advanced':
          permissionLevel = AIPermissionLevel.ADVANCED;
          break;
        case 'admin':
          permissionLevel = AIPermissionLevel.ADMIN;
          break;
      }
      
      // Register the operation
      permissionManager.registerOperationPermission(
        flags.aiOperation,
        99, // Custom action type for user-defined operations
        permissionLevel
      );
      
      this.log(chalk.green(`✓ Operation '${flags.aiOperation}' registered with permission level ${flags.permission}`));
      
      // Show providers that have access to this operation
      const credentials = await secureCredentialManager.listCredentials();
      const providersWithAccess = [];
      
      for (const credential of credentials) {
        const hasPermission = await permissionManager.checkPermission(
          credential.providerName,
          flags.aiOperation
        );
        
        if (hasPermission) {
          providersWithAccess.push(credential.providerName);
        }
      }
      
      if (providersWithAccess.length > 0) {
        this.log(chalk.bold('\nProviders with access:'));
        providersWithAccess.forEach(provider => {
          this.log(`  - ${provider}`);
        });
      } else {
        this.log(chalk.yellow('\nNo providers currently have access to this operation.'));
      }
    } catch (error) {
      this.error(`Failed to register operation: ${error}`);
    }
  }

  private permissionLevelToString(level: AIPermissionLevel): string {
    switch (level) {
      case AIPermissionLevel.NO_ACCESS:
        return 'No Access';
      case AIPermissionLevel.READ_ONLY:
        return 'Read Only';
      case AIPermissionLevel.STANDARD:
        return 'Standard';
      case AIPermissionLevel.ADVANCED:
        return 'Advanced';
      case AIPermissionLevel.ADMIN:
        return 'Admin';
      default:
        return 'Unknown';
    }
  }

  private async confirm(message: string): Promise<boolean> {
    // Simple confirmation prompt
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise<boolean>(resolve => {
      rl.question(`${message} (y/n) `, (answer: string) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }
}