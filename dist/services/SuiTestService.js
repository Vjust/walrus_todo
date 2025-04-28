"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuiTestService = void 0;
const tslib_1 = require("tslib");
/* eslint-disable @typescript-eslint/no-explicit-any */
const crypto_1 = tslib_1.__importDefault(require("crypto"));
/**
 * A deterministic, in‑memory implementation of the Sui service
 * for unit / integration tests.  Does *not* touch the network.
 */
class SuiTestService {
    constructor(walletAddress) {
        this.lists = new Map();
        // Allow overriding for multi‑user tests
        this.walletAddress =
            walletAddress !== null && walletAddress !== void 0 ? walletAddress : `0x${crypto_1.default.randomBytes(20).toString("hex").toLowerCase()}`;
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
