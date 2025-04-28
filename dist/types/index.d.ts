/**
 * Type definitions for the application
 */
export type NetworkType = 'devnet' | 'testnet' | 'mainnet' | 'localnet';
export type Network = 'testnet' | 'mainnet';
export interface Config {
    network: NetworkType;
    walletAddress?: string;
    privateKey?: string;
    encryptedStorage: boolean;
}
export interface Todo {
    id: string;
    task: string;
    description?: string;
    completed: boolean;
    priority: 'high' | 'medium' | 'low';
    dueDate?: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    walrusBlobId?: string;
    isEncrypted?: boolean;
    isTest?: boolean;
    private?: boolean;
}
export interface TodoList {
    id: string;
    name: string;
    owner: string;
    todos: Todo[];
    version: number;
    collaborators?: string[];
    lastSynced?: string;
}
export interface WalrusBlob {
    blobId: string;
    content: Uint8Array;
    metadata?: Record<string, any>;
}
export interface WalrusClientInterface {
    writeBlob: (data: Uint8Array, size?: number, isPublic?: boolean) => Promise<string>;
    readBlob: (blobId: string) => Promise<Uint8Array>;
    network: string;
    isConnected: () => boolean;
    disconnect: () => Promise<void>;
    connect: () => Promise<void>;
}
export interface TodoListObject {
    id: string;
    name: string;
    owner: string;
    version: number;
    blobIds: string[];
    collaborators: string[];
}
export declare class WalrusError extends Error {
    hint?: string | undefined;
    constructor(message: string, hint?: string | undefined);
}
export declare class SuiError extends Error {
    txHash?: string | undefined;
    constructor(message: string, txHash?: string | undefined);
}
export interface RetryOptions {
    maxRetries: number;
    baseDelay: number;
    maxDelay?: number;
}
export * from './todo';
