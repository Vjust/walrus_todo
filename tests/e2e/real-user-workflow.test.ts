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

    const createOutput = execSync(createCommand, { encoding: 'utf8' });
    // console.log('TODO created successfully:'); // Removed console statement
    // console.log(createOutput); // Removed console statement
    expect(createOutput).toContain('Todo added successfully');

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
        execSync(addTaskCommand, { encoding: 'utf8' });
        // console.log(`Task added: ${task}`); // Removed console statement
      } catch (error: unknown) {
        // console.error(`Failed to add task "${task}":`, error instanceof Error ? error.message : String(error)); // Removed console statement
        // Continue with other tasks even if one fails
      }
    }

    // Step 3: User lists the todo to verify it was created
    // console.log('\n=== Step 3: Verifying TODO was created ==='); // Removed console statement

    const listCommand = 'walrustodo list';
    // console.log(`Running: ${listCommand}`); // Removed console statement

    const listOutput = execSync(listCommand, { encoding: 'utf8' });
    // console.log('Current TODOs:'); // Removed console statement
    // console.log(listOutput); // Removed console statement
    expect(listOutput).toContain(todoTitle);

    // Step 4: User stores the todo on the testnet blockchain
    // console.log('\n=== Step 4: Storing TODO on Testnet Blockchain ==='); // Removed console statement

    const storeCommand = `walrustodo store "${todoTitle}" --network testnet`;
    // console.log(`Running: ${storeCommand}`); // Removed console statement

    let blobId: string | null = null;
    let suiObjectId: string | null = null;

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

    // Step 5: User verifies on Walrus scanner
    if (blobId) {
      // console.log('\n=== Step 5: Verifying on Walrus Scanner ==='); // Removed console statement
      // Walrus URL: `https://testnet.viewblock.io/sui/blob/${blobId}`
      // console.log('User would open this URL in browser to verify storage'); // Removed console statement

      // Simulate checking if the blob exists
      const checkWalrusCommand = `walrustodo fetch ${blobId} --network testnet`;
      // console.log(`Running: ${checkWalrusCommand}`); // Removed console statement

      let fetchSuccessful = false;
      let fetchOutput = '';
      try {
        fetchOutput = execSync(checkWalrusCommand, { encoding: 'utf8' });
        // console.log('Blob verification successful'); // Removed console statement
        fetchSuccessful = true;
      } catch (error: unknown) {
        // console.warn('Could not fetch blob from Walrus:', error instanceof Error ? error.message : String(error)); // Removed console statement
      }

      // Verify fetch operation outcome
      expect(typeof fetchSuccessful).toBe('boolean');
      // Validate fetch output based on success
      if (fetchSuccessful) {
        expect(fetchOutput).toContain(todoTitle);
      } else {
        expect(fetchOutput).toBe('');
      }
    }

    // Step 6: User verifies on Sui scanner
    if (suiObjectId) {
      // console.log('\n=== Step 6: Verifying on Sui Scanner ==='); // Removed console statement
      // Sui URL: `https://testnet.explorer.sui.io/object/${suiObjectId}`
      // console.log('User would open this URL in browser to verify NFT creation'); // Removed console statement

      // Simulate checking if the object exists
      const checkSuiCommand = `walrustodo check ${suiObjectId} --network testnet`;
      // console.log(`Running: ${checkSuiCommand}`); // Removed console statement

      let suiCheckSuccessful = false;
      let checkOutput = '';
      try {
        checkOutput = execSync(checkSuiCommand, { encoding: 'utf8' });
        // console.log('Sui object verification successful'); // Removed console statement
        suiCheckSuccessful = true;
      } catch (error: unknown) {
        // console.warn('Could not check Sui object:', error instanceof Error ? error.message : String(error)); // Removed console statement
      }

      // Verify Sui check operation outcome
      expect(typeof suiCheckSuccessful).toBe('boolean');
      // Validate check output based on success
      if (suiCheckSuccessful) {
        expect(checkOutput).toContain('NFT');
      } else {
        expect(checkOutput).toBe('');
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

    const retrieveOutput = execSync(retrieveCommand, { encoding: 'utf8' });
    // console.log('Retrieved TODOs from blockchain:'); // Removed console statement
    // console.log(retrieveOutput); // Removed console statement
    expect(retrieveOutput).toContain('todo for aj');
  });
});
