import { PublicKey, SerializedSignature, SignatureWithBytes, IntentScope, KeyPair } from '@mysten/sui.js/cryptography';

export class MockPublicKey implements PublicKey {
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

  toString(): string {
    return `MockPublicKey(${this.toBase64()})`;
  }

  toRawBytes(): Uint8Array {
    return this.bytes;
  }

  toSuiBytes(): Uint8Array {
    return new Uint8Array([0, ...this.bytes]);
  }
}

export class MockKeypair implements KeyPair {
  #publicKey: MockPublicKey;
  #secretKey: Uint8Array;

  constructor() {
    this.#publicKey = new MockPublicKey();
    this.#secretKey = new Uint8Array(64).fill(1);
  }

  getPublicKey(): MockPublicKey {
    return this.#publicKey;
  }

  async sign(data: Uint8Array): Promise<SignatureWithBytes> {
    const signature = new Uint8Array(64).fill(2);
    return { signature, signatureScheme: 'ED25519', publicKey: this.getPublicKey() };
  }

  async signWithIntent(
    data: Uint8Array,
    intent: IntentScope = 'TransactionData'
  ): Promise<SignatureWithBytes> {
    return this.sign(data);
  }

  export(): { publicKey: Uint8Array; secretKey: Uint8Array } {
    return {
      publicKey: this.#publicKey.toRawBytes(),
      secretKey: this.#secretKey
    };
  }
}

export const mockPublicKey = new MockPublicKey();
export const mockKeypair = new MockKeypair();