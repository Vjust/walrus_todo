'use strict';
/**
 * SuiClient Compatibility Adapter
 *
 * This module provides compatibility wrappers for SuiClient import changes
 * between different versions of @mysten/sui library.
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.getFullnodeUrl = exports.SuiClient = void 0;
exports.createCompatibleSuiClient = createCompatibleSuiClient;
exports.isSuiClientAvailable = isSuiClientAvailable;
exports.getCompatibleFullnodeUrl = getCompatibleFullnodeUrl;
const Logger_1 = require('../Logger');
const client_1 = require('@mysten/sui/client');
const logger = new Logger_1.Logger('sui-client-compatibility');
// Export the actual SuiClient and utilities
exports.SuiClient = client_1.SuiClient;
exports.getFullnodeUrl = client_1.getFullnodeUrl;
// Helper function to create a SuiClient with compatibility handling
function createCompatibleSuiClient(options) {
  try {
    return new exports.SuiClient(options);
  } catch (error) {
    logger.error('Failed to create SuiClient:', error);
    throw new Error(
      `Failed to create SuiClient: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
// Helper function to check if SuiClient is available
function isSuiClientAvailable() {
  return typeof exports.SuiClient === 'function';
}
// Helper function to get a fallback URL for SuiClient
function getCompatibleFullnodeUrl(network = 'testnet') {
  const urls = {
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    testnet: 'https://fullnode.testnet.sui.io:443',
    devnet: 'https://fullnode.devnet.sui.io:443',
    localnet: 'http://localhost:9000',
  };
  return urls[network] || urls.testnet;
}
// Default export for convenience
exports.default = {
  SuiClient: exports.SuiClient,
  createCompatibleSuiClient,
  isSuiClientAvailable,
  getCompatibleFullnodeUrl,
};
//# sourceMappingURL=sui-client-compatibility.js.map
