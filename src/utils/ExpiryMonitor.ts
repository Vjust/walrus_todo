import type { WalrusClientExt } from '../types/client';
import type { BlobObject, DigestHash } from '../types/walrus';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Signer } from '@mysten/sui/cryptography';
import { execSync } from 'child_process';
import { VaultManager, BlobRecord } from './VaultManager';
import { NetworkValidator, NetworkEnvironment } from './NetworkValidator';
import { Logger } from './Logger';
import {
  WalrusError,
  StorageError,
  BlockchainError,
  ValidationError,
  NetworkError
} from '../types/errors';

// ExpiryMonitor config

interface ExpiryConfig {
  checkInterval: number;
  warningThreshold: number;
  autoRenewThreshold: number;
  renewalPeriod: number;
  network: {
    environment: NetworkEnvironment;
    autoSwitch: boolean;
  };
  signer?: Signer;
  retryAttempts?: number;
  retryDelay?: number;
}

type ExpiryHandler = (blobs: BlobRecord[]) => Promise<void>;

type StorageOptions = {
  size: number;
  epochs: number;
  owner: string;
  signer: Signer;
};

interface BlobVerification {
  exists: boolean;
  onChain: boolean;
  hasValidPoA: boolean;
  error?: string;
}

export class ExpiryMonitor {
  private checkTimer: NodeJS.Timeout | null = null;
  private readonly config: ExpiryConfig;
  private readonly networkValidator: NetworkValidator;
  private readonly logger: Logger;

  constructor(
    private readonly vaultManager: VaultManager,
    private readonly walrusClient: WalrusClientExt,
    private readonly onWarning: ExpiryHandler,
    private readonly onRenewal: ExpiryHandler,
    config: Partial<ExpiryConfig> = {}
  ) {
    const defaultConfig = {
      checkInterval: 24 * 60 * 60 * 1000,  // 24 hours
      warningThreshold: 7,                 // 7 days
      autoRenewThreshold: 3,              // 3 days
      renewalPeriod: 30,                  // 30 days
      retryAttempts: 3,                   // 3 retry attempts
      retryDelay: 1000,                   // 1 second delay
      network: {
        environment: 'testnet' as NetworkEnvironment,
        autoSwitch: false
      }
    };
    this.config = { ...defaultConfig, ...config };
    this.networkValidator = new NetworkValidator({
      expectedEnvironment: this.config.network.environment,
      autoSwitch: this.config.network.autoSwitch
    });
    this.logger = Logger.getInstance();
  }

  /**
   * Get current network status
   */
  public async getNetworkStatus() {
    try {
      return await this.networkValidator.getNetworkStatus(this.walrusClient);
    } catch (error) {
      throw new NetworkError(
        'Failed to get network status',
        {
          operation: 'status',
          recoverable: true,
          cause: error as Error
        }
      );
    }
  }

  /**
   * Start monitoring blob expiry
   */
  start(): void {
    if (this.checkTimer) {
      throw new ValidationError(
        'Monitor already running',
        { field: 'monitor', value: 'running' }
      );
    }

    this.logger.info('Starting expiry monitor', {
      config: {
        checkInterval: this.config.checkInterval,
        warningThreshold: this.config.warningThreshold,
        autoRenewThreshold: this.config.autoRenewThreshold
      }
    });

    // Do an initial check
    this.checkExpiry();

    // Schedule regular checks
    this.checkTimer = setInterval(
      () => this.checkExpiry(),
      this.config.checkInterval
    );
  }

  /**
   * Stop monitoring blob expiry
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      this.logger.info('Stopped expiry monitor');
    }
  }

  /**
   * Verify blob existence across storage layers
   */
  public async verifyBlobExistence(blobId: string): Promise<BlobVerification> {
    const result: BlobVerification = {
      exists: false,
      onChain: false,
      hasValidPoA: false
    };

    // Check Walrus CLI for blob existence
    try {
      execSync(`walrus read ${blobId}`, { stdio: 'ignore' });
      result.exists = true;
    } catch (error) {
      this.logger.warn('Blob not found in storage', { blobId });
      return {
        ...result,
        error: `Blob ${blobId} not found in Walrus storage`
      };
    }

    // Verify on-chain blob object
    try {
      const onChainObject = await this.walrusClient.getBlobObject({ blobId });
      result.onChain = !!onChainObject;

      if (result.onChain) {
        const poaCertificate = await this.walrusClient.verifyPoA({ blobId });
        result.hasValidPoA = poaCertificate;
      }
    } catch (error) {
      this.logger.error(
        'Failed to verify on-chain status',
        error as Error,
        { blobId }
      );
      return {
        ...result,
        error: `Failed to verify on-chain status: ${error instanceof Error ? error.message : String(error)}`
      };
    }

    return result;
  }

  private async ensureBlobExists(blobId: string): Promise<void> {
    const verification = await this.verifyBlobExistence(blobId);
    
    if (!verification.exists) {
      throw new StorageError(
        `Blob ${blobId} does not exist`,
        {
          operation: 'verify',
          blobId,
          recoverable: false
        }
      );
    }

    if (!verification.onChain) {
      throw new BlockchainError(
        `Blob ${blobId} not found on blockchain`,
        {
          operation: 'verify',
          recoverable: false
        }
      );
    }

    if (!verification.hasValidPoA) {
      throw new ValidationError(
        `Invalid PoA certificate for blob ${blobId}`,
        {
          field: 'poaCertificate',
          value: 'invalid'
        }
      );
    }
  }

  private async checkExpiry(): Promise<void> {
    try {
      const warningBlobs = this.vaultManager.getExpiringBlobs(
        this.config.warningThreshold
      );

      if (!warningBlobs) {
        return;
      }

      this.logger.debug('Checking blob expiry', {
        blobCount: warningBlobs.length,
        threshold: this.config.warningThreshold
      });

      // Verify existence of all blobs
      const verificationResults = await Promise.all(
        warningBlobs.map(blob => this.verifyBlobExistence(blob.blobId))
      );

      // Filter out blobs that failed verification
      const validBlobs = warningBlobs.filter((_, index) => 
        verificationResults[index].exists && verificationResults[index].onChain
      );

      // Log failed verifications
      warningBlobs.forEach((blob, index) => {
        const result = verificationResults[index];
        if (!result.exists || !result.onChain) {
          this.logger.warn(
            'Blob verification failed during expiry check',
            {
              blobId: blob.blobId,
              error: result.error
            }
          );
        }
      });

      // Get blobs expiring within auto-renewal threshold
      const renewalBlobs = validBlobs.filter(blob => {
        const expiryDate = new Date(blob.expiresAt);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return daysUntilExpiry <= this.config.autoRenewThreshold;
      });

      // Handle warnings first
      if (validBlobs.length > 0) {
        await this.onWarning(validBlobs);
        this.logger.info('Warning handler executed', {
          blobCount: validBlobs.length
        });
      }

      // Then handle renewals
      if (renewalBlobs.length > 0) {
        await this.renewBlobs(renewalBlobs);
        this.logger.info('Renewal handler executed', {
          blobCount: renewalBlobs.length
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to check blob expiry',
        error as Error,
        { config: this.config }
      );
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= (this.config.retryAttempts || 1); attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < (this.config.retryAttempts || 1)) {
          const delay = (this.config.retryDelay || 1000) * attempt;
          this.logger.warn(
            `Retry attempt ${attempt} for ${operationName}`,
            { delay, error: lastError.message }
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to ${operationName}`);
  }

  private async renewBlobs(blobs: BlobRecord[]): Promise<void> {
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + this.config.renewalPeriod);

    let hasFailures = false;
    const successfulBlobs: BlobRecord[] = [];

    for (const blob of blobs) {
      try {
        const verification = await this.verifyBlobExistence(blob.blobId);
        if (!verification.exists || !verification.onChain) {
          hasFailures = true;
          continue;
        }

        // Check storage availability
        const storageUsage = await this.walrusClient.getStorageUsage();
        const usedPercentage = (Number(storageUsage.used) / Number(storageUsage.total)) * 100;
        if (usedPercentage > 80) {
          this.logger.error('Insufficient storage for renewal', new Error('Storage capacity exceeded'), { usedPercentage });
          return;
        }

        const signer = this.config.signer;
        if (!signer) {
          throw new ValidationError('Signer required for storage transactions', {
            field: 'signer'
          });
        }

        await this.retryOperation(
          () => this.walrusClient.executeCreateStorageTransaction({
            size: Math.ceil(this.config.renewalPeriod / (24 * 60 * 60)),
            epochs: Math.ceil(this.config.renewalPeriod / (24 * 60 * 60)),
            owner: blob.vaultId,
            signer: signer
          }),
          `renew blob ${blob.blobId}`
        );

        this.vaultManager.updateBlobExpiry(
          blob.blobId,
          blob.vaultId,
          renewalDate.toISOString()
        );

        successfulBlobs.push(blob);

        this.logger.info('Blob renewed successfully', {
          blobId: blob.blobId,
          newExpiry: renewalDate.toISOString()
        });
      } catch (error) {
        hasFailures = true;
        this.logger.error(
          `Failed to renew blob ${blob.blobId}`,
          error as Error,
          { blob }
        );

        if (blobs.length === 1) {
          throw new StorageError(
            `Failed to renew blob ${blob.blobId}`,
            {
              operation: 'renew',
              blobId: blob.blobId,
              recoverable: true,
              cause: error as Error
            }
          );
        }
      }
    }

    if (successfulBlobs.length > 0) {
      await this.onRenewal(successfulBlobs);
    }
  }

  public async renewBlobById(blobId: string, vaultId: string): Promise<void> {
    const verification = await this.verifyBlobExistence(blobId);
    if (!verification.exists) {
      throw new StorageError(
        `Failed to renew blob ${blobId}: ${verification.error || 'Blob not found'}`,
        {
          operation: 'renew',
          blobId,
          recoverable: false
        }
      );
    }

    const blob = this.vaultManager.getBlobRecord(blobId, vaultId);
    await this.renewBlobs([blob]);
  }
}