import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui.js/keypairs/secp256k1';
import { 
  type Signer, 
  type PublicKey, 
  type SignatureScheme, 
  type SerializedSignature,
  IntentScope, 
  messageWithIntent 
} from '@mysten/sui.js/cryptography';

// Define compatible interface for SignatureWithBytes
interface SignatureWithBytes {
  signature: string;
  bytes: string;
}
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { toB64 } from '@mysten/sui.js/utils';
import { SuiClient, type SuiClientOptions } from '@mysten/sui.js/client';
import { execSync } from 'child_process';

export type KeyType = SignatureScheme;

export class KeystoreError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'KeystoreError';
  }
}

export class KeystoreSigner implements Signer {
  static async fromPath(_clientConfig: string): Promise<KeystoreSigner> {
    const config: SuiClientOptions = { url: 'https://testnet.suifrens.sui.io' };
    const client = new SuiClient(config);
    return new KeystoreSigner(client);
  }
  private keypair!: Ed25519Keypair | Secp256k1Keypair;
  private keyScheme: SignatureScheme = 'ED25519';

  constructor(private suiClient: SuiClient) {
    // Get active address
    const activeAddressOutput = execSync('sui client active-address').toString().trim();
    const activeAddress = activeAddressOutput.trim();
    if (!activeAddress) {
      throw new KeystoreError('No active Sui address found', 'NO_ACTIVE_ADDRESS');
    }

    // Read keystore file
    const homeDir = os.homedir();
    const keystorePath = path.join(homeDir, '.sui', 'sui_config', 'sui.keystore');
    let keystore;
    try {
      const keystoreData = fs.readFileSync(keystorePath, 'utf-8');
      keystore = JSON.parse(keystoreData); // Array of base64 strings
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new KeystoreError(`Failed to read keystore file: ${errorMessage}`, 'KEYSTORE_READ_ERROR');
    }

    // Find the key that matches the active address
    for (const keyBase64 of keystore) {
      const keyBuffer = Buffer.from(keyBase64, 'base64');
      try {
        // Try Ed25519 first
        try {
          const tmpKeypair = Ed25519Keypair.fromSecretKey(keyBuffer.subarray(1));
          const tmpAddress = tmpKeypair.getPublicKey().toSuiAddress();
          if (tmpAddress === activeAddress) {
            this.keypair = tmpKeypair;
            this.keyScheme = 'ED25519';
            break;
          }
        } catch {}

        // Try Secp256k1 if Ed25519 fails
        try {
          const tmpKeypair = Secp256k1Keypair.fromSecretKey(keyBuffer.subarray(1));
          const tmpAddress = tmpKeypair.getPublicKey().toSuiAddress();
          if (tmpAddress === activeAddress) {
            this.keypair = tmpKeypair;
            this.keyScheme = 'Secp256k1';
            break;
          }
        } catch {}
      } catch (e) {
        // Skip invalid keys
        continue;
      }
    }

    if (!this.keypair) {
      throw new KeystoreError(`No key found in keystore for address ${activeAddress}`, 'KEY_NOT_FOUND');
    }
  }

  async getAddress(): Promise<string> {
    return Promise.resolve(this.keypair.getPublicKey().toSuiAddress());
  }

  // Implement required Signer interface method
  async sign(messageBytes: Uint8Array): Promise<Uint8Array> {
    return await this.keypair.signData(messageBytes);
  }
  
  /**
   * Signs data with a specific intent
   * @param messageBytes The message to sign
   * @param intent The intent scope for the signature
   * @returns A Promise resolving to a SignatureWithBytes object
   */
  async signWithIntent(messageBytes: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes> {
    const intentMessage = messageWithIntent(intent, messageBytes);
    const signature = await this.keypair.signData(intentMessage);
    return {
      signature: toB64(signature),
      bytes: toB64(messageBytes)
    };
  }
  
  /**
   * Signs data and returns a signature
   * @param data The data to sign
   * @returns The signature for the given data
   * Note: The Signer interface requires this to be synchronous, but our implementation
   * is asynchronous. We're using a workaround for compatibility.
   */
  // @ts-ignore - This needs to be async despite the Signer interface requiring sync
  async signData(data: Uint8Array): Promise<Uint8Array> {
    return await this.keypair.signData(data);
  }
  
  /**
   * Wrapper version that returns bytes in the expected format for certain implementations
   * @internal Used by adapter implementations
   */
  async signDataWithBytes(data: Uint8Array): Promise<SignatureWithBytes> {
    const signature = await this.keypair.signData(data);
    return {
      signature: toB64(signature),
      bytes: toB64(data)
    };
  }

  /**
   * Signs a transaction block
   * @param bytes The transaction bytes to sign
   * @returns A Promise resolving to a SignatureWithBytes object
   */
  async signTransactionBlock(bytes: Uint8Array): Promise<SignatureWithBytes> {
    return this.signWithIntent(bytes, IntentScope.TransactionData);
  }

  /**
   * Signs a transaction
   * @param transaction The transaction to sign
   * @returns A Promise resolving to a SignatureWithBytes object
   */
  async signTransaction(transaction: TransactionBlock): Promise<SignatureWithBytes> {
    const bytes = await transaction.build({ client: this.suiClient });
    return this.signTransactionBlock(bytes);
  }

  /**
   * Signs a personal message
   * @param bytes The message bytes to sign
   * @returns A Promise resolving to a SignatureWithBytes object
   */
  async signPersonalMessage(bytes: Uint8Array): Promise<SignatureWithBytes> {
    return this.signWithIntent(bytes, IntentScope.PersonalMessage);
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

  connect(client: SuiClient): Signer & { client: SuiClient } {
    return Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      this,
      { client }
    ) as Signer & { client: SuiClient };
  }

  async signAndExecuteTransactionBlock(transactionBlock: TransactionBlock): Promise<{ digest: string }> {
    try {
      if (!transactionBlock) {
        throw new Error('Invalid transaction block');
      }

      const { bytes, signature } = await this.signedTransactionBlock(transactionBlock);

      const response = await this.suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        requestType: 'WaitForLocalExecution',
        options: { showEffects: true }
      });

      if (!response || !response.digest) {
        throw new Error('Transaction execution failed');
      }

      return { digest: response.digest };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Transaction execution failed: ${errorMessage}`);
    }
  }

  /**
   * Signs a transaction block and returns the bytes and signature array
   * @param transactionBlock The transaction block to sign
   * @returns The bytes and signature array
   */
  async signedTransactionBlock(
    transactionBlock: TransactionBlock
  ): Promise<{ bytes: Uint8Array; signature: string[] }> {
    const bytes = await transactionBlock.build({ client: this.suiClient });
    const signatureResult = await this.signTransactionBlock(bytes);
    
    // Convert the signature to base64 string for serialization
    const signatureBase64 = toB64(signatureResult.signature);
    
    return {
      bytes,
      signature: [signatureBase64]
    };
  }
}