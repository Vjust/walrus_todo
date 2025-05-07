import crypto from "crypto";
import { SuiClient } from '@mysten/sui.js/client';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { SUI_DECIMALS, SuiObjectResponse } from '@mysten/sui.js/client';
import { PaginatedObjectsResponse } from '@mysten/sui.js/client';
import { NETWORK_URLS } from '../constants';
import { Config } from '../types';
import { NetworkType } from '../types/network';
import { CLIError } from '../types/error';

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
 * Test implementation of SUI service for development and testing.
 * Simulates blockchain behavior without network calls.
 */
interface MockTransaction {
  id: string;
  sender: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
  gasUsed?: number;
  error?: string;
}

interface MockObject {
  id: string;
  owner: string;
  type: string;
  version: number;
  content: any;
  digest: string;
  createdAt: number;
  updatedAt: number;
}

export class SuiTestService implements ISuiService {
  private walletAddress: string;
  private lists = new Map<string, TodoList>();
  private objects = new Map<string, MockObject>();
  private transactions = new Map<string, MockTransaction>();
  private client: SuiClient;
  private config: Config;
  private networkLatency = 500; // Simulated network delay in ms

  constructor(config?: Config | string) {
    if (typeof config === 'string') {
      this.config = {
        network: 'testnet' as NetworkType,
        walletAddress: config,
        encryptedStorage: false
      };
    } else if (config) {
      this.config = config;
    } else {
      this.config = {
        network: 'testnet' as NetworkType,
        walletAddress: '',
        encryptedStorage: false
      };
    }

    this.client = new SuiClient({ url: getFullnodeUrl(this.config.network as NetworkType) });
    this.walletAddress =
      this.config.walletAddress ??
      `0x${crypto.randomBytes(20).toString("hex").toLowerCase()}`;
  }

  async getWalletAddress(): Promise<string> {
    return this.walletAddress;
  }

  private async simulateTransaction(type: MockTransaction['type'], action: () => void): Promise<string> {
    const txId = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    
    // Create pending transaction
    this.transactions.set(txId, {
      id: txId,
      sender: this.walletAddress,
      type,
      timestamp,
      status: 'pending'
    });

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, this.networkLatency));

    try {
      // Random failure simulation (5% chance)
      if (Math.random() < 0.05) {
        throw new Error('Transaction failed: network congestion');
      }

      // Execute the action
      action();

      // Update transaction status
      this.transactions.set(txId, {
        ...this.transactions.get(txId)!,
        status: 'success',
        gasUsed: Math.floor(Math.random() * 1000) + 500
      });

      return txId;
    } catch (error) {
      // Record failure
      this.transactions.set(txId, {
        ...this.transactions.get(txId)!,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async createTodoList(): Promise<string> {
    const id = this.generateId("list");
    const now = Date.now();
    
    await this.simulateTransaction('create', () => {
      // Create list object
      const listObject: MockObject = {
        id,
        owner: this.walletAddress,
        type: 'TodoList',
        version: 1,
        content: {
          items: new Map(),
          createdAt: now,
          updatedAt: now
        },
        digest: crypto.createHash('sha256').update(id + now).digest('hex'),
        createdAt: now,
        updatedAt: now
      };
      
      this.objects.set(id, listObject);
      this.lists.set(id, {
        id,
        owner: this.walletAddress,
        items: new Map(),
        createdAt: now,
        updatedAt: now,
      });
    });

    return id;
  }

  async addTodo(listId: string, text: string): Promise<string> {
    const list = this.assertList(listId);
    const id = this.generateId("todo");
    const now = Date.now();
    
    await this.simulateTransaction('update', () => {
      // Create todo item object
      const todoObject: MockObject = {
        id,
        owner: this.walletAddress,
        type: 'TodoItem',
        version: 1,
        content: {
          text,
          completed: false,
          updatedAt: now
        },
        digest: crypto.createHash('sha256').update(id + text + now).digest('hex'),
        createdAt: now,
        updatedAt: now
      };
      
      // Update list object
      const listObject = this.objects.get(listId)!;
      listObject.version += 1;
      listObject.updatedAt = now;
      listObject.digest = crypto.createHash('sha256')
        .update(listObject.digest + todoObject.digest)
        .digest('hex');
      
      // Update storage
      this.objects.set(id, todoObject);
      const item: TodoItem = {
        id,
        text,
        completed: false,
        updatedAt: now,
      };
      list.items.set(id, item);
      list.updatedAt = now;
    });

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
      throw new CLIError(`Todo "${itemId}" not found in list "${listId}"`, 'TODO_NOT_FOUND');
    }

    const now = Date.now();
    await this.simulateTransaction('update', () => {
      // Update todo object
      const todoObject = this.objects.get(itemId)!;
      todoObject.version += 1;
      todoObject.updatedAt = now;
      todoObject.content = {
        ...todoObject.content,
        ...changes,
        updatedAt: now
      };
      todoObject.digest = crypto.createHash('sha256')
        .update(todoObject.digest + JSON.stringify(changes))
        .digest('hex');

      // Update list object
      const listObject = this.objects.get(listId)!;
      listObject.version += 1;
      listObject.updatedAt = now;
      listObject.digest = crypto.createHash('sha256')
        .update(listObject.digest + todoObject.digest)
        .digest('hex');

      // Update storage
      Object.assign(item, changes, { updatedAt: now });
      list.updatedAt = now;
    });
  }

  async deleteTodoList(listId: string): Promise<void> {
    const list = this.lists.get(listId);
    if (!list) {
      throw new CLIError(`Todo list "${listId}" does not exist`, 'LIST_NOT_FOUND');
    }

    await this.simulateTransaction('delete', () => {
      // Delete todo items
      for (const itemId of list.items.keys()) {
        this.objects.delete(itemId);
      }

      // Delete list object
      this.objects.delete(listId);
      this.lists.delete(listId);
    });
  }

  public async getAccountInfo(): Promise<AccountInfo> {
    try {
      if (!this.config.walletAddress) {
        throw new CLIError('Wallet address not configured', 'NO_WALLET_ADDRESS');
      }

      const balanceResponse = await this.client.getBalance({
        owner: this.config.walletAddress,
        coinType: '0x2::sui::SUI'
      });

      const objectsResponse = await this.client.getOwnedObjects({
        owner: this.config.walletAddress,
        options: { showType: true },
        limit: 5
      }) as PaginatedObjectsResponse;

      const objects = objectsResponse.data.map((obj: SuiObjectResponse) => {
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
      throw new CLIError(
        `Failed to get account info: ${error instanceof Error ? error.message : String(error)}`,
        'ACCOUNT_INFO_FAILED'
      );
    }
  }

  private assertList(listId: string): TodoList {
    const list = this.lists.get(listId);
    if (!list) {
      throw new CLIError(`Todo list "${listId}" not found`, 'LIST_NOT_FOUND');
    }
    if (list.owner !== this.walletAddress) {
      throw new CLIError('Unauthorized access to todo list', 'UNAUTHORIZED');
    }
    return list;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
  }
}