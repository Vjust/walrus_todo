/* eslint-disable no-console */
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../src/utils/Logger';

const logger = new Logger('upload-with-cli');

/**
 * This script uploads the default NFT image to Walrus storage using the
 * Walrus CLI command directly rather than the SDK.
 */
async function uploadImageWithWalrusCLI() {
  try {
    logger.info('🌊 Walrus Image Uploader (CLI Version) 🌊\n');

    // Ensure we're on testnet
    logger.info('Checking Sui environment...');
    const envInfo = execSync('sui client active-env').toString().trim();

    if (!envInfo.includes('testnet')) {
      logger.info('⚠️  Not on testnet. Switching to testnet...');
      try {
        execSync('sui client switch --env testnet');
        logger.info('✓ Successfully switched to testnet');
      } catch (error) {
        logger.error(`❌ Failed to switch to testnet: ${error}`);
        return null;
      }
    } else {
      logger.info('✓ Already on testnet');
    }

    // Verify image path
    const imagePath = path.join(__dirname, 'assets/todo_bottle.jpeg');
    if (!fs.existsSync(imagePath)) {
      logger.error(`❌ Error: Default image not found at ${imagePath}`);
      logger.error(
        'Please ensure the image exists before running this script.'
      );
      return null;
    }
    logger.info(`✓ Default image found at ${imagePath}`);

    // Get active address
    const activeAddress = execSync('sui client active-address')
      .toString()
      .trim();
    logger.info(`✓ Using active address: ${activeAddress}`);

    // Generate blob ID first (to check if it already exists)
    logger.info('Generating blob ID for image...');
    const blobIdOutput = execSync(`walrus blob-id "${imagePath}"`)
      .toString()
      .trim();
    // Extract blob ID from output (assuming format like "Blob ID: XYZ")
    const blobId = blobIdOutput.includes('Blob ID:')
      ? blobIdOutput.split('Blob ID:')[1]?.trim() || ''
      : blobIdOutput.trim();

    logger.info(`✓ Generated blob ID: ${blobId}`);

    // Check if blob already exists
    logger.info('Checking if blob already exists...');
    try {
      const statusOutput = execSync(
        `walrus blob-status --blob-id ${blobId}`
      ).toString();

      if (statusOutput.includes('Available: true')) {
        logger.info('✓ Image already exists in Walrus storage');
        // Extract expiry info if available
        if (statusOutput.includes('Expiry epoch:')) {
          const expiryMatch = statusOutput.match(/Expiry epoch: (\d+)/);
          if (expiryMatch) {
            logger.info(`  Will expire at epoch: ${expiryMatch[1]}`);
          }
        }
      } else {
        logger.info('✓ Image not yet stored or expired, will upload');
      }
    } catch (error) {
      logger.info('✓ Image not yet stored, will upload');
    }

    // Upload the image using walrus CLI
    logger.info('\nUploading image to Walrus storage...');
    logger.info('This might take a moment...');

    // Use 12 epochs (approximately 1 day)
    const epochs = 12;
    logger.info(`Using ${epochs} epochs for storage duration`);

    // Execute the walrus store command
    // Note: The --epochs parameter is required
    const uploadOutput = execSync(
      `walrus store "${imagePath}" --epochs ${epochs}`
    )
      .toString()
      .trim();
    logger.info('Upload command completed');

    // Parse the upload output to extract blob ID and object ID
    logger.info('\nParsing upload results...');
    let extractedBlobId = '';
    let objectId = '';

    if (uploadOutput.includes('Blob ID:')) {
      const blobIdMatch = uploadOutput.match(/Blob ID: ([a-zA-Z0-9\-_]+)/);
      if (blobIdMatch) {
        extractedBlobId = blobIdMatch[1] ?? '';
        logger.info(`Blob ID: ${extractedBlobId}`);
      }
    }

    if (uploadOutput.includes('Object ID:')) {
      const objectIdMatch = uploadOutput.match(/Object ID: (0x[a-fA-F0-9]+)/);
      if (objectIdMatch) {
        objectId = objectIdMatch[1] ?? '';
        logger.info(`Object ID: ${objectId}`);
      }
    }

    // Use the blob ID from upload or the pre-generated one
    const finalBlobId = extractedBlobId || blobId;

    // Construct the IPFS gateway URL
    const imageUrl = `https://wal.app/blob/${finalBlobId}`;
    logger.info('\n✅ Upload successful!');
    logger.info(`Image URL: ${imageUrl}`);

    // Display formatted response for easy copy/paste into NFT metadata
    logger.info('\nJSON metadata format for your NFT:');
    logger.info(
      JSON.stringify(
        {
          name: 'Todo NFT',
          description: 'A decentralized todo item',
          image_url: imageUrl,
        },
        null,
        2
      )
    );

    return imageUrl;
  } catch (error) {
    logger.error(`\n❌ Operation failed: ${error}`);

    if (error instanceof Error) {
      const errorMsg = error.message;

      if (errorMsg.includes('walrus: command not found')) {
        logger.error('\nWalrus CLI is not installed or not in your PATH.');
        logger.error(
          'Please install the Walrus CLI by following the instructions at:'
        );
        logger.error('https://docs.wal.app/usage/setup.html');
      }

      if (errorMsg.includes('No active address')) {
        logger.error('\nTo set an active address, run:');
        logger.error('sui client switch --address <YOUR_ADDRESS>');
      }

      if (
        errorMsg.includes('insufficient balance') ||
        errorMsg.includes('WAL')
      ) {
        logger.error(
          '\nYou need WAL tokens in your active address for this operation.'
        );
        logger.error('You can get WAL tokens by running: walrus get-wal');
      }
    }

    return null;
  }
}

// Execute the script
logger.info('\nStarting image upload process using Walrus CLI...');
uploadImageWithWalrusCLI().then(imageUrl => {
  if (imageUrl) {
    logger.info('\n🎉 Process completed successfully!');
    logger.info('You can now use this image URL in your NFT metadata.');
  } else {
    logger.error('\n❌ Process completed with errors.');
    logger.error('Please check the error messages above and try again.');
  }
});
