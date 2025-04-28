import { Transaction } from '@mysten/sui/transactions';
import { type SuiTransactionBlockResponse } from '@mysten/sui/client';
import type { Keypair } from '@mysten/sui/cryptography';
export declare class Ed25519Keypair {
    private keypair;
    constructor();
    getPublicKey(): Uint8Array;
    getKeyScheme(): string;
    getSecretKey(): Uint8Array;
    sign(data: Uint8Array): Uint8Array;
    signWithIntent(data: Uint8Array, intent: string): Uint8Array;
    signData(data: Uint8Array): Uint8Array;
    toSuiAddress(): string;
    export(): {
        publicKey: string;
        secretKey: string;
    };
    signTransaction(data: Uint8Array): Uint8Array;
    signPersonalMessage(data: Uint8Array): Uint8Array;
}
export declare class MockSuiClient {
    private mockBlockchain;
    constructor(options?: {});
    getObject(input: {
        id: string;
        options?: {
            showContent?: boolean;
            showType?: boolean;
        };
    }): Promise<{
        data: any;
    }>;
    getObjectBatch(input: {
        ids: string[];
        options?: {
            showContent?: boolean;
            showType?: boolean;
        };
    }): Promise<{
        data: any;
    }[]>;
    getTransactionBlock(input: {
        digest: string;
        options?: {
            showEffects?: boolean;
            showInput?: boolean;
        };
    }): Promise<any>;
    signAndExecuteTransactionBlock(input: {
        transactionBlock: Transaction;
        signer: Keypair;
        options?: {
            showEffects?: boolean;
            showEvents?: boolean;
        };
    }): Promise<SuiTransactionBlockResponse>;
    getCoins(input: {
        owner: string;
        coinType?: string;
    }): Promise<{
        data: never[];
    }>;
    getAllCoins(input: {
        owner: string;
    }): Promise<{
        data: never[];
    }>;
    getBalance(input: {
        owner: string;
        coinType?: string;
    }): Promise<{
        coinType: string;
        totalBalance: string;
    }>;
    getOwnedObjects(input: {
        owner: string;
        options?: {
            showContent?: boolean;
        };
    }): Promise<{
        data: never[];
    }>;
    queryTransactionBlocks(input: any): Promise<{
        data: never[];
    }>;
    multiGetObjects(input: {
        ids: string[];
        options?: {
            showType?: boolean;
        };
    }): Promise<never[]>;
    getCheckpoint(input: {
        id: string;
    }): Promise<{}>;
    getLatestCheckpointSequenceNumber(): Promise<string>;
    getEvents(input: {
        digest: string;
    }): Promise<{
        data: never[];
    }>;
    queryEvents(input: {
        query: any;
        limit?: number;
    }): Promise<{
        data: never[];
    }>;
    devInspectTransactionBlock(input: any): Promise<{}>;
    dryRunTransactionBlock(input: any): Promise<{}>;
    executeTransactionBlock(input: any): Promise<{
        digest: string;
        transaction: {
            data: {
                sender: any;
                gasData: {
                    payment: never[];
                    owner: any;
                    price: string;
                    budget: string;
                };
            };
        };
        effects: {
            status: {
                status: string;
            };
            gasUsed: {
                computationCost: string;
                storageCost: string;
                storageRebate: string;
            };
            transactionDigest: string;
            created: never[];
            mutated: never[];
        };
        events: never[];
        objectChanges: never[];
        balanceChanges: never[];
    }>;
    multiGetTransactionBlocks(input: {
        digests: string[];
        options?: any;
    }): Promise<never[]>;
    subscribeEvent(input: {
        filter: any;
        onMessage: (event: any) => void;
    }): Promise<() => void>;
    subscribeTransaction(input: {
        filter: any;
    }): Promise<{
        unsubscribe: () => void;
    }>;
    getRpcApiVersion(): Promise<string>;
}
export declare const mockSuiClient: MockSuiClient;
export declare const resetMocks: () => void;
export declare const setupMockObject: (objectId: string, data: any) => string;
export { mockSuiClient as SuiClient };
