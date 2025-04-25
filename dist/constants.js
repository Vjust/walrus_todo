"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLI_CONFIG = exports.PACKAGE_CONFIG = exports.TIME_PERIODS = exports.NETWORK_URLS = exports.SUPPORTED_NETWORKS = void 0;
require("dotenv/config");
exports.SUPPORTED_NETWORKS = ['devnet', 'testnet', 'mainnet'];
exports.NETWORK_URLS = {
    devnet: 'https://fullnode.devnet.sui.io:443',
    testnet: 'https://fullnode.testnet.sui.io:443',
    mainnet: 'https://fullnode.mainnet.sui.io:443',
};
// Time periods in milliseconds
exports.TIME_PERIODS = {
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000,
};
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
