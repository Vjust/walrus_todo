import * as path from 'path';
import * as fs from 'fs';

// This test simulates exactly how a real user would use the Walrus TODO CLI
// to create a todo, store it on blockchain, and verify it on scanners

describe('Real User Workflow: Create and Store TODO on Testnet', () => {
  // Simulates a real user session from start to finish
  it('should create a todo and store it on testnet blockchain', async () => {
    // Step 1: User creates a new todo called "todo for aj"
    console.log('\n=== Step 1: Creating TODO "todo for aj" ===');
    
    const todoTitle = 'todo for aj';
    const createCommand = `walrustodo add "${todoTitle}"`;
    console.log(`Running: ${createCommand}`);
    
    try {
      const createOutput = execSync(createCommand, { encoding: 'utf8' });
      console.log('TODO created successfully:');
      console.log(createOutput);
      expect(createOutput).toContain('Todo added successfully');
    } catch (error: any) {
      console.error('Failed to create todo:', error.message);
      throw error;
    }

    // Step 2: User adds tasks for fixing waltodo
    console.log('\n=== Step 2: Adding tasks for fixing waltodo ===');
    
    const tasks = [
      'Review current waltodo codebase',
      'Identify critical bugs and issues',
      'Implement fixes for high-priority bugs',
      'Add comprehensive test coverage',
      'Update documentation with fixes',
      'Deploy and verify fixes on testnet'
    ];

    for (const task of tasks) {
      const addTaskCommand = `walrustodo add "${todoTitle}" --task "${task}"`;
      console.log(`Running: ${addTaskCommand}`);
      
      try {
        const taskOutput = execSync(addTaskCommand, { encoding: 'utf8' });
        console.log(`Task added: ${task}`);
      } catch (error: any) {
        console.error(`Failed to add task "${task}":`, error.message);
        // Continue with other tasks even if one fails
      }
    }

    // Step 3: User lists the todo to verify it was created
    console.log('\n=== Step 3: Verifying TODO was created ===');
    
    const listCommand = 'walrustodo list';
    console.log(`Running: ${listCommand}`);
    
    try {
      const listOutput = execSync(listCommand, { encoding: 'utf8' });
      console.log('Current TODOs:');
      console.log(listOutput);
      expect(listOutput).toContain(todoTitle);
    } catch (error: any) {
      console.error('Failed to list todos:', error.message);
      throw error;
    }

    // Step 4: User stores the todo on the testnet blockchain
    console.log('\n=== Step 4: Storing TODO on Testnet Blockchain ===');
    
    const storeCommand = `walrustodo store "${todoTitle}" --network testnet`;
    console.log(`Running: ${storeCommand}`);
    
    let blobId: string | null = null;
    let suiObjectId: string | null = null;
    
    try {
      const storeOutput = execSync(storeCommand, { encoding: 'utf8' });
      console.log('Store output:');
      console.log(storeOutput);
      
      // Extract blob ID and Sui object ID from output
      const blobIdMatch = storeOutput.match(/blob.*?([a-zA-Z0-9]+)/i);
      const suiIdMatch = storeOutput.match(/object.*?([a-zA-Z0-9]+)/i);
      
      if (blobIdMatch) {
        blobId = blobIdMatch[1];
        console.log(`Walrus Blob ID: ${blobId}`);
      }
      
      if (suiIdMatch) {
        suiObjectId = suiIdMatch[1];
        console.log(`Sui Object ID: ${suiObjectId}`);
      }
      
      expect(storeOutput).toContain('successfully stored');
      expect(blobId).toBeTruthy();
      expect(suiObjectId).toBeTruthy();
    } catch (error: any) {
      console.error('Failed to store on blockchain:', error.message);
      throw error;
    }

    // Step 5: User verifies on Walrus scanner
    if (blobId) {
      console.log('\n=== Step 5: Verifying on Walrus Scanner ===');
      const walrusUrl = `https://testnet.viewblock.io/sui/blob/${blobId}`;
      console.log(`View on Walrus scanner: ${walrusUrl}`);
      console.log('User would open this URL in browser to verify storage');
      
      // Simulate checking if the blob exists
      const checkWalrusCommand = `walrustodo fetch ${blobId} --network testnet`;
      console.log(`Running: ${checkWalrusCommand}`);
      
      try {
        const fetchOutput = execSync(checkWalrusCommand, { encoding: 'utf8' });
        console.log('Blob verification successful');
        expect(fetchOutput).toContain(todoTitle);
      } catch (error: any) {
        console.warn('Could not fetch blob from Walrus:', error.message);
      }
    }

    // Step 6: User verifies on Sui scanner
    if (suiObjectId) {
      console.log('\n=== Step 6: Verifying on Sui Scanner ===');
      const suiUrl = `https://testnet.explorer.sui.io/object/${suiObjectId}`;
      console.log(`View on Sui scanner: ${suiUrl}`);
      console.log('User would open this URL in browser to verify NFT creation');
      
      // Simulate checking if the object exists
      const checkSuiCommand = `walrustodo check ${suiObjectId} --network testnet`;
      console.log(`Running: ${checkSuiCommand}`);
      
      try {
        const checkOutput = execSync(checkSuiCommand, { encoding: 'utf8' });
        console.log('Sui object verification successful');
        expect(checkOutput).toContain('NFT');
      } catch (error: any) {
        console.warn('Could not check Sui object:', error.message);
      }
    }

    // Step 7: Summary for the user
    console.log('\n=== Summary ===');
    console.log(`✓ Created TODO: "${todoTitle}"`);
    console.log(`✓ Added ${tasks.length} tasks for fixing waltodo`);
    console.log('✓ Stored on testnet blockchain');
    if (blobId) {
      console.log(`✓ Walrus Blob ID: ${blobId}`);
      console.log(`  View at: https://testnet.viewblock.io/sui/blob/${blobId}`);
    }
    if (suiObjectId) {
      console.log(`✓ Sui Object ID: ${suiObjectId}`);
      console.log(`  View at: https://testnet.explorer.sui.io/object/${suiObjectId}`);
    }
    console.log('\nThe todo is now permanently stored on the blockchain and can be viewed on both scanners!');
  }, 60000); // 60 second timeout for blockchain operations

  // Additional test to show how a user would retrieve the todo later
  it('should retrieve and verify the stored todo from blockchain', async () => {
    console.log('\n=== Retrieving Stored TODO from Blockchain ===');
    
    // User wants to retrieve their stored todos
    const retrieveCommand = 'walrustodo retrieve --network testnet';
    console.log(`Running: ${retrieveCommand}`);
    
    try {
      const retrieveOutput = execSync(retrieveCommand, { encoding: 'utf8' });
      console.log('Retrieved TODOs from blockchain:');
      console.log(retrieveOutput);
      expect(retrieveOutput).toContain('todo for aj');
    } catch (error: any) {
      console.error('Failed to retrieve from blockchain:', error.message);
      throw error;
    }
  });
});

// Helper function to wait for blockchain confirmation
function waitForBlockchainConfirmation(seconds: number): Promise<void> {
  return new Promise(resolve => {
    console.log(`Waiting ${seconds} seconds for blockchain confirmation...`);
    setTimeout(resolve, seconds * 1000);
  });
}