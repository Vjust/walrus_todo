import { SuiClient } from '@mysten/sui/client';
import { type Signer } from '@mysten/sui/cryptography';
import { WalrusClient } from '@mysten/walrus';
import * as fs from 'fs';
import * as path from 'path';
import { getAssetPath } from './path-utils';
import { handleError } from './error-handler';
import { execSync } from 'child_process';
import { KeystoreSigner } from './sui-keystore';

export class WalrusImageStorage {
  private suiClient: SuiClient;
  private walrusClient!: WalrusClient;
  private isInitialized: boolean = false;
  private signer: KeystoreSigner | null = null;
  private useMockMode: boolean;

  constructor(suiClient: SuiClient, useMockMode: boolean = false) {
    this.suiClient = suiClient;
    this.useMockMode = useMockMode;
  }

  async connect(): Promise<void> {
    try {
      // Get active environment info from Sui CLI
      const envInfo = execSync('sui client active-env').toString().trim();
      if (!envInfo.includes('testnet')) {
        throw new Error('Must be connected to testnet environment. Use "sui client switch --env testnet"');
      }

      // Initialize Walrus client with network config
      this.walrusClient = new WalrusClient({
        network: 'testnet',
        suiClient: this.suiClient,
        storageNodeClientOptions: {
          timeout: 30000,
          onError: (error) => handleError('Walrus storage node error:', error)
        }
      });

      // Create a signer that uses the active CLI keystore
      this.signer = new KeystoreSigner(this.suiClient);

      this.isInitialized = true;
    } catch (error) {
      handleError('Failed to initialize Walrus client', error);
      throw error;
    }
  }

  // Changed from private to protected to allow access in test subclasses
  protected async getTransactionSigner(): Promise<Signer> {
    if (!this.signer) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }
    return this.signer;
  }

  /**
   * Get the active Sui address from the connected keystore signer
   */
  public getActiveAddress(): string {
    if (!this.signer) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }
    return this.signer.toSuiAddress();
  }

  /**
   * Upload the default todo bottle image to Walrus
   * @returns Promise<string> The URL of the uploaded image on Walrus
   */
  async uploadDefaultImage(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }

    try {
      const imagePath = getAssetPath('todo_bottle.jpeg');
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Default image not found at ${imagePath}`);
      }

      // Read image file as buffer
      const imageBuffer = fs.readFileSync(imagePath);

      // Upload to Walrus using CLI keystore signer
      const signer = await this.getTransactionSigner();
      const { blobObject } = await this.walrusClient.writeBlob({
        blob: new Uint8Array(imageBuffer),
        deletable: false,
        epochs: 52, // Store for ~6 months
        signer,
        attributes: {
          contentType: 'image/jpeg',
          filename: 'todo_bottle.jpeg',
          type: 'todo-nft-default-image'
        }
      });

      // Return the Walrus URL format
      return `https://testnet.wal.app/blob/${blobObject.blob_id}`;
    } catch (error) {
      handleError('Failed to upload default image to Walrus', error);
      throw error;
    }
  }

  /**
   * Upload a custom image for a todo
   * @param imagePath Path to the image file
   * @param title Todo title (for metadata)
   * @param completed Todo completion status (for metadata)
   * @returns Promise<string> The URL of the uploaded image on Walrus
   */
  async uploadCustomTodoImage(
    imagePath: string,
    title: string,
    completed: boolean
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }

    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

      // Upload to Walrus using CLI keystore signer
      const signer = await this.getTransactionSigner();
      const { blobObject } = await this.walrusClient.writeBlob({
        blob: new Uint8Array(imageBuffer),
        deletable: false,
        epochs: 52, // Store for ~6 months
        signer,
        attributes: {
          contentType: mimeType,
          filename: path.basename(imagePath),
          type: 'todo-nft-image',
          title,
          completed: completed.toString()
        }
      });

      // Return the Walrus URL format
      return `https://testnet.wal.app/blob/${blobObject.blob_id}`;
    } catch (error) {
      handleError('Failed to upload custom image to Walrus', error);
      throw error;
    }
  }

  /**
   * Upload an image to Walrus
   * @param imagePath Path to the image file
   * @returns Promise<string> The URL of the uploaded image on Walrus
   */
  public async uploadImage(imagePath: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image not found at ${imagePath}`);
      }
      const imageBuffer = fs.readFileSync(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      const signer = await this.getTransactionSigner();
      const { blobObject } = await this.walrusClient.writeBlob({
        blob: new Uint8Array(imageBuffer),
        deletable: false,
        epochs: 52,
        signer,
        attributes: {
          contentType: mimeType,
          filename: path.basename(imagePath),
          type: 'todo-nft-image'
        }
      });
      return `https://testnet.wal.app/blob/${blobObject.blob_id}`;
    } catch (error) {
      handleError('Failed to upload image to Walrus', error);
      throw error;
    }
  }
}

export function createWalrusImageStorage(suiClient: SuiClient, useMockMode: boolean = false): WalrusImageStorage {
  return new WalrusImageStorage(suiClient, useMockMode);
}