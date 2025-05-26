import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import {
  type Signer,
  type PublicKey,
  type SignatureScheme,
  type IntentScope,
  messageWithIntent,
} from '@mysten/sui/cryptography';
import { toB64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import {
  createCompatibleSuiClient,
  CompatibleSuiClientOptions,
} from './adapters/sui-client-compatibility';

// Import the real types if available, otherwise use fallbacks
import {
  SignerAdapter,
  SuiSDKVersion,
  SignatureWithBytes,
} from '../types/adapters/SignerAdapter';
import { TransactionType } from '../types/transaction';
// TransactionBlockAdapter import removed - not used in current implementation

export type KeyType = SignatureScheme;

export class KeystoreError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'KeystoreError';
  }
}

export class KeystoreSigner implements SignerAdapter {
  static async fromPath(_clientConfig: string): Promise<KeystoreSigner> {
    const config: CompatibleSuiClientOptions = { url: 'https://testnet.suifrens.sui.io' };
    const client = createCompatibleSuiClient(config);
    return new KeystoreSigner(client);
  }
  private keypair!: Ed25519Keypair | Secp256k1Keypair;
  private keyScheme: SignatureScheme = 'ED25519';

  private _disposed: boolean = false;
  public getClient(): unknown {
    return this.suiClient;
  }
  public getUnderlyingImplementation(): Signer {
    return this.keypair;
  }
  public dispose(): Promise<void> {
    this._disposed = true;
    return Promise.resolve();
  }
  public isDisposed(): boolean {
    return this._disposed;
  }
  public getSDKVersion(): SuiSDKVersion {
    return SuiSDKVersion.UNKNOWN;
  }

  constructor(private suiClient: unknown) {
    // Get active address
    const activeAddressOutput = execSync('sui client active-address')
      .toString()
      .trim();
    const activeAddress = activeAddressOutput.trim();
    if (!activeAddress) {
      throw new KeystoreError(
        'No active Sui address found',
        'NO_ACTIVE_ADDRESS'
      );
    }

    // Read keystore file
    const homeDir = os.homedir();
    const keystorePath = path.join(
      homeDir,
      '.sui',
      'sui_config',
      'sui.keystore'
    );
    let keystore;
    try {
      const keystoreData = fs.readFileSync(keystorePath, 'utf-8');
      keystore = JSON.parse(keystoreData); // Array of base64 strings
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new KeystoreError(
        `Failed to read keystore file: ${errorMessage}`,
        'KEYSTORE_READ_ERROR'
      );
    }

    // Find the key that matches the active address
    for (const keyBase64 of keystore) {
      const keyBuffer = Buffer.from(keyBase64, 'base64');
      try {
        // Try Ed25519 first
        try {
          const tmpKeypair = Ed25519Keypair.fromSecretKey(
            keyBuffer.subarray(1)
          );
          const tmpAddress = tmpKeypair.getPublicKey().toSuiAddress();
          if (tmpAddress === activeAddress) {
            this.keypair = tmpKeypair;
            this.keyScheme = 'ED25519';
            break;
          }
        } catch (error: unknown) {
          // Ed25519 key doesn't match, continue to try Secp256k1
        }

        // Try Secp256k1 if Ed25519 fails
        try {
          const tmpKeypair = Secp256k1Keypair.fromSecretKey(
            keyBuffer.subarray(1)
          );
          const tmpAddress = tmpKeypair.getPublicKey().toSuiAddress();
          if (tmpAddress === activeAddress) {
            this.keypair = tmpKeypair;
            this.keyScheme = 'Secp256k1';
            break;
          }
        } catch (error: unknown) {
          // Secp256k1 key doesn't match, continue to next key
        }
      } catch (e) {
        // Skip invalid keys
        continue;
      }
    }

    if (!this.keypair) {
      throw new KeystoreError(
        `No key found in keystore for address ${activeAddress}`,
        'KEY_NOT_FOUND'
      );
    }
  }

  async getAddress(): Promise<string> {
    return Promise.resolve(this.keypair.getPublicKey().toSuiAddress());
  }

  // Implement required Signer interface method
  async sign(messageBytes: Uint8Array): Promise<Uint8Array> {
    return await this.signData(messageBytes);
  }

  /**
   * Signs data with a specific intent
   * @param messageBytes The message to sign
   * @param intent The intent scope for the signature
   * @returns A Promise resolving to a SignatureWithBytes object
   */
  async signWithIntent(
    messageBytes: Uint8Array,
    intent: IntentScope
  ): Promise<SignatureWithBytes> {
    const intentMessage = messageWithIntent(intent, messageBytes);
    const signature = await this.signData(intentMessage);

    // Return in the format expected by the SignatureWithBytes interface
    return {
      signature: toB64(signature),
      bytes: toB64(messageBytes),
    };
  }

  /**
   * Signs data and returns a signature
   * @param data The data to sign
   * @returns A Promise resolving to the signature for the given data
   */
  async signData(data: Uint8Array): Promise<Uint8Array> {
    if (
      'signData' in this.keypair &&
      typeof this.keypair.signData === 'function'
    ) {
      return await this.keypair.signData(data);
    }
    // Fallback for keypairs that don't have signData
    const signature = await this.keypair.sign(data);
    return signature;
  }

  /**
   * Signs a transaction block
   * @param bytes The transaction bytes to sign
   * @returns A Promise resolving to a SignatureWithBytes object
   */
  async signTransactionBlock(bytes: Uint8Array): Promise<SignatureWithBytes> {
    return this.signWithIntent(bytes, 'TransactionData' as IntentScope);
  }

  /**
   * Signs a transaction
   * @param transaction The transaction to sign
   * @returns A Promise resolving to a SignatureWithBytes object
   */
  async signTransaction(
    transaction: TransactionType
  ): Promise<SignatureWithBytes> {
    // Serialize the transaction and sign the bytes
    let bytes: Uint8Array;
    if (transaction instanceof TransactionBlock) {
      const serialized = await transaction.serialize();
      bytes = new Uint8Array(Buffer.from(serialized, 'base64'));
    } else if (
      'serialize' in transaction &&
      typeof transaction.serialize === 'function'
    ) {
      // TransactionBlockAdapter type
      const serialized = await transaction.serialize();
      bytes = new Uint8Array(Buffer.from(serialized, 'base64'));
    } else {
      throw new KeystoreError(
        'Unknown transaction type',
        'INVALID_TRANSACTION_TYPE'
      );
    }

    return this.signTransactionBlock(bytes);
  }

  /**
   * Signs a personal message
   * @param bytes The message bytes to sign
   * @returns A Promise resolving to a SignatureWithBytes object
   */
  async signPersonalMessage(bytes: Uint8Array): Promise<SignatureWithBytes> {
    return this.signWithIntent(bytes, 'PersonalMessage' as IntentScope);
  }

  getKeyScheme(): KeyType {
    return this.keyScheme;
  }

  getPublicKey(): PublicKey {
    return this.keypair.getPublicKey();
  }

  toSuiAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }

  connect(client: unknown): SignerAdapter {
    this.suiClient = client;
    return this;
  }

  async signAndExecuteTransaction(
    transactionBlock: TransactionBlock | Transaction,
    options?: {
      requestType?: 'WaitForLocalExecution';
      showEffects?: boolean;
      showObjectChanges?: boolean;
      showEvents?: boolean;
      showBalanceChanges?: boolean;
    }
  ): Promise<unknown> {
    try {
      if (!transactionBlock) {
        throw new Error('Invalid transaction block');
      }

      const { bytes, signature } =
        await this.signedTransactionBlock(transactionBlock);

      const response = await (this.suiClient as Record<string, unknown>).executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        requestType: options?.requestType || 'WaitForLocalExecution',
        options: {
          showEffects: options?.showEffects ?? true,
          showObjectChanges: options?.showObjectChanges,
          showEvents: options?.showEvents,
          showBalanceChanges: options?.showBalanceChanges,
        },
      });

      if (!response) {
        throw new Error('Transaction execution failed');
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Transaction execution failed: ${errorMessage}`);
    }
  }

  /**
   * Signs a transaction block and returns the bytes and signature array
   * @param transactionBlock The transaction block to sign
   * @returns The bytes and signature array
   */
  async signedTransactionBlock(
    transactionBlock: TransactionBlock | Transaction
  ): Promise<{ bytes: Uint8Array; signature: string[] }> {
    let bytes: Uint8Array;
    if (transactionBlock instanceof TransactionBlock) {
      bytes = await transactionBlock.build({ client: this.suiClient });
    } else {
      // Handle modern Transaction type
      bytes = await (transactionBlock as Transaction).build({ client: this.suiClient });
    }
    const signatureResult = await this.signTransactionBlock(bytes);

    // Convert the signature to base64 string for serialization
    // Handle case when signature is already a string or is a Uint8Array
    const signatureBase64 =
      typeof signatureResult.signature === 'string'
        ? signatureResult.signature
        : toB64(
            Buffer.from(signatureResult.signature as unknown as string, 'utf-8')
          );

    return {
      bytes,
      signature: [signatureBase64],
    };
  }

  /**
   * Returns the signer that can be used for compatibility with older SDK versions
   */
  getSigner(): Signer {
    return this.keypair;
  }
}
