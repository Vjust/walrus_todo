import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import { SignerAdapter } from '../../../types/adapters/SignerAdapter';
import { WalrusClientAdapter } from '../../../types/adapters/WalrusClientAdapter';
import { 
  AIVerifierAdapter, 
  VerificationParams, 
  VerificationRecord,
  AIActionType,
  AIPrivacyLevel,
  ProviderRegistrationParams,
  ProviderInfo
} from '../../../types/adapters/AIVerifierAdapter';
import { createHash } from 'crypto';
import { stringify } from 'csv-stringify/sync';
import { CLIError } from '../../../types/error';

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
      const tx = new TransactionBlock();
      
      // Convert metadata to strings
      const metadataEntries = Object.entries(params.metadata || {}).map(([key, value]) => {
        return { key, value: String(value) };
      });
      
      // Call the register_provider function
      tx.moveCall({
        target: `${this.packageId}::ai_verifier::register_provider`,
        arguments: [
          tx.object(this.registryId), // registry
          tx.pure(params.name), // name
          tx.pure(params.publicKey), // public_key
          tx.pure(JSON.stringify(metadataEntries)) // metadata
        ]
      });
      
      // Execute the transaction
      const result = await this.signer.signAndExecuteTransaction(tx);
      
      // Extract the provider object ID from the transaction results
      const providerId = this.extractCreatedObjectId(result);
      
      return providerId;
    } catch (error) {
      console.error('Failed to register provider:', error);
      throw new Error(`Failed to register provider: ${error}`);
    }
  }

  /**
   * Create a verification record for an AI operation
   */
  async createVerification(params: VerificationParams): Promise<VerificationRecord> {
    try {
      // Calculate request and response hashes
      const requestHash = this.hashData(params.request);
      const responseHash = this.hashData(params.response);
      
      // Create a transaction to create the verification
      const tx = new TransactionBlock();
      
      // Convert metadata to strings
      const metadataEntries = Object.entries(params.metadata || {}).map(([key, value]) => {
        return { key, value: String(value) };
      });
      
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
          tx.pure(JSON.stringify(metadataEntries)) // metadata
        ]
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
        metadata: params.metadata || {}
      };
      
      return verificationRecord;
    } catch (error) {
      console.error('Failed to create verification:', error);
      throw new Error(`Failed to create verification: ${error}`);
    }
  }

  /**
   * Verify a record against provided data
   */
  async verifyRecord(
    record: VerificationRecord,
    request: string,
    response: string
  ): Promise<boolean> {
    try {
      // Calculate hashes of the provided request and response
      const requestHash = this.hashData(request);
      const responseHash = this.hashData(response);
      
      // Compare with the hashes in the record
      const isValid = 
        record.requestHash === requestHash &&
        record.responseHash === responseHash;
      
      return isValid;
    } catch (error) {
      console.error('Failed to verify record:', error);
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
        options: { showContent: true }
      });
      
      if (!provider.data || !provider.data.content) {
        throw new Error(`Provider object not found: ${providerAddress}`);
      }
      
      // Extract provider data from the object
      const content = provider.data.content;
      
      // Parse the provider data
      const providerInfo: ProviderInfo = {
        name: (content as any).fields.name || 'unknown',
        publicKey: (content as any).fields.public_key || '',
        verificationCount: parseInt((content as any).fields.verification_count || '0'),
        isActive: (content as any).fields.is_active || false,
        metadata: {}
      };
      
      // Parse metadata if available
      if ((content as any).fields.metadata) {
        try {
          const metadataStr = (content as any).fields.metadata;
          const metadataEntries = JSON.parse(metadataStr);
          
          // Convert array of {key, value} objects to a Record
          metadataEntries.forEach((entry: {key: string, value: string}) => {
            providerInfo.metadata![entry.key] = entry.value;
          });
        } catch (error) {
          console.warn('Failed to parse provider metadata:', error);
        }
      }
      
      return providerInfo;
    } catch (error) {
      console.error('Failed to get provider info:', error);
      throw new Error(`Failed to get provider info: ${error}`);
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
          StructType: `${this.packageId}::ai_verifier::Verification`
        },
        options: { showContent: true }
      });
      
      // Parse the verification objects
      const verifications: VerificationRecord[] = [];
      
      for (const obj of objects.data) {
        if (!obj.data || !obj.data.content) continue;
        
        const content = obj.data.content;
        
        // Parse metadata if available
        let metadata: Record<string, string> = {};
        if ((content as any).fields.metadata) {
          try {
            const metadataStr = (content as any).fields.metadata;
            const metadataEntries = JSON.parse(metadataStr);
            
            // Convert array of {key, value} objects to a Record
            metadataEntries.forEach((entry: {key: string, value: string}) => {
              metadata[entry.key] = entry.value;
            });
          } catch (error) {
            console.warn('Failed to parse verification metadata:', error);
          }
        }
        
        // Create a verification record
        const verification: VerificationRecord = {
          id: obj.data.objectId,
          requestHash: (content as any).fields.request_hash || '',
          responseHash: (content as any).fields.response_hash || '',
          user: address,
          provider: (content as any).fields.provider || 'unknown',
          timestamp: parseInt((content as any).fields.timestamp || Date.now().toString()),
          verificationType: parseInt((content as any).fields.verification_type || '0'),
          metadata
        };
        
        verifications.push(verification);
      }
      
      return verifications;
    } catch (error) {
      console.error('Failed to list verifications:', error);
      throw new Error(`Failed to list verifications: ${error}`);
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
        options: { showContent: true }
      });
      
      if (!verification.data || !verification.data.content) {
        throw new Error(`Verification object not found: ${verificationId}`);
      }
      
      // Extract verification data from the object
      const content = verification.data.content;
      
      // Parse metadata if available
      let metadata: Record<string, string> = {};
      if ((content as any).fields.metadata) {
        try {
          const metadataStr = (content as any).fields.metadata;
          const metadataEntries = JSON.parse(metadataStr);
          
          // Convert array of {key, value} objects to a Record
          metadataEntries.forEach((entry: {key: string, value: string}) => {
            metadata[entry.key] = entry.value;
          });
        } catch (error) {
          console.warn('Failed to parse verification metadata:', error);
        }
      }
      
      // Create a verification record
      const verificationRecord: VerificationRecord = {
        id: verificationId,
        requestHash: (content as any).fields.request_hash || '',
        responseHash: (content as any).fields.response_hash || '',
        user: (content as any).fields.user || '',
        provider: (content as any).fields.provider || 'unknown',
        timestamp: parseInt((content as any).fields.timestamp || Date.now().toString()),
        verificationType: parseInt((content as any).fields.verification_type || '0'),
        metadata
      };
      
      return verificationRecord;
    } catch (error) {
      console.error('Failed to get verification:', error);
      throw new Error(`Failed to get verification: ${error}`);
    }
  }

  /**
   * Hash data for blockchain storage
   */
  private hashData(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Extract created object ID from a transaction response
   */
  private extractCreatedObjectId(response: SuiTransactionBlockResponse): string {
    // Find the first created object in the transaction
    const created = response.effects?.created;
    
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
        id: createHash('sha256').update(`${verificationId}:${Date.now()}`).digest('hex'),
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
          verificationObjectId: verificationId
        }
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
          publicKey: this.signer.getPublicKey().toBase64()
        }
      };
      
      // Return the proof as a base64-encoded string
      return Buffer.from(JSON.stringify(signedProof)).toString('base64');
    } catch (error) {
      console.error('Failed to generate proof:', error);
      throw new CLIError(
        `Failed to generate proof: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  async exportVerifications(userAddress: string, format: 'json' | 'csv' = 'json'): Promise<string> {
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
          verificationType: AIActionType[v.verificationType] || v.verificationType,
          requestHash: v.requestHash,
          responseHash: v.responseHash,
          ...v.metadata // Include metadata fields
        }));
        
        // Generate CSV
        return stringify(records, { header: true });
      } else {
        throw new CLIError(`Unsupported export format: ${format}`, 'UNSUPPORTED_EXPORT_FORMAT');
      }
    } catch (error) {
      console.error('Failed to export verifications:', error);
      throw new CLIError(
        `Failed to export verifications: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      // Calculate the retention threshold timestamp
      const now = Date.now();
      const retentionThreshold = now - (retentionDays * 24 * 60 * 60 * 1000);
      
      // Get all verifications for the current user
      const userAddress = this.signer.toSuiAddress();
      const verifications = await this.listVerifications(userAddress);
      
      // Filter for records older than the retention threshold
      const expiredRecords = verifications.filter(record => record.timestamp < retentionThreshold);
      
      if (expiredRecords.length === 0) {
        return 0; // No records to delete
      }
      
      // Create a transaction block for batch deletion
      const tx = new TransactionBlock();
      
      // Add move calls to delete each expired record
      for (const record of expiredRecords) {
        tx.moveCall({
          target: `${this.packageId}::ai_verifier::delete_verification`,
          arguments: [
            tx.object(this.registryId), // registry
            tx.object(record.id),       // verification ID
          ]
        });
      }
      
      // Execute the transaction
      await this.signer.signAndExecuteTransaction(tx);
      
      return expiredRecords.length;
    } catch (error) {
      console.error('Failed to enforce retention policy:', error);
      throw new CLIError(
        `Failed to enforce retention policy: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      if (record.metadata.requestBlobId && record.metadata.responseBlobId && this.walrusAdapter) {
        // Delete the associated blobs from Walrus
        try {
          await this.deleteWalrusBlob(record.metadata.requestBlobId);
          await this.deleteWalrusBlob(record.metadata.responseBlobId);
        } catch (error) {
          console.warn('Failed to delete Walrus blobs:', error);
          // Continue with blockchain deletion even if blob deletion fails
        }
      }
      
      // Create a transaction to delete the verification from blockchain
      const tx = new TransactionBlock();
      
      // Call the delete_verification function
      tx.moveCall({
        target: `${this.packageId}::ai_verifier::delete_verification`,
        arguments: [
          tx.object(this.registryId), // registry
          tx.object(verificationId),  // verification ID
        ]
      });
      
      // Execute the transaction
      await this.signer.signAndExecuteTransaction(tx);
      
      return true;
    } catch (error) {
      console.error('Failed to securely destroy data:', error);
      throw new CLIError(
        `Failed to securely destroy data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SECURE_DESTRUCTION_FAILED'
      );
    }
  }
  
  /**
   * Helper method to delete a blob from Walrus storage
   */
  private async deleteWalrusBlob(blobId: string): Promise<boolean> {
    if (!this.walrusAdapter) {
      throw new CLIError('Walrus adapter not configured', 'WALRUS_ADAPTER_MISSING');
    }
    
    try {
      // Create transaction for deletion
      const tx = new TransactionBlock();
      
      // Use the deleteBlob method if it exists
      if (typeof this.walrusAdapter.deleteBlob === 'function') {
        const deleteFunction = this.walrusAdapter.deleteBlob({ blobId });
        await deleteFunction(tx);
      } else {
        // Fallback to direct transaction call if method doesn't exist
        tx.moveCall({
          target: 'walrus::storage::delete_blob',
          arguments: [tx.pure(blobId)]
        });
      }
      
      // Execute the transaction
      await this.signer.signAndExecuteTransaction(tx);
      
      return true;
    } catch (error) {
      console.error(`Failed to delete blob ${blobId}:`, error);
      throw new CLIError(
        `Failed to delete blob: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BLOB_DELETION_FAILED'
      );
    }
  }
}