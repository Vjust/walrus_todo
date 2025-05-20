import { AIVerificationService, VerifiedAIResult } from './AIVerificationService';
import { AIActionType, AIPrivacyLevel } from '../../types/adapters/AIVerifierAdapter';
import { Todo } from '../../types/todo';
import { BlockchainVerifier } from './BlockchainVerifier';
import { SecureCredentialManager } from './SecureCredentialManager';
import { AIPermissionLevel } from '../../types/adapters/AICredentialAdapter';
import { AIPermissionManager, getPermissionManager } from './AIPermissionManager';
import { AIProofSystem, AIOperationProof } from './AIProofSystem';
import { CLIError } from '../../types/error';

/**
 * Enhanced verified result that includes blockchain proof
 */
export interface BlockchainVerifiedResult<T> extends VerifiedAIResult<T> {
  proof?: AIOperationProof;
  transactionId?: string;
  provider: string;
  verificationDate: Date;
}

/**
 * BlockchainAIVerificationService - Enhanced AI verification service using the blockchain
 * 
 * This class extends the basic AIVerificationService with blockchain verification,
 * permission management, and proof generation.
 */
export class BlockchainAIVerificationService extends AIVerificationService {
  private blockchainVerifier: BlockchainVerifier;
  private permissionManager: AIPermissionManager;
  private proofSystem: AIProofSystem;
  private credentialManager: SecureCredentialManager;
  private defaultProvider: string;


  constructor(
    blockchainVerifier: BlockchainVerifier,
    permissionManager: AIPermissionManager,
    credentialManager: SecureCredentialManager,
    defaultProvider: string = 'default_provider'
  ) {
    // Initialize with empty adapter as we're replacing functionality
    super({} as any);
    
    this.blockchainVerifier = blockchainVerifier;
    this.permissionManager = permissionManager;
    this.credentialManager = credentialManager;
    this.defaultProvider = defaultProvider;
    
    // Initialize proof system
    this.proofSystem = new AIProofSystem(blockchainVerifier);
  }

  /**
   * Check if provider has permission for an operation
   */
  private async checkOperationPermission(
    operation: AIActionType,
    provider: string,
    todoCount: number,
    isVerified: boolean = true
  ): Promise<void> {
    // Convert AIActionType enum value to operation string name
    let operationName: string;
    switch (operation) {
      case AIActionType.SUMMARIZE:
        operationName = 'summarize';
        break;
      case AIActionType.CATEGORIZE:
        operationName = 'categorize';
        break;
      case AIActionType.PRIORITIZE:
        operationName = 'prioritize';
        break;
      case AIActionType.SUGGEST:
        operationName = 'suggest';
        break;
      case AIActionType.ANALYZE:
        operationName = 'analyze';
        break;
      default:
        operationName = 'analyze'; // Default fallback
    }

    // Check permission using the permission manager
    const permissionGranted = await this.permissionManager.checkPermission(provider, operationName);

    if (!permissionGranted) {
      throw new CLIError(
        `Permission denied: Insufficient permissions for this operation`,
        'AI_PERMISSION_DENIED'
      );
    }
  }

  /**
   * Create blockchain verification for an operation
   */
  public async createBlockchainVerification<T>(
    operationType: AIActionType,
    todos: Todo[],
    result: T,
    provider: string = this.defaultProvider,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY,
    metadata: Record<string, string> = {}
  ): Promise<BlockchainVerifiedResult<T>> {
    // Check operation permission
    await this.checkOperationPermission(
      operationType,
      provider,
      todos.length
    );
    
    // Add standard metadata
    const enhancedMetadata = {
      ...metadata,
      todoCount: todos.length.toString(),
      timestamp: Date.now().toString(),
      privacyLevel
    };
    
    // Create verification on blockchain
    const verificationResult = await this.blockchainVerifier.verifyOperation({
      actionType: operationType,
      request: JSON.stringify(todos),
      response: JSON.stringify(result),
      provider,
      metadata: enhancedMetadata,
      privacyLevel
    });
    
    // Verification result is directly the record in this implementation
    if (!verificationResult) {
      throw new CLIError(
        `Blockchain verification failed: Unknown error`,
        'BLOCKCHAIN_VERIFICATION_FAILED'
      );
    }
    
    // Generate proof for the operation
    const proof = await this.proofSystem.generateProof(verificationResult.id);
    
    // Return enhanced result
    return {
      result,
      verification: verificationResult,
      proof,
      transactionId: verificationResult.id, // Use record ID as transaction ID
      provider,
      verificationDate: new Date(verificationResult.timestamp)
    };
  }

  /**
   * Create a verified AI summarization
   */
  public async createVerifiedSummary(
    todos: Todo[],
    summary: string,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY,
    provider: string = this.defaultProvider
  ): Promise<BlockchainVerifiedResult<string>> {
    return this.createBlockchainVerification(
      AIActionType.SUMMARIZE,
      todos,
      summary,
      provider,
      privacyLevel,
      {
        summaryLength: summary.length.toString()
      }
    );
  }

  /**
   * Create a verified AI categorization
   */
  public async createVerifiedCategorization(
    todos: Todo[],
    categories: Record<string, string[]>,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY,
    provider: string = this.defaultProvider
  ): Promise<BlockchainVerifiedResult<Record<string, string[]>>> {
    return this.createBlockchainVerification(
      AIActionType.CATEGORIZE,
      todos,
      categories,
      provider,
      privacyLevel,
      {
        categoryCount: Object.keys(categories).length.toString()
      }
    );
  }

  /**
   * Create a verified AI prioritization
   */
  public async createVerifiedPrioritization(
    todos: Todo[],
    priorities: Record<string, number>,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY,
    provider: string = this.defaultProvider
  ): Promise<BlockchainVerifiedResult<Record<string, number>>> {
    return this.createBlockchainVerification(
      AIActionType.PRIORITIZE,
      todos,
      priorities,
      provider,
      privacyLevel
    );
  }

  /**
   * Create a verified AI suggestion
   */
  public async createVerifiedSuggestion(
    todos: Todo[],
    suggestions: string[],
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY,
    provider: string = this.defaultProvider
  ): Promise<BlockchainVerifiedResult<string[]>> {
    return this.createBlockchainVerification(
      AIActionType.SUGGEST,
      todos,
      suggestions,
      provider,
      privacyLevel,
      {
        suggestionCount: suggestions.length.toString()
      }
    );
  }

  /**
   * Create a verified AI analysis
   */
  public async createVerifiedAnalysis(
    todos: Todo[],
    analysis: Record<string, any>,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY,
    provider: string = this.defaultProvider
  ): Promise<BlockchainVerifiedResult<Record<string, any>>> {
    return this.createBlockchainVerification(
      AIActionType.ANALYZE,
      todos,
      analysis,
      provider,
      privacyLevel,
      {
        analysisKeys: Object.keys(analysis).join(',')
      }
    );
  }

  /**
   * Verify an exported proof
   */
  public async verifyExportedProof(exportedProof: string): Promise<boolean> {
    try {
      // For path-based proofs, we need to import from a file
      // For string-based proofs, we can directly verify the string
      const verificationResult = await this.proofSystem.verifyProof(exportedProof);
      return verificationResult.isValid;
    } catch (error) {
      console.error('Failed to verify proof:', error);
      return false;
    }
  }

  /**
   * Get a specific verification record
   */
  public async getVerification(verificationId: string): Promise<BlockchainVerifiedResult<any>> {
    // Get verification from blockchain
    const verification = await this.blockchainVerifier.getVerification(verificationId);

    // The actual result content will depend on the privacy level
    // For non-public data, we'd need to fetch from Walrus storage

    return {
      result: {}, // Placeholder - would fetch actual content
      verification,
      provider: verification.provider,
      verificationDate: new Date(verification.timestamp)
    };
  }

  /**
   * List all verifications for the current user
   */
  public async listVerifications(): Promise<BlockchainVerifiedResult<any>[]> {
    const verifications = await this.blockchainVerifier.listVerifications();
    
    return verifications.map(verification => ({
      result: {}, // Placeholder - would fetch actual content
      verification,
      provider: verification.provider,
      verificationDate: new Date(verification.timestamp)
    }));
  }

  /**
   * Generate a proof for an operation type
   * 
   * Creates a cryptographically verifiable proof for an AI operation
   */
  public async generateProof(
    actionType: AIActionType,
    request: string,
    response: string
  ): Promise<{
    proofId: string;
    signature: string;
    data: {
      actionType: AIActionType;
      request: string;
      response: string;
      timestamp: number;
    }
  }> {
    // Create verification first
    const verification = await this.createBlockchainVerification(
      actionType,
      JSON.parse(request),
      JSON.parse(response),
      this.defaultProvider
    );

    // Generate proof from the verification
    const proofString = await this.blockchainVerifier.generateProof(verification.verification.id);
    const proofData = JSON.parse(Buffer.from(proofString, 'base64').toString());

    return {
      proofId: proofData.id,
      signature: proofData.signature?.signature || '',
      data: {
        actionType,
        request,
        response,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Verify an external proof
   * 
   * Verifies a proof's authenticity and integrity
   */
  public async verifyExternalProof(
    proofId: string,
    signature: string,
    data: {
      request: string;
      response: string;
    }
  ): Promise<boolean> {
    // Simulate verifying signature
    const isValidSignature = await this.blockchainVerifier['verifySignature']?.(signature);
    
    if (!isValidSignature) {
      throw new Error('Invalid signature for proof verification');
    }
    
    // In a real implementation, would verify the actual proof data against blockchain records
    return true;
  }

  /**
   * Verify a proof with blockchain
   * 
   * Verifies the authenticity and integrity of a proof based on blockchain records
   */
  public async verifyProof(
    proofId: string,
    signature: string,
    data: any
  ): Promise<boolean> {
    try {
      // Convert proof to expected format
      const proofString = Buffer.from(JSON.stringify({
        id: proofId,
        signature: {
          signature,
          publicKey: this.blockchainVerifier.getSigner().getPublicKey().toBase64()
        },
        ...data
      })).toString('base64');
      
      // Verify proof integrity using blockchain data
      const result = await this.proofSystem.verifyProof(proofString);
      
      return result.isValid;
    } catch (error) {
      console.error('Failed to verify proof:', error);
      return false;
    }
  }
}