"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMockTodos = exports.resetMocks = exports.WalrusClient = void 0;
const globals_1 = require("@jest/globals");
// Simulated storage for blobs
const blobStorage = new Map();
// Error types matching the mock guide
class WalrusError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'WalrusError';
    }
}
// Mock storage validation
const validateBlobData = (data, size) => {
    if (!data || !(data instanceof Uint8Array)) {
        throw new WalrusError('Invalid blob data format', 'INVALID_FORMAT');
    }
    if (size && data.length > size) {
        throw new WalrusError(`Blob size exceeds limit of ${size} bytes`, 'SIZE_EXCEEDED');
    }
};
// Mock WalrusClient class
class WalrusClient {
    constructor(config) {
        this.network = 'testnet';
        if (WalrusClient.instance) {
            return WalrusClient.instance;
        }
        WalrusClient.instance = this;
    }
    async writeBlob(data, size, isPublic) {
        try {
            validateBlobData(data, size);
            const blobId = 'mock-blob-' + Math.random().toString(36).substr(2, 9);
            blobStorage.set(blobId, data);
            return blobId;
        }
        catch (error) {
            throw error;
        }
    }
    async readBlob(blobId) {
        const data = blobStorage.get(blobId);
        if (!data) {
            throw new WalrusError('Blob not found', 'NOT_FOUND');
        }
        return data;
    }
    isConnected() {
        return true;
    }
    async disconnect() {
        return Promise.resolve();
    }
    async connect() {
        return Promise.resolve();
    }
}
exports.WalrusClient = WalrusClient;
// Reset functionality with storage clear
const resetMocks = () => {
    blobStorage.clear();
    globals_1.jest.clearAllMocks();
};
exports.resetMocks = resetMocks;
// Helper for test setup
const setupMockTodos = (todos) => {
    const blobId = 'mock-todos-blob';
    const data = Buffer.from(JSON.stringify({ todos }));
    blobStorage.set(blobId, data);
    return blobId;
};
exports.setupMockTodos = setupMockTodos;
