import { WalrusImageStorage } from '../src/walrus-image-storage';
import * as dotenv from 'dotenv';

async function main() {
    // Load environment variables
    dotenv.config();

    const storage = new WalrusImageStorage();
    
    try {
        console.log('Uploading default todo bottle image to Walrus...');
        const imageUrl = await storage.uploadDefaultImage();
        console.log('Upload successful!');
        console.log('Public URL:', imageUrl);
        
        // Output JSON format for easy copying into NFT metadata
        console.log('\nNFT Metadata format:');
        console.log(JSON.stringify({
            name: "Todo NFT",
            description: "A decentralized todo item",
            image_url: imageUrl
        }, null, 2));
    } catch (error) {
        console.error('Failed to upload image:', error);
        process.exit(1);
    }
}

main();