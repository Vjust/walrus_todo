import { SuiClient } from '@mysten/sui/client';
import { Signer } from '@mysten/sui/cryptography';
import { WalrusClient } from '@mysten/walrus';
import { WalletAdapter } from '@mysten/wallet-adapter-base';
import * as fs from 'fs';
import * as path from 'path';
import { getAssetPath } from './path-utils';
import { handleError } from './error-handler';
import { execSync } from 'child_process';
import { CLIError } from '../types/error';
import { KeystoreSigner } from './sui-keystore';
import { WalletExtensionSigner } from './wallet-extension';

const WAL_COIN_TYPE = '0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL';

export class WalrusImageStorage {
  private walrusClient!: WalrusClient;
  private isInitialized: boolean = false;
  private signer: Signer | null = null;

  constructor(
    private suiClient: SuiClient,
    private wallet?: WalletAdapter
  ) {}

  async connect(): Promise<void> {
    try {
      const envInfo = execSync('sui client active-env').toString().trim();
      if (!envInfo.includes('testnet')) {
        throw new CLIError(
          'Must be connected to testnet environment. Use "sui client switch --env testnet"',
          'WRONG_NETWORK'
        );
      }

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
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Failed to initialize Walrus client: ${error instanceof Error ? error.message : String(error)}`,
        'INIT_FAILED'
      );
    }
  }

  private async getTransactionSigner(): Promise<Signer> {
    try {
      if (this.signer) {
        return this.signer;
      }

      let signer: Signer;
      if (this.wallet?.connected) {
        signer = new WalletExtensionSigner(this.wallet);
      } else {
        signer = new KeystoreSigner(this.suiClient);
      }

      const balance = await this.suiClient.getBalance({
        owner: signer.toSuiAddress(),
        coinType: WAL_COIN_TYPE
      });

      if (balance.totalBalance === '0') {
        throw new CLIError(
          'No WAL tokens found in wallet. WAL tokens are required to upload to Walrus storage.',
          'NO_WAL_TOKENS'
        );
      }

      this.signer = signer;
      return signer;
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Failed to create signer: ${error instanceof Error ? error.message : String(error)}`,
        'SIGNER_FAILED'
      );
    }
  }

  async uploadDefaultImage(): Promise<string> {
    if (!this.isInitialized) {
      throw new CLIError('WalrusImageStorage not initialized. Call connect() first.', 'NOT_INITIALIZED');
    }

    try {
      const imagePath = getAssetPath('todo_bottle.jpeg');
      if (!fs.existsSync(imagePath)) {
        throw new CLIError(`Default image not found at ${imagePath}`, 'IMAGE_NOT_FOUND');
      }

      const imageBuffer = fs.readFileSync(imagePath);
      const signer = await this.getTransactionSigner();
      
      const { blobObject } = await this.walrusClient.writeBlob({
        blob: new Uint8Array(imageBuffer),
        deletable: false,
        epochs: 52,
        signer,
        attributes: {
          contentType: 'image/jpeg',
          filename: 'todo_bottle.jpeg',
          type: 'todo-nft-default-image'
        }
      });

      return `https://testnet.wal.app/blob/${blobObject.blob_id}`;
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Failed to upload default image to Walrus: ${error instanceof Error ? error.message : String(error)}`,
        'UPLOAD_FAILED'
      );
    }
  }

  async uploadCustomTodoImage(
    imagePath: string,
    title: string,
    completed: boolean
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new CLIError('WalrusImageStorage not initialized. Call connect() first.', 'NOT_INITIALIZED');
    }

    try {
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
          type: 'todo-nft-image',
          title,
          completed: completed.toString()
        }
      });

      return `https://testnet.wal.app/blob/${blobObject.blob_id}`;
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Failed to upload custom image: ${error instanceof Error ? error.message : String(error)}`,
        'UPLOAD_FAILED'
      );
    }
  }
}

export function createWalrusImageStorage(
  suiClient: SuiClient,
  wallet?: WalletAdapter
): WalrusImageStorage {
  return new WalrusImageStorage(suiClient, wallet);
}