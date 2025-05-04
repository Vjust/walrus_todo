import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient } from '@mysten/sui/client';
import { type Transaction } from '@mysten/sui/transactions';
import { execSync } from 'child_process';
import { 
  type Signer,
  type SignatureScheme,
  type PublicKey,
  type SignatureWithBytes,
  messageWithIntent,
  IntentScope,
  toSerializedSignature
} from '@mysten/sui/cryptography';

export class KeystoreSigner implements Signer {
  private keypair: Ed25519Keypair;

  constructor(private suiClient: SuiClient) {
    // Get active address
    const activeAddressOutput = execSync('sui client active-address').toString().trim();
    const activeAddress = activeAddressOutput.trim();
    if (!activeAddress) {
      throw new Error('No active Sui address found');
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
      throw new Error(`Failed to read keystore file: ${errorMessage}`);
    }
  
    // Find the key that matches the active address
    let secretKeyBuffer: Buffer | undefined;
    for (const keyBase64 of keystore) {
      const keyBuffer = Buffer.from(keyBase64, 'base64');
      const skBuffer = keyBuffer.slice(1); // Remove flag byte, should be 32 bytes
      try {
        const keypair = Ed25519Keypair.fromSecretKey(skBuffer);
        const address = keypair.getPublicKey().toSuiAddress();
        if (address === activeAddress) {
          secretKeyBuffer = skBuffer;
          break;
        }
      } catch (e) {
        // Skip invalid keys
        continue;
      }
    }
  
    if (!secretKeyBuffer) {
      throw new Error(`No key found in keystore for address ${activeAddress}`);
    }
  
    // Create keypair from secret key
    this.keypair = Ed25519Keypair.fromSecretKey(secretKeyBuffer);
  }

  async sign(bytes: Uint8Array): Promise<Uint8Array> {
    const signature = await this.keypair.signWithIntent(bytes, 'TransactionData');
    return Buffer.from(signature.signature, 'base64');
  }

  async signMessage(bytes: Uint8Array): Promise<SignatureWithBytes> {
    const signature = await this.keypair.signWithIntent(bytes, 'PersonalMessage');
    return {
      signature: Buffer.from(signature.signature, 'base64').toString('base64'),
      bytes: Buffer.from(bytes).toString('base64')
    };
  }

  async signWithIntent(bytes: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes> {
    const signature = await this.keypair.signWithIntent(bytes, intent);
    return {
      signature: Buffer.from(signature.signature, 'base64').toString('base64'),
      bytes: Buffer.from(bytes).toString('base64')
    };
  }

  signPersonalMessage(bytes: Uint8Array): Promise<SignatureWithBytes> {
    return this.signWithIntent(bytes, 'PersonalMessage');
  }

  getKeyScheme(): SignatureScheme {
    return this.keypair.getKeyScheme();
  }

  getPublicKey(): PublicKey {
    return this.keypair.getPublicKey();
  }

  toSuiAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }

  signTransaction(bytes: Uint8Array): Promise<SignatureWithBytes> {
    return this.signWithIntent(bytes, 'TransactionData');
  }
}
