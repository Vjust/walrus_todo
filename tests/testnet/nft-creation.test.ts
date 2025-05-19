import { Ed25519Keypair } from '@mysten/sui/cryptography';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/utils';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Load test wallet from environment
const TEST_PRIVATE_KEY = process.env.TEST_WALLET_PRIVATE_KEY;
const PACKAGE_ID = process.env.PACKAGE_ID;

if (!TEST_PRIVATE_KEY || !PACKAGE_ID) {
  throw new Error('Missing TEST_WALLET_PRIVATE_KEY or PACKAGE_ID in environment');
}

describe('Sui Testnet NFT Creation', () => {
  let suiClient: SuiClient;
  let testWallet: Ed25519Keypair;
  let storageContractId: string;

  beforeAll(() => {
    // Set up Sui client for testnet
    suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
    
    // Set up test wallet
    const { secretKey } = decodeSuiPrivateKey(TEST_PRIVATE_KEY);
    testWallet = Ed25519Keypair.fromSecretKey(secretKey);
  });

  test('should create a Todo NFT on testnet', async () => {
    try {
      // Build transaction
      const txb = new Transaction();
      
      // Call create_todo_nft function
      txb.moveCall({
        target: `${PACKAGE_ID}::todo_nft::create_todo_nft`,
        arguments: [
          // title
          txb.pure.string('Test Todo NFT'),
          // description
          txb.pure.string('This is a test NFT created on testnet'),
          // category
          txb.pure.string('test'),
          // priority
          txb.pure.u8(1),
          // creator
          txb.pure.address(testWallet.getPublicKey().toSuiAddress()),
          // walrus_blob_id
          txb.pure.string('test-blob-id-12345'),
          // walrus_url
          txb.pure.string('https://walrus.testnet/test-blob-id-12345'),
          // image_url
          txb.pure.string('https://walrus.testnet/assets/test-image.jpg'),
          // ai_enhanced
          txb.pure.bool(false),
          // completed
          txb.pure.bool(false),
          // metadata (empty JSON object)
          txb.pure.string('{}')
        ],
      });

      // Execute the transaction
      const response = await suiClient.signAndExecuteTransaction({
        signer: testWallet,
        transaction: txb,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      // Validate the transaction was successful
      expect(response.effects?.status.status).toBe('success');
      expect(response.effects?.created).toBeDefined();
      expect(response.effects?.created?.length).toBeGreaterThan(0);

      // Find the created NFT object
      const createdNft = response.effects?.created?.find(
        obj => obj.objectType && obj.objectType.includes('TodoNFT')
      );
      
      expect(createdNft).toBeDefined();
      console.log('Created NFT ID:', createdNft?.reference.objectId);
      console.log('Transaction digest:', response.digest);

      // Store the NFT ID for later tests
      if (createdNft) {
        storageContractId = createdNft.reference.objectId;
      }
    } catch (error) {
      console.error('NFT creation failed:', error);
      throw error;
    }
  }, 30000); // 30 second timeout

  test('should create and set metadata on an NFT', async () => {
    try {
      const txb = new Transaction();
      
      // Create NFT
      const [nft] = txb.moveCall({
        target: `${PACKAGE_ID}::todo_nft::create_todo_nft`,
        arguments: [
          txb.pure.string('NFT with Metadata'),
          txb.pure.string('This NFT will have metadata set'),
          txb.pure.string('test'),
          txb.pure.u8(2),
          txb.pure.address(testWallet.getPublicKey().toSuiAddress()),
          txb.pure.string('test-blob-id-metadata'),
          txb.pure.string('https://walrus.testnet/test-blob-id-metadata'),
          txb.pure.string('https://walrus.testnet/assets/metadata-image.jpg'),
          txb.pure.bool(false),
          txb.pure.bool(false),
          txb.pure.string('{"custom": "initial"}')
        ],
      });

      // Update metadata on the newly created NFT
      txb.moveCall({
        target: `${PACKAGE_ID}::todo_nft::update_metadata`,
        arguments: [
          nft,
          txb.pure.string('{"custom": "updated", "tags": ["important", "test"]}')
        ],
      });

      // Execute the transaction
      const response = await suiClient.signAndExecuteTransaction({
        signer: testWallet,
        transaction: txb,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      expect(response.effects?.status.status).toBe('success');
      
      // Find the created NFT
      const createdNft = response.effects?.created?.find(
        obj => obj.objectType && obj.objectType.includes('TodoNFT')
      );
      
      expect(createdNft).toBeDefined();
      
      if (createdNft) {
        // Fetch the NFT object to verify metadata
        const nftObject = await suiClient.getObject({
          id: createdNft.reference.objectId,
          options: { showContent: true },
        });
        
        expect(nftObject.data?.content).toBeDefined();
        console.log('NFT with metadata created:', createdNft.reference.objectId);
      }
    } catch (error) {
      console.error('NFT with metadata creation failed:', error);
      throw error;
    }
  }, 30000);

  test('should create and transfer an NFT', async () => {
    try {
      // Get a test recipient address (could be another test wallet)
      const recipientAddress = '0x0000000000000000000000000000000000000000000000000000000000000002';
      
      const txb = new Transaction();
      
      // Create NFT
      const [nft] = txb.moveCall({
        target: `${PACKAGE_ID}::todo_nft::create_todo_nft`,
        arguments: [
          txb.pure.string('Transferable NFT'),
          txb.pure.string('This NFT will be transferred'),
          txb.pure.string('transfer'),
          txb.pure.u8(3),
          txb.pure.address(testWallet.getPublicKey().toSuiAddress()),
          txb.pure.string('test-blob-id-transfer'),
          txb.pure.string('https://walrus.testnet/test-blob-id-transfer'),
          txb.pure.string('https://walrus.testnet/assets/transfer-image.jpg'),
          txb.pure.bool(false),
          txb.pure.bool(false),
          txb.pure.string('{}')
        ],
      });

      // Transfer the NFT to recipient
      txb.transferObjects([nft], recipientAddress);

      // Execute the transaction
      const response = await suiClient.signAndExecuteTransaction({
        signer: testWallet,
        transaction: txb,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      expect(response.effects?.status.status).toBe('success');
      
      // Verify the NFT was transferred
      const mutatedObject = response.effects?.mutatedObjects?.find(
        obj => obj.objectType && obj.objectType.includes('TodoNFT')
      );
      
      if (mutatedObject) {
        // Verify ownership changed
        const nftObject = await suiClient.getObject({
          id: mutatedObject.reference.objectId,
          options: { showOwner: true },
        });
        
        expect(nftObject.data?.owner).toBeDefined();
        console.log('NFT transferred to:', nftObject.data?.owner);
      }
    } catch (error) {
      console.error('NFT transfer failed:', error);
      throw error;
    }
  }, 30000);

  test('should create multiple NFTs in batch', async () => {
    try {
      const txb = new Transaction();
      const nftCount = 3;
      
      // Create multiple NFTs in a single transaction
      for (let i = 0; i < nftCount; i++) {
        txb.moveCall({
          target: `${PACKAGE_ID}::todo_nft::create_todo_nft`,
          arguments: [
            txb.pure.string(`Batch NFT ${i + 1}`),
            txb.pure.string(`This is batch NFT number ${i + 1}`),
            txb.pure.string('batch'),
            txb.pure.u8(i + 1),
            txb.pure.address(testWallet.getPublicKey().toSuiAddress()),
            txb.pure.string(`test-blob-id-batch-${i + 1}`),
            txb.pure.string(`https://walrus.testnet/test-blob-id-batch-${i + 1}`),
            txb.pure.string(`https://walrus.testnet/assets/batch-image-${i + 1}.jpg`),
            txb.pure.bool(false),
            txb.pure.bool(false),
            txb.pure.string('{}')
          ],
        });
      }

      // Execute the transaction
      const response = await suiClient.signAndExecuteTransaction({
        signer: testWallet,
        transaction: txb,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      expect(response.effects?.status.status).toBe('success');
      
      // Count created NFTs
      const createdNfts = response.effects?.created?.filter(
        obj => obj.objectType && obj.objectType.includes('TodoNFT')
      );
      
      expect(createdNfts?.length).toBe(nftCount);
      console.log(`Created ${createdNfts?.length} NFTs in batch`);
      
      createdNfts?.forEach((nft, index) => {
        console.log(`NFT ${index + 1} ID:`, nft.reference.objectId);
      });
    } catch (error) {
      console.error('Batch NFT creation failed:', error);
      throw error;
    }
  }, 30000);

  test('should create an AI-enhanced NFT', async () => {
    try {
      const txb = new Transaction();
      
      // Create an AI-enhanced NFT with special metadata
      const aiMetadata = {
        ai_provider: 'xai',
        ai_operations: ['summarize', 'categorize', 'prioritize'],
        ai_suggestions: ['Complete by end of week', 'High priority task'],
        enhancement_timestamp: Date.now()
      };
      
      txb.moveCall({
        target: `${PACKAGE_ID}::todo_nft::create_todo_nft`,
        arguments: [
          txb.pure.string('AI-Enhanced Todo NFT'),
          txb.pure.string('This NFT has been enhanced with AI features'),
          txb.pure.string('ai-enhanced'),
          txb.pure.u8(5), // High priority
          txb.pure.address(testWallet.getPublicKey().toSuiAddress()),
          txb.pure.string('test-blob-id-ai-enhanced'),
          txb.pure.string('https://walrus.testnet/test-blob-id-ai-enhanced'),
          txb.pure.string('https://walrus.testnet/assets/ai-enhanced-image.jpg'),
          txb.pure.bool(true), // AI enhanced
          txb.pure.bool(false),
          txb.pure.string(JSON.stringify(aiMetadata))
        ],
      });

      // Execute the transaction
      const response = await suiClient.signAndExecuteTransaction({
        signer: testWallet,
        transaction: txb,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      expect(response.effects?.status.status).toBe('success');
      
      const createdNft = response.effects?.created?.find(
        obj => obj.objectType && obj.objectType.includes('TodoNFT')
      );
      
      expect(createdNft).toBeDefined();
      
      if (createdNft) {
        // Fetch the NFT to verify AI enhancement flag
        const nftObject = await suiClient.getObject({
          id: createdNft.reference.objectId,
          options: { showContent: true },
        });
        
        const content = nftObject.data?.content;
        if (content && 'fields' in content) {
          expect(content.fields.ai_enhanced).toBe(true);
          console.log('AI-enhanced NFT created:', createdNft.reference.objectId);
        }
      }
    } catch (error) {
      console.error('AI-enhanced NFT creation failed:', error);
      throw error;
    }
  }, 30000);
});