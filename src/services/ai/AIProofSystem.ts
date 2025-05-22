import { BlockchainVerifier } from './BlockchainVerifier';
import { VerificationRecord } from '../../types/adapters/AIVerifierAdapter';
import { CLIError } from '../../types/error';
import { createHash } from 'crypto';
import { WalrusClientAdapter } from '../../types/adapters/WalrusClientAdapter';
import fs from 'fs';
import path from 'path';
import { CLI_CONFIG } from '../../constants';
import { Logger } from '../../utils/Logger';

/**
 * Proof data structure
 */
export interface AIOperationProof {
  id: string;
  verificationId: string;
  operation: string;
  requestHash: string;
  responseHash: string;
  timestamp: number;
  user: string;
  provider: string;
  metadata: Record<string, string>;
  chainInfo: {
    network: string;
    objectId: string;
    registryAddress: string;
  };
  signatureInfo?: {
    signature: string;
    publicKey: string;
  };
}

/**
 * AIProofSystem - Manages proofs of AI operations
 * 
 * This service creates, manages, and verifies cryptographic proofs of AI operations
 * that can be independently verified, including proof generation and export.
 */
export class AIProofSystem {
  private blockchainVerifier: BlockchainVerifier;
  private walrusAdapter?: WalrusClientAdapter;
  private proofCachePath: string;

  constructor(blockchainVerifier: BlockchainVerifier, walrusAdapter?: WalrusClientAdapter) {
    this.blockchainVerifier = blockchainVerifier;
    this.walrusAdapter = walrusAdapter;
    
    // Setup local proof cache
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const configDir = path.join(homeDir, '.config', CLI_CONFIG.APP_NAME);
    
    // Ensure the config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    this.proofCachePath = path.join(configDir, 'proofs');
    if (!fs.existsSync(this.proofCachePath)) {
      fs.mkdirSync(this.proofCachePath, { recursive: true });
    }
  }

  /**
   * Generate a proof for an AI operation
   */
  public async generateProof(verificationId: string): Promise<AIOperationProof> {
    try {
      // Get the verification record
      const record = await this.blockchainVerifier.getVerification(verificationId);
      
      // Create the proof
      const proof: AIOperationProof = {
        id: createHash('sha256').update(`${verificationId}:${Date.now()}`).digest('hex'),
        verificationId: verificationId,
        operation: record.metadata.operation || 'unknown',
        requestHash: record.requestHash,
        responseHash: record.responseHash,
        timestamp: record.timestamp,
        user: record.user,
        provider: record.provider,
        metadata: record.metadata,
        chainInfo: {
          network: 'sui',
          objectId: verificationId,
          registryAddress: await this.blockchainVerifier.getVerifierAdapter().getRegistryAddress()
        }
      };
      
      // Add signature if possible
      try {
        const signer = this.blockchainVerifier.getSigner();
        const messageBytes = new TextEncoder().encode(JSON.stringify({
          verificationId,
          timestamp: Date.now(),
          user: record.user
        }));
        
        const signatureResult = await signer.signPersonalMessage(messageBytes);
        
        proof.signatureInfo = {
          signature: Buffer.from(signatureResult.signature).toString('base64'),
          publicKey: signer.getPublicKey().toBase64()
        };
      } catch (_error) {
        Logger.getInstance().warn(`Failed to add signature to proof: ${error instanceof Error ? error.message : String(error)}`);
        // Continue without signature
      }
      
      // Save proof to cache
      this.saveProofToCache(proof);
      
      return proof;
    } catch (_error) {
      throw new CLIError(
        `Failed to generate proof: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROOF_GENERATION_FAILED'
      );
    }
  }

  /**
   * Verify a proof's authenticity
   */
  public async verifyProof(proof: AIOperationProof | string): Promise<{ 
    isValid: boolean; 
    record?: VerificationRecord;
    details?: string;
  }> {
    try {
      // Parse proof if it's a string
      let proofObj: AIOperationProof;
      if (typeof proof === 'string') {
        try {
          // Try to parse as JSON
          proofObj = JSON.parse(proof);
        } catch {
          // Try to parse as base64-encoded JSON
          try {
            const decodedJson = Buffer.from(proof, 'base64').toString('utf8');
            proofObj = JSON.parse(decodedJson);
          } catch {
            return { 
              isValid: false,
              details: 'Invalid proof format. Expected JSON or base64-encoded JSON.'
            };
          }
        }
      } else {
        proofObj = proof;
      }
      
      // Get the verification record from the blockchain
      let record: VerificationRecord;
      try {
        record = await this.blockchainVerifier.getVerification(proofObj.verificationId);
      } catch (_error) {
        return { 
          isValid: false,
          details: `Failed to retrieve verification record: ${error}`
        };
      }
      
      // Verify the basic proof information
      const isBasicInfoValid = 
        record.id === proofObj.verificationId &&
        record.requestHash === proofObj.requestHash &&
        record.responseHash === proofObj.responseHash &&
        record.timestamp === proofObj.timestamp &&
        record.user === proofObj.user &&
        record.provider === proofObj.provider;
      
      if (!isBasicInfoValid) {
        return { 
          isValid: false,
          details: 'Proof information does not match blockchain record.'
        };
      }
      
      // Verify signature if present
      if (proofObj.signatureInfo) {
        try {
          // Verification logic would go here
          // For now, we just acknowledge that the signature exists
          // Signature verification not yet implemented - TODO: Add implementation
        } catch (_error) {
          return { 
            isValid: false,
            details: `Failed to verify signature: ${error}`
          };
        }
      }
      
      return { 
        isValid: true,
        record,
        details: 'Proof verified successfully.'
      };
    } catch (_error) {
      return { 
        isValid: false,
        details: `Proof verification failed: ${error}`
      };
    }
  }

  /**
   * Export a proof to a file
   */
  public async exportProof(
    proof: AIOperationProof, 
    filePath?: string
  ): Promise<string> {
    // Generate default path if not provided
    if (!filePath) {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      filePath = path.join(
        this.proofCachePath, 
        `proof_${proof.operation}_${timestamp}.json`
      );
    }
    
    // Serialize proof
    const proofJson = JSON.stringify(proof, null, 2);
    
    // Write to file
    fs.writeFileSync(filePath, proofJson);
    
    return filePath;
  }

  /**
   * Import a proof from a file
   */
  public async importProof(filePath: string): Promise<AIOperationProof> {
    if (!fs.existsSync(filePath)) {
      throw new CLIError(`Proof file not found: ${filePath}`, 'PROOF_FILE_NOT_FOUND');
    }
    
    try {
      // Read file
      const proofJson = fs.readFileSync(filePath, 'utf8');
      
      // Parse JSON
      const proof = JSON.parse(proofJson);
      
      // Validate proof structure
      if (!proof.id || !proof.verificationId || !proof.operation) {
        throw new CLIError('Invalid proof format', 'INVALID_PROOF_FORMAT');
      }
      
      return proof;
    } catch (_error) {
      throw new CLIError(
        `Failed to import proof: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROOF_IMPORT_FAILED'
      );
    }
  }

  /**
   * Export proof as a shareable string
   */
  public exportProofAsString(proof: AIOperationProof): string {
    return Buffer.from(JSON.stringify(proof)).toString('base64');
  }

  /**
   * Import proof from a shareable string
   */
  public importProofFromString(proofString: string): AIOperationProof {
    try {
      const proofJson = Buffer.from(proofString, 'base64').toString('utf8');
      const proof = JSON.parse(proofJson);
      
      // Validate proof structure
      if (!proof.id || !proof.verificationId || !proof.operation) {
        throw new CLIError('Invalid proof format', 'INVALID_PROOF_FORMAT');
      }
      
      return proof;
    } catch (_error) {
      throw new CLIError(
        `Failed to import proof string: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROOF_IMPORT_FAILED'
      );
    }
  }

  /**
   * Store a proof on the blockchain
   */
  public async storeProofOnChain(proof: AIOperationProof): Promise<string> {
    if (!this.walrusAdapter) {
      throw new CLIError('Walrus adapter not configured', 'WALRUS_ADAPTER_MISSING');
    }
    
    try {
      // Serialize proof
      const proofJson = JSON.stringify(proof);
      const proofBlob = new TextEncoder().encode(proofJson);
      
      // Get signer
      const signer = this.blockchainVerifier.getSigner();
      
      // Store on Walrus
      const result = await this.walrusAdapter.writeBlob({
        blob: proofBlob,
        signer,
        attributes: {
          type: 'ai_proof',
          verificationId: proof.verificationId,
          operation: proof.operation,
          timestamp: proof.timestamp.toString()
        }
      });
      
      return result.blobId;
    } catch (_error) {
      throw new CLIError(
        `Failed to store proof on chain: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROOF_STORAGE_FAILED'
      );
    }
  }

  /**
   * Retrieve a proof from the blockchain
   */
  public async retrieveProofFromChain(blobId: string): Promise<AIOperationProof> {
    if (!this.walrusAdapter) {
      throw new CLIError('Walrus adapter not configured', 'WALRUS_ADAPTER_MISSING');
    }
    
    try {
      // Read from Walrus
      const blob = await this.walrusAdapter.readBlob({ blobId });
      
      // Parse proof
      const proofJson = new TextDecoder().decode(blob);
      const proof = JSON.parse(proofJson);
      
      // Validate proof structure
      if (!proof.id || !proof.verificationId || !proof.operation) {
        throw new CLIError('Invalid proof format', 'INVALID_PROOF_FORMAT');
      }
      
      return proof;
    } catch (_error) {
      throw new CLIError(
        `Failed to retrieve proof from chain: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROOF_RETRIEVAL_FAILED'
      );
    }
  }

  /**
   * Save a proof to the local cache
   */
  private saveProofToCache(proof: AIOperationProof): void {
    const proofPath = path.join(this.proofCachePath, `${proof.id}.json`);
    fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  }

  /**
   * List all proofs in the local cache
   */
  public listCachedProofs(): AIOperationProof[] {
    const proofs: AIOperationProof[] = [];
    
    const files = fs.readdirSync(this.proofCachePath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const proofPath = path.join(this.proofCachePath, file);
          const proofJson = fs.readFileSync(proofPath, 'utf8');
          const proof = JSON.parse(proofJson);
          
          // Validate proof structure
          if (proof.id && proof.verificationId && proof.operation) {
            proofs.push(proof);
          }
        } catch (_error) {
          Logger.getInstance().warn(`Failed to read proof file ${file}: ${error instanceof Error ? error.message : String(error)}`);
          // Skip invalid files
        }
      }
    }
    
    return proofs;
  }
}

// Singleton instance
let proofSystem: AIProofSystem | null = null;

export function initializeProofSystem(
  blockchainVerifier: BlockchainVerifier,
  walrusAdapter?: WalrusClientAdapter
): AIProofSystem {
  if (!proofSystem) {
    proofSystem = new AIProofSystem(blockchainVerifier, walrusAdapter);
  }
  return proofSystem;
}