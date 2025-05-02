import { SuiClient } from '@mysten/sui/client';
import { type Signer, type SignatureWithBytes } from '@mysten/sui/cryptography';
import { WalrusClient } from '@mysten/walrus';
import * as fs from 'fs';
import * as path from 'path';
import { getAssetPath } from './path-utils';
import { handleError } from './error-handler';
import { execSync } from 'child_process';
import { IntentScope, messageWithIntent } from '@mysten/sui/cryptography';

export class WalrusImageStorage {
  private suiClient: SuiClient;
  private walrusClient!: WalrusClient;
  private isInitialized: boolean = false;

  constructor(suiClient: SuiClient) {
    this.suiClient = suiClient;
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

      this.isInitialized = true;
    } catch (error) {
      handleError('Failed to initialize Walrus client', error);
      throw error;
    }
  }

  private async getTransactionSigner(): Promise<Signer> {
    // Use CLI to get active address
    const activeAddress = execSync('sui client active-address').toString().trim();

    // Helper function to sign data using CLI
    const signWithCLI = async (data: Uint8Array): Promise<string> => {
      const base64Data = Buffer.from(data).toString('base64');
      const result = execSync(`sui client sign-data "${base64Data}"`).toString();
      const match = result.match(/signature: ([^\n]+)/);
      if (!match) {
        throw new Error('Failed to extract signature from sui client output');
      }
      return match[1];
    };
    
    return {
      // Required methods from Signer interface
      getKeyScheme: () => 'ED25519',
      signTransaction: async (tx: Uint8Array): Promise<SignatureWithBytes> => {
        return {
          signature: await signWithCLI(tx),
          bytes: Buffer.from(tx).toString('base64')
        };
      },
      signMessage: async (message: Uint8Array): Promise<string> => {
        return signWithCLI(message);
      },
      sign: async (data: Uint8Array): Promise<Uint8Array> => {
        const signatureStr = await signWithCLI(data);
        return new Uint8Array(Buffer.from(signatureStr, 'base64'));
      },
      signWithIntent: async (data: Uint8Array, intent: IntentScope): Promise<string> => {
        const messageBytes = messageWithIntent(intent, data);
        return signWithCLI(messageBytes);
      },
      signPersonalMessage: async (message: Uint8Array): Promise<string> => {
        return signWithCLI(message);
      },
      toSuiAddress: () => activeAddress,
      getPublicKey: () => {
        throw new Error('getPublicKey not implemented - using CLI for signing only');
      }
    };
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

      // Upload to Walrus using CLI signer
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

      // Upload to Walrus using CLI signer
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
}

export function createWalrusImageStorage(suiClient: SuiClient): WalrusImageStorage {
  return new WalrusImageStorage(suiClient);
}