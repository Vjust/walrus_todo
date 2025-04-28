/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";

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
 * A deterministic, in‑memory implementation of the Sui service
 * for unit / integration tests.  Does *not* touch the network.
 */
export class SuiTestService implements ISuiService {
	private walletAddress: string;
	private lists = new Map<string, TodoList>();

	constructor(walletAddress?: string) {
		// Allow overriding for multi‑user tests
		this.walletAddress =
			walletAddress ??
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
