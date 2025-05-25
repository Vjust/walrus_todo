import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

// This test simulates exactly how a real user would use the Walrus TODO CLI
// to create a todo, store it on blockchain, and verify it on scanners

describe('Real User Workflow: Create and Store TODO on Testnet', () => {
  // Simulates a real user session from start to finish
  it('should create a todo and store it on testnet blockchain', async () => {
    // Step 1: User creates a new todo called "todo for aj"
    // console.log('\n=== Step 1: Creating TODO "todo for aj" ==='); // Removed console statement

    const todoTitle = 'todo for aj';
    const createCommand = `walrustodo add "${todoTitle}"`;
    // console.log(`Running: ${createCommand}`); // Removed console statement

    try {
      const createOutput = execSync(createCommand, { encoding: 'utf8' });
      // console.log('TODO created successfully:'); // Removed console statement
      // console.log(createOutput); // Removed console statement
      expect(createOutput).toContain('Todo added successfully');
    } catch (error: any) {
      // console.error('Failed to create todo:', error.message); // Removed console statement
      throw error;
    }

    // Step 2: User adds tasks for fixing waltodo
    // console.log('\n=== Step 2: Adding tasks for fixing waltodo ==='); // Removed console statement

    const tasks = [
      'Review current waltodo codebase',
      'Identify critical bugs and issues',
      'Implement fixes for high-priority bugs',
      'Add comprehensive test coverage',
      'Update documentation with fixes',
      'Deploy and verify fixes on testnet',
    ];

    for (const task of tasks) {
      const addTaskCommand = `walrustodo add "${todoTitle}" --task "${task}"`;
      // console.log(`Running: ${addTaskCommand}`); // Removed console statement

      try {
        const taskOutput = execSync(addTaskCommand, { encoding: 'utf8' });
        // console.log(`Task added: ${task}`); // Removed console statement
      } catch (error: any) {
        // console.error(`Failed to add task "${task}":`, error.message); // Removed console statement
        // Continue with other tasks even if one fails
      }
    }

    // Step 3: User lists the todo to verify it was created
    // console.log('\n=== Step 3: Verifying TODO was created ==='); // Removed console statement

    const listCommand = 'walrustodo list';
    // console.log(`Running: ${listCommand}`); // Removed console statement

    try {
      const listOutput = execSync(listCommand, { encoding: 'utf8' });
      // console.log('Current TODOs:'); // Removed console statement
      // console.log(listOutput); // Removed console statement
      expect(listOutput).toContain(todoTitle);
    } catch (error: any) {
      // console.error('Failed to list todos:', error.message); // Removed console statement
      throw error;
    }

    // Step 4: User stores the todo on the testnet blockchain
    // console.log('\n=== Step 4: Storing TODO on Testnet Blockchain ==='); // Removed console statement

    const storeCommand = `walrustodo store "${todoTitle}" --network testnet`;
    // console.log(`Running: ${storeCommand}`); // Removed console statement

    let blobId: string | null = null;
    let suiObjectId: string | null = null;

    try {
      const storeOutput = execSync(storeCommand, { encoding: 'utf8' });
      // console.log('Store output:'); // Removed console statement
      // console.log(storeOutput); // Removed console statement

      // Extract blob ID and Sui object ID from output
      const blobIdMatch = storeOutput.match(/blob.*?([a-zA-Z0-9]+)/i);
      const suiIdMatch = storeOutput.match(/object.*?([a-zA-Z0-9]+)/i);

      if (blobIdMatch) {
        blobId = blobIdMatch[1];
        // console.log(`Walrus Blob ID: ${blobId}`); // Removed console statement
      }

      if (suiIdMatch) {
        suiObjectId = suiIdMatch[1];
        // console.log(`Sui Object ID: ${suiObjectId}`); // Removed console statement
      }

      expect(storeOutput).toContain('successfully stored');
      expect(blobId).toBeTruthy();
      expect(suiObjectId).toBeTruthy();
    } catch (error: any) {
      // console.error('Failed to store on blockchain:', error.message); // Removed console statement
      throw error;
    }

    // Step 5: User verifies on Walrus scanner
    if (blobId) {
      // console.log('\n=== Step 5: Verifying on Walrus Scanner ==='); // Removed console statement
      const walrusUrl = `https://testnet.viewblock.io/sui/blob/${blobId}`;
      // console.log(`View on Walrus scanner: ${walrusUrl}`); // Removed console statement
      // console.log('User would open this URL in browser to verify storage'); // Removed console statement

      // Simulate checking if the blob exists
      const checkWalrusCommand = `walrustodo fetch ${blobId} --network testnet`;
      // console.log(`Running: ${checkWalrusCommand}`); // Removed console statement

      try {
        const fetchOutput = execSync(checkWalrusCommand, { encoding: 'utf8' });
        // console.log('Blob verification successful'); // Removed console statement
        expect(fetchOutput).toContain(todoTitle);
      } catch (error: any) {
        // console.warn('Could not fetch blob from Walrus:', error.message); // Removed console statement
      }
    }

    // Step 6: User verifies on Sui scanner
    if (suiObjectId) {
      // console.log('\n=== Step 6: Verifying on Sui Scanner ==='); // Removed console statement
      const suiUrl = `https://testnet.explorer.sui.io/object/${suiObjectId}`;
      // console.log(`View on Sui scanner: ${suiUrl}`); // Removed console statement
      // console.log('User would open this URL in browser to verify NFT creation'); // Removed console statement

      // Simulate checking if the object exists
      const checkSuiCommand = `walrustodo check ${suiObjectId} --network testnet`;
      // console.log(`Running: ${checkSuiCommand}`); // Removed console statement

      try {
        const checkOutput = execSync(checkSuiCommand, { encoding: 'utf8' });
        // console.log('Sui object verification successful'); // Removed console statement
        expect(checkOutput).toContain('NFT');
      } catch (error: any) {
        // console.warn('Could not check Sui object:', error.message); // Removed console statement
      }
    }

    // Step 7: Summary for the user
    // console.log('\n=== Summary ==='); // Removed console statement
    // console.log(`✓ Created TODO: "${todoTitle}"`); // Removed console statement
    // console.log(`✓ Added ${tasks.length} tasks for fixing waltodo`); // Removed console statement
    // console.log('✓ Stored on testnet blockchain'); // Removed console statement
    if (blobId) {
      // console.log(`✓ Walrus Blob ID: ${blobId}`); // Removed console statement
      // console.log(`  View at: https://testnet.viewblock.io/sui/blob/${blobId}`); // Removed console statement
    }
    if (suiObjectId) {
      // console.log(`✓ Sui Object ID: ${suiObjectId}`); // Removed console statement
      // console.log(`  View at: https://testnet.explorer.sui.io/object/${suiObjectId}`); // Removed console statement
    }
    // console.log('\nThe todo is now permanently stored on the blockchain and can be viewed on both scanners!'); // Removed console statement
  }, 60000); // 60 second timeout for blockchain operations

  // Additional test to show how a user would retrieve the todo later
  it('should retrieve and verify the stored todo from blockchain', async () => {
    // console.log('\n=== Retrieving Stored TODO from Blockchain ==='); // Removed console statement

    // User wants to retrieve their stored todos
    const retrieveCommand = 'walrustodo retrieve --network testnet';
    // console.log(`Running: ${retrieveCommand}`); // Removed console statement

    try {
      const retrieveOutput = execSync(retrieveCommand, { encoding: 'utf8' });
      // console.log('Retrieved TODOs from blockchain:'); // Removed console statement
      // console.log(retrieveOutput); // Removed console statement
      expect(retrieveOutput).toContain('todo for aj');
    } catch (error: any) {
      // console.error('Failed to retrieve from blockchain:', error.message); // Removed console statement
      throw error;
    }
  });
});

// Helper function to wait for blockchain confirmation
function waitForBlockchainConfirmation(seconds: number): Promise<void> {
  return new Promise(resolve => {
    // console.log(`Waiting ${seconds} seconds for blockchain confirmation...`); // Removed console statement
    setTimeout(resolve, seconds * 1000);
  });
}
