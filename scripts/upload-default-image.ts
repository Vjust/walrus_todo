import { createWalrusImageStorage } from '../src/utils/walrus-image-storage';
import { SuiClient } from '@mysten/sui/client';
import { execSync } from 'child_process';
import { NETWORK_URLS } from '../src/constants';
import { CLIError } from '../src/types/error';
import chalk from 'chalk';

async function main(): Promise<void> {
    try {
        // Get active environment info
        const envInfo = execSync('sui client active-env').toString().trim();
        const network = envInfo.includes('testnet') ? 'testnet' 
                     : envInfo.includes('mainnet') ? 'mainnet'
                     : envInfo.includes('devnet') ? 'devnet'
                     : 'local';
        
        // Check for testnet
        if (network !== 'testnet') {
            console.error(chalk.yellow('\n⚠️  Warning: Please switch to testnet:'));
            console.error(chalk.dim('  Run: sui client switch --env testnet'));
            process.exit(1);
        }

        // Switch to testnet
        execSync('sui client switch --env testnet');
        
        // Initialize SuiClient using testnet URL
        const suiClient = new SuiClient({
            url: NETWORK_URLS.testnet
        });
        
        // Create WalrusImageStorage instance
        const storage = createWalrusImageStorage(suiClient);
        
        // Connect (this will also verify we're on testnet)
        await storage.connect();
        
        console.log(chalk.blue('\nUploading default todo bottle image to Walrus...'));
        const imageUrl = await storage.uploadDefaultImage();
        console.log(chalk.green('\n✓ Upload successful!'));
        console.log(chalk.dim('Public URL:'), imageUrl);
        
        // Output JSON format for easy copying into NFT metadata
        console.log(chalk.dim('\nNFT Metadata format:'));
        console.log(JSON.stringify({
            name: "Todo NFT",
            description: "A decentralized todo item",
            image_url: imageUrl
        }, null, 2));

    } catch (error: unknown) {
        if (error instanceof CLIError) {
            // Handle specific error cases
            switch(error.code) {
                case 'NO_WAL_TOKENS':
                    console.error(chalk.red('\n❌ Error: No WAL tokens found'));
                    console.error(chalk.dim('You need WAL tokens to upload to Walrus storage.'));
                    console.error(chalk.dim('Please obtain WAL tokens before proceeding.'));
                    break;
                case 'WRONG_NETWORK':
                    console.error(chalk.red('\n❌ Error: Wrong network'));
                    console.error(chalk.dim('Please make sure you are connected to the testnet:'));
                    console.error(chalk.dim('  Run: sui client switch --env testnet'));
                    break;
                default:
                    console.error(chalk.red('\n❌ Error:'), error.message);
            }
        } else if (error instanceof Error) {
            console.error(chalk.red('\n❌ Error:'), error.message);
        } else {
            console.error(chalk.red('\n❌ An unknown error occurred during image upload'));
        }
        process.exit(1);
    }
}

main();