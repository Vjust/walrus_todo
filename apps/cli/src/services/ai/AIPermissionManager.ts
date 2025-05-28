import { SecureCredentialManager } from './SecureCredentialManager';
import { BlockchainVerifier } from './BlockchainVerifier';
import {
  AIPermissionLevel,
  AIOperationPermission,
} from '../../types/adapters/AICredentialAdapter';
import { AIActionType } from '../../types/adapters/AIVerifierAdapter';
import { AIProvider } from '../../types/adapters/AIModelAdapter';
import { CLIError } from '../../types/errors/consolidated';
import { Logger } from '../../utils/Logger';

/**
 * AIPermissionManager - Manages permissions for AI operations
 *
 * This service controls access to AI features based on permission levels
 * assigned to credentials and verified on the blockchain.
 */
export class AIPermissionManager {
  private credentialManager: SecureCredentialManager;
  private blockchainVerifier: BlockchainVerifier;
  private operationPermissions: Map<string, AIOperationPermission> = new Map();
  private initialized: boolean = false;

  constructor(
    credentialManager: SecureCredentialManager,
    blockchainVerifier: BlockchainVerifier
  ) {
    this.credentialManager = credentialManager;
    this.blockchainVerifier = blockchainVerifier;
    this.initializePermissions();
  }

  /**
   * Initialize default permissions for AI operations
   */
  private initializePermissions(): void {
    // Standard AI operations
    this.registerOperationPermission(
      'summarize',
      AIActionType.SUMMARIZE,
      AIPermissionLevel.READ_ONLY
    );
    this.registerOperationPermission(
      'analyze',
      AIActionType.ANALYZE,
      AIPermissionLevel.READ_ONLY
    );
    this.registerOperationPermission(
      'categorize',
      AIActionType.CATEGORIZE,
      AIPermissionLevel.STANDARD
    );
    this.registerOperationPermission(
      'prioritize',
      AIActionType.PRIORITIZE,
      AIPermissionLevel.STANDARD
    );
    this.registerOperationPermission(
      'suggest',
      AIActionType.SUGGEST,
      AIPermissionLevel.STANDARD
    );

    // Enhanced AI operations
    this.registerOperationPermission('group', 5, AIPermissionLevel.STANDARD);
    this.registerOperationPermission('schedule', 6, AIPermissionLevel.STANDARD);
    this.registerOperationPermission(
      'detect_dependencies',
      7,
      AIPermissionLevel.STANDARD
    );
    this.registerOperationPermission(
      'estimate_effort',
      8,
      AIPermissionLevel.STANDARD
    );

    // Advanced operations
    this.registerOperationPermission('train', 10, AIPermissionLevel.ADVANCED);
    this.registerOperationPermission(
      'fine_tune',
      11,
      AIPermissionLevel.ADVANCED
    );

    // Admin operations
    this.registerOperationPermission(
      'generate_credential',
      20,
      AIPermissionLevel.ADMIN
    );
    this.registerOperationPermission(
      'manage_providers',
      21,
      AIPermissionLevel.ADMIN
    );

    this.initialized = true;
  }

  /**
   * Register a permission requirement for an AI operation
   */
  public registerOperationPermission(
    operationName: string,
    actionType: AIActionType | number,
    minPermissionLevel: AIPermissionLevel,
    additionalChecks?: string[]
  ): void {
    this.operationPermissions.set(operationName, {
      operationName,
      actionType, // Store the actionType to fix the reference error
      minPermissionLevel,
      additionalChecks,
    });
  }

  /**
   * Check if a provider is allowed to perform an operation
   */
  public async checkPermission(
    provider: string | AIProvider,
    operation: string
  ): Promise<boolean> {
    if (!this.initialized) {
      throw new CLIError(
        'Permission manager not initialized',
        'PERMISSION_MANAGER_NOT_INITIALIZED'
      );
    }

    // Validate input parameters for security
    if (!provider || typeof provider !== 'string') {
      if (typeof provider !== 'object' || !(provider in AIProvider)) {
        throw new Error('Invalid provider parameter');
      }
    }
    if (!operation || typeof operation !== 'string') {
      throw new Error('Invalid operation parameter');
    }

    // Convert enum to string or use string directly
    const providerName =
      typeof provider === 'string' ? provider : AIProvider[provider];

    // Prevent privilege escalation by checking for restricted operations
    if (operation === 'blockchain_verification' && !(await this.hasPermissionLevel(providerName, AIPermissionLevel.ADMIN))) {
      throw new Error(`Insufficient permissions for ${operation}`);
    }

    // Get the operation permission requirements
    const operationPermission = this.operationPermissions.get(operation);
    if (!operationPermission) {
      // If operation is not registered, default to requiring ADMIN permission
      return await this.hasPermissionLevel(
        providerName,
        AIPermissionLevel.ADMIN
      );
    }

    // Check if provider has the required permission level
    return await this.hasPermissionLevel(
      providerName,
      operationPermission.minPermissionLevel
    );
  }

  /**
   * Check if a provider has at least the specified permission level
   */
  private async hasPermissionLevel(
    provider: string,
    level: AIPermissionLevel
  ): Promise<boolean> {
    try {
      // Validate input parameters
      if (!provider || typeof provider !== 'string') {
        throw new Error('Invalid provider parameter');
      }
      if (typeof level !== 'number') {
        throw new Error('Invalid permission level parameter');
      }

      // Check if credential exists
      if (!(await this.credentialManager.hasCredential(provider))) {
        return false;
      }

      // Get credential object
      const credential =
        await this.credentialManager.getCredentialObject(provider);

      // Prevent unauthorized permission escalation attempts
      if (level === AIPermissionLevel.ADMIN && credential.permissionLevel < AIPermissionLevel.ADMIN) {
        Logger.getInstance().warn(`Unauthorized permission escalation attempt for provider ${provider}`);
        return false;
      }

      // Check if permission level is sufficient
      return credential.permissionLevel >= level;
    } catch (err: unknown) {
      Logger.getInstance().warn(`Permission check failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Get the permission level for a provider
   */
  public async getPermissionLevel(
    provider: string
  ): Promise<AIPermissionLevel> {
    try {
      // Check if credential exists
      if (!(await this.credentialManager.hasCredential(provider))) {
        return AIPermissionLevel.NO_ACCESS;
      }

      // Get credential object
      const credential =
        await this.credentialManager.getCredentialObject(provider);

      return credential.permissionLevel;
    } catch (err: unknown) {
      Logger.getInstance().warn(`Failed to get permission level: ${err instanceof Error ? err.message : String(err)}`);
      return AIPermissionLevel.NO_ACCESS;
    }
  }

  /**
   * Set the permission level for a provider
   */
  public async setPermissionLevel(
    provider: string,
    level: AIPermissionLevel
  ): Promise<boolean> {
    try {
      // Update permissions
      await this.credentialManager.updatePermissions(provider, level);
      return true;
    } catch (error) {
      Logger.getInstance().error(
        `Failed to set permission level: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Get all operations that a provider is allowed to perform
   */
  public async getAllowedOperations(provider: string): Promise<string[]> {
    const providerLevel = await this.getPermissionLevel(provider);

    // If no access, return empty array
    if (providerLevel === AIPermissionLevel.NO_ACCESS) {
      return [];
    }

    // Return all operations that the provider has permission for
    return Array.from(this.operationPermissions.entries())
      .filter(
        ([_, permission]) => permission.minPermissionLevel <= providerLevel
      )
      .map(([operationName, _]) => operationName);
  }

  /**
   * Verify an operation permission on the blockchain and record it
   */
  public async verifyOperationPermission(
    provider: string,
    operation: string
  ): Promise<{ allowed: boolean; verificationId?: string }> {
    try {
      // Check local permission first
      const allowed = await this.checkPermission(provider, operation);

      if (!allowed) {
        return { allowed: false };
      }

      // Get credential object
      const credential =
        await this.credentialManager.getCredentialObject(provider);

      // Get operation permission
      const operationPermission = this.operationPermissions.get(operation);
      if (!operationPermission) {
        return { allowed: true }; // No verification needed for undefined operations
      }

      // Create verification record on blockchain
      // Safely extract actionType from operationPermission
      const actionType =
        operationPermission &&
        typeof operationPermission.actionType === 'number'
          ? operationPermission.actionType
          : AIActionType.ANALYZE; // Default

      const verificationRecord = await this.blockchainVerifier.verifyOperation({
        actionType,
        request: `Permission check for ${provider} to perform ${operation}`,
        response: `Permission granted at level ${credential.permissionLevel}`,
        provider: provider,
        metadata: {
          operation,
          permissionLevel: credential.permissionLevel.toString(),
          timestamp: Date.now().toString(),
        },
      });

      return {
        allowed: true,
        verificationId: verificationRecord.id,
      };
    } catch (error) {
      Logger.getInstance().error(
        `Failed to verify operation permission: ${error instanceof Error ? error.message : String(error)}`
      );
      return { allowed: false };
    }
  }
}

// Singleton instance
let permissionManager: AIPermissionManager | null = null;

/**
 * Initialize and return the permission manager singleton
 *
 * This function is designed to be mockable in tests while maintaining
 * singleton behavior in production. The export of the implementation
 * rather than just the function signature allows jest.mock to properly
 * replace it during testing.
 *
 * @param credentialManager - The credential manager to use
 * @param blockchainVerifier - The blockchain verifier to use
 * @returns The initialized permission manager instance
 */
export const initializePermissionManager = (
  credentialManager: SecureCredentialManager,
  blockchainVerifier: BlockchainVerifier
): AIPermissionManager => {
  if (!permissionManager) {
    permissionManager = new AIPermissionManager(
      credentialManager,
      blockchainVerifier
    );
  }
  return permissionManager;
};

/**
 * Get the already initialized permission manager singleton
 *
 * @returns The permission manager instance
 * @throws Error if the permission manager is not initialized
 */
export function getPermissionManager(): AIPermissionManager {
  if (!permissionManager) {
    throw new Error('Permission manager not initialized');
  }
  return permissionManager;
}
