/**
 * Version compatibility utilities for @mysten/sui and @mysten/dapp-kit
 * Handles different versions and API changes between releases
 */
/**
 * Parse version string into components
 */
export function parseVersion(versionString) {
    const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        throw new Error(`Invalid version string: ${versionString}`);
    }
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        full: versionString,
    };
}
/**
 * Check if version meets minimum requirement
 */
export function isVersionAtLeast(current, required) {
    if (current.major > required.major)
        return true;
    if (current.major < required.major)
        return false;
    if (current.minor > required.minor)
        return true;
    if (current.minor < required.minor)
        return false;
    return current.patch >= required.patch;
}
/**
 * Get version of @mysten/sui package
 */
export function getSuiVersion() {
    try {
        // Try to get version from package.json
        const pkg = require('@mysten/sui/package.json');
        return parseVersion(pkg.version);
    }
    catch (error) {
        console.warn('[SuiClient] Could not determine @mysten/sui version:', error);
        return null;
    }
}
/**
 * Get version of @mysten/dapp-kit package
 */
export function getDappKitVersion() {
    try {
        const pkg = require('@mysten/dapp-kit/package.json');
        return parseVersion(pkg.version);
    }
    catch (error) {
        console.warn('[SuiClient] Could not determine @mysten/dapp-kit version:', error);
        return null;
    }
}
/**
 * Compatibility wrapper for SuiClient options
 * Handles differences between SDK versions
 */
export function createCompatibleSuiClientOptions(options) {
    const suiVersion = getSuiVersion();
    // For newer versions, ensure proper option format
    if (suiVersion && isVersionAtLeast(suiVersion, { major: 1, minor: 30, patch: 0, full: '1.30.0' })) {
        return {
            url: options.url,
            transport: options.transport,
            rpcTimeout: options.rpcTimeout || 30000,
            websocketTimeout: options.websocketTimeout || 30000,
            ...options,
        };
    }
    // Legacy format for older versions
    return {
        url: options.url,
        ...options,
    };
}
/**
 * Compatibility wrapper for transaction results
 * Handles missing properties in different SDK versions
 */
export function normalizeTransactionResult(result) {
    if (!result)
        return result;
    return {
        digest: result.digest,
        effects: result.effects,
        events: result.events || [],
        objectChanges: result.objectChanges || [],
        balanceChanges: result.balanceChanges || [],
        // Legacy support
        confirmedLocalExecution: result.confirmedLocalExecution,
        timestamp: result.timestamp,
    };
}
/**
 * Compatibility wrapper for owned objects response
 * Handles pagination and data structure changes
 */
export function normalizeOwnedObjectsResponse(response) {
    if (!response)
        return { data: [] };
    return {
        data: response.data || [],
        nextCursor: response.nextCursor,
        hasNextPage: response.hasNextPage || false,
    };
}
/**
 * Compatibility wrapper for object response
 * Handles different object data structures
 */
export function normalizeObjectResponse(response) {
    if (!response)
        return null;
    return {
        data: response.data,
        error: response.error,
    };
}
/**
 * Detect SDK capabilities based on version
 */
export function detectSDKCapabilities() {
    const suiVersion = getSuiVersion();
    if (!suiVersion) {
        // Conservative defaults when version is unknown
        return {
            hasObjectChanges: false,
            hasBalanceChanges: false,
            hasEvents: true,
            hasWebsocketSupport: false,
            hasTransactionMetadata: false,
        };
    }
    // Check for specific version features
    const hasModernFeatures = isVersionAtLeast(suiVersion, { major: 1, minor: 30, patch: 0, full: '1.30.0' });
    return {
        hasObjectChanges: hasModernFeatures,
        hasBalanceChanges: hasModernFeatures,
        hasEvents: true,
        hasWebsocketSupport: hasModernFeatures,
        hasTransactionMetadata: hasModernFeatures,
    };
}
/**
 * Safe property access with fallbacks
 */
export function safeAccess(obj, path, fallback) {
    try {
        const keys = path.split('.');
        let current = obj;
        for (const key of keys) {
            if (current === null || current === undefined) {
                return fallback;
            }
            current = current[key];
        }
        return current !== undefined ? current : fallback;
    }
    catch (error) {
        return fallback;
    }
}
/**
 * Compatibility helpers for React components
 */
export const ReactCompatibility = {
    /**
     * Safe hook usage that won't break if hooks change
     */
    useSafeCurrentAccount: (useCurrentAccountHook) => {
        try {
            return useCurrentAccountHook();
        }
        catch (error) {
            console.warn('[SuiClient] useCurrentAccount hook failed:', error);
            return null;
        }
    },
    /**
     * Safe wallet connection hook
     */
    useSafeWalletConnection: (useConnectWalletHook) => {
        try {
            return useConnectWalletHook();
        }
        catch (error) {
            console.warn('[SuiClient] useConnectWallet hook failed:', error);
            return { mutate: () => { }, isPending: false };
        }
    },
    /**
     * Safe transaction execution hook
     */
    useSafeTransactionExecution: (useSignAndExecuteTransactionHook) => {
        try {
            return useSignAndExecuteTransactionHook();
        }
        catch (error) {
            console.warn('[SuiClient] useSignAndExecuteTransaction hook failed:', error);
            return { mutateAsync: async () => { throw error; } };
        }
    },
};
/**
 * Environment detection
 */
export const Environment = {
    isBrowser: () => typeof window !== 'undefined' && typeof document !== 'undefined',
    isNode: () => typeof window === 'undefined' && typeof process !== 'undefined',
    isReactNative: () => typeof navigator !== 'undefined' && navigator.product === 'ReactNative',
    supportsLocalStorage: () => {
        try {
            return typeof localStorage !== 'undefined';
        }
        catch {
            return false;
        }
    },
    supportsWebSocket: () => {
        try {
            return typeof WebSocket !== 'undefined';
        }
        catch {
            return false;
        }
    },
};
/**
 * Version compatibility warnings
 */
export function checkVersionCompatibility() {
    const suiVersion = getSuiVersion();
    const dappKitVersion = getDappKitVersion();
    // Known incompatible versions
    const minSuiVersion = { major: 1, minor: 28, patch: 0, full: '1.28.0' };
    const minDappKitVersion = { major: 0, minor: 14, patch: 0, full: '0.14.0' };
    if (suiVersion && !isVersionAtLeast(suiVersion, minSuiVersion)) {
        console.warn(`[SuiClient] @mysten/sui version ${suiVersion.full} may be incompatible. ` +
            `Minimum recommended version is ${minSuiVersion.full}`);
    }
    if (dappKitVersion && !isVersionAtLeast(dappKitVersion, minDappKitVersion)) {
        console.warn(`[SuiClient] @mysten/dapp-kit version ${dappKitVersion.full} may be incompatible. ` +
            `Minimum recommended version is ${minDappKitVersion.full}`);
    }
}
//# sourceMappingURL=compatibility.js.map