// Setup for stress test environment
// This file configures Jest environment variables and settings for stress tests

module.exports = async () => {
  // Set environment variables for stress tests
  process.env.JEST_PROJECT = 'stress-tests';
  process.env.NODE_ENV = 'test';
  process.env.STRESS_TEST_MODE = 'true';

  // Configure test timeouts for longer operations
  process.env.JEST_TIMEOUT = '120000';

  // Memory optimization for stress tests
  if (global.gc) {
    global.gc();
  }

  // Single worker mode for stress tests to avoid interference
  process.env.JEST_MAX_WORKERS = '1';

  console.log('💪 Stress test environment configured');
};
