import { NetworkType } from './types';
export declare const SUPPORTED_NETWORKS: readonly ["devnet", "testnet", "mainnet", "localnet"];
export declare const DEFAULT_NETWORK: NetworkType;
export declare const CURRENT_NETWORK: NetworkType;
export declare const NETWORK_URLS: Record<NetworkType, string>;
export declare const TIME_PERIODS: {
    readonly DAY: number;
    readonly WEEK: number;
    readonly MONTH: number;
};
export declare const DEFAULT_MODULE_NAME = "wal_todo";
export declare const DEFAULT_PACKAGE_CONFIG: {
    readonly TESTNET_ID: "0x0";
    readonly MAINNET_ID: "0x0";
    readonly MODULE: "wal_todo";
};
export declare const PACKAGE_CONFIG: {
    readonly ID: string;
    readonly MODULE: string;
    readonly FUNCTIONS: {
        readonly CREATE_LIST: "create_list";
        readonly UPDATE_VERSION: "update_version";
        readonly ADD_COLLABORATOR: "add_collaborator";
        readonly REMOVE_COLLABORATOR: "remove_collaborator";
    };
};
export declare const CLI_CONFIG: {
    readonly APP_NAME: "waltodo";
    readonly CONFIG_FILE: ".waltodo.json";
    readonly VERSION: "1.0.0";
    readonly DEFAULT_LIST: "default";
};
export declare const WALRUS_CONFIG: {
    readonly STORAGE_EPOCHS: 3;
    readonly MAX_RETRIES: 3;
    readonly RETRY_DELAY: 1000;
};
export declare const STORAGE_CONFIG: {
    TODOS_DIR: string;
    FILE_EXT: string;
};
