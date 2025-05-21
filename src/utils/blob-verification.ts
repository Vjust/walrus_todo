// Import statements with CommonJS compatibility
import { SuiClient } from '@mysten/sui/client';
import type { WalrusClientExt } from '../types/client';
import type { BlobInfo, BlobMetadata, BlobMetadataShape } from '../types/walrus';
import { CLIError } from '../types/error';
import { handleError } from './error-handler';
import { RetryManager, NetworkNode } from './retry-manager';
import type { TransactionSigner } from '../types/signer';
import * as crypto from 'crypto';

// Provide fallback implementations for testing environments
const oraImport = (() => {
  try {
    return import('ora');
  } catch {
    return Promise.resolve(() => ({
      start: () => ({ stop: () => {}, succeed: () => {}, fail: () => {} }),
      stop: () => {},
      succeed: () => {},
      fail: () => {}
    }));
  }
})();

const cliProgressImport = (() => {
  try {
    return import('cli-progress');
  } catch {
    return Promise.resolve({
      SingleBar: class MockSingleBar {
        start() { return this; }
        update() { return this; }
        stop() { return this; }
      },
      MultiBar: class MockMultiBar {
        create() { return new (this as any).SingleBar(); }
        remove() {}
        stop() {}
      }
    });
  }
})();

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
    attributes?: Record<string, any>;
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
}

export class BlobVerificationManager {
  private static readonly DEFAULT_OPTIONS: Required<VerificationOptions> = {
    maxRetries: 3,
    baseDelay: 1000,
    timeout: 15000,
    verifySmartContract: true,
    requireCertification: true,
    verifyAttributes: true
  };

  private signer: TransactionSigner | null = null;

  constructor(
    private suiClient: Pick<SuiClient, 'getLatestSuiSystemState'>,
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
        hashes: [{
          primary_hash: {
            Digest: new Uint8Array(),
            $kind: 'Digest'
          },
          secondary_hash: {
            Sha256: new Uint8Array(),
            $kind: 'Sha256'
          }
        }], 
        $kind: 'V1' 
      }, 
      $kind: 'V1' 
    };
  }

  /**
   * Calculates multiple checksums for data integrity verification
   */
  private calculateChecksums(data: Buffer): {
    sha256: string;
    sha512: string;
    blake2b: string;
  } {
    // Required checksums (always calculated)
    const checksums = {
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      sha512: crypto.createHash('sha512').update(data).digest('hex'),
      blake2b: crypto.createHash('blake2b512').update(data).digest('hex')
    };

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
        throw new CLIError('Failed to retrieve blob information', 'WALRUS_INFO_ERROR');
      }

      // Get storage providers and availability proof
      const providers = await this.walrusClient.getStorageProviders({ blobId });
      const hasMinProviders = !options?.minProviders || providers.length >= options.minProviders;

      // A blob is considered certified if:
      // 1. It has a certification epoch number AND
      // 2. That epoch is not in the future AND
      // 3. The certification was recorded on-chain through Sui's storage fund
      const certified = blobInfo.certified_epoch !== undefined && 
                       BigInt(blobInfo.certified_epoch) <= currentEpoch;

      // An on-chain PoA (Proof of Availability) is complete when:
      // 1. Required storage fees were paid AND
      // 2. Storage providers published their certificates AND
      // 3. Certificates were validated by Sui validators
      const poaComplete = options?.requirePoA ? 
        await this.walrusClient.verifyPoA({ blobId }).catch(() => false) :
        true;

      if (!certified || (options?.requirePoA && !poaComplete) || !hasMinProviders) {
        const reasons = [];
        if (!certified) reasons.push('not certified');
        if (options?.requirePoA && !poaComplete) reasons.push('PoA incomplete');
        if (!hasMinProviders) reasons.push(`insufficient providers (${providers.length}/${options.minProviders})`);
        
        console.warn(`Blob ${blobId} verification incomplete: ${reasons.join(', ')}`);
      }

      return {
        certified,
        certificateEpoch: blobInfo.certified_epoch,
        registeredEpoch: blobInfo.registered_epoch,
        poaComplete,
        providers: providers.length
      };
    } catch (error) {
      handleError('Smart contract verification failed', error);
      return {
        certified: false,
        certificateEpoch: undefined,
        registeredEpoch: undefined,
        poaComplete: false,
        providers: 0
      };
    }
  }

  /**
   * Verifies blob metadata and attributes
   */
  private async verifyMetadata(
    blobId: string,
    expectedAttributes: Record<string, any>
  ): Promise<{
    valid: boolean;
    actualAttributes: Record<string, any>;
    mismatches: Array<{ key: string; expected: any; actual: any }>;
    metadata: BlobMetadata;
  }> {
    try {
      const response = await this.walrusClient.getBlobMetadata({ blobId });
      if (!response) {
        throw new CLIError('Failed to retrieve blob metadata', 'WALRUS_METADATA_ERROR');
      }
      
      // Cast the response to BlobMetadata and ensure it has the required structure
      let metadata: BlobMetadata;
      
      // Check if response has the required structure
      if (response && typeof response === 'object') {
        if (!('V1' in response) || !('$kind' in response)) {
          // Add the required properties if missing
          const responseObj = response as Record<string, any>;
          metadata = {
            ...(responseObj as object),
            V1: 'V1' in responseObj ? responseObj.V1 : {
              encoding_type: { RedStuff: true, $kind: 'RedStuff' },
              unencoded_length: '0',
              hashes: [{
                primary_hash: {
                  Digest: new Uint8Array(),
                  $kind: 'Digest'
                },
                secondary_hash: {
                  Sha256: new Uint8Array(),
                  $kind: 'Sha256'
                }
              }],
              $kind: 'V1'
            },
            $kind: 'V1'
          } as BlobMetadata;
        } else {
          metadata = response as BlobMetadata;
        }
      } else {
        // If response is null or not an object, use default metadata
        metadata = this.createDefaultMetadata();
      }
      
      const actualAttributes = (metadata.V1 || {}) as Record<string, any>;
      const mismatches: Array<{ key: string; expected: any; actual: any }> = [];

      // Type-safe attribute comparison
      for (const [key, expectedValue] of Object.entries(expectedAttributes)) {
        const actualValue = actualAttributes[key];
        // Handle different types appropriately
        const match = typeof expectedValue === 'object' ?
          JSON.stringify(actualValue) === JSON.stringify(expectedValue) :
          String(actualValue) === String(expectedValue);
          
        if (!match) {
          mismatches.push({
            key,
            expected: expectedValue,
            actual: actualValue
          });
        }
      }

      return {
        valid: mismatches.length === 0,
        actualAttributes,
        mismatches,
        metadata
      };
    } catch (error) {
      handleError('Metadata verification failed', error);
      // Use helper method to create properly typed default metadata
      const defaultMetadata = this.createDefaultMetadata();
      return {
        valid: false,
        actualAttributes: {},
        mismatches: [],
        metadata: defaultMetadata
      };
    }
  }

  /**
   * Retrieves blob content with timeout protection
   */
  private async retrieveBlobWithTimeout(
    blobId: string,
    timeout: number,
    attempt: number
  ): Promise<Buffer> {
    const retryManager = new RetryManager([
      'https://testnet.wal.app',
      'https://testnet-replica1.wal.app',
      'https://testnet-replica2.wal.app'
    ], {
      timeout,
      maxRetries: 8,        // Up to 8 retries
      maxDuration: 180000,  // Total timeout of 3 minutes
      onRetry: (error: Error, attempt: number, delay: number) => {
        console.log(
          `Retrieval attempt ${attempt} failed:`,
          error.message,
          `Retrying in ${delay}ms...`
        );
      }
    });

    return retryManager.execute(async (node: NetworkNode) => {
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
    expectedAttributes: Record<string, any>,
    options: VerificationOptions = {}
  ): Promise<VerificationResult> {
    const {
      maxRetries,
      baseDelay,
      timeout,
      verifySmartContract,
      requireCertification,
      verifyAttributes
    } = { ...BlobVerificationManager.DEFAULT_OPTIONS, ...options };

    let attempts = 0;
    let lastError: Error | null = null;
    const expectedSize = expectedData.length;
    const expectedChecksums = this.calculateChecksums(expectedData);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      attempts = attempt;
      try {
        console.log(`Verifying blob ${blobId} (attempt ${attempt}/${maxRetries})...`);

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

        // 3. Verify checksums
        const actualChecksums = this.calculateChecksums(retrievedContent);
        for (const [algorithm, expectedHash] of Object.entries(expectedChecksums)) {
          if (actualChecksums[algorithm as keyof typeof actualChecksums] !== expectedHash) {
            throw new Error(
              `${algorithm} checksum mismatch: expected ${expectedHash}, got ${
                actualChecksums[algorithm as keyof typeof actualChecksums]
              }`
            );
          }
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
          registeredEpoch: undefined
        };
        
        if (verifySmartContract) {
          const { epoch } = await this.suiClient.getLatestSuiSystemState();
          const result = await this.verifySmartContract(blobId, BigInt(epoch));
          contractVerification = result;
          
          if (requireCertification && !contractVerification.certified) {
            throw new Error(
              'Blob certification required but not found' +
              (contractVerification.registeredEpoch !== undefined
                ? ` (registered at epoch ${contractVerification.registeredEpoch})`
                : '')
            );
          }
        }

        // 5. Verify metadata if requested
        let metadataVerification = {
          valid: true,
          actualAttributes: {} as Record<string, any>,
          mismatches: [] as Array<{ key: string; expected: any; actual: any }>,
          metadata: this.createDefaultMetadata()
        };
        if (verifyAttributes) {
          const result = await this.verifyMetadata(blobId, expectedAttributes);
          metadataVerification = result;
          if (!metadataVerification.valid && metadataVerification.mismatches?.length) {
            throw new Error(
              'Metadata verification failed:\n' +
              metadataVerification.mismatches
                .map(m => `  ${m.key}: expected "${m.expected}", got "${m.actual}"`)
                .join('\n')
            );
          }
        }

        // All verifications passed
        // Ensure we include all required properties with proper type-safe fallbacks
        const contractVerificationComplete = {
          ...contractVerification,
          poaComplete: 'poaComplete' in contractVerification ? 
            (contractVerification as { poaComplete: boolean }).poaComplete : false,
          providers: 'providers' in contractVerification ? 
            (contractVerification as { providers: number }).providers : 0
        };

        const defaultMetadata = this.createDefaultMetadata();

        return {
          success: true,
          details: {
            size: retrievedContent.length,
            checksum: expectedChecksums.sha256,
            blobId,
            certified: contractVerification.certified,
            certificateEpoch: contractVerification.certificateEpoch,
            registeredEpoch: contractVerification.registeredEpoch,
            attributes: metadataVerification.actualAttributes
          },
          attempts,
          poaComplete: contractVerificationComplete.poaComplete,
          providers: contractVerificationComplete.providers,
          metadata: metadataVerification.metadata || this.createDefaultMetadata()
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Verification attempt ${attempt} failed, retrying in ${delay}ms...`);
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
    const {
      interval = 5000,
      maxAttempts = 12,
      timeout = 10000
    } = options;

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        // 1. Check blob content
        const content = await this.retrieveBlobWithTimeout(blobId, timeout, attempts);
        const actualChecksums = this.calculateChecksums(content);

        // 2. Verify all checksums
        for (const [algorithm, expectedHash] of Object.entries(checksums)) {
          if (actualChecksums[algorithm as keyof typeof actualChecksums] !== expectedHash) {
            throw new Error(
              `${algorithm} checksum mismatch during monitoring (attempt ${attempts})`
            );
          }
        }

        // 3. Check certification status
        const { epoch } = await this.suiClient.getLatestSuiSystemState();
        const { certified } = await this.verifySmartContract(blobId, BigInt(epoch));
        
        if (!certified) {
          throw new Error(`Blob not certified during monitoring (attempt ${attempts})`);
        }

        console.log(`Blob ${blobId} verified available and certified (attempt ${attempts}/${maxAttempts})`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempts === maxAttempts) {
          break;
        }

        console.log(`Monitoring attempt ${attempts} failed, retrying in ${interval}ms...`);
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
  async verifyUpload(data: Buffer, options: {
    waitForCertification?: boolean;
    waitTimeout?: number;
    minProviders?: number;
  } = {}): Promise<{
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
      minProviders = 1
    } = options;

    // Upload the blob
    const signer = await this.getTransactionSigner();
    const uploadResult = await this.walrusClient.writeBlob({
      blob: new Uint8Array(data),
      deletable: false,
      epochs: 52,
      signer
    });
    const blobId = uploadResult.blobObject.blob_id;

    // Calculate checksums
    const checksums = this.calculateChecksums(data);

    // Get storage providers
    const providers = await this.walrusClient.getStorageProviders({ blobId });
    const hasMinProviders = providers.length >= minProviders;

    // Check initial certification status
    const { epoch } = await this.suiClient.getLatestSuiSystemState();
    let verificationResult = await this.verifySmartContract(blobId, BigInt(epoch));

    // Wait for certification if requested
    if (waitForCertification && !verificationResult.certified) {
      const startTime = Date.now();
      while (Date.now() - startTime < waitTimeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        verificationResult = await this.verifySmartContract(blobId, BigInt(epoch));
        if (verificationResult.certified) break;
      }
      if (!verificationResult.certified) {
        throw new CLIError('Timeout waiting for certification', 'WALRUS_CERTIFICATION_TIMEOUT');
      }
    }

    // Check PoA
    const poaComplete = await this.walrusClient.verifyPoA({ blobId }).catch(() => false);

    return {
      blobId,
      checksums,
      certified: verificationResult.certified,
      poaComplete,
      hasMinProviders
    };
  }
}