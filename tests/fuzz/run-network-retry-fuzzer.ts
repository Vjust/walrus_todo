#!/usr/bin/env node

import { Logger } from '../../src/utils/Logger';

const logger = new Logger('run-network-retry-fuzzer');

/**
 * Script to run network retry fuzzer tests
 * Usage: pnpm run test:fuzz:network-retry
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runNetworkRetryFuzzer() {
  logger.info('🌐 Starting Network Retry Fuzzer Tests...\n');

  try {
    const { stdout, stderr } = await execAsync(
      'npx jest tests/fuzz/network-retry-fuzzer.test.ts --verbose',
      {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FORCE_COLOR: '1',
        },
      }
    );

    logger.info(stdout);
    if (stderr) logger.error(stderr);

    logger.info('\n✅ Network Retry Fuzzer Tests Completed Successfully!');
  } catch (_error) {
    logger.error('\n❌ Network Retry Fuzzer Tests Failed:');
    logger.error(error.message);
    process.exit(1);
  }
}

// Run the fuzzer
runNetworkRetryFuzzer();
