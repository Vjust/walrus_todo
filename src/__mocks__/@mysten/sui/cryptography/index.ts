import type { PublicKey, IntentScope } from '@mysten/sui.js/cryptography';

export class MockPublicKey implements PublicKey {
  private bytes: Uint8Array;
  flag(): number {
    return 0;
  }

  constructor() {
    this.bytes = new Uint8Array(32).fill(1);
  }

  toSuiPublicKey(): string {
    return this.toBase64();
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

  async verify(data: Uint8Array, signature: string | Uint8Array): Promise<boolean> {
    return true;
  }

  async verifyWithIntent(bytes: Uint8Array, signature: string | Uint8Array, intent: IntentScope): Promise<boolean> {
    return true;
  }

  async verifyTransactionBlock(message: Uint8Array, signature: string | Uint8Array): Promise<boolean> {
    return true;
  }

  async verifyPersonalMessage(message: Uint8Array, signature: string | Uint8Array): Promise<boolean> {
    return true;
  }

  toRawBytes(): Uint8Array {
    return this.bytes;
  }

  toSuiBytes(): Uint8Array {
    return new Uint8Array([0, ...this.bytes]);
  }

  toString(): never {
    throw new Error('toString() should not be called');
  }
}

export class MockKeypair {
  #publicKey: MockPublicKey;
  #secretKey: Uint8Array;

  constructor() {
    this.#publicKey = new MockPublicKey();
    this.#secretKey = new Uint8Array(64).fill(1);
  }

  getPublicKey(): MockPublicKey {
    return this.#publicKey;
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(64).fill(2);
  }

  async signData(data: Uint8Array): Promise<{ signature: string; bytes: string }> {
    return {
      signature: Buffer.from(new Uint8Array(64).fill(2)).toString('base64'),
      bytes: Buffer.from(data).toString('base64')
    };
  }
  
  async signTransaction(transaction: any): Promise<{ signature: string; bytes: string }> {
    return {
      signature: Buffer.from(new Uint8Array(64).fill(2)).toString('base64'),
      bytes: 'mock-serialized-tx-bytes'
    };
  }
  
  async signPersonalMessage(message: Uint8Array): Promise<{ signature: string; bytes: string }> {
    return {
      signature: Buffer.from(new Uint8Array(64).fill(2)).toString('base64'),
      bytes: Buffer.from(message).toString('base64')
    };
  }
  
  async signWithIntent(message: Uint8Array, intent: string): Promise<{ signature: string; bytes: string }> {
    return {
      signature: Buffer.from(new Uint8Array(64).fill(2)).toString('base64'),
      bytes: Buffer.from(message).toString('base64')
    };
  }
  
  getKeyScheme(): 'ED25519' | 'Secp256k1' {
    return 'ED25519';
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