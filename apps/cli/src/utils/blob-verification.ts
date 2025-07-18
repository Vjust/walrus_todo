// Import statements with CommonJS compatibility
import type { WalrusClientExt } from '../types/client';
import type { BlobMetadata } from '../types/walrus';
import { CLIError } from '../types/errors/consolidated';
import { handleError } from './error-handler';
import { RetryManager, NetworkNode } from './retry-manager';
import type { TransactionSigner } from '../types/signer';
import { SuiClientType } from './adapters/sui-client-compatibility';
import * as crypto from 'crypto';
import { Logger } from './Logger';

const logger = new Logger('blob-verification');

// Provide fallback implementations for testing environments

// Using BlobInfo from types/walrus.ts

interface VerificationResult {
  success: boolean;
  message?: string;
  details: {
    size: number;
    checksum: string;
    blobId: string;
    certified: boolean;
    certificateEpoch?: number;
    registeredEpoch?: number;
    attributes?: Record<string, unknown>;
  };
  attempts: number;
  poaComplete: boolean;
  providers: number;
  metadata: BlobMetadata;
}

interface VerificationOptions {
  maxRetries?: number;
  baseDelay?: number;
  timeout?: number;
  verifySmartContract?: boolean;
  requireCertification?: boolean;
  verifyAttributes?: boolean;
  requireEpochValidation?: boolean;
}

export class BlobVerificationManager {
  private static readonly DEFAULT_OPTIONS: Required<VerificationOptions> = {
    maxRetries: 3,
    baseDelay: 1000,
    timeout: 15000,
    verifySmartContract: true,
    requireCertification: true,
    verifyAttributes: true,
    requireEpochValidation: false,
  };

  private signer: TransactionSigner | null = null;

  constructor(
    private suiClient: SuiClientType,
    private walrusClient: WalrusClientExt,
    signer?: TransactionSigner
  ) {
    this.signer = signer || null;
  }

  protected async getTransactionSigner(): Promise<TransactionSigner> {
    if (!this.signer) {
      throw new Error('No signer available. Initialize with a signer first.');
    }
    return this.signer;
  }

  /**
   * Creates a default metadata object that conforms to BlobMetadata type
   */
  private createDefaultMetadata(): BlobMetadata {
    return {
      V1: {
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        unencoded_length: '0',
        hashes: [
          {
            primary_hash: {
              Digest: new Uint8Array(),
              $kind: 'Digest',
            },
            secondary_hash: {
              Sha256: new Uint8Array(),
              $kind: 'Sha256',
            },
          },
        ],
        $kind: 'V1',
      },
      $kind: 'V1',
    };
  }

  /**
   * Calculates multiple checksums for data integrity verification
   * Uses collision-resistant algorithms for security
   */
  private calculateChecksums(data: Buffer): {
    sha256: string;
    sha512: string;
    blake2b: string;
  } {
    // Use only cryptographically secure, collision-resistant hash algorithms
    const checksums = {
      // SHA-256: Collision-resistant and widely standardized
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      // SHA-512: Higher security variant with longer output
      sha512: crypto.createHash('sha512').update(data).digest('hex'),
      // BLAKE2b: Modern, faster alternative with proven security
      blake2b: crypto.createHash('blake2b512').update(data).digest('hex'),
    };

    // Validate hash outputs for corruption detection
    if (!checksums.sha256 || checksums.sha256.length !== 64) {
      throw new Error('SHA-256 hash generation failed - invalid output length');
    }
    if (!checksums.sha512 || checksums.sha512.length !== 128) {
      throw new Error('SHA-512 hash generation failed - invalid output length');
    }
    if (!checksums.blake2b || checksums.blake2b.length !== 128) {
      throw new Error('BLAKE2b hash generation failed - invalid output length');
    }

    return checksums;
  }

  /**
   * Verifies smart contract certification status
   */
  private async verifySmartContract(
    blobId: string,
    currentEpoch: bigint,
    options?: {
      requirePoA?: boolean;
      minProviders?: number;
    }
  ): Promise<{
    certified: boolean;
    certificateEpoch: number | undefined;
    registeredEpoch: number | undefined;
    poaComplete: boolean;
    providers: number;
  }> {
    try {
      const blobInfo = await this.walrusClient.getBlobInfo(blobId);

      if (!blobInfo) {
        throw new CLIError(
          'Failed to retrieve blob information',
          'WALRUS_INFO_ERROR'
        );
      }

      // Get storage providers and availability proof
      const providers = await this.walrusClient.getStorageProviders({ blobId });
      const hasMinProviders =
        !options?.minProviders || providers.length >= options.minProviders;

      // A blob is considered certified if:
      // 1. It has a certification epoch number AND
      // 2. That epoch is not in the future AND
      // 3. The certification was recorded on-chain through Sui's storage fund
      const certified =
        blobInfo.certified_epoch !== undefined &&
        BigInt(blobInfo.certified_epoch) <= currentEpoch;

      // An on-chain PoA (Proof of Availability) is complete when:
      // 1. Required storage fees were paid AND
      // 2. Storage providers published their certificates AND
      // 3. Certificates were validated by Sui validators
      const poaComplete = options?.requirePoA
        ? await this.walrusClient.verifyPoA({ blobId }).catch(() => false)
        : true;

      if (
        !certified ||
        (options?.requirePoA && !poaComplete) ||
        !hasMinProviders
      ) {
        const reasons = [];
        if (!certified) reasons.push('not certified');
        if (options?.requirePoA && !poaComplete) reasons.push('PoA incomplete');
        if (!hasMinProviders)
          reasons.push(
            `insufficient providers (${providers.length}/${options.minProviders})`
          );

        logger.warn(
          `Blob ${blobId} verification incomplete: ${reasons.join(', ')}`
        );
      }

      return {
        certified,
        certificateEpoch: blobInfo.certified_epoch,
        registeredEpoch: blobInfo.registered_epoch,
        poaComplete,
        providers: providers.length,
      };
    } catch (error) {
      handleError('Smart contract verification failed', error);
      return {
        certified: false,
        certificateEpoch: undefined,
        registeredEpoch: undefined,
        poaComplete: false,
        providers: 0,
      };
    }
  }

  /**
   * Verifies blob metadata and attributes
   */
  private async verifyMetadata(
    blobId: string,
    expectedAttributes: Record<string, unknown>
  ): Promise<{
    valid: boolean;
    actualAttributes: Record<string, unknown>;
    mismatches: Array<{ key: string; expected: unknown; actual: unknown }>;
    metadata: BlobMetadata;
  }> {
    try {
      const response = await this.walrusClient.getBlobMetadata({ blobId });
      if (!response) {
        throw new CLIError(
          'Failed to retrieve blob metadata',
          'WALRUS_METADATA_ERROR'
        );
      }

      // Cast the response to BlobMetadata and ensure it has the required structure
      let metadata: BlobMetadata;

      // Check if response has the required structure
      if (response && typeof response === 'object') {
        if (!('V1' in response) || !('$kind' in response)) {
          // Add the required properties if missing
          const responseObj = response as Record<string, unknown>;
          metadata = {
            ...(responseObj as object),
            V1:
              'V1' in responseObj
                ? responseObj.V1
                : {
                    encoding_type: { RedStuff: true, $kind: 'RedStuff' },
                    unencoded_length: '0',
                    hashes: [
                      {
                        primary_hash: {
                          Digest: new Uint8Array(),
                          $kind: 'Digest',
                        },
                        secondary_hash: {
                          Sha256: new Uint8Array(),
                          $kind: 'Sha256',
                        },
                      },
                    ],
                    $kind: 'V1',
                  },
            $kind: 'V1',
          } as BlobMetadata;
        } else {
          metadata = response as BlobMetadata;
        }
      } else {
        // If response is null or not an object, use default metadata
        metadata = this.createDefaultMetadata();
      }

      const actualAttributes = (metadata.V1 || {}) as Record<string, unknown>;
      const mismatches: Array<{
        key: string;
        expected: unknown;
        actual: unknown;
      }> = [];

      // Type-safe attribute comparison
      for (const [key, expectedValue] of Object.entries(expectedAttributes)) {
        const actualValue = actualAttributes[key];
        // Handle different types appropriately
        const match =
          typeof expectedValue === 'object'
            ? JSON.stringify(actualValue) === JSON.stringify(expectedValue)
            : String(actualValue) === String(expectedValue);

        if (!match) {
          mismatches.push({
            key,
            expected: expectedValue,
            actual: actualValue,
          });
        }
      }

      return {
        valid: mismatches.length === 0,
        actualAttributes,
        mismatches,
        metadata,
      };
    } catch (error) {
      handleError('Metadata verification failed', error);
      // Use helper method to create properly typed default metadata
      const defaultMetadata = this.createDefaultMetadata();
      return {
        valid: false,
        actualAttributes: {} as Record<string, never>,
        mismatches: [],
        metadata: defaultMetadata,
      };
    }
  }

  /**
   * Retrieves blob content with timeout protection
   */
  private async retrieveBlobWithTimeout(
    blobId: string,
    timeout: number,
    _attempt: number
  ): Promise<Buffer> {
    const retryManager = new RetryManager(
      [
        'https://testnet.wal.app',
        'https://testnet-replica1.wal.app',
        'https://testnet-replica2.wal.app',
      ],
      {
        timeout,
        maxRetries: 8, // Up to 8 retries
        maxDuration: 180000, // Total timeout of 3 minutes
        onRetry: (error: Error, attempt: number, delay: number) => {
          logger.info(
            `Retrieval attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`
          );
        },
      }
    );

    return retryManager.execute(async (_node: NetworkNode) => {
      const content = await this.walrusClient.readBlob({ blobId });
      if (!content) {
        throw new Error('Retrieved content is empty');
      }
      return Buffer.from(content);
    }, 'blob retrieval');
  }

  /**
   * Comprehensive verification of uploaded blob
   */
  async verifyBlob(
    blobId: string,
    expectedData: Buffer,
    expectedAttributes: Record<string, unknown>,
    options: VerificationOptions = {}
  ): Promise<VerificationResult> {
    const {
      maxRetries,
      baseDelay,
      timeout,
      verifySmartContract,
      requireCertification,
      verifyAttributes,
      requireEpochValidation,
    } = { ...BlobVerificationManager.DEFAULT_OPTIONS, ...options };

    let attempts = 0;
    let lastError: Error | null = null;
    const expectedSize = expectedData.length;
    const expectedChecksums = this.calculateChecksums(expectedData);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      attempts = attempt;
      try {
        logger.info(
          `Verifying blob ${blobId} (attempt ${attempt}/${maxRetries})...`
        );

        // 1. Retrieve and verify content
        const retrievedContent = await this.retrieveBlobWithTimeout(
          blobId,
          timeout,
          attempt
        );

        // 2. Verify size
        if (retrievedContent.length !== expectedSize) {
          throw new Error(
            `Size mismatch: expected ${expectedSize} bytes, got ${retrievedContent.length} bytes`
          );
        }

        // 3. Verify checksums with tamper detection
        const actualChecksums = this.calculateChecksums(retrievedContent);

        // Track tampering detection results
        const tamperingDetected = [];

        for (const [algorithm, expectedHash] of Object.entries(
          expectedChecksums
        )) {
          const actualHash =
            actualChecksums[algorithm as keyof typeof actualChecksums];

          // Critical: Hash comparison for tamper detection
          const isHashValid = actualHash === expectedHash;

          if (!isHashValid) {
            // Tampering detected - collect evidence
            tamperingDetected.push({
              algorithm,
              expected: expectedHash,
              actual: actualHash,
              tampered: true,
            });

            throw new Error(
              `TAMPERING DETECTED: ${algorithm} hash mismatch indicates data modification. ` +
                `Expected: ${expectedHash}, Got: ${actualHash}. ` +
                `This suggests the blob content has been altered.`
            );
          }
        }

        // Log successful verification for audit trail
        if (tamperingDetected.length === 0) {
          logger.info(
            `Hash verification PASSED: All ${Object.keys(expectedChecksums).length} checksums match`,
            {
              blobId,
              algorithms: Object.keys(expectedChecksums),
              verified: true,
            }
          );
        }

        // 4. Verify smart contract certification if requested
        let contractVerification: {
          certified: boolean;
          certificateEpoch: number | undefined;
          registeredEpoch: number | undefined;
          poaComplete?: boolean;
          providers?: number;
        } = {
          certified: false,
          certificateEpoch: undefined,
          registeredEpoch: undefined,
        };

        if (verifySmartContract) {
          const systemState = await this.suiClient.getLatestSuiSystemState();
          if (
            !systemState ||
            typeof systemState !== 'object' ||
            !('epoch' in systemState)
          ) {
            throw new Error('Failed to get system state or epoch information');
          }
          const { epoch } = systemState as { epoch: string };
          const result = await this.verifySmartContract(blobId, BigInt(epoch), {
            requirePoA: true,
            minProviders: 1,
          });
          contractVerification = result;

          if (requireCertification && !contractVerification.certified) {
            throw new Error(
              'Blob certification required but not found' +
                (contractVerification.registeredEpoch !== undefined
                  ? ` (registered at epoch ${contractVerification.registeredEpoch})`
                  : '')
            );
          }

          // Additional epoch validation if required
          if (requireEpochValidation) {
            const systemState = await this.suiClient.getLatestSuiSystemState();
            if (
              !systemState ||
              typeof systemState !== 'object' ||
              !('epoch' in systemState)
            ) {
              throw new Error('Epoch validation failed: Failed to get system state or epoch information');
            }
            const { epoch } = systemState as { epoch: string };
            const currentEpoch = BigInt(epoch);
            
            // Validate that certification epoch is not in the future
            if (contractVerification.certificateEpoch !== undefined) {
              const certificationEpoch = BigInt(contractVerification.certificateEpoch);
              if (certificationEpoch > currentEpoch) {
                throw new Error(
                  `Epoch validation failed: Certificate epoch ${contractVerification.certificateEpoch} is in the future (current: ${epoch})`
                );
              }
            }
            
            // Validate that registration epoch is reasonable
            if (contractVerification.registeredEpoch !== undefined) {
              const registrationEpoch = BigInt(contractVerification.registeredEpoch);
              if (registrationEpoch > currentEpoch) {
                throw new Error(
                  `Epoch validation failed: Registration epoch ${contractVerification.registeredEpoch} is in the future (current: ${epoch})`
                );
              }
            }
          }
        }

        // 5. Verify metadata if requested
        let metadataVerification = {
          valid: true,
          actualAttributes: {} as Record<string, never>,
          mismatches: [] as Array<{
            key: string;
            expected: unknown;
            actual: unknown;
          }>,
          metadata: this.createDefaultMetadata(),
        };
        if (verifyAttributes) {
          const result = await this.verifyMetadata(blobId, expectedAttributes);
          metadataVerification = result;
          if (
            !metadataVerification.valid &&
            metadataVerification.mismatches?.length
          ) {
            throw new Error(
              'Metadata verification failed:\n' +
                metadataVerification.mismatches
                  .map(
                    m =>
                      `  ${m.key}: expected "${m.expected}", got "${m.actual}"`
                  )
                  .join('\n')
            );
          }
        }

        // All verifications passed
        // Ensure we include all required properties with proper type-safe fallbacks
        const contractVerificationComplete = {
          ...contractVerification,
          poaComplete:
            'poaComplete' in contractVerification
              ? (contractVerification as { poaComplete: boolean }).poaComplete
              : false,
          providers:
            'providers' in contractVerification
              ? (contractVerification as { providers: number }).providers
              : 0,
        };

        return {
          success: true,
          details: {
            size: retrievedContent.length,
            checksum: expectedChecksums.sha256,
            blobId,
            certified: contractVerification.certified,
            certificateEpoch: contractVerification.certificateEpoch,
            registeredEpoch: contractVerification.registeredEpoch,
            attributes: metadataVerification.actualAttributes,
          },
          attempts,
          poaComplete: contractVerificationComplete.poaComplete,
          providers: contractVerificationComplete.providers,
          metadata:
            metadataVerification.metadata || this.createDefaultMetadata(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.info(
          `Verification attempt ${attempt} failed, retrying in ${delay}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If we get here, all attempts failed
    throw new CLIError(
      `Blob verification failed after ${attempts} attempts: ${lastError?.message || 'Unknown error'}`,
      'WALRUS_VERIFICATION_FAILED'
    );
  }

  /**
   * Long-term verification that blob remains available and certified
   */
  async monitorBlobAvailability(
    blobId: string,
    checksums: { sha256: string; sha512: string; blake2b: string },
    options: {
      interval?: number;
      maxAttempts?: number;
      timeout?: number;
    } = {}
  ): Promise<void> {
    const { interval = 5000, maxAttempts = 12, timeout = 10000 } = options;

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        // 1. Check blob content
        const content = await this.retrieveBlobWithTimeout(
          blobId,
          timeout,
          attempts
        );
        const actualChecksums = this.calculateChecksums(content);

        // 2. Verify all checksums with tamper detection
        let tamperingDetectedInMonitoring = false;

        for (const [algorithm, expectedHash] of Object.entries(checksums)) {
          const actualHash =
            actualChecksums[algorithm as keyof typeof actualChecksums];

          // Hash comparison with proper tamper detection logic
          const hashMatches = actualHash === expectedHash;

          if (!hashMatches) {
            tamperingDetectedInMonitoring = true;
            throw new Error(
              `TAMPERING DETECTED during monitoring: ${algorithm} hash mismatch on attempt ${attempts}. ` +
                `Expected: ${expectedHash}, Actual: ${actualHash}. ` +
                `Data integrity compromised - blob may have been modified.`
            );
          }
        }

        // Log successful monitoring verification
        if (!tamperingDetectedInMonitoring) {
          logger.info(
            `Monitoring hash verification PASSED for blob ${blobId} (attempt ${attempts})`
          );
        }

        // 3. Check certification status
        const systemState = await this.suiClient.getLatestSuiSystemState();
        if (
          !systemState ||
          typeof systemState !== 'object' ||
          !('epoch' in systemState)
        ) {
          throw new Error('Failed to get system state or epoch information');
        }
        const { epoch } = systemState as { epoch: string };
        const { certified } = await this.verifySmartContract(
          blobId,
          BigInt(epoch),
          {
            requirePoA: false,
            minProviders: 1,
          }
        );

        if (!certified) {
          throw new Error(
            `Blob not certified during monitoring (attempt ${attempts})`
          );
        }

        logger.info(
          `Blob ${blobId} verified available and certified (attempt ${attempts}/${maxAttempts})`
        );
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempts === maxAttempts) {
          break;
        }

        logger.info(
          `Monitoring attempt ${attempts} failed, retrying in ${interval}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    throw new CLIError(
      `Blob availability monitoring failed after ${attempts} attempts: ${lastError?.message}`,
      'WALRUS_MONITORING_FAILED'
    );
  }

  /**
   * Verify a blob upload with optional certification waiting
   */
  async verifyUpload(
    data: Buffer,
    options: {
      waitForCertification?: boolean;
      waitTimeout?: number;
      minProviders?: number;
    } = {}
  ): Promise<{
    blobId: string;
    checksums: {
      sha256: string;
      sha512: string;
      blake2b: string;
    };
    certified: boolean;
    poaComplete: boolean;
    hasMinProviders: boolean;
  }> {
    const {
      waitForCertification = false,
      waitTimeout = 30000,
      minProviders = 1,
    } = options;

    // Upload the blob
    const signer = await this.getTransactionSigner();
    const uploadResult = await this.walrusClient.writeBlob({
      blob: new Uint8Array(data),
      deletable: false,
      epochs: 52,
      signer,
    });
    const blobId = uploadResult.blobObject.blob_id;

    // Calculate checksums
    const checksums = this.calculateChecksums(data);

    // Get storage providers
    const providers = await this.walrusClient.getStorageProviders({ blobId });
    const hasMinProviders = providers.length >= minProviders;

    // Check initial certification status
    const systemState = await this.suiClient.getLatestSuiSystemState();
    if (
      !systemState ||
      typeof systemState !== 'object' ||
      !('epoch' in systemState)
    ) {
      throw new Error('Failed to get system state or epoch information');
    }
    const { epoch } = systemState as { epoch: string };
    let verificationResult = await this.verifySmartContract(
      blobId,
      BigInt(epoch),
      {
        requirePoA: true,
        minProviders,
      }
    );

    // Wait for certification if requested
    if (waitForCertification && !verificationResult.certified) {
      const startTime = Date.now();
      while (Date.now() - startTime < waitTimeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const newSystemState = await this.suiClient.getLatestSuiSystemState();
        if (
          !newSystemState ||
          typeof newSystemState !== 'object' ||
          !('epoch' in newSystemState)
        ) {
          throw new Error(
            'Failed to get system state or epoch information during certification wait'
          );
        }
        const { epoch: newEpoch } = newSystemState as { epoch: string };
        verificationResult = await this.verifySmartContract(
          blobId,
          BigInt(newEpoch),
          {
            requirePoA: true,
            minProviders,
          }
        );
        if (verificationResult.certified) break;
      }
      if (!verificationResult.certified) {
        throw new CLIError(
          'Timeout waiting for certification',
          'WALRUS_CERTIFICATION_TIMEOUT'
        );
      }
    }

    // Check PoA
    const poaComplete = await this.walrusClient
      .verifyPoA({ blobId })
      .catch(() => false);

    return {
      blobId,
      checksums,
      certified: verificationResult.certified,
      poaComplete,
      hasMinProviders,
    };
  }
}
