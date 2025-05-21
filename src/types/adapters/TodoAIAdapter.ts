import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { TodoAIOperation, VerificationResult, AIProvider } from '../../services/ai/types';
import { Logger } from '../../utils/Logger';
import { CLIError } from '../error';
import { createTransactionBlockAdapter } from '../../utils/adapters/transaction-adapter';
import { asUint8ArrayOrTransactionBlock, asStringUint8ArrayOrTransactionBlock } from '../transaction';

/**
 * Adapter for interacting with the Todo AI extension smart contract
 */
export class TodoAIAdapter {
  private client: SuiClient;
  private todoAIModuleAddress: string;
  private aiVerifierModuleAddress: string;
  private todoAIRegistry: string;
  private verificationRegistry: string;
  private logger: Logger;

  constructor(
    client: SuiClient,
    todoAIModuleAddress: string,
    aiVerifierModuleAddress: string,
    todoAIRegistry: string,
    verificationRegistry: string
  ) {
    this.client = client;
    this.todoAIModuleAddress = todoAIModuleAddress;
    this.aiVerifierModuleAddress = aiVerifierModuleAddress;
    this.todoAIRegistry = todoAIRegistry;
    this.verificationRegistry = verificationRegistry;
    // Use getInstance to get the logger, as the constructor is private
    this.logger = new Logger('TodoAIAdapter');
  }

  /**
   * Link a verification to a todo
   */
  async linkVerificationToTodo(
    todoId: string,
    verificationId: string,
    operation: TodoAIOperation,
    keypair: Ed25519Keypair
  ): Promise<string> {
    try {
      // Create a standard Transaction
      // Create a transaction block and cast to the expected type
      // This is necessary because Transaction doesn't satisfy the Transaction interface exactly
      const tx = new Transaction() as unknown as Transaction;

      tx.moveCall({
        target: `${this.todoAIModuleAddress}::todo_ai_extension::link_verification_to_todo`,
        arguments: [
          tx.object(this.todoAIRegistry),
          tx.pure(todoId),
          tx.pure(verificationId),
          tx.pure(operation),
          tx.pure(new Date().toISOString()),
        ],
      });

      // Cast to Uint8Array | Transaction to match the expected type
      const result = await this.client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx as any,
      });

      this.logger.info(`Linked verification ${verificationId} to todo ${todoId}`);
      return result.digest;
    } catch (error: any) {
      this.logger.error(`Failed to link verification to todo: ${error.message}`);
      throw new CLIError(
        `Failed to link verification to todo: ${error.message}`,
        'VERIFICATION_LINK_FAILED'
      );
    }
  }

  /**
   * Check if a todo has a verification for an operation
   */
  async hasVerificationForOperation(
    todoId: string,
    operation: TodoAIOperation
  ): Promise<boolean> {
    try {
      // Create a standard Transaction
      // Create a transaction block and cast to the expected type
      // This is necessary because Transaction doesn't satisfy the Transaction interface exactly
      const tx = new Transaction() as unknown as Transaction;

      tx.moveCall({
        target: `${this.todoAIModuleAddress}::todo_ai_extension::has_verification_for_operation`,
        arguments: [
          tx.object(this.todoAIRegistry),
          tx.pure(todoId),
          tx.pure(operation),
        ],
      });

      // Cast to string | Uint8Array | Transaction to match the expected type
      const result = await this.client.devInspectTransactionBlock({
        sender: '0x0', // Dummy address for read-only operation
        transaction: tx as any,
      });

      if (result?.results?.[0]) {
        const returnValue = result.results[0].returnValues?.[0]?.[0];
        // Convert to string before comparison to avoid type errors
        const returnValueStr = String(returnValue || '');
        return returnValueStr === '1' || returnValueStr === 'true';
      }

      return false;
    } catch (error: any) {
      this.logger.error(`Failed to check verification: ${error.message}`);
      return false;
    }
  }

  /**
   * Get all verification IDs for a todo
   */
  async getVerificationsForTodo(
    todoId: string
  ): Promise<string[]> {
    try {
      // Create a standard Transaction
      // Create a transaction block and cast to the expected type
      // This is necessary because Transaction doesn't satisfy the Transaction interface exactly
      const tx = new Transaction() as unknown as Transaction;

      tx.moveCall({
        target: `${this.todoAIModuleAddress}::todo_ai_extension::get_verifications_for_todo`,
        arguments: [
          tx.object(this.todoAIRegistry),
          tx.pure(todoId),
        ],
      });

      // Cast to string | Uint8Array | Transaction to match the expected type
      const result = await this.client.devInspectTransactionBlock({
        sender: '0x0', // Dummy address for read-only operation
        transaction: tx as any,
      });

      if (result?.results?.[0]) {
        // Parse vector of strings from the result
        const returnValues = result.results[0].returnValues;
        if (returnValues && returnValues.length > 0) {
          // Ensure we're handling string[] properly and not comparing with number[]
          const values = returnValues[0];
          if (Array.isArray(values)) {
            // Convert all values to strings to avoid type comparison issues
            return values.map(value => String(value || ''));
          }
        }
      }

      return [];
    } catch (error: any) {
      this.logger.error(`Failed to get verifications: ${error.message}`);
      return [];
    }
  }

  /**
   * Verify a todo operation
   */
  async verifyTodoOperation(
    todoId: string,
    operation: TodoAIOperation
  ): Promise<boolean> {
    try {
      // Create a standard Transaction
      // Create a transaction block and cast to the expected type
      // This is necessary because Transaction doesn't satisfy the Transaction interface exactly
      const tx = new Transaction() as unknown as Transaction;

      tx.moveCall({
        target: `${this.todoAIModuleAddress}::todo_ai_extension::verify_todo_operation`,
        arguments: [
          tx.object(this.todoAIRegistry),
          tx.object(this.verificationRegistry),
          tx.pure(todoId),
          tx.pure(operation),
        ],
      });

      // Cast to string | Uint8Array | Transaction to match the expected type
      const result = await this.client.devInspectTransactionBlock({
        sender: '0x0', // Dummy address for read-only operation
        transaction: tx as any,
      });

      if (result?.results?.[0]) {
        const returnValue = result.results[0].returnValues?.[0]?.[0];
        // Convert to string before comparison to avoid type errors
        const returnValueStr = String(returnValue || '');
        return returnValueStr === '1' || returnValueStr === 'true';
      }

      return false;
    } catch (error: any) {
      this.logger.error(`Failed to verify todo operation: ${error.message}`);
      return false;
    }
  }

  /**
   * Create verification and link to a todo in one transaction
   */
  async createAndLinkVerification(
    todoId: string,
    provider: string | AIProvider,
    operation: TodoAIOperation,
    inputHash: string,
    outputHash: string,
    keypair: Ed25519Keypair
  ): Promise<VerificationResult> {
    try {
      const timestamp = new Date().toISOString();
      // Create a standard Transaction
      // Create a transaction block and cast to the expected type
      // This is necessary because Transaction doesn't satisfy the Transaction interface exactly
      const tx = new Transaction() as unknown as Transaction;

      // Call verify_operation on ai_operation_verifier
      tx.moveCall({
        target: `${this.aiVerifierModuleAddress}::ai_operation_verifier::verify_operation`,
        arguments: [
          tx.object(this.verificationRegistry),
          tx.pure(provider),
          tx.pure(operation),
          tx.pure(inputHash),
          tx.pure(outputHash),
          tx.pure(timestamp),
        ],
      });

      // Generate the verification ID (needs to match the algorithm in smart contract)
      const verificationId = this.generateVerificationId(provider, operation, inputHash, outputHash);

      // Link the verification to the todo
      tx.moveCall({
        target: `${this.todoAIModuleAddress}::todo_ai_extension::link_verification_to_todo`,
        arguments: [
          tx.object(this.todoAIRegistry),
          tx.pure(todoId),
          tx.pure(verificationId),
          tx.pure(operation),
          tx.pure(timestamp),
        ],
      });

      // Execute the transaction
      // Cast to Uint8Array | Transaction to match the expected type
      const result = await this.client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx as any,
      });

      this.logger.info(`Created and linked verification to todo ${todoId}`);

      return {
        verified: true,
        verificationId,
        timestamp,
        provider: provider as unknown as AIProvider,
        operation
      };
    } catch (error: any) {
      this.logger.error(`Failed to create and link verification: ${error.message}`);
      throw new CLIError(
        `Failed to create and link verification: ${error.message}`,
        'VERIFICATION_CREATION_FAILED'
      );
    }
  }

  /**
   * Helper method to generate verification ID (must match contract logic)
   */
  private generateVerificationId(
    provider: string,
    operation: string,
    inputHash: string,
    outputHash: string
  ): string {
    // Simple concatenation - should match the logic in the smart contract
    return provider + operation + inputHash + outputHash;
  }
}