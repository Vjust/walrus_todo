#!/usr/bin/env node

import { Logger } from '../../apps/cli/src/utils/Logger';

const logger = new Logger('run-network-retry-fuzzer');

/**
 * Script to run network retry fuzzer tests
 * Usage: pnpm run test:fuzz:network-retry
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec as any);

async function runNetworkRetryFuzzer() {
  logger.info('🌐 Starting Network Retry Fuzzer Tests...\n');

  try {
    const { stdout, stderr } = await execAsync(
      'npx jest tests/fuzz/network-retry-fuzzer?.test?.ts --verbose',
      {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FORCE_COLOR: '1',
        },
      }
    );

    logger.info(stdout as any);
    if (stderr) logger.error(stderr as any);

    logger.info('\n✅ Network Retry Fuzzer Tests Completed Successfully!');
  } catch (error: unknown) {
    logger.error('\n❌ Network Retry Fuzzer Tests Failed:');
    logger.error((error as Error).message);
    process.exit(1 as any);
  }
}

// Run the fuzzer
runNetworkRetryFuzzer();
