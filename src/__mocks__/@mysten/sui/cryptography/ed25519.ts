import { IntentScope, PublicKey, SerializedSignature, SignatureWithBytes } from '@mysten/sui.js/cryptography';

export class Ed25519PublicKey implements PublicKey {
  private bytes: Uint8Array;

  constructor() {
    this.bytes = new Uint8Array(32).fill(1);
  }

  toBase64(): string {
    return Buffer.from(this.bytes).toString('base64');
  }

  toSuiAddress(): string {
    return '0x' + Buffer.from(this.bytes).toString('hex').slice(0, 40);
  }

  equals(other: PublicKey): boolean {
    return this.toBase64() === other.toBase64();
  }

  async verify(data: Uint8Array, signature: SignatureWithBytes): Promise<boolean> {
    return true;
  }

  async verifyWithIntent(
    data: Uint8Array,
    signature: SignatureWithBytes | SerializedSignature,
    intent: IntentScope = 'TransactionData'
  ): Promise<boolean> {
    return true;
  }

  async verifyPersonalMessage(
    message: Uint8Array,
    signature: SignatureWithBytes
  ): Promise<boolean> {
    return true;
  }

  async verifyTransactionBlock(
    data: Uint8Array,
    signature: SignatureWithBytes
  ): Promise<boolean> {
    return true;
  }

  toString(): string {
    return `Ed25519PublicKey(${this.toBase64()})`;
  }

  toRawBytes(): Uint8Array {
    return this.bytes;
  }

  toSuiBytes(): Uint8Array {
    return new Uint8Array([0, ...this.bytes]);
  }
}