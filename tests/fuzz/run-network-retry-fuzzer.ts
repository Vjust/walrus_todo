#!/usr/bin/env node

/**
 * Script to run network retry fuzzer tests
 * Usage: pnpm run test:fuzz:network-retry
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runNetworkRetryFuzzer() {
  console.log('🌐 Starting Network Retry Fuzzer Tests...\n');
  
  try {
    const { stdout, stderr } = await execAsync(
      'npx jest tests/fuzz/network-retry-fuzzer.test.ts --verbose',
      {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FORCE_COLOR: '1'
        }
      }
    );
    
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log('\n✅ Network Retry Fuzzer Tests Completed Successfully!');
  } catch (_error) {
    console.error('\n❌ Network Retry Fuzzer Tests Failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the fuzzer
runNetworkRetryFuzzer();