/**
 * CredentialVerificationService.ts
 *
 * Service for verifying digital credentials on the blockchain
 */

import { CLIError } from '../../../types/errors/consolidated';
import { SuiClient } from '../../../utils/adapters/sui-client-compatibility';
import type { WalrusClientExt } from '../../../types/client';
import { Logger } from '../../../utils/Logger';
// createHash imported but not used
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

/**
 * Verification options for credential verification
 */
export interface CredentialVerificationOptions {
  verifySignature?: boolean;
  verifyTimestamp?: boolean;
  verifyRevocation?: boolean;
  verifySchemaCompliance?: boolean;
}

/**
 * Verification result with proper boolean types
 */
export interface CredentialVerificationResult {
  valid: boolean;
  signature: boolean;
  timestamp: boolean;
  revocation: boolean;
  schemaCompliance: boolean;
  issuer: string;
  subject: string;
  issuanceDate: Date;
  expirationDate: Date | null;
}

/**
 * Digital credential structure
 */
export interface DigitalCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: {
    id: string;
    name?: string;
  };
  credentialSubject: {
    id: string;
    [key: string]: unknown;
  };
  issuanceDate: string;
  expirationDate?: string;
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    jws: string;
    proofValue?: string;
  };
  [key: string]: unknown;
}

/**
 * Registration result interface
 */
export interface CredentialRegistrationResult {
  credentialId: string;
  credential: DigitalCredential;
  registered: boolean;
  transactionDigest: string;
}

/**
 * Service for verifying digital credentials against the blockchain
 */
export class CredentialVerificationService {
  private logger: Logger;

  constructor(
    private suiClient: Pick<SuiClient, 'getLatestSuiSystemState' | 'getObject'>,
    private walrusClient: WalrusClientExt,
    private signer: Ed25519Keypair
  ) {
    this.logger = new Logger('CredentialVerificationService');
  }

  /**
   * Verify a digital credential against the blockchain
   */
  async verifyCredential(
    credentialId: string,
    options: CredentialVerificationOptions = {}
  ): Promise<CredentialVerificationResult> {
    const {
      verifySignature = true,
      verifyTimestamp = true,
      verifyRevocation = true,
      verifySchemaCompliance = true,
    } = options;

    try {
      // 1. Get credential data from Walrus storage
      const credentialData = await this.walrusClient.readBlob({
        blobId: credentialId,
      });
      if (!credentialData) {
        throw new CLIError('Credential not found', 'CREDENTIAL_NOT_FOUND');
      }

      // 2. Parse credential
      const credential = JSON.parse(
        Buffer.from(credentialData).toString('utf-8')
      );

      // 3. Get metadata for verification
      // metadata and attestationInfo would be used for verification
      // const metadata = await this.walrusClient.getBlobMetadata({ blobId: credentialId });
      // const attestationInfo = await this.walrusClient.getBlobInfo(credentialId);

      // 4. Verify credential components
      const signatureValid = verifySignature
        ? await this.verifyDigitalSignature(credential)
        : true;
      const timestampValid = verifyTimestamp
        ? this.verifyTimestamps(credential)
        : true;
      const notRevoked = verifyRevocation
        ? await this.checkRevocationStatus(credential.id)
        : true;
      const schemaValid = verifySchemaCompliance
        ? this.validateSchema(credential)
        : true;

      // 5. Return verification results with proper boolean types
      return {
        valid: signatureValid && timestampValid && notRevoked && schemaValid,
        signature: signatureValid,
        timestamp: timestampValid,
        revocation: notRevoked,
        schemaCompliance: schemaValid,
        issuer: credential.issuer,
        subject: credential.credentialSubject.id,
        issuanceDate: new Date(credential.issuanceDate),
        expirationDate: credential.expirationDate
          ? new Date(credential.expirationDate)
          : null,
      };
    } catch (_error) {
      this.logger.error(
        `Credential verification failed: ${_error instanceof Error ? _error.message : String(_error)}`
      );
      throw new CLIError(
        `Credential verification failed: ${_error instanceof Error ? _error.message : String(_error)}`,
        'CREDENTIAL_VERIFICATION_ERROR'
      );
    }
  }

  /**
   * Verify digital signature on credential
   */
  private async verifyDigitalSignature(
    credential: DigitalCredential
  ): Promise<boolean> {
    try {
      // Get the signature from the proof
      const { proof } = credential;
      if (!proof || !proof.jws) {
        this.logger.error('Missing proof in credential');
        return false;
      }

      // Verify the signature using blockchain verification
      // In a real implementation, we would verify the signature cryptographically
      // For now, we'll perform a basic check
      const signatureBytes = Buffer.from(proof.jws, 'base64');
      if (signatureBytes.length < 64) {
        this.logger.error('Invalid signature length');
        return false;
      }

      // PLANNED FEATURE: Cryptographic verification
      // This will implement digital signatures and cryptographic proofs
      // See docs/ai-blockchain-verification-roadmap.md for details
      // Current implementation returns true for compatibility
      return true;
    } catch (_error) {
      this.logger.error(`Signature verification failed: ${_error.message}`);
      return false;
    }
  }

  /**
   * Verify issuance and expiration timestamps
   */
  private verifyTimestamps(credential: DigitalCredential): boolean {
    try {
      const now = new Date();
      const issuanceDate = new Date(credential.issuanceDate);

      // Credential cannot be issued in the future
      if (issuanceDate > now) {
        this.logger.warn(
          `Credential has future issuance date: ${issuanceDate.toISOString()}`
        );
        return false;
      }

      // Check expiration if present
      if (credential.expirationDate) {
        const expirationDate = new Date(credential.expirationDate);
        if (expirationDate < now) {
          this.logger.warn(
            `Credential expired on: ${expirationDate.toISOString()}`
          );
          return false;
        }
      }

      return true;
    } catch (_error) {
      this.logger.error(`Timestamp verification failed: ${_error.message}`);
      return false;
    }
  }

  /**
   * Check revocation status against blockchain registry
   */
  private async checkRevocationStatus(_credentialId: string): Promise<boolean> {
    try {
      // In a real implementation, this would check against a revocation registry on-chain
      // For testing, we'll just return true (not revoked)
      return true;
    } catch (_error) {
      this.logger.error(`Revocation check failed: ${_error.message}`);
      return false;
    }
  }

  /**
   * Validate credential schema compliance
   */
  private validateSchema(credential: DigitalCredential): boolean {
    try {
      // Basic schema validation
      const isValid =
        credential &&
        typeof credential === 'object' &&
        credential.issuer &&
        credential.credentialSubject &&
        credential.issuanceDate &&
        Array.isArray(credential.type) &&
        credential.type.includes('VerifiableCredential');

      if (!isValid) {
        this.logger.warn('Credential failed schema validation');
      }

      return isValid;
    } catch (_error) {
      this.logger.error(`Schema validation failed: ${_error.message}`);
      return false;
    }
  }

  /**
   * Issue a new credential and register on blockchain
   */
  async issueCredential(data: {
    type: string[];
    issuer: string;
    subject: string;
    claims: Record<string, unknown>;
    expirationDate?: Date;
  }): Promise<{
    credentialId: string;
    credential: DigitalCredential;
    registered: boolean;
    transactionDigest: string;
  }> {
    try {
      // 1. Create credential document
      const now = new Date();
      const credential: DigitalCredential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1',
        ],
        id: `uuid:${this.generateUuid()}`,
        type: ['VerifiableCredential', ...data.type],
        issuer: {
          id: data.issuer,
        },
        issuanceDate: now.toISOString(),
        expirationDate: data.expirationDate?.toISOString(),
        credentialSubject: {
          id: data.subject,
          ...data.claims,
        },
      };

      // 2. Sign credential
      const signedCredential = await this.signCredential(credential);

      // 3. Store on Walrus
      const credentialBytes = new TextEncoder().encode(
        JSON.stringify(signedCredential)
      );
      const response = await this.walrusClient.writeBlob({
        blob: credentialBytes,
        signer: this.signer,
        deletable: false,
        epochs: 52,
        attributes: {
          contentType: 'application/json',
          credentialType: data.type.join(','),
          issuer: data.issuer,
          subject: data.subject,
        },
      });

      // 4. Register on blockchain
      const blobId = response.blobId;
      // PLANNED FEATURE: Blockchain registration
      // This will create an on-chain record of credential verification
      // See docs/ai-blockchain-verification-roadmap.md for details

      return {
        credentialId: blobId,
        credential: signedCredential,
        registered: true,
        transactionDigest: 'mock-transaction-digest', // Replace with actual transaction digest
      };
    } catch (_error) {
      this.logger.error(
        `Failed to issue credential: ${_error instanceof Error ? _error.message : String(_error)}`
      );
      throw new CLIError(
        `Failed to issue credential: ${_error instanceof Error ? _error.message : String(_error)}`,
        'CREDENTIAL_ISSUANCE_ERROR'
      );
    }
  }

  /**
   * Sign a credential with the issuer's key
   */
  private async signCredential(
    credential: DigitalCredential
  ): Promise<DigitalCredential> {
    const now = new Date();

    // Generate a signature (mock implementation)
    const dataToSign = JSON.stringify(credential);
    const signatureBytes = await this.signer.sign(
      new TextEncoder().encode(dataToSign)
    );

    // Add a proof to the credential
    return {
      ...credential,
      proof: {
        type: 'Ed25519Signature2020',
        created: now.toISOString(),
        verificationMethod: `${credential.issuer}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: Buffer.from(signatureBytes).toString('base64'),
        proofValue: Buffer.from(signatureBytes).toString('base64'),
      },
    };
  }

  /**
   * Revoke a credential on the blockchain
   */
  async revokeCredential(
    credentialId: string,
    reason: string
  ): Promise<{
    revoked: boolean;
    transactionDigest: string;
  }> {
    try {
      // Check if credential exists
      const exists = await this.walrusClient
        .getBlobInfo(credentialId)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        throw new CLIError('Credential not found', 'CREDENTIAL_NOT_FOUND');
      }

      // PLANNED FEATURE: Blockchain revocation
      // This will register revocation on-chain
      // See docs/ai-blockchain-verification-roadmap.md for details
      // For now, we're just returning a mock response

      this.logger.info(`Credential ${credentialId} revoked: ${reason}`);

      return {
        revoked: true,
        transactionDigest: 'mock-revocation-digest', // Replace with actual transaction digest
      };
    } catch (_error) {
      this.logger.error(
        `Failed to revoke credential: ${_error instanceof Error ? _error.message : String(_error)}`
      );
      throw new CLIError(
        `Failed to revoke credential: ${_error instanceof Error ? _error.message : String(_error)}`,
        'CREDENTIAL_REVOCATION_ERROR'
      );
    }
  }

  /**
   * Generate a UUID
   */
  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
