import { SuiClient } from '@mysten/sui/client';
import { KeystoreSigner } from './sui-keystore';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface WalrusUploadResponse {
  blob_id: string;
  status: string;
}

export class WalrusImageStorage {
  private suiClient: SuiClient;
  private activeAddress: string | null = null;
  private isInitialized = false;
  private signer: KeystoreSigner | null = null;

  constructor(suiClient: SuiClient) {
    this.suiClient = suiClient;
  }

  async connect(): Promise<void> {
    try {
      // Get active address from Sui CLI
      this.activeAddress = execSync('sui client active-address').toString().trim();
      if (!this.activeAddress) {
        throw new Error('No active Sui address found');
      }

      // Check balance
      const balance = await this.suiClient.getBalance({
        owner: this.activeAddress
      });
      
      if (balance.totalBalance === '0') {
        throw new Error('No WAL tokens found in the active address');
      }

      // Initialize signer
      this.signer = new KeystoreSigner(this.suiClient);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to connect to Sui network:', error);
      throw error;
    }
  }

  async getTransactionSigner(): Promise<KeystoreSigner> {
    if (this.signer) {
      return this.signer;
    }

    const balance = await this.suiClient.getBalance({
      owner: this.activeAddress!
    });

    if (balance.totalBalance === '0') {
      throw new Error('No WAL tokens found');
    }

    this.signer = new KeystoreSigner(this.suiClient);
    return this.signer;
  }

  async uploadImage(imagePath: string): Promise<string> {
    if (!this.isInitialized || !this.signer) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }

    try {
      // Read and encode image file
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Generate signature
      const dataToSign = new TextEncoder().encode(base64Image);
      const signedData = await this.signer.signMessage(dataToSign);

      // Send to Walrus storage
      const response = await fetch('https://api.walrus.store/v1/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sui-Signature': signedData.signature,
          'X-Sui-Address': this.activeAddress!
        },
        body: JSON.stringify({
          data: base64Image
        })
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json() as WalrusUploadResponse;
      return result.blob_id;
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw error;
    }
  }

  async uploadDefaultImage(): Promise<string> {
    const defaultImagePath = path.join(__dirname, '../../assets/todo_bottle.jpeg');
    const blobId = await this.uploadImage(defaultImagePath);
    return `https://api.walrus.store/v1/download/${blobId}`;
  }
}

export function createWalrusImageStorage(suiClient: SuiClient): WalrusImageStorage {
  return new WalrusImageStorage(suiClient);
}
