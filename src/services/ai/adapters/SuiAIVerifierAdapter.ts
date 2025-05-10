import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
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
      const result = await this.signer.signAndExecuteTransactionBlock(tx);
      
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
      const result = await this.signer.signAndExecuteTransactionBlock(tx);
      
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
}