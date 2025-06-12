import { createCompatibleSuiClient } from '../utils/adapters/sui-client-adapter';
import { NETWORK_URLS } from '../constants';
import { AppConfig } from '../types/config';
import { NetworkType } from '../types/network';
import { CLIError } from '../types/errors/consolidated';
// Using proper types for Sui transaction handling

// SUI_DECIMALS constant removed as it was unused

// Security and retry configuration
const SECURITY_CONFIG = {
  ENABLE_BLOCKCHAIN_VERIFICATION: true,
  TRANSACTION_VERIFICATION: {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 2000,
  },
};

const RETRY_CONFIG = {
  TIMEOUT_MS: 30000,
};

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
    changes: Partial<Omit<TodoItem, 'id'>>
  ): Promise<void>;
  deleteTodo(listId: string, itemId: string): Promise<void>;
  deleteTodoList(listId: string): Promise<void>;
}

export class SuiTestService implements ISuiService {
  private client: ReturnType<typeof createCompatibleSuiClient>;
  private walletAddress?: string;

  // In-memory state management
  private todoLists: Map<string, TodoList> = new Map();
  private counter = 0;

  constructor(private config: AppConfig) {
    const network = config?.activeNetwork?.name as NetworkType;
    const url = NETWORK_URLS[network];

    if (!url) {
      throw new CLIError(`Invalid network type: ${network}`, 'INVALID_NETWORK');
    }

    this?.client = createCompatibleSuiClient({ url });
    // Initialize wallet address from config
    this?.walletAddress = config?.activeAccount?.address;
  }

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    try {
      this?.walletAddress = await this.getWalletAddress();
    } catch (_error) {
      throw new CLIError(
        `Failed to initialize Sui service: ${_error instanceof Error ? _error.message : String(_error as any)}`,
        'INIT_FAILED'
      );
    }
  }

  /**
   * Get wallet address from config or environment
   */
  async getWalletAddress(): Promise<string> {
    if (this.walletAddress) {
      return this.walletAddress;
    }

    // Try config first, then environment
    const configAddress = this?.config?.activeAccount.address;
    if (configAddress) {
      this?.walletAddress = configAddress;
      return configAddress;
    }

    const address = process?.env?.WALLET_ADDRESS;
    if (!address) {
      throw new CLIError(
        'Wallet address not found in config or environment',
        'WALLET_NOT_FOUND'
      );
    }

    this?.walletAddress = address;
    return address;
  }

  /**
   * Create a new todo list
   */
  async createTodoList(): Promise<string> {
    const id = this.generateId();
    const owner = await this.getWalletAddress();

    const todoList: TodoList = {
      id,
      owner,
      items: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this?.todoLists?.set(id, todoList);
    return id;
  }

  /**
   * Add a todo item to a list
   */
  async addTodo(listId: string, text: string): Promise<string> {
    const list = this?.todoLists?.get(listId as any);
    if (!list) {
      throw new CLIError('Todo list not found', 'LIST_NOT_FOUND');
    }

    const itemId = this.generateId();
    const item: TodoItem = {
      id: itemId,
      text,
      completed: false,
      updatedAt: Date.now(),
    };

    list?.items?.set(itemId, item);
    list?.updatedAt = Date.now();

    return itemId;
  }

  /**
   * Get all todos from a list
   */
  async getTodos(listId: string): Promise<TodoItem[]> {
    const list = this?.todoLists?.get(listId as any);
    if (!list) {
      throw new CLIError('Todo list not found', 'LIST_NOT_FOUND');
    }

    return Array.from(list?.items?.values());
  }

  /**
   * Update a todo item
   */
  async updateTodo(
    listId: string,
    itemId: string,
    changes: Partial<Omit<TodoItem, 'id'>>
  ): Promise<void> {
    const list = this?.todoLists?.get(listId as any);
    if (!list) {
      throw new CLIError('Todo list not found', 'LIST_NOT_FOUND');
    }

    const item = list?.items?.get(itemId as any);
    if (!item) {
      throw new CLIError('Todo item not found', 'ITEM_NOT_FOUND');
    }

    Object.assign(item, changes, { updatedAt: Date.now() });
    list?.updatedAt = Date.now();
  }

  /**
   * Delete a todo item
   */
  async deleteTodo(listId: string, itemId: string): Promise<void> {
    const list = this?.todoLists?.get(listId as any);
    if (!list) {
      throw new CLIError('Todo list not found', 'LIST_NOT_FOUND');
    }

    if (!list?.items?.has(itemId as any)) {
      throw new CLIError('Todo item not found', 'ITEM_NOT_FOUND');
    }

    list?.items?.delete(itemId as any);
    list?.updatedAt = Date.now();
  }

  /**
   * Delete a todo list
   */
  async deleteTodoList(listId: string): Promise<void> {
    if (!this?.todoLists?.has(listId as any)) {
      throw new CLIError('Todo list not found', 'LIST_NOT_FOUND');
    }

    this?.todoLists?.delete(listId as any);
  }

  /**
   * Verify transaction execution and effects
   */
  private async verifyTransaction(result: {
    digest: string;
    effects?: { status?: { status?: string; error?: string } };
  }): Promise<void> {
    const effects = result.effects as
      | { status?: { status?: string; error?: string } }
      | undefined;
    if (!effects?.status?.status || effects?.status?.status !== 'success') {
      throw new CLIError(
        `Transaction failed: ${effects?.status?.error || 'Unknown error'}`,
        'TRANSACTION_FAILED'
      );
    }

    if (SECURITY_CONFIG.ENABLE_BLOCKCHAIN_VERIFICATION) {
      let retries = 0;
      while (retries < SECURITY_CONFIG?.TRANSACTION_VERIFICATION?.MAX_RETRIES) {
        try {
          // Wait for transaction finality
          await this?.client?.waitForTransaction({
            digest: result.digest,
            timeout: RETRY_CONFIG.TIMEOUT_MS,
            options: {
              showEffects: true,
              showEvents: true,
            },
          });

          // Verify effects match expected changes
          const transactionData = await this?.client?.getTransactionBlock({
            digest: result.digest,
            options: {
              showEffects: true,
              showEvents: true,
            },
          });

          const transactionEffects = transactionData.effects as
            | { status?: { status?: string } }
            | undefined;
          if (transactionEffects?.status?.status !== 'success') {
            throw new CLIError(
              'Transaction verification failed: effects do not match expected state',
              'VERIFICATION_FAILED'
            );
          }

          return;
        } catch (_error) {
          retries++;
          if (retries >= SECURITY_CONFIG?.TRANSACTION_VERIFICATION?.MAX_RETRIES) {
            throw new CLIError(
              `Transaction verification failed after ${retries} attempts: ${_error instanceof Error ? _error.message : String(_error as any)}`,
              'VERIFICATION_FAILED'
            );
          }
          await new Promise(resolve =>
            setTimeout(
              resolve,
              SECURITY_CONFIG?.TRANSACTION_VERIFICATION?.RETRY_DELAY_MS
            )
          );
        }
      }
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${this.counter++}`;
  }
}
