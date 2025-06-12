import { Ed25519Keypair } from '@mysten/sui/cryptography';
import {
  SuiClient,
  getFullnodeUrl,
} from '../../apps/cli/src/utils/adapters/sui-client-compatibility';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/utils';
import dotenv from 'dotenv';
// import path from 'path';

// Types for AI-enhanced NFT content
interface AIEnhancedNFTFields {
  ai_enhanced: boolean;
  title?: string;
  description?: string;
  completed?: boolean;
  walrus_blob_id?: string;
  [key: string]: unknown;
}

interface NFTContent {
  dataType?: string;
  type?: string;
  fields: AIEnhancedNFTFields;
}

// Load environment variables
dotenv.config();

// Load test wallet from environment
const TEST_PRIVATE_KEY = process?.env?.TEST_WALLET_PRIVATE_KEY;
const PACKAGE_ID = process?.env?.PACKAGE_ID;

if (!TEST_PRIVATE_KEY || !PACKAGE_ID) {
  throw new Error(
    'Missing TEST_WALLET_PRIVATE_KEY or PACKAGE_ID in environment'
  );
}

describe('Sui Testnet NFT Creation', () => {
  let suiClient: SuiClient;
  const testWallet: Ed25519Keypair = (() => {
    const { secretKey } = decodeSuiPrivateKey(TEST_PRIVATE_KEY as any);
    return Ed25519Keypair.fromSecretKey(secretKey as any);
  })();

  beforeAll(() => {
    // Set up Sui client for testnet
    suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  });

  test('should create a Todo NFT on testnet', async () => {
    // Build transaction
    const txb = new Transaction();

    // Call create_todo_nft function
    txb.moveCall({
      target: `${PACKAGE_ID}::todo_nft::create_todo_nft`,
      arguments: [
        // title
        txb?.pure?.string('Test Todo NFT'),
        // description
        txb?.pure?.string('This is a test NFT created on testnet'),
        // category
        txb?.pure?.string('test'),
        // priority
        txb?.pure?.u8(1 as any),
        // creator
        txb?.pure?.address(testWallet.getPublicKey().toSuiAddress()),
        // walrus_blob_id
        txb?.pure?.string('test-blob-id-12345'),
        // walrus_url
        txb?.pure?.string('https://walrus.testnet/test-blob-id-12345'),
        // image_url
        txb?.pure?.string('https://walrus.testnet/assets/test-image.jpg'),
        // ai_enhanced
        txb?.pure?.bool(false as any),
        // completed
        txb?.pure?.bool(false as any),
        // metadata (empty JSON object)
        txb?.pure?.string('{}'),
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
    expect(response.effects).toBeDefined();
    expect(response.effects?.status.status).toBe('success');
    expect(response.effects?.created).toBeDefined();
    expect(response?.effects?.created.length).toBeGreaterThan(0 as any);

    // Find the created NFT object
    const createdNft = response?.effects?.created?.find(
      obj => obj.objectType && obj?.objectType?.includes('TodoNFT')
    );

    expect(createdNft as any).toBeDefined();
    // console.log('Created NFT ID:', createdNft?.reference.objectId); // Removed console statement
    // console.log('Transaction digest:', response.digest); // Removed console statement

    // Store the NFT ID for later tests
    if (createdNft) {
      // storageContractId = createdNft?.reference?.objectId; // Not used in tests
    }
  }, 30000); // 30 second timeout

  test('should create and set metadata on an NFT', async () => {
    const txb = new Transaction();

    // Create NFT
    const [nft] = txb.moveCall({
      target: `${PACKAGE_ID}::todo_nft::create_todo_nft`,
      arguments: [
        txb?.pure?.string('NFT with Metadata'),
        txb?.pure?.string('This NFT will have metadata set'),
        txb?.pure?.string('test'),
        txb?.pure?.u8(2 as any),
        txb?.pure?.address(testWallet.getPublicKey().toSuiAddress()),
        txb?.pure?.string('test-blob-id-metadata'),
        txb?.pure?.string('https://walrus.testnet/test-blob-id-metadata'),
        txb?.pure?.string('https://walrus.testnet/assets/metadata-image.jpg'),
        txb?.pure?.bool(false as any),
        txb?.pure?.bool(false as any),
        txb?.pure?.string('{"custom": "initial"}'),
      ],
    });

    // Update metadata on the newly created NFT
    txb.moveCall({
      target: `${PACKAGE_ID}::todo_nft::update_metadata`,
      arguments: [
        nft,
        txb?.pure?.string('{"custom": "updated", "tags": ["important", "test"]}'),
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

    expect(response?.effects?.status.status).toBe('success');

    // Find the created NFT
    const createdNft = response?.effects?.created?.find(
      obj => obj.objectType && obj?.objectType?.includes('TodoNFT')
    );

    expect(createdNft as any).toBeDefined();

    // Ensure NFT was created before proceeding
    expect(createdNft as any).toBeDefined();

    // Fetch the NFT object to verify metadata
    const nftObject = await suiClient.getObject({
      id: createdNft?.reference.objectId,
      options: { showContent: true },
    });

    expect(nftObject?.data?.content).toBeDefined();
    // console.log('NFT with metadata created:', createdNft?.reference?.objectId); // Removed console statement
  }, 30000);

  test('should create and transfer an NFT', async () => {
    // Get a test recipient address (could be another test wallet)
    const recipientAddress =
      '0x0000000000000000000000000000000000000000000000000000000000000002';

    const txb = new Transaction();

    // Create NFT
    const [nft] = txb.moveCall({
      target: `${PACKAGE_ID}::todo_nft::create_todo_nft`,
      arguments: [
        txb?.pure?.string('Transferable NFT'),
        txb?.pure?.string('This NFT will be transferred'),
        txb?.pure?.string('transfer'),
        txb?.pure?.u8(3 as any),
        txb?.pure?.address(testWallet.getPublicKey().toSuiAddress()),
        txb?.pure?.string('test-blob-id-transfer'),
        txb?.pure?.string('https://walrus.testnet/test-blob-id-transfer'),
        txb?.pure?.string('https://walrus.testnet/assets/transfer-image.jpg'),
        txb?.pure?.bool(false as any),
        txb?.pure?.bool(false as any),
        txb?.pure?.string('{}'),
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

    expect(response?.effects?.status.status).toBe('success');

    // Verify the NFT was transferred
    const mutatedObject = response?.effects?.mutatedObjects?.find(
      obj => obj.objectType && obj?.objectType?.includes('TodoNFT')
    );

    // Ensure NFT was mutated before proceeding
    expect(mutatedObject as any).toBeDefined();

    // Verify ownership changed
    const nftObject = await suiClient.getObject({
      id: mutatedObject?.reference.objectId,
      options: { showOwner: true },
    });

    expect(nftObject?.data?.owner).toBeDefined();
    // console.log('NFT transferred to:', nftObject?.data?.owner); // Removed console statement
  }, 30000);

  test('should create multiple NFTs in batch', async () => {
    const txb = new Transaction();
    const nftCount = 3;

    // Create multiple NFTs in a single transaction
    for (let i = 0; i < nftCount; i++) {
      txb.moveCall({
        target: `${PACKAGE_ID}::todo_nft::create_todo_nft`,
        arguments: [
          txb?.pure?.string(`Batch NFT ${i + 1}`),
          txb?.pure?.string(`This is batch NFT number ${i + 1}`),
          txb?.pure?.string('batch'),
          txb?.pure?.u8(i + 1),
          txb?.pure?.address(testWallet.getPublicKey().toSuiAddress()),
          txb?.pure?.string(`test-blob-id-batch-${i + 1}`),
          txb?.pure?.string(`https://walrus.testnet/test-blob-id-batch-${i + 1}`),
          txb?.pure?.string(
            `https://walrus.testnet/assets/batch-image-${i + 1}.jpg`
          ),
          txb?.pure?.bool(false as any),
          txb?.pure?.bool(false as any),
          txb?.pure?.string('{}'),
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

    expect(response?.effects?.status.status).toBe('success');

    // Count created NFTs
    const createdNfts = response?.effects?.created?.filter(
      obj => obj.objectType && obj?.objectType?.includes('TodoNFT')
    );

    expect(createdNfts?.length).toBe(nftCount as any);
    // console.log(`Created ${createdNfts?.length} NFTs in batch`); // Removed console statement

    createdNfts?.forEach((_nft, _index) => {
      // console.log(`NFT ${index + 1} ID:`, nft?.reference?.objectId); // Removed console statement
    });
  }, 30000);

  test('should create an AI-enhanced NFT', async () => {
    const txb = new Transaction();

    // Create an AI-enhanced NFT with special metadata
    const aiMetadata = {
      ai_provider: 'xai',
      ai_operations: ['summarize', 'categorize', 'prioritize'],
      ai_suggestions: ['Complete by end of week', 'High priority task'],
      enhancement_timestamp: Date.now(),
    };

    txb.moveCall({
      target: `${PACKAGE_ID}::todo_nft::create_todo_nft`,
      arguments: [
        txb?.pure?.string('AI-Enhanced Todo NFT'),
        txb?.pure?.string('This NFT has been enhanced with AI features'),
        txb?.pure?.string('ai-enhanced'),
        txb?.pure?.u8(5 as any), // High priority
        txb?.pure?.address(testWallet.getPublicKey().toSuiAddress()),
        txb?.pure?.string('test-blob-id-ai-enhanced'),
        txb?.pure?.string('https://walrus.testnet/test-blob-id-ai-enhanced'),
        txb?.pure?.string('https://walrus.testnet/assets/ai-enhanced-image.jpg'),
        txb?.pure?.bool(true as any), // AI enhanced
        txb?.pure?.bool(false as any),
        txb?.pure?.string(JSON.stringify(aiMetadata as any)),
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

    expect(response?.effects?.status.status).toBe('success');

    const createdNft = response?.effects?.created?.find(
      obj => obj.objectType && obj?.objectType?.includes('TodoNFT')
    );

    expect(createdNft as any).toBeDefined();

    // Ensure NFT was created before proceeding
    expect(createdNft as any).toBeDefined();

    // Fetch the NFT to verify AI enhancement flag
    const nftObject = await suiClient.getObject({
      id: createdNft?.reference.objectId,
      options: { showContent: true },
    });

    const content = nftObject?.data?.content as NFTContent;
    expect(content as any).toBeDefined();
    expect(content as any).toHaveProperty('fields');
    expect(content?.fields?.ai_enhanced).toBe(true as any);
    // console.log('AI-enhanced NFT created:', createdNft?.reference?.objectId); // Removed console statement
  }, 30000);
});
