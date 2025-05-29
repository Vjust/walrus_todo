// Setup for fuzz test environment
// This file configures Jest environment variables and settings for fuzz tests

module.exports = async () => {
  // Set environment variables for fuzz tests
  process.env.JEST_PROJECT = 'fuzz-tests';
  process.env.NODE_ENV = 'test';
  process.env.FUZZ_TEST_MODE = 'true';

  // Configure test timeouts
  process.env.JEST_TIMEOUT = '60000';

  // Memory optimization for fuzz tests
  if (global.gc) {
    global.gc();
  }

  console.log('🎯 Fuzz test environment configured');
};
