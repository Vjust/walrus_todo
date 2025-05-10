import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * This script uploads the default NFT image to Walrus storage using the 
 * Walrus CLI command directly rather than the SDK.
 */
async function uploadImageWithWalrusCLI() {
  try {
    console.log('🌊 Walrus Image Uploader (CLI Version) 🌊\n');

    // Ensure we're on testnet
    console.log('Checking Sui environment...');
    const envInfo = execSync('sui client active-env').toString().trim();
    
    if (!envInfo.includes('testnet')) {
      console.log('⚠️  Not on testnet. Switching to testnet...');
      try {
        execSync('sui client switch --env testnet');
        console.log('✓ Successfully switched to testnet');
      } catch (error) {
        console.error('❌ Failed to switch to testnet:', error);
        return null;
      }
    } else {
      console.log('✓ Already on testnet');
    }

    // Verify image path
    const imagePath = path.join(__dirname, 'assets/todo_bottle.jpeg');
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Error: Default image not found at ${imagePath}`);
      console.error('Please ensure the image exists before running this script.');
      return null;
    }
    console.log(`✓ Default image found at ${imagePath}`);

    // Get active address
    const activeAddress = execSync('sui client active-address').toString().trim();
    console.log(`✓ Using active address: ${activeAddress}`);

    // Generate blob ID first (to check if it already exists)
    console.log('Generating blob ID for image...');
    const blobIdOutput = execSync(`walrus blob-id "${imagePath}"`).toString().trim();
    // Extract blob ID from output (assuming format like "Blob ID: XYZ")
    const blobId = blobIdOutput.includes('Blob ID:') 
      ? blobIdOutput.split('Blob ID:')[1].trim()
      : blobIdOutput.trim();
    
    console.log(`✓ Generated blob ID: ${blobId}`);

    // Check if blob already exists
    console.log('Checking if blob already exists...');
    try {
      const statusOutput = execSync(`walrus blob-status --blob-id ${blobId}`).toString();
      
      if (statusOutput.includes('Available: true')) {
        console.log('✓ Image already exists in Walrus storage');
        // Extract expiry info if available
        if (statusOutput.includes('Expiry epoch:')) {
          const expiryMatch = statusOutput.match(/Expiry epoch: (\d+)/);
          if (expiryMatch) {
            console.log(`  Will expire at epoch: ${expiryMatch[1]}`);
          }
        }
      } else {
        console.log('✓ Image not yet stored or expired, will upload');
      }
    } catch (error) {
      console.log('✓ Image not yet stored, will upload');
    }

    // Upload the image using walrus CLI
    console.log('\nUploading image to Walrus storage...');
    console.log('This might take a moment...');
    
    // Use 12 epochs (approximately 1 day)
    const epochs = 12;
    console.log(`Using ${epochs} epochs for storage duration`);
    
    // Execute the walrus store command
    // Note: The --epochs parameter is required
    const uploadOutput = execSync(`walrus store "${imagePath}" --epochs ${epochs}`).toString().trim();
    console.log('Upload command completed');
    
    // Parse the upload output to extract blob ID and object ID
    console.log('\nParsing upload results...');
    let extractedBlobId = '';
    let objectId = '';
    
    if (uploadOutput.includes('Blob ID:')) {
      const blobIdMatch = uploadOutput.match(/Blob ID: ([a-zA-Z0-9\-_]+)/);
      if (blobIdMatch) {
        extractedBlobId = blobIdMatch[1];
        console.log(`Blob ID: ${extractedBlobId}`);
      }
    }
    
    if (uploadOutput.includes('Object ID:')) {
      const objectIdMatch = uploadOutput.match(/Object ID: (0x[a-fA-F0-9]+)/);
      if (objectIdMatch) {
        objectId = objectIdMatch[1];
        console.log(`Object ID: ${objectId}`);
      }
    }

    // Use the blob ID from upload or the pre-generated one
    const finalBlobId = extractedBlobId || blobId;
    
    // Construct the IPFS gateway URL
    const imageUrl = `https://wal.app/blob/${finalBlobId}`;
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
    
    if (error instanceof Error) {
      const errorMsg = error.message;
      
      if (errorMsg.includes('walrus: command not found')) {
        console.error('\nWalrus CLI is not installed or not in your PATH.');
        console.error('Please install the Walrus CLI by following the instructions at:');
        console.error('https://docs.wal.app/usage/setup.html');
      }
      
      if (errorMsg.includes('No active address')) {
        console.error('\nTo set an active address, run:');
        console.error('sui client switch --address <YOUR_ADDRESS>');
      }
      
      if (errorMsg.includes('insufficient balance') || errorMsg.includes('WAL')) {
        console.error('\nYou need WAL tokens in your active address for this operation.');
        console.error('You can get WAL tokens by running: walrus get-wal');
      }
    }
    
    return null;
  }
}

// Execute the script
console.log('\nStarting image upload process using Walrus CLI...');
uploadImageWithWalrusCLI().then(imageUrl => {
  if (imageUrl) {
    console.log('\n🎉 Process completed successfully!');
    console.log('You can now use this image URL in your NFT metadata.');
  } else {
    console.error('\n❌ Process completed with errors.');
    console.error('Please check the error messages above and try again.');
  }
});
