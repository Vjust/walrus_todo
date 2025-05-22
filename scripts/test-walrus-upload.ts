/* eslint-disable no-console */
import { createWalrusImageStorage } from '../src/utils/walrus-image-storage';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { NETWORK_URLS } from '../src/constants';

/**
 * This script ensures we're running on testnet and uploads a default image for our NFT to Walrus storage.
 * It then provides the URL for use in NFT metadata.
 *
 * @param useMockMode - If true, uses mock mode to generate a URL without actually uploading
 */
async function uploadDefaultImageToWalrus(useMockMode: boolean = false) {
  try {
    console.log('🌊 Walrus NFT Image Uploader 🌊\n');

    // Ensure we're on testnet
    console.log('Checking Sui environment...');
    const envInfo = execSync('sui client active-env').toString().trim();
    const network = envInfo.includes('testnet') ? 'testnet'
                 : envInfo.includes('mainnet') ? 'mainnet'
                 : envInfo.includes('devnet') ? 'devnet'
                 : 'local';

    // Check for testnet and switch if needed
    if (network !== 'testnet') {
      console.log('⚠️  Not on testnet. Switching to testnet...');
      try {
        execSync('sui client switch --env testnet');
        console.log('✓ Successfully switched to testnet');
      } catch (error) {
        console.error('❌ Failed to switch to testnet:', error);
        console.error('Please run: sui client switch --env testnet');
        return null;
      }
    } else {
      console.log('✓ Already on testnet');
    }

    // Create SuiClient with testnet URL
    console.log('Initializing Sui client...');
    const suiClient = new SuiClient({ url: NETWORK_URLS.testnet });

    // Check if image exists
    const defaultImagePath = path.join(__dirname, 'assets/todo_bottle.jpeg');
    if (!fs.existsSync(defaultImagePath)) {
      console.error(`❌ Error: Default image not found at ${defaultImagePath}`);
      console.error('Please ensure the image exists before running this script.');
      return null;
    }
    console.log(`✓ Default image found at ${defaultImagePath}`);

    // Create Walrus storage client for testnet
    console.log(`Creating Walrus storage client in ${useMockMode ? 'MOCK' : 'REAL'} mode...`);
    const walrusStorage = createWalrusImageStorage(suiClient, useMockMode);

    // Connect to get active address and initialize WalrusClient
    console.log('Connecting to Sui network and initializing Walrus client...');
    await walrusStorage.connect();
    const activeAddress = walrusStorage.getActiveAddress();

    if (!activeAddress) {
      throw new Error('No active address found. Ensure connect() was successful.');
    }
    console.log(`✓ Connected to Sui with address: ${activeAddress}`);

    // Note: Skipping WAL balance check as the coin type format may vary between Sui versions
    // The Walrus client will handle errors if there are insufficient WAL tokens
    console.log('Proceeding to upload - make sure you have WAL tokens in your wallet...');

    // Upload the default image
    console.log('\nUploading default image to Walrus...');
    const imageUrl = await walrusStorage.uploadImage(defaultImagePath);

    console.log('\n✅ Upload successful!');
    console.log('Image URL:', imageUrl);

    // Display formatted response for easy copy/paste into NFT metadata
    console.log('\nJSON metadata format for your NFT:');
    console.log(JSON.stringify({
      name: "Todo NFT",
      description: "A decentralized todo item",
      image_url: imageUrl
    }, null, 2));

    return imageUrl;
  } catch (error) {
    console.error('\n❌ Operation failed:', error);

    // Provide helpful error messages based on error type
    if (error instanceof Error) {
      const errorMsg = error.message;

      if (errorMsg.includes('No active Sui address')) {
        console.error('\nTo set an active address, run:');
        console.error('sui client switch --address <YOUR_ADDRESS>');
      }

      if (errorMsg.includes('insufficient balance') || errorMsg.includes('WAL')) {
        console.error('\nYou need WAL tokens in your active address for this operation.');
        console.error('You can get WAL tokens from the Walrus faucet or Discord.');
      }

      if (errorMsg.includes('network') || errorMsg.includes('connection')) {
        console.error('\nCheck your internet connection and try again.');
        console.error('Make sure Sui testnet is accessible.');
      }
    }

    return null;
  }
}

// Execute the script - using real mode which requires WAL tokens
const useMockMode = false; // Using real mode with actual WAL tokens
console.log(`\nStarting default image upload process in ${useMockMode ? 'MOCK' : 'REAL'} mode...`);
uploadDefaultImageToWalrus(useMockMode).then(imageUrl => {
  if (imageUrl) {
    console.log('\n🎉 Process completed successfully!');
    console.log('You can now use this image URL in your NFT metadata.');
  } else {
    console.error('\n❌ Process completed with errors.');
    console.error('Please check the error messages above and try again.');
  }
});
