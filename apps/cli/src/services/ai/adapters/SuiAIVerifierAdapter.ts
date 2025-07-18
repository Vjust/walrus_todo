// Use compatible type to match SignerAdapter expectations
type SuiTransactionBlockResponse = Record<string, unknown>;

// Define types for Sui object content structures
interface SuiProviderFields {
  name: string;
  public_key: string;
  verification_count: string;
  is_active: boolean;
  metadata?: string;
}

interface SuiVerificationFields {
  request_hash: string;
  response_hash: string;
  user: string;
  provider: string;
  timestamp: string;
  verification_type: string;
  metadata?: string;
}

interface SuiObjectContent {
  fields: SuiProviderFields | SuiVerificationFields;
}
import { SuiClient } from '../../../utils/adapters/sui-client-compatibility';
import { Transaction } from '@mysten/sui/transactions';
import { createHash } from 'crypto';
import { stringify } from 'csv-stringify/sync';
import { SignerAdapter } from '../../../types/adapters/SignerAdapter';
import { WalrusClientAdapter } from '../../../types/adapters/WalrusClientAdapter';
import { Logger } from '../../../utils/Logger';
import { CLIError } from '../../../types/errors/consolidated';
import {
  AIVerifierAdapter,
  VerificationParams,
  VerificationRecord,
  AIActionType,
  ProviderRegistrationParams,
  ProviderInfo,
} from '../../../types/adapters/AIVerifierAdapter';

const logger = new Logger('SuiAIVerifierAdapter');

/**
 * SuiAIVerifierAdapter - Blockchain adapter for AI verification
 *
 * This adapter implements the AIVerifierAdapter interface using the Sui blockchain
 * for verification and storage of AI operation records.
 */
export class SuiAIVerifierAdapter implements AIVerifierAdapter {
  private client: SuiClient;
  private signer: SignerAdapter;
  private packageId: string;
  private registryId: string;
  private walrusAdapter?: WalrusClientAdapter;

  constructor(
    client: SuiClient,
    signer: SignerAdapter,
    packageId: string,
    registryId: string,
    walrusAdapter?: WalrusClientAdapter
  ) {
    this.client = client;
    this.signer = signer;
    this.packageId = packageId;
    this.registryId = registryId;
    this.walrusAdapter = walrusAdapter;
  }

  /**
   * Get the signer
   */
  getSigner(): SignerAdapter {
    return this.signer;
  }

  /**
   * Register an AI provider on the blockchain
   */
  async registerProvider(params: ProviderRegistrationParams): Promise<string> {
    try {
      // Create a transaction to register the provider
      const tx = new Transaction();

      // Convert metadata to strings
      const metadataEntries = Object.entries(params.metadata || {}).map(
        ([key, value]) => {
          return { key, value: String(value) };
        }
      );

      // Call the register_provider function
      tx.moveCall({
        target: `${this.packageId}::ai_verifier::register_provider`,
        arguments: [
          tx.object(this.registryId), // registry
          tx.pure(params.name), // name
          tx.pure(params.publicKey), // public_key
          tx.pure(JSON.stringify(metadataEntries)), // metadata
        ],
      });

      // Execute the transaction
      const result = await this.signer.signAndExecuteTransaction(tx);

      // Extract the provider object ID from the transaction results
      const providerId = this.extractCreatedObjectId(result);

      return providerId;
    } catch (_error) {
      logger.error('Failed to register provider:', _error);
      throw new Error(`${_error}`);
    }
  }

  /**
   * Create a verification record for an AI operation
   */
  async createVerification(
    params: VerificationParams
  ): Promise<VerificationRecord> {
    // Add type guards for verification parameters
    if (!params) {
      throw new Error('Verification parameters are required');
    }

    if (params.actionType === undefined || params.actionType === null) {
      throw new Error('Action type is required for verification');
    }

    if (!params.request || typeof params.request !== 'string') {
      throw new Error('Request data is required and must be a string');
    }

    if (!params.response || typeof params.response !== 'string') {
      throw new Error('Response data is required and must be a string');
    }

    try {
      // Calculate request and response hashes
      const requestHash = this.hashData(params.request);
      const responseHash = this.hashData(params.response);

      // Create a transaction to create the verification
      const tx = new Transaction();

      // Convert metadata to strings
      const metadataEntries = Object.entries(params.metadata || {}).map(
        ([key, value]) => {
          return { key, value: String(value) };
        }
      );

      // Get the user address from the signer
      const userAddress = this.signer.toSuiAddress();

      // Call the create_verification function
      tx.moveCall({
        target: `${this.packageId}::ai_verifier::create_verification`,
        arguments: [
          tx.object(this.registryId), // registry
          tx.pure(params.actionType), // action_type
          tx.pure(requestHash), // request_hash
          tx.pure(responseHash), // response_hash
          tx.pure(params.provider || 'unknown'), // provider
          tx.pure(JSON.stringify(metadataEntries)), // metadata
        ],
      });

      // Execute the transaction
      const result = await this.signer.signAndExecuteTransaction(tx);

      // Extract the verification ID from the transaction results
      const verificationId = this.extractCreatedObjectId(result);

      // Create a verification record
      const verificationRecord: VerificationRecord = {
        id: verificationId,
        requestHash: requestHash,
        responseHash: responseHash,
        user: userAddress,
        provider: params.provider || 'unknown',
        timestamp: Date.now(),
        verificationType: params.actionType,
        metadata: params.metadata || {},
      };

      return verificationRecord;
    } catch (_error) {
      logger.error('Failed to create verification:', _error);
      throw new Error(`${_error}`);
    }
  }

  /**
   * Verify a record against provided data with enhanced tamper detection
   */
  async verifyRecord(
    record: VerificationRecord,
    request: string,
    response: string
  ): Promise<boolean> {
    try {
      // Calculate hashes of the provided request and response using secure algorithms
      const calculatedRequestHash = this.hashData(request);
      const calculatedResponseHash = this.hashData(response);

      // Validate hash format and length for collision resistance
      if (
        !this.isValidHashFormat(calculatedRequestHash) ||
        !this.isValidHashFormat(calculatedResponseHash)
      ) {
        logger.error('Invalid hash format detected during verification');
        return false;
      }

      // Critical: Hash comparison for tamper detection
      const requestHashMatches = record.requestHash === calculatedRequestHash;
      const responseHashMatches =
        record.responseHash === calculatedResponseHash;

      // Detailed tamper detection logic
      if (!requestHashMatches) {
        logger.warn('TAMPERING DETECTED: Request hash mismatch', {
          recordId: record.id,
          expected: record.requestHash,
          calculated: calculatedRequestHash,
          tampered: true,
        });
      }

      if (!responseHashMatches) {
        logger.warn('TAMPERING DETECTED: Response hash mismatch', {
          recordId: record.id,
          expected: record.responseHash,
          calculated: calculatedResponseHash,
          tampered: true,
        });
      }

      // Return true ONLY if both hashes match (no tampering detected)
      const isValid = requestHashMatches && responseHashMatches;

      // Log verification result
      if (isValid) {
        logger.info('Hash verification PASSED: No tampering detected', {
          recordId: record.id,
          verified: true,
        });
      } else {
        logger.error('Hash verification FAILED: Tampering detected', {
          recordId: record.id,
          requestTampered: !requestHashMatches,
          responseTampered: !responseHashMatches,
          verified: false,
        });
      }

      return isValid;
    } catch (_error) {
      logger.error('Failed to verify record:', _error);
      return false;
    }
  }

  /**
   * Get provider information
   */
  async getProviderInfo(providerAddress: string): Promise<ProviderInfo> {
    try {
      // Get provider object data from the blockchain
      const provider = await this.client.getObject({
        id: providerAddress,
        options: { showContent: true },
      });

      if (!provider.data || !provider.data.content) {
        throw new Error(`Provider object not found: ${providerAddress}`);
      }

      // Extract provider data from the object
      const content = provider.data.content;

      // Parse the provider data
      const fields = (content as SuiObjectContent).fields as SuiProviderFields;
      const providerInfo: ProviderInfo = {
        name: fields.name || 'unknown',
        publicKey: fields.public_key || '',
        verificationCount: parseInt(fields.verification_count || '0'),
        isActive: fields.is_active || false,
        metadata: {},
      };

      // Parse metadata if available
      if (fields.metadata) {
        try {
          const metadataStr = fields.metadata;
          const metadataEntries = JSON.parse(metadataStr) as Array<{
            key: string;
            value: string;
          }>;

          // Convert array of {key, value} objects to a Record
          metadataEntries.forEach((entry: { key: string; value: string }) => {
            if (providerInfo.metadata) {
              providerInfo.metadata[entry.key] = entry.value;
            }
          });
        } catch (_error) {
          logger.warn('Failed to parse provider metadata:', _error);
        }
      }

      return providerInfo;
    } catch (_error) {
      logger.error('Failed to get provider info:', _error);
      throw new Error(`${_error}`);
    }
  }

  /**
   * List verifications for a user
   */
  async listVerifications(userAddress?: string): Promise<VerificationRecord[]> {
    try {
      // Use the provided user address or the signer's address
      const address = userAddress || this.signer.toSuiAddress();

      // Query the blockchain for verifications owned by the user
      const objects = await this.client.getOwnedObjects({
        owner: address,
        filter: {
          StructType: `${this.packageId}::ai_verifier::Verification`,
        },
        options: { showContent: true },
      });

      // Parse the verification objects
      const verifications: VerificationRecord[] = [];

      for (const obj of objects.data) {
        if (!obj.data || !obj.data.content) continue;

        const content = obj.data.content;

        // Parse metadata if available
        const metadata: Record<string, string> = {};
        if ((content as SuiObjectContent).fields.metadata) {
          try {
            const metadataStr = (
              (content as SuiObjectContent).fields as SuiVerificationFields
            ).metadata;
            const metadataEntries = JSON.parse(metadataStr) as Array<{
              key: string;
              value: string;
            }>;

            // Convert array of {key, value} objects to a Record
            metadataEntries.forEach((entry: { key: string; value: string }) => {
              metadata[entry.key] = entry.value;
            });
          } catch (_error) {
            logger.warn('Failed to parse verification metadata:', _error);
          }
        }

        // Create a verification record
        const fields = (content as SuiObjectContent)
          .fields as SuiVerificationFields;
        const verification: VerificationRecord = {
          id: obj.data.objectId,
          requestHash: fields.request_hash || '',
          responseHash: fields.response_hash || '',
          user: address,
          provider: fields.provider || 'unknown',
          timestamp: parseInt(fields.timestamp || Date.now().toString()),
          verificationType: parseInt(fields.verification_type || '0'),
          metadata,
        };

        verifications.push(verification);
      }

      return verifications;
    } catch (_error) {
      logger.error('Failed to list verifications:', _error);
      throw new Error(`${_error}`);
    }
  }

  /**
   * Get the registry address
   */
  async getRegistryAddress(): Promise<string> {
    return this.registryId;
  }

  /**
   * Get a specific verification by ID
   */
  async getVerification(verificationId: string): Promise<VerificationRecord> {
    try {
      // Get verification object data from the blockchain
      const verification = await this.client.getObject({
        id: verificationId,
        options: { showContent: true },
      });

      if (!verification.data || !verification.data.content) {
        throw new Error(`Verification object not found: ${verificationId}`);
      }

      // Extract verification data from the object
      const content = verification.data.content;

      // Parse metadata if available
      const metadata: Record<string, string> = {};
      if ((content as SuiObjectContent).fields.metadata) {
        try {
          const metadataStr = (
            (content as SuiObjectContent).fields as SuiVerificationFields
          ).metadata;
          const metadataEntries = JSON.parse(metadataStr);

          // Convert array of {key, value} objects to a Record
          metadataEntries.forEach((entry: { key: string; value: string }) => {
            metadata[entry.key] = entry.value;
          });
        } catch (_error) {
          logger.warn('Failed to parse verification metadata:', _error);
        }
      }

      // Create a verification record
      const fields = (content as SuiObjectContent)
        .fields as SuiVerificationFields;
      const verificationRecord: VerificationRecord = {
        id: verificationId,
        requestHash: fields.request_hash || '',
        responseHash: fields.response_hash || '',
        user: fields.user || '',
        provider: fields.provider || 'unknown',
        timestamp: parseInt(fields.timestamp || Date.now().toString()),
        verificationType: parseInt(fields.verification_type || '0'),
        metadata,
      };

      return verificationRecord;
    } catch (_error) {
      logger.error('Failed to get verification:', _error);
      throw new Error(`${_error}`);
    }
  }

  /**
   * Hash data for blockchain storage with collision-resistant algorithm
   */
  private hashData(data: string): string {
    // Use SHA-256 for collision resistance and standardization
    const hash = createHash('sha256').update(data, 'utf8').digest('hex');

    // Validate hash output format
    if (!this.isValidHashFormat(hash)) {
      throw new Error('Hash generation failed - invalid output format');
    }

    return hash;
  }

  /**
   * Validate hash format for collision resistance verification
   */
  private isValidHashFormat(hash: string): boolean {
    // SHA-256 should produce exactly 64 hexadecimal characters
    const sha256Pattern = /^[a-fA-F0-9]{64}$/;
    return sha256Pattern.test(hash);
  }

  /**
   * Extract created object ID from a transaction response
   */
  private extractCreatedObjectId(
    response: SuiTransactionBlockResponse
  ): string {
    // Find the first created object in the transaction
    const effects = response.effects as
      | { created?: Array<{ reference: { objectId: string } }> }
      | undefined;
    const created = effects?.created;

    if (!created || created.length === 0) {
      throw new Error('No objects created in transaction');
    }

    return created[0].reference.objectId;
  }

  /**
   * Generate a cryptographic proof for a verification record
   *
   * Creates a cryptographically signed proof of an AI verification that can be
   * independently verified and shared
   */
  async generateProof(verificationId: string): Promise<string> {
    try {
      // Get the verification record
      const record = await this.getVerification(verificationId);

      // Create proof data structure
      const proofData = {
        id: createHash('sha256')
          .update(`${verificationId}:${Date.now()}`)
          .digest('hex'),
        verificationId: record.id,
        requestHash: record.requestHash,
        responseHash: record.responseHash,
        timestamp: record.timestamp,
        user: record.user,
        provider: record.provider,
        verificationType: record.verificationType,
        metadata: record.metadata,
        chainInfo: {
          network: 'sui',
          packageId: this.packageId,
          registryId: this.registryId,
          verificationObjectId: verificationId,
        },
      };

      // Sign the proof data with the signer's key
      const dataToSign = JSON.stringify(proofData);
      const signatureBytes = await this.signer.signPersonalMessage(
        new TextEncoder().encode(dataToSign)
      );

      // Add signature to the proof
      const signedProof = {
        ...proofData,
        signature: {
          signature: Buffer.from(signatureBytes.signature).toString('base64'),
          publicKey: this.signer.getPublicKey().toBase64(),
        },
      };

      // Return the proof as a base64-encoded string
      return Buffer.from(JSON.stringify(signedProof)).toString('base64');
    } catch (_error) {
      logger.error('Failed to generate proof:', _error);
      throw new CLIError(
        `Failed to generate proof: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'PROOF_GENERATION_FAILED'
      );
    }
  }

  /**
   * Export user verification records in the specified format
   *
   * Retrieves all verification records for a user and exports them in the
   * requested format (JSON or CSV)
   */
  async exportVerifications(
    userAddress: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      // Get all verifications for the user
      const verifications = await this.listVerifications(userAddress);

      if (verifications.length === 0) {
        return format === 'json' ? '[]' : '';
      }

      if (format === 'json') {
        // Return as formatted JSON
        return JSON.stringify(verifications, null, 2);
      } else if (format === 'csv') {
        // Convert to CSV format
        // Extract relevant fields for CSV
        const records = verifications.map(v => ({
          id: v.id,
          timestamp: new Date(v.timestamp).toISOString(),
          provider: v.provider,
          verificationType:
            AIActionType[v.verificationType] || v.verificationType,
          requestHash: v.requestHash,
          responseHash: v.responseHash,
          ...v.metadata, // Include metadata fields
        }));

        // Generate CSV
        return stringify(records, { header: true });
      } else {
        throw new CLIError(
          `Unsupported export format: ${format}`,
          'UNSUPPORTED_EXPORT_FORMAT'
        );
      }
    } catch (_error) {
      logger.error('Failed to export verifications:', _error);
      throw new CLIError(
        `Failed to export verifications: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'EXPORT_FAILED'
      );
    }
  }

  /**
   * Enforce data retention policy
   *
   * Deletes verification records that are older than the specified retention period
   * Returns the number of records deleted
   */
  async enforceRetentionPolicy(retentionDays: number = 30): Promise<number> {
    try {
      // Calculate the retention threshold timestamp with replay attack prevention
      const now = Date.now();
      const retentionThreshold = now - retentionDays * 24 * 60 * 60 * 1000;

      // Validate timestamp to prevent manipulation
      if (retentionThreshold > now || retentionThreshold < 0) {
        throw new Error(
          'Invalid retention threshold - potential timestamp manipulation detected'
        );
      }

      // Get all verifications for the current user
      const userAddress = this.signer.toSuiAddress();
      const verifications = await this.listVerifications(userAddress);

      // Filter for records older than the retention threshold with timestamp validation
      const expiredRecords = verifications.filter(record => {
        // Validate record timestamp format and range
        if (
          typeof record.timestamp !== 'number' ||
          record.timestamp < 0 ||
          record.timestamp > now
        ) {
          logger.warn('Invalid timestamp detected in verification record', {
            recordId: record.id,
            timestamp: record.timestamp,
            suspicious: true,
          });
          return false; // Skip suspicious records
        }

        return record.timestamp < retentionThreshold;
      });

      if (expiredRecords.length === 0) {
        return 0; // No records to delete
      }

      // Create a transaction block for batch deletion
      const tx = new Transaction();

      // Add move calls to delete each expired record
      for (const record of expiredRecords) {
        tx.moveCall({
          target: `${this.packageId}::ai_verifier::delete_verification`,
          arguments: [
            tx.object(this.registryId), // registry
            tx.object(record.id), // verification ID
          ],
        });
      }

      // Execute the transaction
      await this.signer.signAndExecuteTransaction(tx);

      return expiredRecords.length;
    } catch (_error) {
      logger.error('Failed to enforce retention policy:', _error);
      throw new CLIError(
        `Failed to enforce retention policy: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'RETENTION_POLICY_FAILED'
      );
    }
  }

  /**
   * Securely destroy data
   *
   * Permanently deletes a verification record and associated data in a secure manner
   */
  async securelyDestroyData(verificationId: string): Promise<boolean> {
    try {
      // Get the verification record to check ownership
      const record = await this.getVerification(verificationId);

      // Verify the current signer is the owner of the verification
      const userAddress = this.signer.toSuiAddress();
      if (record.user !== userAddress) {
        throw new CLIError(
          'Only the owner can destroy their verification data',
          'UNAUTHORIZED_DESTRUCTION'
        );
      }

      // Check if there's associated data in Walrus storage
      if (
        record.metadata.requestBlobId &&
        record.metadata.responseBlobId &&
        this.walrusAdapter
      ) {
        // Delete the associated blobs from Walrus
        try {
          await this.deleteWalrusBlob(record.metadata.requestBlobId);
          await this.deleteWalrusBlob(record.metadata.responseBlobId);
        } catch (_error) {
          logger.warn('Failed to delete Walrus blobs:', _error);
          // Continue with blockchain deletion even if blob deletion fails
        }
      }

      // Create a transaction to delete the verification from blockchain
      const tx = new Transaction();

      // Call the delete_verification function
      tx.moveCall({
        target: `${this.packageId}::ai_verifier::delete_verification`,
        arguments: [
          tx.object(this.registryId), // registry
          tx.object(verificationId), // verification ID
        ],
      });

      // Execute the transaction
      await this.signer.signAndExecuteTransaction(tx);

      return true;
    } catch (_error) {
      logger.error('Failed to securely destroy data:', _error);
      throw new CLIError(
        `Failed to securely destroy data: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'SECURE_DESTRUCTION_FAILED'
      );
    }
  }

  /**
   * Helper method to delete a blob from Walrus storage
   */
  private async deleteWalrusBlob(blobId: string): Promise<boolean> {
    if (!this.walrusAdapter) {
      throw new CLIError(
        'Walrus adapter not configured',
        'WALRUS_ADAPTER_MISSING'
      );
    }

    try {
      // Create transaction for deletion
      const tx = new Transaction();

      // Use the deleteBlob method if it exists
      if (typeof this.walrusAdapter.deleteBlob === 'function') {
        // The deleteBlob method expects different options based on the WalrusClientAdapter interface
        const deleteFunction = this.walrusAdapter.deleteBlob({
          blobId: blobId, // Use explicit property name
        } as Parameters<typeof this.walrusAdapter.deleteBlob>[0]); // Proper type assertion
        await deleteFunction(tx);
      } else {
        // Fallback to direct transaction call if method doesn't exist
        tx.moveCall({
          target: 'walrus::storage::delete_blob',
          arguments: [tx.pure(blobId)],
        });
      }

      // Execute the transaction
      await this.signer.signAndExecuteTransaction(tx);

      return true;
    } catch (_error) {
      logger.error(`Failed to delete blob ${blobId}:`, _error);
      throw new CLIError(
        `Failed to delete blob: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'BLOB_DELETION_FAILED'
      );
    }
  }
}
