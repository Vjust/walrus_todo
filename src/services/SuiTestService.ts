/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import { SuiClient } from '@mysten/sui/client';
import { NETWORK_URLS } from '../constants';
import { Config } from '../types';

type TodoItem = {
	id: string;
	text: string;
	completed: boolean;
	updatedAt: number;
};

type TodoList = {
	id: string;
	owner: string;
	items: Map<string, TodoItem>;
	createdAt: number;
	updatedAt: number;
};

export interface ISuiService {
	getWalletAddress(): Promise<string>;
	createTodoList(): Promise<string>;
	addTodo(listId: string, text: string): Promise<string>;
	getTodos(listId: string): Promise<TodoItem[]>;
	updateTodo(
		listId: string,
		itemId: string,
		changes: Partial<Omit<TodoItem, "id">>
	): Promise<void>;
	deleteTodoList(listId: string): Promise<void>;
}

/**
 * Interface for account information returned by the service
 */
export interface AccountInfo {
  address: string;
  balance: string;
  objects?: Array<{
    objectId: string;
    type: string;
  }>;
}

/**
 * A deterministic, in‑memory implementation of the Sui service
 * for unit / integration tests.  Does *not* touch the network.
 */
export class SuiTestService implements ISuiService {
	private walletAddress: string;
	private lists = new Map<string, TodoList>();
	private client: SuiClient;
	private config: Config;

	/**
	 * Create a new SuiTestService instance.
	 *  • `config`  – full Config object  
	 *  • `string`  – wallet address, defaults network to 'testnet'  
	 *  • omitted   – uses default dummy config (network 'testnet')
	 */
	constructor(config?: Config | string) {
		// Normalise constructor argument
		if (typeof config === 'string') {
			this.config = {
				network: 'testnet',
				walletAddress: config,
				encryptedStorage: false
			};
		} else if (config) {
			this.config = config;
		} else {
			this.config = {
				network: 'testnet',
				walletAddress: '0x0',
				encryptedStorage: false
			};
		}

		this.client = new SuiClient({ url: NETWORK_URLS[this.config.network] });
		// Allow overriding for multi‑user tests
		this.walletAddress =
			this.config.walletAddress ??
			`0x${crypto.randomBytes(20).toString("hex").toLowerCase()}`;
	}

	async getWalletAddress(): Promise<string> {
		return this.walletAddress;
	}

	async createTodoList(): Promise<string> {
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

	async addTodo(listId: string, text: string): Promise<string> {
		const list = this.assertList(listId);
		const id = this.generateId("todo");
		const item: TodoItem = {
			id,
			text,
			completed: false,
			updatedAt: Date.now(),
		};
		list.items.set(id, item);
		list.updatedAt = Date.now();
		return id;
	}

	async getTodos(listId: string): Promise<TodoItem[]> {
		return Array.from(this.assertList(listId).items.values());
	}

	async updateTodo(
		listId: string,
		itemId: string,
		changes: Partial<Omit<TodoItem, "id">>
	): Promise<void> {
		const list = this.assertList(listId);
		const item = list.items.get(itemId);
		if (!item) {
			throw new Error(`Todo "${itemId}" not found in list "${listId}"`);
		}
		Object.assign(item, changes, { updatedAt: Date.now() });
		list.updatedAt = Date.now();
	}

	async deleteTodoList(listId: string): Promise<void> {
		if (!this.lists.delete(listId)) {
			throw new Error(`Todo list "${listId}" does not exist`);
		}
	}

	/**
	 * Gets account information including balance and owned objects
	 * @returns Promise<AccountInfo> Account information object
	 */
	public async getAccountInfo(): Promise<AccountInfo> {
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
				return {
					objectId: obj.data?.objectId || 'unknown',
					type: obj.data?.type || 'unknown'
				};
			});

			return {
				address: this.config.walletAddress,
				balance: balanceResponse.totalBalance,
				objects
			};
		} catch (error) {
			console.error('Error getting account info:', error);
			throw error;
		}
	}

	/* ---------- helpers ---------- */

	private assertList(listId: string): TodoList {
		const list = this.lists.get(listId);
		if (!list) throw new Error(`Todo list "${listId}" not found`);
		if (list.owner !== this.walletAddress)
			throw new Error("Unauthorized access to todo list");
		return list;
	}

	private generateId(prefix: string): string {
		return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
	}
}
