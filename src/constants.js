"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENT_NETWORK = exports.TODO_NFT_CONFIG = exports.WALRUS_CONFIG = exports.NETWORK_URLS = exports.STORAGE_CONFIG = exports.CLI_CONFIG = void 0;
exports.CLI_CONFIG = {
    APP_NAME: 'waltodo',
    CONFIG_FILE: '.waltodo.json',
    VERSION: '1.0.0',
    DEFAULT_LIST: 'default'
};
exports.STORAGE_CONFIG = {
    TODOS_DIR: 'todos',
    FILE_EXT: '.json'
};
exports.NETWORK_URLS = {
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    testnet: 'https://fullnode.testnet.sui.io:443',
    devnet: 'https://fullnode.devnet.sui.io:443',
    local: 'http://127.0.0.1:9000'
};
exports.WALRUS_CONFIG = {
    DEFAULT_IMAGE: 'QmeYxwj4CwYbQGAZqGLENhDmxGGWnYwKkBaZvxDFAEGPVR',
    API_PREFIX: 'https://api.walrus.tech/1.0'
};
exports.TODO_NFT_CONFIG = {
    PACKAGE_NAME: 'TodoNFT',
    MODULE_NAME: 'todo_nft',
    MODULE_ADDRESS: '0x25a04efc88188231b2f9eb35310a5025c293c4211d2482fd24fe2c8e2dbc9f74', // Deployed to testnet on 2025-05-03 with correct Walrus aggregator URL
    STRUCT_NAME: 'TodoNFT'
};
exports.CURRENT_NETWORK = 'testnet';
