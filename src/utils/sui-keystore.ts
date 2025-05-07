import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui.js/keypairs/secp256k1';
import { Signer, PublicKey, SignatureScheme, SignatureWithBytes, IntentScope, messageWithIntent } from '@mysten/sui.js/cryptography';
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

export class KeystoreSigner extends Signer {
  static async fromPath(_clientConfig: string): Promise<KeystoreSigner> {
    const config: SuiClientOptions = { url: 'https://testnet.suifrens.sui.io' };
    const client = new SuiClient(config);
    return new KeystoreSigner(client);
  }
  private keypair!: Ed25519Keypair | Secp256k1Keypair;
  private keyScheme: SignatureScheme = 'ED25519';

  constructor(private suiClient: SuiClient) {
    super();
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

  async sign(data: Uint8Array): Promise<Uint8Array> {
    return this.keypair.sign(data);
  }

  async signData(data: Uint8Array): Promise<Uint8Array> {
    return this.keypair.sign(data);
  }

  async signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes> {
    if (!message || message.length === 0) {
      throw new Error('Invalid message bytes');
    }
    const signature = await this.sign(message);
    return {
      signature: toB64(signature),
      bytes: toB64(message)
    };
  }

  async signMessage(message: Uint8Array): Promise<SignatureWithBytes> {
    return this.signPersonalMessage(message);
  }

  async signTransactionBlock(transaction: TransactionBlock): Promise<SignatureWithBytes> {
    if (!transaction) {
      throw new Error('Invalid transaction');
    }
    const bytes = await transaction.build({ client: this.suiClient });
    const signature = await this.sign(bytes);
    return {
      signature: toB64(signature),
      bytes: toB64(bytes)
    };
  }

  async signTransaction(bytes: Uint8Array): Promise<SignatureWithBytes> {
    const signature = await this.sign(bytes);
    return {
      signature: toB64(signature),
      bytes: toB64(bytes)
    };
  }

  getKeyScheme(): KeyType {
    return this.keyScheme;
  }

  getPublicKey(): PublicKey {
    const scheme = this.keyScheme === 'ED25519' ? 'ED25519' : 'Secp256k1';
    const publicKey = this.keypair.getPublicKey();
    return {
      toBase64: () => publicKey.toBase64(),
      toSuiAddress: () => publicKey.toSuiAddress(),
      equals: (other: PublicKey) => other.toBase64() === publicKey.toBase64(),
      verify: async (data: Uint8Array, signature: Uint8Array) => {
        return publicKey.verify(data, signature);
      },
      verifyWithIntent: async (data: Uint8Array, signature: Uint8Array, scope: IntentScope) => {
        const intentMessage = messageWithIntent(scope, data);
        return publicKey.verify(intentMessage, signature);
      },
      flag: () => this.keyScheme === 'ED25519' ? 0x00 : 0x01,
      scheme,
      toBytes: () => new Uint8Array(Buffer.from(publicKey.toBase64(), 'base64'))
    };
  }

  async signWithIntent(bytes: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes> {
    const signature = await this.sign(bytes);
    return {
      signature: toB64(signature),
      bytes: toB64(bytes)
    };
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

      const bytes = await transactionBlock.build({ client: this.suiClient });
      const signedTx = await this.signTransaction(bytes);

      const response = await this.suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature: signedTx.signature,
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
}