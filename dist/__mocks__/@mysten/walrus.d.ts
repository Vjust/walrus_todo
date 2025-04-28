import { WalrusClientInterface } from '../../types';
export declare class WalrusClient implements WalrusClientInterface {
    private static instance;
    network: string;
    constructor(config?: any);
    writeBlob(data: Uint8Array, size?: number, isPublic?: boolean): Promise<string>;
    readBlob(blobId: string): Promise<Uint8Array>;
    isConnected(): boolean;
    disconnect(): Promise<void>;
    connect(): Promise<void>;
}
export declare const resetMocks: () => void;
export declare const setupMockTodos: (todos: any[]) => string;
