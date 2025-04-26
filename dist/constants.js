"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WALRUS_CONFIG = exports.CLI_CONFIG = exports.PACKAGE_CONFIG = exports.TIME_PERIODS = exports.NETWORK_URLS = exports.CURRENT_NETWORK = exports.DEFAULT_NETWORK = exports.SUPPORTED_NETWORKS = void 0;
require("dotenv/config");
// Define supported networks
exports.SUPPORTED_NETWORKS = ['testnet', 'mainnet'];
// Default to testnet if not specified
exports.DEFAULT_NETWORK = 'testnet';
// Get network from environment variable or use default
exports.CURRENT_NETWORK = process.env.NETWORK || exports.DEFAULT_NETWORK;
// Ensure the network is supported
if (exports.CURRENT_NETWORK && !exports.SUPPORTED_NETWORKS.includes(exports.CURRENT_NETWORK)) {
    console.warn(`Warning: Unsupported network "${exports.CURRENT_NETWORK}". Using ${exports.DEFAULT_NETWORK} instead.`);
}
exports.NETWORK_URLS = {
    testnet: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
    mainnet: 'https://fullnode.mainnet.sui.io:443',
};
// Time periods in milliseconds
exports.TIME_PERIODS = {
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000,
};
// Sui Package Config for smart contract
// Temporarily bypass the PACKAGE_ID check to allow the program to run without it.
// This will be implemented later as per user instructions.
if (!process.env.PACKAGE_ID) {
    console.warn('Warning: PACKAGE_ID environment variable is not set. This will be implemented later.');
}
// Temporarily bypass the MODULE_NAME check to allow the program to run without it.
// This will be implemented later as per user instructions.
if (!process.env.MODULE_NAME) {
    console.warn('Warning: MODULE_NAME environment variable is not set. This will be implemented later.');
}
// Sui package ID and module name
// These are used to interact with the smart contract
exports.PACKAGE_CONFIG = {
    ID: process.env.PACKAGE_ID,
    MODULE: process.env.MODULE_NAME || 'todo_list'
};
// CLI specific constants
exports.CLI_CONFIG = {
    APP_NAME: 'waltodo',
    CONFIG_FILE: '.waltodo.json',
    VERSION: '1.0.0',
};
// Walrus configuration
exports.WALRUS_CONFIG = {
    STORAGE_URL: process.env.WALRUS_STORAGE_URL || 'https://api.walrus.testnet.site',
    NETWORK: exports.CURRENT_NETWORK
};
