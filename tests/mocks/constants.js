// Jest is available globally in the test environment

// Mock CLI_CONFIG
const CLI_CONFIG = {
  APP_NAME: 'test-app',
  VERSION: '1.0.0',
  CONFIG_DIR: '.test-config',
  CACHE_DIR: '.test-cache',
};

module.exports = {
  CLI_CONFIG,
  default: CLI_CONFIG,
};