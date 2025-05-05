import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
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

  async createTodoNft(todo: Todo, walrusBlobId: string, _imageUrl: string): Promise<string> {
    try {
      const txb = new Transaction();

      // Serialize strings to Uint8Array for Move
      const titleBytes = new TextEncoder().encode(todo.title);
      const descriptionBytes = new TextEncoder().encode(todo.description || '');
      const blobIdBytes = new TextEncoder().encode(walrusBlobId);

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

  /**
   * Normalize an object ID to ensure it has the 0x prefix and is a valid Sui object ID
   * @param objectId The object ID to normalize
   * @returns The normalized object ID with 0x prefix
   */
  private async normalizeObjectId(objectId: string): Promise<string> {
    // If the objectId is a transaction digest (which is what we're storing in nftObjectId),
    // we need to get the actual object ID from the transaction effects
    if (objectId.length > 50) {
      console.log(`Object ID ${objectId} appears to be a transaction digest, not an object ID`);
      console.log('Attempting to get the actual object ID from the transaction effects...');

      try {
        // Query the transaction effects to get the created object ID
        const txResponse = await this.suiClient.getTransactionBlock({
          digest: objectId,
          options: {
            showEffects: true,
            showEvents: true
          }
        });

        if (!txResponse.effects?.created || txResponse.effects.created.length === 0) {
          throw new Error(`No created objects found in transaction ${objectId}`);
        }

        // Find the created object that matches our TodoNFT type
        // We need to get the object details to check its type
        for (const createdObj of txResponse.effects.created) {
          try {
            const objDetails = await this.suiClient.getObject({
              id: createdObj.reference.objectId,
              options: { showType: true }
            });

            if (objDetails.data?.type?.includes('todo_nft::TodoNFT')) {
              console.log(`Found TodoNFT object: ${createdObj.reference.objectId}`);
              return createdObj.reference.objectId;
            }
          } catch (error) {
            console.warn(`Error checking object ${createdObj.reference.objectId}:`, error);
          }
        }

        // If we get here, we didn't find a matching object
        throw new Error(`No TodoNFT object found in transaction ${objectId}`);
      } catch (error) {
        console.error('Failed to get object ID from transaction digest:', error);
        throw new Error(`Failed to get object ID from transaction digest: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // If the objectId doesn't start with 0x, add it
    let normalized = objectId.startsWith('0x') ? objectId : `0x${objectId}`;

    // Ensure the object ID is lowercase
    normalized = normalized.toLowerCase();

    return normalized;
  }

  async getTodoNft(nftObjectId: string): Promise<{
    objectId: string;
    title: string;
    description: string;
    completed: boolean;
    walrusBlobId: string;
  }> {
    try {
      // Normalize the object ID to ensure it has the 0x prefix
      const normalizedObjectId = await this.normalizeObjectId(nftObjectId);

      console.log(`Retrieving Todo NFT with object ID: ${normalizedObjectId}`);

      const response = await this.suiClient.getObject({
        id: normalizedObjectId,
        options: {
          showContent: true,
        },
      });

      if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
        throw new Error(`Failed to retrieve Todo NFT with ID: ${normalizedObjectId}`);
      }

      const content = response.data.content as any;

      console.log(`Successfully retrieved Todo NFT:`);
      console.log(`  Title: ${content.fields.title}`);
      console.log(`  Description: ${content.fields.description || '(none)'}`);
      console.log(`  Completed: ${Boolean(content.fields.completed)}`);
      console.log(`  Walrus Blob ID: ${content.fields.walrus_blob_id}`);

      return {
        objectId: normalizedObjectId,
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

  async completeTodoNft(nftObjectId: string): Promise<string> {
    try {
      // Normalize the object ID to ensure it has the 0x prefix
      const normalizedObjectId = await this.normalizeObjectId(nftObjectId);

      console.log(`Completing Todo NFT with object ID: ${normalizedObjectId}`);

      const txb = new Transaction();

      // Call the complete_todo function with the NFT object ID
      txb.moveCall({
        target: `${this.moduleAddress}::todo_nft::complete_todo`,
        arguments: [
          txb.object(normalizedObjectId)
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

      console.log(`Successfully completed Todo NFT with transaction digest: ${response.digest}`);

      return response.digest;
    } catch (error) {
      handleError('Error completing Todo NFT on Sui', error);
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
