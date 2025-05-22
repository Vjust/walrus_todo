import { CLIError } from '../../../types/error';
import { AIProvider } from '../types';
import { SuiClient } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
// asUint8ArrayOrTransactionBlock and asStringUint8ArrayOrTransactionBlock imported but not used
import { bcs } from '@mysten/sui/bcs';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { NetworkValidator } from '../../../utils/NetworkValidator';
import { Logger } from '../../../utils/Logger';
import { getAIVerifierAddress } from './module-address';
import { createHash } from 'crypto';

/**
 * Handles verification of AI provider credentials on the Sui blockchain
 */
export class CredentialVerifier {
  private client: SuiClient;
  private logger: Logger;
  private networkValidator: NetworkValidator;
  private moduleAddress: string;
  
  constructor() {
    this.logger = new Logger('CredentialVerifier');
    // Initialize with devnet as expected environment and auto-switch disabled
    this.networkValidator = new NetworkValidator({ expectedEnvironment: 'devnet', autoSwitch: false });
    // Get the deployed AI verifier module address
    this.moduleAddress = getAIVerifierAddress();
    this.initializeClient();
  }

  /**
   * Initialize the Sui client
   */
  private initializeClient() {
    // Initialize Sui client (skip network validation for now)
    this.client = new SuiClient({
      url: process.env.SUI_RPC_URL || 'https://fullnode.devnet.sui.io:443',
    });
  }

  /**
   * Register a new credential on the blockchain without exposing the actual key
   */
  async registerCredential(provider: AIProvider, apiKey: string): Promise<string> {
    // Create a one-way hash of the API key to store on-chain
    const keyHash = this.hashCredential(apiKey);
    
    try {
      // Prepare keypair for transaction
      const keypair = this.getKeypair();
      
      // Build transaction to call the register_credential function
      // Create a transaction block and cast to the expected type
      // This is necessary because TransactionBlock doesn't satisfy the TransactionBlock interface exactly
      const tx = new TransactionBlock() as unknown as TransactionBlock;
      tx.moveCall({
        target: `${this.moduleAddress}::ai_verifier::register_credential`,
        arguments: [
          tx.pure(provider),
          tx.pure(keyHash),
          tx.pure(new Date().toISOString()), // registration timestamp
        ],
      });
      
      // Execute transaction
      // Need to cast to any to bypass type checking issues
      const result = await this.client.signAndExecuteTransaction({
        transaction: tx as any,
        signer: keypair,
      });
      
      this.logger.info(`Credential registered on blockchain with digest: ${result.digest}`);
      return result.digest;
    } catch (_error) {
      this.logger.error(`Failed to register credential: ${error.message}`);
      throw new CLIError(
        `Failed to register credential on blockchain: ${error.message}`,
        'CREDENTIAL_REGISTRATION_FAILED'
      );
    }
  }

  /**
   * Verify if a credential is valid on the blockchain
   */
  async verifyCredential(provider: AIProvider, apiKey: string): Promise<boolean> {
    const keyHash = this.hashCredential(apiKey);
    
    try {
      // Query the blockchain to check if this credential exists and is valid
      const tx = this.buildVerifyTx(provider, keyHash);
      const result = await this.client.devInspectTransactionBlock({
        sender: this.getKeypair().getPublicKey().toSuiAddress(),
        transactionBlock: tx as any,
      });
      
      // Parse the result to get boolean value
      if (result && result.results && result.results[0]) {
        const returnValue = result.results[0].returnValues[0][0];
        // BCS decode the return value (should be a boolean)
        const isValid = bcs.Bool.parse(Uint8Array.from(returnValue));
        return isValid;
      }
      
      return false;
    } catch (_error) {
      this.logger.error(`Failed to verify credential: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a provider has any registered credential
   */
  async isRegistered(provider: AIProvider): Promise<boolean> {
    try {
      // Create a transaction block and cast to the expected type
      // This is necessary because TransactionBlock doesn't satisfy the TransactionBlock interface exactly
      const tx = new TransactionBlock() as unknown as TransactionBlock;
      tx.moveCall({
        target: `${this.moduleAddress}::ai_verifier::is_provider_registered`,
        arguments: [tx.pure(provider)],
      });
      
      const result = await this.client.devInspectTransactionBlock({
        sender: this.getKeypair().getPublicKey().toSuiAddress(),
        transactionBlock: tx as any,
      });
      
      if (result && result.results && result.results[0]) {
        const returnValue = result.results[0].returnValues[0][0];
        return bcs.Bool.parse(Uint8Array.from(returnValue));
      }
      
      return false;
    } catch (_error) {
      this.logger.error(`Failed to check registration status: ${error.message}`);
      return false;
    }
  }

  /**
   * Revoke a credential on the blockchain
   */
  async revokeCredential(provider: AIProvider): Promise<void> {
    try {
      const keypair = this.getKeypair();
      
      // Create a transaction block and cast to the expected type
      // This is necessary because TransactionBlock doesn't satisfy the TransactionBlock interface exactly
      const tx = new TransactionBlock() as unknown as TransactionBlock;
      tx.moveCall({
        target: `${this.moduleAddress}::ai_verifier::revoke_credential`,
        arguments: [tx.pure(provider)],
      });
      
      await this.client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx as any,
      });
      
      this.logger.info(`Credential for ${provider} revoked successfully`);
    } catch (_error) {
      this.logger.error(`Failed to revoke credential: ${error.message}`);
      throw new CLIError(
        `Failed to revoke credential on blockchain: ${error.message}`,
        'CREDENTIAL_REVOCATION_FAILED'
      );
    }
  }

  /**
   * Build a transaction block for verification
   */
  private buildVerifyTx(provider: AIProvider, keyHash: string): TransactionBlock {
    // Create a transaction block and cast to the expected type
    // This is necessary because TransactionBlock doesn't satisfy the TransactionBlock interface exactly
    const tx = new TransactionBlock() as unknown as TransactionBlock;
    tx.moveCall({
      target: `${this.moduleAddress}::ai_verifier::verify_credential`,
      arguments: [
        tx.pure(provider),
        tx.pure(keyHash),
      ],
    });
    
    return tx;
  }

  /**
   * Get a keypair for transaction signing
   */
  private getKeypair(): Ed25519Keypair {
    // In a real implementation, this would use the user's actual keypair
    // For simplicity, we're creating a keypair from an environment variable
    const privateKey = process.env.SUI_PRIVATE_KEY || 
                      '0000000000000000000000000000000000000000000000000000000000000001';
    
    return Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
  }

  /**
   * Hash a credential for secure storage on-chain
   */
  private hashCredential(apiKey: string): string {
    // Create a SHA-256 hash of the API key
    return createHash('sha256').update(apiKey).digest('hex');
  }
}