"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORAGE_CONFIG = exports.WALRUS_CONFIG = exports.CLI_CONFIG = exports.PACKAGE_CONFIG = exports.DEFAULT_PACKAGE_CONFIG = exports.DEFAULT_MODULE_NAME = exports.TIME_PERIODS = exports.NETWORK_URLS = exports.CURRENT_NETWORK = exports.DEFAULT_NETWORK = exports.SUPPORTED_NETWORKS = void 0;
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// Define supported networks
exports.SUPPORTED_NETWORKS = ['devnet', 'testnet', 'mainnet', 'localnet'];
// Default to testnet if not specified
exports.DEFAULT_NETWORK = 'testnet';
// Get network from environment variable or use default
exports.CURRENT_NETWORK = process.env.NETWORK || exports.DEFAULT_NETWORK;
// Ensure the network is supported
if (exports.CURRENT_NETWORK && !exports.SUPPORTED_NETWORKS.includes(exports.CURRENT_NETWORK)) {
    console.warn(`Warning: Unsupported network "${exports.CURRENT_NETWORK}". Using ${exports.DEFAULT_NETWORK} instead.`);
}
exports.NETWORK_URLS = {
    devnet: 'https://fullnode.devnet.sui.io:443',
    testnet: 'https://fullnode.testnet.sui.io:443',
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    localnet: 'http://127.0.0.1:9000'
};
// Time periods in milliseconds
exports.TIME_PERIODS = {
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000,
};
// Sui Package Config for smart contract
exports.DEFAULT_MODULE_NAME = 'wal_todo';
exports.DEFAULT_PACKAGE_CONFIG = {
    // Default testnet package ID - this should be updated after contract deployment
    TESTNET_ID: '0x0', // Replace with actual testnet package ID after deployment
    MAINNET_ID: '0x0', // Replace with actual mainnet package ID after deployment
    MODULE: exports.DEFAULT_MODULE_NAME
};
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
    ID: process.env.PACKAGE_ID || '0x...', // Replace with actual package ID after deployment
    MODULE: process.env.MODULE_NAME || exports.DEFAULT_MODULE_NAME,
    FUNCTIONS: {
        CREATE_LIST: 'create_list',
        UPDATE_VERSION: 'update_version',
        ADD_COLLABORATOR: 'add_collaborator',
        REMOVE_COLLABORATOR: 'remove_collaborator'
    }
};
// CLI specific constants
exports.CLI_CONFIG = {
    APP_NAME: 'waltodo',
    CONFIG_FILE: '.waltodo.json',
    VERSION: '1.0.0',
    DEFAULT_LIST: 'default'
};
// Walrus configuration
exports.WALRUS_CONFIG = {
    STORAGE_EPOCHS: 3, // Number of epochs to store data
    MAX_RETRIES: 3, // Maximum number of retries for operations
    RETRY_DELAY: 1000 // Base delay for retry backoff (ms)
};
// Local storage configuration
exports.STORAGE_CONFIG = {
    TODOS_DIR: 'Todos',
    FILE_EXT: '.json'
};
