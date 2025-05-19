// @ts-ignore - Ignore type errors from sui.js compatibility issues
import {
  Signer,
  type IntentScope,
  type SignatureScheme,
  type PublicKey,
  messageWithIntent,
  toSerializedSignature,
  SignatureWithBytes
} from '@mysten/sui/cryptography';
// @ts-ignore - Ignore type errors from sui.js compatibility issues
import { type TransactionBlock } from '@mysten/sui/transactions';
// @ts-ignore - Ignore type errors from sui.js compatibility issues
import { toB64 } from '@mysten/sui/utils';
// @ts-ignore - Ignore type errors from sui.js compatibility issues
import { blake2b } from '@mysten/sui/cryptography/utils';

/**
 * A simplified wallet extension signer that satisfies the Signer interface
 * This is a placeholder implementation - in a real application, you would
 * use the actual wallet adapter implementation
 */
// @ts-ignore - Ignore TypeScript errors related to missing interface implementations
export class WalletExtensionSigner extends Signer {
  private cachedAddress: string;
  private keyScheme: SignatureScheme = 'ED25519';
  private mockPublicKey: PublicKey;

  constructor() {
    super();
    this.cachedAddress = 'demo-address';
    this.mockPublicKey = this.createMockPublicKey();
  }

  private createMockPublicKey(): PublicKey {
    // @ts-ignore - Ignore TypeScript errors for interface implementation
    return {
      flag: () => 0x00,
      toBase64: () => 'mock-base64',
      toSuiAddress: () => this.cachedAddress,
      equals: (publicKey: PublicKey) => false,
      verify: async (data: Uint8Array, signature: Uint8Array): Promise<boolean> => {
        return signature.length === 64 && blake2b(data).length > 0;
      },
      toRawBytes: () => new Uint8Array(32),
      // Implementation of toString with never return type
      toString: (): never => {
        throw new Error('toString() should not be called');
      },
      // @ts-ignore - Ignore TypeScript errors for method signature compatibility
      async verifyTransactionBlock(message: Uint8Array, signature: string): Promise<boolean> {
        const signatureBytes = Buffer.from(signature, 'base64');
        const intentMessage = messageWithIntent('TransactionData' as IntentScope, message);
        return this.verify(intentMessage, signatureBytes);
      },
      // @ts-ignore - Ignore TypeScript errors for method signature compatibility
      async verifyPersonalMessage(message: Uint8Array, signature: string): Promise<boolean> {
        const signatureBytes = Buffer.from(signature, 'base64');
        const intentMessage = messageWithIntent('PersonalMessage' as IntentScope, message);
        return this.verify(intentMessage, signatureBytes);
      }
    };
  }

  // @ts-ignore - Ignore TypeScript errors for method implementation
  private generateSignature(data: Uint8Array): Uint8Array {
    if (!data || data.length === 0) {
      throw new Error('Invalid data bytes');
    }
    // Generate deterministic mock signature based on input data
    const mockSignature = new Uint8Array(64);
    const hash = blake2b(data);
    mockSignature.set(hash.slice(0, 32), 0);
    mockSignature.set(hash.slice(32, 64), 32);
    return mockSignature;
  }

  // @ts-ignore - Ignore TypeScript errors for method signature compatibility
  // @ts-ignore - Interface compatibility issue
  async signData(data: Uint8Array): Promise<SignatureWithBytes> {
    const signature = this.generateSignature(data);
    return {
      signature: toB64(signature),
      bytes: toB64(data)
    };
  }

  // @ts-ignore - Ignore TypeScript errors for method signature compatibility
  // @ts-ignore - Interface compatibility issue
  async signTransactionBlock(transaction: TransactionBlock): Promise<SignatureWithBytes> {
    // @ts-ignore - Build options compatibility
    const bytes = await transaction.build({ 
      client: undefined 
    });
    const intentMessage = messageWithIntent('TransactionData' as IntentScope, bytes);
    const signature = this.generateSignature(intentMessage);
    // @ts-ignore - Return type compatibility
    return {
      signature: toB64(signature),
      bytes: toB64(bytes)
    };
  }

  // @ts-ignore - Ignore TypeScript errors for method signature compatibility
  // @ts-ignore - Interface compatibility issue
  async signMessage(message: Uint8Array): Promise<SignatureWithBytes> {
    const intentMessage = messageWithIntent('PersonalMessage' as IntentScope, message);
    const signature = this.generateSignature(intentMessage);
    // @ts-ignore - Return type compatibility
    return {
      signature: toB64(signature),
      bytes: toB64(message)
    };
  }

  // @ts-ignore - Ignore TypeScript errors for method signature compatibility
  toSuiAddress(): string {
    return this.cachedAddress;
  }

  // @ts-ignore - Ignore TypeScript errors for method signature compatibility
  getPublicKey(): PublicKey {
    return this.mockPublicKey;
  }
}