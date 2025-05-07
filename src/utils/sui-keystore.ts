import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui.js/keypairs/secp256k1';
import { type Signer, type PublicKey, type SignatureScheme, type SerializedSignature } from '@mysten/sui.js/cryptography';
import { IntentScope, messageWithIntent } from '@mysten/sui.js/cryptography';
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

  // @ts-ignore - Interface compatibility issue
  async sign(messageBytes: Uint8Array, intent: IntentScope): Promise<SerializedSignature> {
    const intentMessage = messageWithIntent(intent, messageBytes);
    const signature = await this.keypair.signData(intentMessage);
    const serializedSignature = toB64(signature);
    return serializedSignature;
  }

  // @ts-ignore - Interface compatibility issue
  async signTransactionBlock(bytes: Uint8Array): Promise<{signature: SerializedSignature, bytes: Uint8Array}> {
    const signature = await this.sign(bytes, IntentScope.TransactionData);
    return {
      signature,
      bytes
    };
  }

  // @ts-ignore - Interface compatibility issue
  async signPersonalMessage(bytes: Uint8Array): Promise<{signature: SerializedSignature, bytes: Uint8Array}> {
    const signature = await this.sign(bytes, IntentScope.PersonalMessage);
    return {
      signature,
      bytes
    };
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

  async signedTransactionBlock(
    transactionBlock: TransactionBlock
  ): Promise<{ bytes: Uint8Array; signature: string[] }> {
    const bytes = await transactionBlock.build({ client: this.suiClient });
    const signatureResult = await this.signTransactionBlock(bytes);
    return {
      bytes,
      signature: [signatureResult.signature]
    };
  }
}