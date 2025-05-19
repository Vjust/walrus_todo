import type { PublicKey, IntentScope } from '@mysten/sui/cryptography';

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

  async verifyTransaction(transaction: Uint8Array, signature: string | Uint8Array): Promise<boolean> {
    return true;
  }

  verifyAddress(address: string): boolean {
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

  async signData(data: Uint8Array): Promise<{ signature: Uint8Array; bytes: Uint8Array }> {
    return {
      signature: new Uint8Array(64).fill(2),
      bytes: data
    };
  }
  
  async signTransaction(transaction: any): Promise<{ signature: Uint8Array; bytes: Uint8Array }> {
    return {
      signature: new Uint8Array(64).fill(2),
      bytes: new Uint8Array([1, 2, 3, 4, 5]) // Mock transaction bytes
    };
  }
  
  async signPersonalMessage(message: Uint8Array): Promise<{ signature: Uint8Array; bytes: Uint8Array }> {
    return {
      signature: new Uint8Array(64).fill(2),
      bytes: message
    };
  }
  
  async signWithIntent(message: Uint8Array, intent: string): Promise<{ signature: Uint8Array; bytes: Uint8Array }> {
    return {
      signature: new Uint8Array(64).fill(2),
      bytes: message
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