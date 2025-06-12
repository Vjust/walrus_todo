import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '../../utils/adapters/sui-client-compatibility';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  TodoAIOperation,
  VerificationResult,
  AIProvider,
} from '../../services/ai/types';
import { Logger } from '../../utils/Logger';
import { CLIError } from '../error';

// Define interfaces for SUI transaction responses
interface SuiTransactionResponse {
  digest: string;
  transaction?: Transaction;
  effects?: Record<string, unknown>;
  events?: unknown[];
}

interface SuiInspectionResult {
  results?: Array<{
    returnValues?: Array<Array<unknown>>;
    executionStatus?: {
      status: string;
      error?: string;
    };
  }>;
}

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
    this?.client = client;
    this?.todoAIModuleAddress = todoAIModuleAddress;
    this?.aiVerifierModuleAddress = aiVerifierModuleAddress;
    this?.todoAIRegistry = todoAIRegistry;
    this?.verificationRegistry = verificationRegistry;
    // Use getInstance to get the logger, as the constructor is private
    this?.logger = new Logger('TodoAIAdapter');
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
          tx.pure(todoId as any),
          tx.pure(verificationId as any),
          tx.pure(operation as any),
          tx.pure(new Date().toISOString()),
        ],
      });

      const result: SuiTransactionResponse =
        await this?.client?.signAndExecuteTransaction({
          signer: keypair,
          transaction: tx,
        });

      this?.logger?.info(
        `Linked verification ${verificationId} to todo ${todoId}`
      );
      return result.digest;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : `${error}`;
      this?.logger?.error(`Failed to link verification to todo: ${errorMessage}`);
      throw new CLIError(
        `Failed to link verification to todo: ${errorMessage}`,
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
          tx.pure(todoId as any),
          tx.pure(operation as any),
        ],
      });

      const result: SuiInspectionResult =
        await this?.client?.devInspectTransactionBlock({
          sender: '0x0', // Dummy address for read-only operation
          transaction: tx,
        });

      if (result?.results?.[0]) {
        const returnValue = result?.results?.[0].returnValues?.[0]?.[0];
        // Convert to string before comparison to avoid type errors
        const returnValueStr = String(returnValue || '');
        return returnValueStr === '1' || returnValueStr === 'true';
      }

      return false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : `${error}`;
      this?.logger?.error(`Failed to check verification: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get all verification IDs for a todo
   */
  async getVerificationsForTodo(todoId: string): Promise<string[]> {
    try {
      // Create a standard Transaction
      // Create a transaction block and cast to the expected type
      // This is necessary because Transaction doesn't satisfy the Transaction interface exactly
      const tx = new Transaction() as unknown as Transaction;

      tx.moveCall({
        target: `${this.todoAIModuleAddress}::todo_ai_extension::get_verifications_for_todo`,
        arguments: [tx.object(this.todoAIRegistry), tx.pure(todoId as any)],
      });

      const result: SuiInspectionResult =
        await this?.client?.devInspectTransactionBlock({
          sender: '0x0', // Dummy address for read-only operation
          transaction: tx,
        });

      if (result?.results?.[0]) {
        // Parse vector of strings from the result
        const returnValues = result?.results?.[0].returnValues;
        if (returnValues && returnValues.length > 0) {
          // Ensure we're handling string[] properly and not comparing with number[]
          const values = returnValues[0];
          if (Array.isArray(values as any)) {
            // Convert all values to strings to avoid type comparison issues
            return values.map(value => String(value || ''));
          }
        }
      }

      return [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : `${error}`;
      this?.logger?.error(`Failed to get verifications: ${errorMessage}`);
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
          tx.pure(todoId as any),
          tx.pure(operation as any),
        ],
      });

      const result: SuiInspectionResult =
        await this?.client?.devInspectTransactionBlock({
          sender: '0x0', // Dummy address for read-only operation
          transaction: tx,
        });

      if (result?.results?.[0]) {
        const returnValue = result?.results?.[0].returnValues?.[0]?.[0];
        // Convert to string before comparison to avoid type errors
        const returnValueStr = String(returnValue || '');
        return returnValueStr === '1' || returnValueStr === 'true';
      }

      return false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : `${error}`;
      this?.logger?.error(`Failed to verify todo operation: ${errorMessage}`);
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
          tx.pure(provider as any),
          tx.pure(operation as any),
          tx.pure(inputHash as any),
          tx.pure(outputHash as any),
          tx.pure(timestamp as any),
        ],
      });

      // Generate the verification ID (needs to match the algorithm in smart contract)
      const verificationId = this.generateVerificationId(
        provider,
        operation,
        inputHash,
        outputHash
      );

      // Link the verification to the todo
      tx.moveCall({
        target: `${this.todoAIModuleAddress}::todo_ai_extension::link_verification_to_todo`,
        arguments: [
          tx.object(this.todoAIRegistry),
          tx.pure(todoId as any),
          tx.pure(verificationId as any),
          tx.pure(operation as any),
          tx.pure(timestamp as any),
        ],
      });

      // Execute the transaction
      const txResult: SuiTransactionResponse =
        await this?.client?.signAndExecuteTransaction({
          signer: keypair,
          transaction: tx,
        });

      this?.logger?.info(`Created and linked verification to todo ${todoId}`, {
        transactionDigest: txResult.digest,
        effects: txResult.effects?.status,
      });

      return {
        verified: true,
        verificationId,
        timestamp,
        provider: provider as unknown as AIProvider,
        operation,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : `${error}`;
      this?.logger?.error(
        `Failed to create and link verification: ${errorMessage}`
      );
      throw new CLIError(
        `Failed to create and link verification: ${errorMessage}`,
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
