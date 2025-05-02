"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuiTestService = void 0;
const tslib_1 = require("tslib");
/* eslint-disable @typescript-eslint/no-explicit-any */
const crypto_1 = tslib_1.__importDefault(require("crypto"));
const client_1 = require("@mysten/sui/client");
const constants_1 = require("../constants");
/**
 * A deterministic, in‑memory implementation of the Sui service
 * for unit / integration tests.  Does *not* touch the network.
 */
class SuiTestService {
    /**
     * Create a new SuiTestService instance.
     *  • `config`  – full Config object
     *  • `string`  – wallet address, defaults network to 'testnet'
     *  • omitted   – uses default dummy config (network 'testnet')
     */
    constructor(config) {
        var _a;
        this.lists = new Map();
        // Normalise constructor argument
        if (typeof config === 'string') {
            this.config = {
                network: 'testnet',
                walletAddress: config,
                encryptedStorage: false
            };
        }
        else if (config) {
            this.config = config;
        }
        else {
            this.config = {
                network: 'testnet',
                walletAddress: '0x0',
                encryptedStorage: false
            };
        }
        this.client = new client_1.SuiClient({ url: constants_1.NETWORK_URLS[this.config.network] });
        // Allow overriding for multi‑user tests
        this.walletAddress =
            (_a = this.config.walletAddress) !== null && _a !== void 0 ? _a : `0x${crypto_1.default.randomBytes(20).toString("hex").toLowerCase()}`;
    }
    async getWalletAddress() {
        return this.walletAddress;
    }
    async createTodoList() {
        const id = this.generateId("list");
        const now = Date.now();
        this.lists.set(id, {
            id,
            owner: this.walletAddress,
            items: new Map(),
            createdAt: now,
            updatedAt: now,
        });
        return id;
    }
    async addTodo(listId, text) {
        const list = this.assertList(listId);
        const id = this.generateId("todo");
        const item = {
            id,
            text,
            completed: false,
            updatedAt: Date.now(),
        };
        list.items.set(id, item);
        list.updatedAt = Date.now();
        return id;
    }
    async getTodos(listId) {
        return Array.from(this.assertList(listId).items.values());
    }
    async updateTodo(listId, itemId, changes) {
        const list = this.assertList(listId);
        const item = list.items.get(itemId);
        if (!item) {
            throw new Error(`Todo "${itemId}" not found in list "${listId}"`);
        }
        Object.assign(item, changes, { updatedAt: Date.now() });
        list.updatedAt = Date.now();
    }
    async deleteTodoList(listId) {
        if (!this.lists.delete(listId)) {
            throw new Error(`Todo list "${listId}" does not exist`);
        }
    }
    /**
     * Gets account information including balance and owned objects
     * @returns Promise<AccountInfo> Account information object
     */
    async getAccountInfo() {
        try {
            // Ensure wallet address is available
            if (!this.config.walletAddress) {
                throw new Error('Wallet address not configured');
            }
            // Get balance information
            const balanceResponse = await this.client.getBalance({
                owner: this.config.walletAddress
            });
            // Get owned objects (limit to first 5 for display purposes)
            const objectsResponse = await this.client.getOwnedObjects({
                owner: this.config.walletAddress,
                limit: 5
            });
            // Format objects for display
            const objects = objectsResponse.data.map(obj => {
                var _a, _b;
                return {
                    objectId: ((_a = obj.data) === null || _a === void 0 ? void 0 : _a.objectId) || 'unknown',
                    type: ((_b = obj.data) === null || _b === void 0 ? void 0 : _b.type) || 'unknown'
                };
            });
            return {
                address: this.config.walletAddress,
                balance: balanceResponse.totalBalance,
                objects
            };
        }
        catch (error) {
            console.error('Error getting account info:', error);
            throw error;
        }
    }
    /* ---------- helpers ---------- */
    assertList(listId) {
        const list = this.lists.get(listId);
        if (!list)
            throw new Error(`Todo list "${listId}" not found`);
        if (list.owner !== this.walletAddress)
            throw new Error("Unauthorized access to todo list");
        return list;
    }
    generateId(prefix) {
        return `${prefix}_${crypto_1.default.randomBytes(6).toString("hex")}`;
    }
}
exports.SuiTestService = SuiTestService;
