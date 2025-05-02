#!/usr/bin/env node

const { execSync } = require('child_process');

function listAllObjects() {
  try {
    // Get active address from Sui CLI
    const activeAddressOutput = execSync('sui client active-address', { encoding: 'utf8' });
    const address = activeAddressOutput.trim();
    if (!address) throw new Error('No active address found');
    console.log(`Using active Sui address: ${address}`);

    // Get all objects using sui CLI
    const objectsOutput = execSync('sui client objects', { encoding: 'utf8' });
    console.log('\nObjects in wallet:');
    console.log('===============================');
    console.log(objectsOutput);

    // For each object, get its details
    const objectIds = objectsOutput.match(/0x[a-fA-F0-9]+/g) || [];
    for (const id of objectIds) {
      try {
        const objectDetails = execSync(`sui client object ${id}`, { encoding: 'utf8' });
        console.log(`\nDetails for object ${id}:`);
        console.log('-------------------------------');
        console.log(objectDetails);
      } catch (error) {
        console.warn(`Could not get details for object ${id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

listAllObjects();