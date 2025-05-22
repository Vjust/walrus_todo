import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import { SignerAdapter } from '../../../types/adapters/SignerAdapter';
import { WalrusClientAdapter } from '../../../types/adapters/WalrusClientAdapter';
import { 
  AICredentialAdapter,
  AIProviderCredential,
  CredentialType,
  CredentialVerificationParams,
  CredentialVerificationResult
} from '../../../types/adapters/AICredentialAdapter';
import { createHash } from 'crypto';

/**
 * SuiAICredentialAdapter - Blockchain adapter for AI credentials
 * 
 * This adapter implements the AICredentialAdapter interface using the Sui blockchain
 * for verification and storage of AI credential records.
 */
export class SuiAICredentialAdapter implements AICredentialAdapter {
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
   * Store a credential on the blockchain
   */
  async storeCredential(credential: AIProviderCredential): Promise<string> {
    try {
      // Create a transaction to store the credential
      const tx = new TransactionBlock();
      
      // Convert metadata to strings
      const metadataEntries = Object.entries(credential.metadata || {}).map(([key, value]) => {
        return { key, value: String(value) };
      });
      
      // Calculate expiry timestamp
      const expiry = credential.expiresAt ? credential.expiresAt.toString() : '0';
      
      // Call the store_credential function
      tx.moveCall({
        target: `${this.packageId}::ai_credential::store_credential`,
        arguments: [
          tx.object(this.registryId), // registry
          tx.pure(credential.id), // credential_id
          tx.pure(credential.providerName), // provider_name
          tx.pure(credential.credentialType), // credential_type
          tx.pure(this.hashData(credential.credentialValue)), // credential_hash (store hash, not actual value)
          tx.pure(credential.permissionLevel), // permission_level
          tx.pure(expiry), // expires_at
          tx.pure(JSON.stringify(metadataEntries)) // metadata
        ]
      });
      
      // Execute the transaction
      const result = await this.signer.signAndExecuteTransaction(tx);
      
      // Extract the credential object ID from the transaction results
      const credentialObjectId = this.extractCreatedObjectId(result);
      
      return credentialObjectId;
    } catch (_error) {
      console.error('Failed to store credential:', error);
      throw new Error(`Failed to store credential: ${error}`);
    }
  }

  /**
   * Retrieve a credential by ID
   */
  async getCredential(credentialId: string): Promise<AIProviderCredential> {
    try {
      // Get credential object data from the blockchain
      const credential = await this.client.getObject({
        id: credentialId,
        options: { showContent: true }
      });
      
      if (!credential.data || !credential.data.content) {
        throw new Error(`Credential object not found: ${credentialId}`);
      }
      
      // Extract credential data from the object
      const content = credential.data.content;
      
      // Parse metadata if available
      const metadata: Record<string, any> = {};
      if ((content as any).fields.metadata) {
        try {
          const metadataStr = (content as any).fields.metadata;
          const metadataEntries = JSON.parse(metadataStr);
          
          // Convert array of {key, value} objects to a Record
          metadataEntries.forEach((entry: {key: string, value: string}) => {
            metadata[entry.key] = entry.value;
          });
        } catch (_error) {
          console.warn('Failed to parse credential metadata:', error);
        }
      }
      
      // Create an AIProviderCredential object
      // Note: The actual credential value is not stored on-chain, only the hash
      const providerCredential: AIProviderCredential = {
        id: (content as any).fields.credential_id || credentialId,
        providerName: (content as any).fields.provider_name || 'unknown',
        credentialType: (content as any).fields.credential_type || CredentialType.API_KEY,
        credentialValue: '', // Not stored on-chain
        metadata,
        isVerified: (content as any).fields.is_verified || false,
        verificationProof: (content as any).fields.verification_proof || undefined,
        storageOptions: { encrypt: true },
        createdAt: parseInt((content as any).fields.created_at || '0'),
        expiresAt: parseInt((content as any).fields.expires_at || '0'),
        permissionLevel: parseInt((content as any).fields.permission_level || '0')
      };
      
      return providerCredential;
    } catch (_error) {
      console.error('Failed to get credential:', error);
      throw new Error(`Failed to get credential: ${error}`);
    }
  }

  /**
   * Retrieve a credential by provider name
   */
  async getCredentialByProvider(providerName: string): Promise<AIProviderCredential> {
    try {
      // Query the blockchain for credentials by provider name
      // This would typically require a custom index or query endpoint
      
      // For now, we'll simply list all credentials and filter by provider name
      const credentials = await this.listCredentials();
      
      const credential = credentials.find(c => c.providerName === providerName);
      
      if (!credential) {
        throw new Error(`No credential found for provider: ${providerName}`);
      }
      
      return credential;
    } catch (_error) {
      console.error('Failed to get credential by provider:', error);
      throw new Error(`Failed to get credential by provider: ${error}`);
    }
  }

  /**
   * List all credentials
   */
  async listCredentials(): Promise<AIProviderCredential[]> {
    try {
      // Get the user address from the signer
      const userAddress = this.signer.toSuiAddress();
      
      // Query the blockchain for credentials owned by the user
      const objects = await this.client.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${this.packageId}::ai_credential::Credential`
        },
        options: { showContent: true }
      });
      
      // Parse the credential objects
      const credentials: AIProviderCredential[] = [];
      
      for (const obj of objects.data) {
        if (!obj.data || !obj.data.content) continue;
        
        const content = obj.data.content;
        
        // Parse metadata if available
        const metadata: Record<string, any> = {};
        if ((content as any).fields.metadata) {
          try {
            const metadataStr = (content as any).fields.metadata;
            const metadataEntries = JSON.parse(metadataStr);
            
            // Convert array of {key, value} objects to a Record
            metadataEntries.forEach((entry: {key: string, value: string}) => {
              metadata[entry.key] = entry.value;
            });
          } catch (_error) {
            console.warn('Failed to parse credential metadata:', error);
          }
        }
        
        // Create a credential object
        const credential: AIProviderCredential = {
          id: (content as any).fields.credential_id || obj.data.objectId,
          providerName: (content as any).fields.provider_name || 'unknown',
          credentialType: (content as any).fields.credential_type || CredentialType.API_KEY,
          credentialValue: '', // Not stored on-chain
          metadata,
          isVerified: (content as any).fields.is_verified || false,
          verificationProof: (content as any).fields.verification_proof || undefined,
          storageOptions: { encrypt: true },
          createdAt: parseInt((content as any).fields.created_at || '0'),
          expiresAt: parseInt((content as any).fields.expires_at || '0'),
          permissionLevel: parseInt((content as any).fields.permission_level || '0')
        };
        
        credentials.push(credential);
      }
      
      return credentials;
    } catch (_error) {
      console.error('Failed to list credentials:', error);
      throw new Error(`Failed to list credentials: ${error}`);
    }
  }

  /**
   * Check if a credential exists for a provider
   */
  async hasCredential(providerName: string): Promise<boolean> {
    try {
      const credentials = await this.listCredentials();
      return credentials.some(c => c.providerName === providerName);
    } catch (_error) {
      console.error('Failed to check credential existence:', error);
      return false;
    }
  }

  /**
   * Delete a credential
   */
  async deleteCredential(credentialId: string): Promise<boolean> {
    try {
      // Create a transaction to delete the credential
      const tx = new TransactionBlock();
      
      // Call the delete_credential function
      tx.moveCall({
        target: `${this.packageId}::ai_credential::delete_credential`,
        arguments: [
          tx.object(this.registryId), // registry
          tx.object(credentialId) // credential
        ]
      });
      
      // Execute the transaction
      await this.signer.signAndExecuteTransaction(tx);
      
      return true;
    } catch (_error) {
      console.error('Failed to delete credential:', error);
      return false;
    }
  }

  /**
   * Verify a credential on the blockchain
   */
  async verifyCredential(params: CredentialVerificationParams): Promise<CredentialVerificationResult> {
    try {
      // Create a transaction to verify the credential
      const tx = new TransactionBlock();
      
      // Convert metadata to strings
      const metadataEntries = Object.entries(params.metadata || {}).map(([key, value]) => {
        return { key, value: String(value) };
      });
      
      // Call the verify_credential function
      tx.moveCall({
        target: `${this.packageId}::ai_credential::verify_credential`,
        arguments: [
          tx.object(this.registryId), // registry
          tx.pure(params.credentialId), // credential_id
          tx.pure(params.providerName), // provider_name
          tx.pure(params.publicKey), // public_key
          tx.pure(params.timestamp.toString()), // timestamp
          tx.pure(JSON.stringify(metadataEntries)) // metadata
        ]
      });
      
      // Execute the transaction
      const result = await this.signer.signAndExecuteTransaction(tx);
      
      // Extract the verification ID from the transaction results
      const verificationId = this.extractCreatedObjectId(result);
      
      // Create a verification result
      const verificationResult: CredentialVerificationResult = {
        isVerified: true,
        verificationId,
        timestamp: params.timestamp,
        verifierAddress: params.verifierAddress,
        metadata: params.metadata || {},
        expiryTimestamp: params.metadata?.expiryTimestamp ? parseInt(params.metadata.expiryTimestamp) : undefined
      };
      
      return verificationResult;
    } catch (_error) {
      console.error('Failed to verify credential:', error);
      throw new Error(`Failed to verify credential: ${error}`);
    }
  }

  /**
   * Check if a credential verification is still valid
   */
  async checkVerificationStatus(verificationId: string): Promise<boolean> {
    try {
      // Get verification object data from the blockchain
      const verification = await this.client.getObject({
        id: verificationId,
        options: { showContent: true }
      });
      
      if (!verification.data || !verification.data.content) {
        return false;
      }
      
      // Extract verification data
      const content = verification.data.content;
      
      // Check if verification is still valid
      const isValid = (content as any).fields.is_valid || false;
      
      // Check if verification has expired
      const expiryTimestamp = parseInt((content as any).fields.expiry_timestamp || '0');
      if (expiryTimestamp > 0 && expiryTimestamp < Date.now()) {
        return false;
      }
      
      return isValid;
    } catch (_error) {
      console.error('Failed to check verification status:', error);
      return false;
    }
  }

  /**
   * Generate a shareable proof for a credential
   */
  async generateCredentialProof(credentialId: string): Promise<string> {
    try {
      // Get credential data
      const credential = await this.getCredential(credentialId);
      
      if (!credential.verificationProof) {
        throw new Error('Credential is not verified');
      }
      
      // Get verification data
      const verification = await this.client.getObject({
        id: credential.verificationProof,
        options: { showContent: true }
      });
      
      if (!verification.data || !verification.data.content) {
        throw new Error('Verification not found');
      }
      
      // Extract verification data
      const content = verification.data.content;
      
      // Create a proof object
      const proof = {
        credentialId,
        verificationId: credential.verificationProof,
        providerName: credential.providerName,
        credentialType: credential.credentialType,
        permissionLevel: credential.permissionLevel,
        timestamp: parseInt((content as any).fields.timestamp || '0'),
        verifier: (content as any).fields.verifier || '',
        chainInfo: {
          network: 'sui',
          objectId: credential.verificationProof,
          registryId: this.registryId
        }
      };
      
      // Convert to a shareable string
      return Buffer.from(JSON.stringify(proof)).toString('base64');
    } catch (_error) {
      console.error('Failed to generate credential proof:', error);
      throw new Error(`Failed to generate credential proof: ${error}`);
    }
  }

  /**
   * Revoke a credential verification
   */
  async revokeVerification(verificationId: string): Promise<boolean> {
    try {
      // Create a transaction to revoke the verification
      const tx = new TransactionBlock();
      
      // Call the revoke_verification function
      tx.moveCall({
        target: `${this.packageId}::ai_credential::revoke_verification`,
        arguments: [
          tx.object(this.registryId), // registry
          tx.object(verificationId) // verification
        ]
      });
      
      // Execute the transaction
      await this.signer.signAndExecuteTransaction(tx);
      
      return true;
    } catch (_error) {
      console.error('Failed to revoke verification:', error);
      return false;
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
   * Get the signer for this credential adapter
   */
  getSigner(): SignerAdapter {
    return this.signer;
  }
}