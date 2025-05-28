import type { WalrusClientExt } from '../types/client';
import type { Signer } from '@mysten/sui/cryptography';
// Transaction imported but not used
import { execa } from 'execa';
import { VaultManager, BlobRecord } from './VaultManager';
import { NetworkValidator, NetworkEnvironment } from './NetworkValidator';
import { Logger } from './Logger';
import { StorageError, BlockchainError, NetworkError } from '../types/errors';
import { ValidationError } from '../types/errors/ValidationError';

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

// Removed unused StorageOptions type

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
      checkInterval: 24 * 60 * 60 * 1000, // 24 hours
      warningThreshold: 7, // 7 days
      autoRenewThreshold: 3, // 3 days
      renewalPeriod: 30, // 30 days
      retryAttempts: 3, // 3 retry attempts
      retryDelay: 1000, // 1 second delay
      network: {
        environment: 'testnet' as NetworkEnvironment,
        autoSwitch: false,
      },
    };
    this.config = { ...defaultConfig, ...config };
    this.networkValidator = new NetworkValidator({
      expectedEnvironment: this.config.network.environment,
      autoSwitch: this.config.network.autoSwitch,
    });
    this.logger = Logger.getInstance();
  }

  /**
   * Get current network status
   */
  public async getNetworkStatus() {
    try {
      return await this.networkValidator.getNetworkStatus(this.walrusClient);
    } catch (_error) {
      throw new NetworkError('Failed to get network status', {
        operation: 'status',
        recoverable: true,
        cause: _error as Error,
      });
    }
  }

  /**
   * Start monitoring blob expiry
   */
  start(): void {
    if (this.checkTimer) {
      throw new ValidationError('Monitor already running', {
        field: 'monitor',
        value: 'running',
      });
    }

    this.logger.info('Starting expiry monitor', {
      config: {
        checkInterval: this.config.checkInterval,
        warningThreshold: this.config.warningThreshold,
        autoRenewThreshold: this.config.autoRenewThreshold,
      },
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
   * Releases all resources held by the expiry monitor
   * Should be called when the monitor is no longer needed
   */
  async cleanup(): Promise<void> {
    // Stop scheduled checks
    this.stop();

    // Log final status
    try {
      const status = await this.getNetworkStatus();
      this.logger.info('Expiry monitor cleanup - final status', { status });
    } catch (_error) {
      this.logger.warn('Failed to get network status during cleanup', {
        error: _error,
      });
    }

    // Additional cleanup could be added here if needed
    this.logger.info('Expiry monitor resources released');
  }

  /**
   * Verify blob existence across storage layers
   */
  public async verifyBlobExistence(blobId: string): Promise<BlobVerification> {
    const result: BlobVerification = {
      exists: false,
      onChain: false,
      hasValidPoA: false,
    };

    // Check Walrus CLI for blob existence
    try {
      await execa('walrus', ['read', blobId], { stdio: 'ignore' });
      result.exists = true;
    } catch (_error) {
      this.logger.warn('Blob not found in storage', { blobId });
      return {
        ...result,
        error: `Blob ${blobId} not found in Walrus storage`,
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
    } catch (_error) {
      this.logger.error('Failed to verify on-chain status', _error as Error, {
        blobId,
      });
      return {
        ...result,
        error: `Failed to verify on-chain status: ${_error instanceof Error ? _error.message : String(_error)}`,
      };
    }

    return result;
  }

  private async ensureBlobExists(blobId: string): Promise<void> {
    const verification = await this.verifyBlobExistence(blobId);

    if (!verification.exists) {
      throw new StorageError(`Blob ${blobId} does not exist`, {
        operation: 'verify',
        blobId,
        recoverable: false,
      });
    }

    if (!verification.onChain) {
      throw new BlockchainError(`Blob ${blobId} not found on blockchain`, {
        operation: 'verify',
        recoverable: false,
      });
    }

    if (!verification.hasValidPoA) {
      throw new ValidationError(`Invalid PoA certificate for blob ${blobId}`, {
        field: 'poaCertificate',
        value: 'invalid',
      });
    }
  }

  private async checkExpiry(): Promise<void> {
    // Skip if monitor has been stopped
    if (!this.checkTimer) {
      this.logger.debug('Skipping expiry check - monitor stopped');
      return;
    }

    const pendingOperations: Promise<void>[] = [];

    try {
      const warningBlobs = this.vaultManager.getExpiringBlobs(
        this.config.warningThreshold
      );

      if (!warningBlobs) {
        return;
      }

      this.logger.debug('Checking blob expiry', {
        blobCount: warningBlobs.length,
        threshold: this.config.warningThreshold,
      });

      // Verify existence of all blobs with added error handling
      let verificationResults: BlobVerification[];
      try {
        verificationResults = await Promise.all<BlobVerification>(
          warningBlobs.map(blob =>
            this.verifyBlobExistence(blob.blobId).catch((_error: unknown) => {
              // Return a failed verification result on error
              this.logger.error(
                `Blob verification failed for ${blob.blobId}`,
                _error as Error,
                { operation: 'verifyBlobExistence' }
              );
              return {
                exists: false,
                onChain: false,
                hasValidPoA: false,
                error:
                  _error instanceof Error ? _error.message : String(_error),
              };
            })
          )
        );
      } catch (allError) {
        // This should rarely happen since individual promises have catch handlers
        this.logger.error(
          'Critical failure during blob verification batch',
          allError as Error,
          { blobCount: warningBlobs.length }
        );
        verificationResults = warningBlobs.map(() => ({
          exists: false,
          onChain: false,
          hasValidPoA: false,
          error: 'Batch verification failed',
        }));
      }

      // Filter out blobs that failed verification
      const validBlobs = warningBlobs.filter(
        (_, index) =>
          verificationResults[index]?.exists &&
          verificationResults[index]?.onChain
      );

      // Log failed verifications
      warningBlobs.forEach((blob, index) => {
        const result = verificationResults[index];
        if (!result?.exists || !result?.onChain) {
          this.logger.warn('Blob verification failed during expiry check', {
            blobId: blob.blobId,
            error: result?.error,
          });
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

      // Schedule handlers asynchronously but track them
      if (validBlobs.length > 0) {
        pendingOperations.push(
          this.onWarning(validBlobs)
            .then(() => {
              this.logger.info('Warning handler executed', {
                blobCount: validBlobs.length,
              });
            })
            .catch(_error => {
              this.logger.error('Warning handler failed', _error, {
                blobCount: validBlobs.length,
                operation: 'onWarning',
              });
            })
        );
      }

      // Handle renewals
      if (renewalBlobs.length > 0) {
        pendingOperations.push(
          this.renewBlobs(renewalBlobs)
            .then(() => {
              this.logger.info('Renewal handler executed', {
                blobCount: renewalBlobs.length,
              });
            })
            .catch(_error => {
              this.logger.error('Renewal handler failed', _error, {
                blobCount: renewalBlobs.length,
                operation: 'renewBlobs',
              });
            })
        );
      }

      // Wait for all pending operations to complete with tracking
      const results: PromiseSettledResult<void>[] =
        await Promise.allSettled(pendingOperations);
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          // This should not happen since each promise has its own catch handler,
          // but we handle it just in case
          this.logger.error(
            `Operation ${index} failed after internal catch handler`,
            result.reason instanceof Error
              ? result.reason
              : new Error(String(result.reason)),
            { operationType: index < validBlobs.length ? 'warning' : 'renewal' }
          );
        }
      });
    } catch (_error) {
      this.logger.error('Failed to check blob expiry', _error as Error, {
        config: this.config,
        operation: 'checkExpiry',
      });
    } finally {
      // Ensure any unfinished operations complete
      if (pendingOperations.length > 0) {
        try {
          const results: PromiseSettledResult<void>[] =
            await Promise.allSettled(pendingOperations);
          const pendingErrors = results
            .filter(r => r.status === 'rejected')
            .map(r => (r.status === 'rejected' ? r.reason : null))
            .filter(Boolean);

          if (pendingErrors.length > 0) {
            this.logger.error(
              `${pendingErrors.length} operations failed during cleanup`,
              pendingErrors[0] as Error,
              { errorCount: pendingErrors.length }
            );
          }
        } catch (finalError) {
          this.logger.error(
            'Error during final cleanup of pending operations',
            finalError as Error,
            { operation: 'cleanup' }
          );
        }
      }
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (
      let attempt = 1;
      attempt <= (this.config.retryAttempts || 1);
      attempt++
    ) {
      try {
        return await operation();
      } catch (_error) {
        lastError = _error as Error;
        if (attempt < (this.config.retryAttempts || 1)) {
          const delay = (this.config.retryDelay || 1000) * attempt;
          this.logger.warn(`Retry attempt ${attempt} for ${operationName}`, {
            delay,
            error: lastError.message,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to ${operationName}`);
  }

  private async renewBlobs(blobs: BlobRecord[]): Promise<void> {
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + this.config.renewalPeriod);

    // let hasFailures = false; // Removed unused variable
    const successfulBlobs: BlobRecord[] = [];
    const errors: { blobId: string; error: Error }[] = [];

    for (const blob of blobs) {
      try {
        // Verify blob existence with improved error handling
        let verification: BlobVerification;
        try {
          verification = await this.verifyBlobExistence(blob.blobId);
        } catch (verifyError) {
          const error =
            verifyError instanceof Error
              ? verifyError
              : new Error(String(verifyError));
          errors.push({ blobId: blob.blobId, error });
          this.logger.error(
            `Failed to verify blob ${blob.blobId} for renewal`,
            error,
            { operation: 'verifyBlobExistence' }
          );
          // hasFailures = true;
          continue;
        }

        if (!verification.exists || !verification.onChain) {
          // hasFailures = true;
          const error = new Error(
            verification.error || 'Blob verification failed'
          );
          errors.push({ blobId: blob.blobId, error });
          continue;
        }

        // Check storage availability with timeout protection
        let storageUsage;
        try {
          const storagePromise = this.walrusClient.getStorageUsage();
          const timeoutPromise = new Promise<never>((_, reject) => {
            const timeoutId = setTimeout(() => {
              clearTimeout(timeoutId);
              reject(
                new Error('Storage usage check timed out after 10 seconds')
              );
            }, 10000);
          });

          storageUsage = await Promise.race<{ used: string; total: string }>([
            storagePromise,
            timeoutPromise,
          ]);
        } catch (storageError) {
          const error =
            storageError instanceof Error
              ? storageError
              : new Error(String(storageError));
          errors.push({ blobId: blob.blobId, error });
          this.logger.error('Failed to check storage availability', error, {
            operation: 'getStorageUsage',
            blobId: blob.blobId,
          });
          // hasFailures = true;
          continue;
        }

        const usedPercentage =
          (Number(storageUsage.used) / Number(storageUsage.total)) * 100;
        if (usedPercentage > 80) {
          const capacityError = new Error(
            `Storage capacity exceeded (${usedPercentage.toFixed(2)}%)`
          );
          errors.push({ blobId: blob.blobId, error: capacityError });
          this.logger.error('Insufficient storage for renewal', capacityError, {
            usedPercentage,
          });
          return;
        }

        const signer = this.config.signer;
        if (!signer) {
          const signerError = new ValidationError(
            'Signer required for storage transactions',
            {
              field: 'signer',
              operation: 'renewBlobs',
            }
          );
          errors.push({ blobId: blob.blobId, error: signerError });
          throw signerError;
        }

        try {
          await this.retryOperation(
            () =>
              this.walrusClient.executeCreateStorageTransaction({
                size: Math.ceil(this.config.renewalPeriod / (24 * 60 * 60)),
                epochs: Math.ceil(this.config.renewalPeriod / (24 * 60 * 60)),
                signer: signer,
              }),
            `renew blob ${blob.blobId}`
          );

          // Update expiry date in vault manager
          this.vaultManager.updateBlobExpiry(
            blob.blobId,
            blob.vaultId,
            renewalDate.toISOString()
          );

          successfulBlobs.push(blob);

          this.logger.info('Blob renewed successfully', {
            blobId: blob.blobId,
            newExpiry: renewalDate.toISOString(),
          });
        } catch (renewError) {
          const error =
            renewError instanceof Error
              ? renewError
              : new Error(String(renewError));
          errors.push({ blobId: blob.blobId, error });
          // hasFailures = true;
          this.logger.error(
            `Failed to execute renewal transaction for blob ${blob.blobId}`,
            error,
            { operation: 'executeCreateStorageTransaction' }
          );
        }
      } catch (_error) {
        const typedError =
          _error instanceof Error ? _error : new Error(String(_error));
        // hasFailures = true;
        errors.push({ blobId: blob.blobId, error: typedError });
        this.logger.error(`Failed to renew blob ${blob.blobId}`, typedError, {
          blob,
          operation: 'renewBlobs',
        });

        if (blobs.length === 1) {
          throw new StorageError(
            `Failed to renew blob ${blob.blobId}: ${typedError.message}`,
            {
              operation: 'renew',
              blobId: blob.blobId,
              recoverable: true,
              cause: typedError,
            }
          );
        }
      }
    }

    if (successfulBlobs.length > 0) {
      try {
        await this.onRenewal(successfulBlobs);
      } catch (renewalHandlerError) {
        this.logger.error(
          'Renewal handler failed after blob renewal',
          renewalHandlerError instanceof Error
            ? renewalHandlerError
            : new Error(String(renewalHandlerError)),
          { blobCount: successfulBlobs.length, operation: 'onRenewal' }
        );
        // Don't re-throw since we've already renewed the blobs
      }
    }

    // Summarize errors if there were any
    if (errors.length > 0) {
      this.logger.warn('Renewal operation completed with errors', {
        totalBlobs: blobs.length,
        successful: successfulBlobs.length,
        failed: errors.length,
        errorSummary: errors
          .map(e => `${e.blobId}: ${e.error.message}`)
          .join('; '),
      });
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
          recoverable: false,
        }
      );
    }

    const blob = this.vaultManager.getBlobRecord(blobId, vaultId);
    await this.renewBlobs([blob]);
  }
}
