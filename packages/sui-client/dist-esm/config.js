/**
 * Configuration management for Sui client
 * Handles dynamic configuration loading for both browser and Node.js environments
 * Uses @waltodo/config-loader for dynamic configuration loading
 */
import { getFullnodeUrl } from '@mysten/sui/client';
import { NetworkError } from './types';
// Import config-loader for dynamic configuration loading
let configLoader = null;
try {
    configLoader = require('@waltodo/config-loader');
}
catch (error) {
    console.debug('[SuiClient] @waltodo/config-loader not available, using fallback configurations');
}
// Configuration cache
let cachedConfig = null;
let currentNetwork = null;
/**
 * Fallback network URLs
 */
const NETWORK_URLS = {
    mainnet: getFullnodeUrl('mainnet'),
    testnet: getFullnodeUrl('testnet'),
    devnet: getFullnodeUrl('devnet'),
    localnet: 'http://127.0.0.1:9000',
};
/**
 * Fallback configurations when auto-generated configs are not available
 */
const FALLBACK_CONFIGS = {
    testnet: {
        network: {
            name: 'testnet',
            url: NETWORK_URLS.testnet,
            faucetUrl: 'https://faucet.testnet.sui.io',
            explorerUrl: 'https://testnet.suiexplorer.com',
        },
        walrus: {
            networkUrl: 'https://wal.testnet.sui.io',
            publisherUrl: 'https://publisher-testnet.walrus.space',
            aggregatorUrl: 'https://aggregator-testnet.walrus.space',
            apiPrefix: 'https://api-testnet.walrus.tech/1.0',
        },
        deployment: {
            packageId: '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b',
            digest: 'unknown',
            timestamp: new Date().toISOString(),
            deployerAddress: '0x0',
        },
        contracts: {
            todoNft: {
                packageId: '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b',
                moduleName: 'todo_nft',
                structName: 'TodoNFT',
            },
        },
        features: {
            aiEnabled: true,
            blockchainVerification: false,
            encryptedStorage: false,
        },
    },
    devnet: {
        network: {
            name: 'devnet',
            url: NETWORK_URLS.devnet,
            faucetUrl: 'https://faucet.devnet.sui.io',
            explorerUrl: 'https://devnet.suiexplorer.com',
        },
        walrus: {
            networkUrl: 'https://wal.devnet.sui.io',
            publisherUrl: 'https://publisher-devnet.walrus.space',
            aggregatorUrl: 'https://aggregator-devnet.walrus.space',
            apiPrefix: 'https://api-devnet.walrus.tech/1.0',
        },
        deployment: {
            packageId: '0x0',
            digest: 'unknown',
            timestamp: new Date().toISOString(),
            deployerAddress: '0x0',
        },
        contracts: {
            todoNft: {
                packageId: '0x0',
                moduleName: 'todo_nft',
                structName: 'TodoNFT',
            },
        },
        features: {
            aiEnabled: true,
            blockchainVerification: false,
            encryptedStorage: false,
        },
    },
    mainnet: {
        network: {
            name: 'mainnet',
            url: NETWORK_URLS.mainnet,
            explorerUrl: 'https://suiexplorer.com',
        },
        walrus: {
            networkUrl: 'https://wal.mainnet.sui.io',
            publisherUrl: 'https://publisher.walrus.space',
            aggregatorUrl: 'https://aggregator.walrus.space',
            apiPrefix: 'https://api.walrus.tech/1.0',
        },
        deployment: {
            packageId: '0x0',
            digest: 'unknown',
            timestamp: new Date().toISOString(),
            deployerAddress: '0x0',
        },
        contracts: {
            todoNft: {
                packageId: '0x0',
                moduleName: 'todo_nft',
                structName: 'TodoNFT',
            },
        },
        features: {
            aiEnabled: true,
            blockchainVerification: false,
            encryptedStorage: false,
        },
    },
    localnet: {
        network: {
            name: 'localnet',
            url: NETWORK_URLS.localnet,
            explorerUrl: 'http://localhost:9001',
        },
        walrus: {
            networkUrl: 'http://localhost:31415',
            publisherUrl: 'http://localhost:31416',
            aggregatorUrl: 'http://localhost:31417',
            apiPrefix: 'http://localhost:31418/1.0',
        },
        deployment: {
            packageId: '0x0',
            digest: 'unknown',
            timestamp: new Date().toISOString(),
            deployerAddress: '0x0',
        },
        contracts: {
            todoNft: {
                packageId: '0x0',
                moduleName: 'todo_nft',
                structName: 'TodoNFT',
            },
        },
        features: {
            aiEnabled: true,
            blockchainVerification: false,
            encryptedStorage: false,
        },
    },
};
/**
 * Detects the current environment (browser vs Node.js)
 */
function isBrowserEnvironment() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}
/**
 * Gets the current network from environment variables
 */
function getCurrentNetwork() {
    if (isBrowserEnvironment()) {
        // Browser environment - try to get from window object or default
        return window?.NEXT_PUBLIC_NETWORK ||
            process.env.NEXT_PUBLIC_NETWORK ||
            'testnet';
    }
    else {
        // Node.js environment
        return process.env.SUI_NETWORK ||
            process.env.NEXT_PUBLIC_NETWORK ||
            'testnet';
    }
}
/**
 * Loads configuration from auto-generated files (browser only)
 */
async function loadGeneratedConfig(network) {
    if (!isBrowserEnvironment()) {
        return null; // Skip in Node.js environment
    }
    try {
        const configResponse = await fetch(`/config/${network}.json`);
        if (configResponse.ok) {
            const config = await configResponse.json();
            console.log(`[SuiClient] Loaded generated configuration for ${network}`);
            return config;
        }
    }
    catch (error) {
        console.warn(`[SuiClient] Failed to load generated config for ${network}:`, error);
    }
    return null;
}
/**
 * Loads configuration from CLI config files (Node.js only)
 */
async function loadCliConfig(network) {
    if (isBrowserEnvironment()) {
        return null; // Skip in browser environment
    }
    try {
        // Try to load from different possible locations
        const configPaths = [
            `./config/${network}.json`,
            `../config/${network}.json`,
            `../../config/${network}.json`,
            `./.waltodo-cache/config/${network}.json`,
        ];
        // Use dynamic import for Node.js file system operations
        const { readFileSync, existsSync } = await import('fs');
        const { resolve } = await import('path');
        for (const configPath of configPaths) {
            const fullPath = resolve(configPath);
            if (existsSync(fullPath)) {
                const configData = readFileSync(fullPath, 'utf-8');
                const config = JSON.parse(configData);
                console.log(`[SuiClient] Loaded CLI configuration from ${fullPath}`);
                return config;
            }
        }
    }
    catch (error) {
        console.warn(`[SuiClient] Failed to load CLI config for ${network}:`, error);
    }
    return null;
}
/**
 * Creates a complete configuration from fallback data
 */
function createFallbackConfig(network) {
    const fallback = FALLBACK_CONFIGS[network];
    if (!fallback) {
        throw new NetworkError(`No configuration available for network: ${network}`, network);
    }
    console.warn(`[SuiClient] Using fallback configuration for ${network} - run 'waltodo deploy' to generate proper config`);
    return fallback;
}
/**
 * Transform config-loader format to sui-client format
 */
function transformConfigLoaderConfig(configLoaderResult) {
    // Handle different possible structures from config-loader
    const config = configLoaderResult.config || configLoaderResult;
    return {
        network: {
            name: config.network?.name || config.network || 'testnet',
            url: config.network?.url || config.rpcUrl || getNetworkUrl(config.network || 'testnet'),
            faucetUrl: config.network?.faucetUrl,
            explorerUrl: config.network?.explorerUrl || getDefaultExplorerUrl(config.network?.name || config.network || 'testnet'),
        },
        walrus: {
            networkUrl: config.walrus?.networkUrl || '',
            publisherUrl: config.walrus?.publisherUrl || '',
            aggregatorUrl: config.walrus?.aggregatorUrl || '',
            apiPrefix: config.walrus?.apiPrefix || '',
        },
        deployment: {
            packageId: config.deployment?.packageId || '0x0',
            digest: config.deployment?.transactionHash || 'unknown',
            timestamp: config.deployment?.timestamp || new Date().toISOString(),
            deployerAddress: config.deployment?.deployerAddress || '0x0',
        },
        contracts: {
            todoNft: {
                packageId: config.contracts?.todoNft?.packageId || config.deployment?.packageId || '0x0',
                moduleName: config.contracts?.todoNft?.moduleName || 'todo_nft',
                structName: config.contracts?.todoNft?.structName || 'TodoNFT',
            },
        },
        features: {
            aiEnabled: config.features?.aiIntegration !== false,
            blockchainVerification: config.features?.blockchainVerification || false,
            encryptedStorage: config.features?.encryptedStorage || false,
        },
    };
}
/**
 * Get default explorer URL for a network
 */
function getDefaultExplorerUrl(network) {
    switch (network) {
        case 'mainnet':
            return 'https://suiexplorer.com';
        case 'testnet':
            return 'https://testnet.suiexplorer.com';
        case 'devnet':
            return 'https://devnet.suiexplorer.com';
        case 'localnet':
            return 'http://localhost:9001';
        default:
            return 'https://testnet.suiexplorer.com';
    }
}
/**
 * Loads the application configuration for the current network
 * Uses @waltodo/config-loader when available, falls back to built-in configurations
 */
export async function loadAppConfig(networkOverride) {
    const network = networkOverride || getCurrentNetwork();
    // Return cached config if network hasn't changed
    if (cachedConfig && currentNetwork === network) {
        return cachedConfig;
    }
    console.log(`[SuiClient] Loading configuration for ${network} network`);
    let config = null;
    // Try to use config-loader first
    if (configLoader) {
        try {
            const loadResult = await configLoader.loadNetworkConfig(network, {
                enableCache: true,
                fallbackToLocalnet: false,
            });
            if (loadResult && loadResult.config) {
                config = transformConfigLoaderConfig(loadResult.config);
                console.log(`[SuiClient] Loaded configuration from config-loader (${loadResult.source})`);
            }
        }
        catch (error) {
            console.warn(`[SuiClient] Failed to load config using config-loader:`, error);
        }
    }
    // Fallback to original loading method if config-loader failed
    if (!config) {
        if (isBrowserEnvironment()) {
            config = await loadGeneratedConfig(network);
        }
        else {
            config = await loadCliConfig(network);
        }
    }
    // Fall back to default configuration if still no config
    if (!config) {
        config = createFallbackConfig(network);
    }
    // Validate configuration
    if (!config.deployment.packageId || config.deployment.packageId === '0x0') {
        console.warn('[SuiClient] Package ID not set - some blockchain features may not work');
    }
    // Cache the configuration
    cachedConfig = config;
    currentNetwork = network;
    return config;
}
/**
 * Gets network configuration for a specific network
 */
export function getNetworkConfig(network) {
    const fallback = FALLBACK_CONFIGS[network];
    if (!fallback?.network) {
        throw new NetworkError(`Unknown network: ${network}`, network);
    }
    return fallback.network;
}
/**
 * Gets the current cached configuration (synchronous)
 */
export function getCachedConfig() {
    return cachedConfig;
}
/**
 * Gets the current network name
 */
export function getNetworkName() {
    return getCurrentNetwork();
}
/**
 * Clears the configuration cache
 */
export function clearConfigCache() {
    cachedConfig = null;
    currentNetwork = null;
}
/**
 * Validates that the configuration has required deployment information
 */
export function isConfigurationComplete(config) {
    return !!(config.deployment.packageId &&
        config.deployment.packageId !== '0x0' &&
        config.deployment.deployerAddress &&
        config.deployment.deployerAddress !== '0x0');
}
/**
 * Gets the explorer URL for a specific object
 */
export function getExplorerUrl(config, objectId) {
    return `${config.network.explorerUrl}/object/${objectId}?network=${config.network.name}`;
}
/**
 * Gets the faucet URL for the current network (if available)
 */
export function getFaucetUrl(config) {
    return config.network.faucetUrl || null;
}
/**
 * Gets the network URL for a specific network type
 */
export function getNetworkUrl(network) {
    return NETWORK_URLS[network];
}
//# sourceMappingURL=config.js.map