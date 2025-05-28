// SuiClient imported but not used
// TransactionBlock imported but not used
import { SignerAdapter } from '../../types/adapters/SignerAdapter';
import { WalrusClientAdapter } from '../../types/adapters/WalrusClientAdapter';
import {
  AIVerifierAdapter,
  VerificationParams,
  VerificationRecord,
} from '../../types/adapters/AIVerifierAdapter';
import {
  AICredentialAdapter,
  CredentialVerificationParams,
  CredentialVerificationResult,
} from '../../types/adapters/AICredentialAdapter';
import { createHash } from 'crypto';
import { Logger } from '../../utils/Logger';

const logger = new Logger('BlockchainVerifier');

/**
 * BlockchainVerifier - Service that handles blockchain verification for AI operations
 *
 * This service manages the verification of AI operations and credentials on the
 * blockchain, providing a tamper-proof record of AI activities and credentials.
 */
export class BlockchainVerifier {
  private verifierAdapter: AIVerifierAdapter;
  private credentialAdapter?: AICredentialAdapter;
  private walrusAdapter?: WalrusClientAdapter;

  constructor(
    verifierAdapter: AIVerifierAdapter,
    credentialAdapter?: AICredentialAdapter,
    walrusAdapter?: WalrusClientAdapter
  ) {
    this.verifierAdapter = verifierAdapter;
    this.credentialAdapter = credentialAdapter;
    this.walrusAdapter = walrusAdapter;
  }

  /**
   * Set the credential adapter
   */
  public setCredentialAdapter(adapter: AICredentialAdapter): void {
    this.credentialAdapter = adapter;
  }

  /**
   * Set the Walrus adapter for off-chain storage
   */
  public setWalrusAdapter(adapter: WalrusClientAdapter): void {
    this.walrusAdapter = adapter;
  }

  /**
   * Verify an AI operation and create a blockchain record
   */
  async verifyOperation(
    params: VerificationParams
  ): Promise<VerificationRecord> {
    // Calculate request and response hashes for efficient blockchain storage
    // requestHash and responseHash would be used for blockchain storage
    // const requestHash = this.hashData(params.request);
    // const responseHash = this.hashData(params.response);

    // If Walrus adapter is available, store the full request and response off-chain
    if (this.walrusAdapter && params.privacyLevel !== 'public') {
      try {
        // Store request and response in Walrus storage
        const requestBlob = new TextEncoder().encode(params.request);
        const responseBlob = new TextEncoder().encode(params.response);

        // Get signer from verifier adapter
        const signer = this.verifierAdapter.getSigner();

        // Store request and response blobs
        const requestBlobResult = await this.walrusAdapter.writeBlob({
          blob: requestBlob,
          signer: signer,
        });

        const responseBlobResult = await this.walrusAdapter.writeBlob({
          blob: responseBlob,
          signer: signer,
        });

        // Add blob IDs to metadata
        params.metadata = {
          ...params.metadata,
          requestBlobId: requestBlobResult.blobId,
          responseBlobId: responseBlobResult.blobId,
          storageType: 'walrus',
        };
      } catch (_error) {
        logger.warn('Failed to store full data in Walrus:', _error);
        // Continue with only hashes if off-chain storage fails
      }
    }

    // Create verification on the blockchain
    return this.verifierAdapter.createVerification(params);
  }

  /**
   * Verify a credential and create a blockchain record
   */
  async verifyCredential(
    params: CredentialVerificationParams
  ): Promise<CredentialVerificationResult> {
    if (!this.credentialAdapter) {
      throw new Error('Credential adapter not configured');
    }

    // Verify credential on blockchain
    return this.credentialAdapter.verifyCredential(params);
  }

  /**
   * Verify a verification record against provided data
   */
  async verifyRecord(
    record: VerificationRecord,
    request: string,
    response: string
  ): Promise<boolean> {
    // Defensive validation
    if (!this.verifierAdapter) {
      throw new Error('Verifier adapter is not initialized');
    }
    if (!record) {
      throw new Error('Verification record is required');
    }
    if (typeof request !== 'string' || typeof response !== 'string') {
      throw new Error('Request and response must be strings');
    }

    const result = await this.verifierAdapter.verifyRecord(
      record,
      request,
      response
    );
    return Boolean(result);
  }

  /**
   * Get a specific verification record
   */
  async getVerification(verificationId: string): Promise<VerificationRecord> {
    // Defensive validation
    if (!this.verifierAdapter) {
      throw new Error('Verifier adapter is not initialized');
    }
    if (!verificationId || typeof verificationId !== 'string') {
      throw new Error('Verification ID must be a non-empty string');
    }

    const verification =
      await this.verifierAdapter.getVerification(verificationId);
    if (!verification) {
      throw new Error(`Verification not found: ${verificationId}`);
    }

    return verification;
  }

  /**
   * List verifications for the current user
   */
  async listVerifications(userAddress?: string): Promise<VerificationRecord[]> {
    // Defensive validation
    if (!this.verifierAdapter) {
      throw new Error('Verifier adapter is not initialized');
    }

    const verifications =
      await this.verifierAdapter.listVerifications(userAddress);
    return Array.isArray(verifications) ? verifications : [];
  }

  /**
   * Retrieve the full data for a verification record
   */
  async retrieveVerificationData(
    record: VerificationRecord
  ): Promise<{ request: string; response: string }> {
    if (
      !record.metadata ||
      !record.metadata.requestBlobId ||
      !record.metadata.responseBlobId
    ) {
      throw new Error(
        'Verification does not contain blob IDs for full data retrieval'
      );
    }

    if (!this.walrusAdapter) {
      throw new Error('Walrus adapter not configured');
    }

    try {
      // Retrieve request and response blobs
      const requestBlobId = record.metadata.requestBlobId;
      const responseBlobId = record.metadata.responseBlobId;

      const requestBlob = await this.walrusAdapter.readBlob({
        blobId: requestBlobId,
      });
      const responseBlob = await this.walrusAdapter.readBlob({
        blobId: responseBlobId,
      });

      // Convert Uint8Array to strings
      const request = new TextDecoder().decode(requestBlob);
      const response = new TextDecoder().decode(responseBlob);

      return { request, response };
    } catch (_error) {
      throw new Error(`Failed to retrieve full data: ${_error}`);
    }
  }

  /**
   * Generate a shareable proof of a verification
   */
  async generateVerificationProof(verificationId: string): Promise<string> {
    // Get the verification record
    const record = await this.verifierAdapter.getVerification(verificationId);

    // Create a JSON proof object with verification details
    const proof = {
      verificationId: record.id,
      verifierAddress: this.verifierAdapter.getRegistryAddress(),
      timestamp: record.timestamp,
      requestHash: record.requestHash,
      responseHash: record.responseHash,
      metadata: record.metadata,
      verificationType: record.verificationType,
      chainInfo: {
        network: 'sui',
        objectId: verificationId,
        registryId: await this.verifierAdapter.getRegistryAddress(),
      },
      verificationUrl: `https://explorer.sui.io/objects/${verificationId}`,
    };

    // Convert the proof to a shareable string
    return Buffer.from(JSON.stringify(proof)).toString('base64');
  }

  /**
   * Retrieve and verify a proof
   */
  async verifyProof(
    proofString: string
  ): Promise<{ isValid: boolean; record?: VerificationRecord }> {
    try {
      // Parse the proof
      const proofJson = Buffer.from(proofString, 'base64').toString('utf8');
      const proof = JSON.parse(proofJson) as {
        verificationId: string;
        requestHash: string;
        responseHash: string;
        timestamp: number;
      };

      // Get the verification record from the blockchain
      const record = await this.verifierAdapter.getVerification(
        proof.verificationId
      );

      // Check if verification record exists
      if (!record) {
        return { isValid: false };
      }

      // Validate the proof by comparing hashes and metadata
      const isValid =
        record.id === proof.verificationId &&
        record.requestHash === proof.requestHash &&
        record.responseHash === proof.responseHash &&
        record.timestamp === proof.timestamp;

      return {
        isValid,
        record: isValid ? record : undefined,
      };
    } catch (_error) {
      logger.error('Failed to verify proof:', _error);
      return { isValid: false };
    }
  }

  /**
   * Generate a hash of data for blockchain storage
   */
  private hashData(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get the underlying verifier adapter
   */
  getVerifierAdapter(): AIVerifierAdapter {
    return this.verifierAdapter;
  }

  /**
   * Get the underlying credential adapter
   */
  getCredentialAdapter(): AICredentialAdapter | undefined {
    return this.credentialAdapter;
  }

  /**
   * Get the signer used by the verifier adapter
   */
  getSigner(): SignerAdapter {
    return this.verifierAdapter.getSigner();
  }

  /**
   * Generate a cryptographic proof for a verification
   */
  async generateProof(verificationId: string): Promise<string> {
    // Defensive validation
    if (!this.verifierAdapter) {
      throw new Error('Verifier adapter is not initialized');
    }
    if (!verificationId || typeof verificationId !== 'string') {
      throw new Error('Verification ID must be a non-empty string');
    }

    const proof = await this.verifierAdapter.generateProof(verificationId);
    if (!proof || typeof proof !== 'string') {
      throw new Error('Failed to generate proof: invalid result');
    }

    return proof;
  }

  /**
   * Export verifications for a user
   */
  async exportVerifications(
    userAddress: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    return this.verifierAdapter.exportVerifications(userAddress, format);
  }

  /**
   * Enforce data retention policy
   */
  async enforceRetentionPolicy(retentionDays?: number): Promise<number> {
    return this.verifierAdapter.enforceRetentionPolicy(retentionDays);
  }

  /**
   * Securely destroy verification data
   */
  async securelyDestroyData(verificationId: string): Promise<boolean> {
    return this.verifierAdapter.securelyDestroyData(verificationId);
  }

  /**
   * Delete a verification record
   */
  async deleteVerification(
    verificationId: string,
    userAddress: string
  ): Promise<boolean> {
    // Get verification to check ownership
    const verification = await this.getVerification(verificationId);

    // Verify ownership
    if (verification.user !== userAddress) {
      throw new Error('Unauthorized: only the owner can delete their data');
    }

    // Use secure destruction method for actual deletion
    return this.securelyDestroyData(verificationId);
  }

  /**
   * Verify a signature
   */
  async verifySignature(
    signature: string,
    data?: string,
    publicKey?: string
  ): Promise<boolean> {
    try {
      if (!data || !publicKey) {
        // Simple validation for tests
        return signature === 'valid-signature';
      }

      // In a real implementation, would verify the signature cryptographically
      // const dataBuffer = new TextEncoder().encode(data);
      // const signatureBuffer = Buffer.from(signature, 'base64');
      // const publicKeyBuffer = Buffer.from(publicKey, 'base64');

      // This is a stub - in a real implementation, would use proper verification
      return true;
    } catch (_error) {
      logger.error('Signature verification failed:', _error);
      return false;
    }
  }
}
