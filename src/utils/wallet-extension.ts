import { SuiClient } from '@mysten/sui/client';
import { type Transaction } from '@mysten/sui/transactions';
import { 
  type Signer,
  type SignatureScheme,
  type PublicKey,
  type SignatureWithBytes,
  messageWithIntent,
  IntentScope,
  toSerializedSignature
} from '@mysten/sui/cryptography';
import { type WalletAdapter } from '@mysten/wallet-adapter-base';

export class WalletExtensionSigner implements Signer {
  private cachedAddress: string | null = null;
  
  constructor(private wallet: WalletAdapter) {
    if (!wallet.connected) {
      throw new Error('Wallet not connected');
    }
  }

  async sign(bytes: Uint8Array): Promise<Uint8Array> {
    const accounts = await this.wallet.getAccounts();
    if (!this.wallet.signMessage || !accounts?.[0]) {
      throw new Error('Wallet does not support signMessage');
    }
    const { signature } = await this.wallet.signMessage({
      message: bytes,
      account: accounts[0]
    });
    return Buffer.from(signature, 'base64');
  }

  async signMessage(bytes: Uint8Array): Promise<SignatureWithBytes> {
    const signatureBuffer = await this.sign(bytes);
    return {
      signature: signatureBuffer.toString(),
      bytes: bytes.toString()
    };
  }

  async signWithIntent(bytes: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes> {
    const message = messageWithIntent(intent, bytes);
    const signatureBuffer = await this.sign(message);
    return {
      signature: signatureBuffer.toString(),
      bytes: message.toString()
    };
  }

  signPersonalMessage(bytes: Uint8Array): Promise<SignatureWithBytes> {
    return this.signWithIntent(bytes, 'PersonalMessage');
  }

  getKeyScheme(): SignatureScheme {
    return 'ED25519';
  }

  getPublicKey(): PublicKey {
    throw new Error('Public key not available from wallet adapter');
  }

  toSuiAddress(): string {
    if (!this.cachedAddress) {
      this.wallet.getAccounts().then(accounts => {
        this.cachedAddress = accounts?.[0]?.address ?? '';
      });
      return '';
    }
    return this.cachedAddress;
  }

  signTransaction(bytes: Uint8Array): Promise<SignatureWithBytes> {
    return this.signWithIntent(bytes, 'TransactionData');
  }
}