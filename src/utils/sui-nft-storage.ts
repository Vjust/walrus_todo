import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { execSync } from 'child_process';
import { Todo } from '../types/todo';
import { handleError } from './error-handler';
import { bcs } from '@mysten/sui/bcs';
import { Signer } from '@mysten/sui/cryptography';
import { KeystoreSigner } from './sui-keystore';

export class SuiNftStorage {
  private suiClient: SuiClient;
  private moduleAddress: string;
  private signer: Signer;

  constructor(suiClient: SuiClient, moduleAddress: string) {
    try {
      this.suiClient = suiClient;
      this.moduleAddress = moduleAddress;
      this.signer = new KeystoreSigner(suiClient);
    } catch (error) {
      handleError('Failed to initialize Sui NFT Storage', error);
      throw error;
    }
  }

  async createTodoNft(todo: Todo, walrusBlobId: string, imageUrl: string): Promise<string> {
    try {
      const txb = new Transaction();
      
      // Serialize strings to Uint8Array for Move
      const titleBytes = new TextEncoder().encode(todo.title);
      const descriptionBytes = new TextEncoder().encode(todo.description || '');
      const blobIdBytes = new TextEncoder().encode(walrusBlobId);
      const imageUrlBytes = new TextEncoder().encode(imageUrl);
      
      // Call the create_todo function with properly serialized arguments
      txb.moveCall({
        target: `${this.moduleAddress}::todo_nft::create_todo`,
        arguments: [
          bcs.vector(bcs.u8()).serialize(titleBytes),
          bcs.vector(bcs.u8()).serialize(descriptionBytes),
          bcs.vector(bcs.u8()).serialize(blobIdBytes),
          bcs.bool().serialize(todo.private)
        ],
      });
      
      // Sign and execute the transaction
      const response = await this.suiClient.signAndExecuteTransaction({
        transaction: txb,
        options: {
          showEffects: true,
        },
        signer: this.signer
      });
      
      if (!response.digest) {
        throw new Error('Transaction failed: No digest returned');
      }
      
      return response.digest;
    } catch (error) {
      handleError('Error creating Todo NFT on Sui', error);
      throw error;
    }
  }

  async getTodoNft(nftObjectId: string): Promise<{
    objectId: string;
    title: string;
    description: string;
    completed: boolean;
    walrusBlobId: string;
  }> {
    try {
      const response = await this.suiClient.getObject({
        id: nftObjectId,
        options: {
          showContent: true,
        },
      });
      
      if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
        throw new Error(`Failed to retrieve Todo NFT with ID: ${nftObjectId}`);
      }
      
      const content = response.data.content as any;
      
      return {
        objectId: nftObjectId,
        title: content.fields.title,
        description: content.fields.description,
        completed: content.fields.completed,
        walrusBlobId: content.fields.walrus_blob_id,
      };
    } catch (error) {
      handleError('Error retrieving Todo NFT from Sui', error);
      throw error;
    }
  }

  async getOwnedTodoNfts(): Promise<{
    objectId: string;
    title: string;
    completed: boolean;
    walrusBlobId: string;
  }[]> {
    try {
      const address = execSync('sui client active-address').toString().trim();
      
      const response = await this.suiClient.getOwnedObjects({
        owner: address,
        options: {
          showContent: true,
        },
        filter: {
          StructType: `${this.moduleAddress}::todo_nft::TodoNFT`
        }
      });
      
      if (!response.data) {
        return [];
      }
      
      return response.data
        .map(item => {
          if (!item.data?.content || item.data.content.dataType !== 'moveObject') {
            return null;
          }

          const content = item.data.content as any;
          if (!content.fields) return null;

          return {
            objectId: item.data.objectId,
            title: content.fields.title,
            completed: Boolean(content.fields.completed),
            walrusBlobId: content.fields.walrus_blob_id,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    } catch (error) {
      handleError('Error retrieving owned Todo NFTs from Sui', error);
      throw error;
    }
  }
}

export function createSuiNftStorage(
  suiClient: SuiClient, 
  moduleAddress: string
): SuiNftStorage {
  return new SuiNftStorage(suiClient, moduleAddress);
}
