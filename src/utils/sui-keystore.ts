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
    const activeAddress = execSync('sui client active-address').toString().trim();
    const privateKey = execSync(`sui keytool convert ${activeAddress}`).toString().trim();
    this.keypair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
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