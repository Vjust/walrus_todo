/**
 * Real-time blockchain event management
 * Provides reactive updates from Sui blockchain for TodoNFT events
 */

import { SuiClient } from '@mysten/sui/client';
import { loadNetworkConfig } from './config-loader';
import { Todo } from '@/types/todo-nft';

export interface BlockchainEvent {
  type: string;
  data: any;
  timestamp: string;
  transactionId?: string;
  objectId?: string;
}

export interface BlockchainEventHandler {
  (event: BlockchainEvent): void;
}

export enum TodoEventType {
  TODO_CREATED = 'todo_created',
  TODO_UPDATED = 'todo_updated', 
  TODO_COMPLETED = 'todo_completed',
  TODO_TRANSFERRED = 'todo_transferred',
  TODO_DELETED = 'todo_deleted'
}

/**
 * Real-time blockchain event manager for TodoNFT events
 */
export class BlockchainEventManager {
  private handlers: Map<string, BlockchainEventHandler[]> = new Map();
  private suiClient: SuiClient | null = null;
  private isListening = false;
  private subscriptions: Map<string, () => void> = new Map();
  private walletAddress: string | null = null;
  private packageId: string | null = null;

  /**
   * Initialize the event manager with wallet and network config
   */
  async initialize(walletAddress?: string): Promise<void> {
    try {
      const config = await loadNetworkConfig(
        process.env.NEXT_PUBLIC_NETWORK || 'testnet'
      );
      
      if (!config) {
        throw new Error('Failed to load network configuration');
      }

      this.suiClient = new SuiClient({ url: config.network.url });
      this.packageId = config.deployment.packageId;
      this.walletAddress = walletAddress || null;

      // Blockchain event manager initialized
    } catch (error) {
      // Failed to initialize blockchain event manager
    }
  }

  /**
   * Add event listener for specific event types
   */
  addEventListener(eventType: string, handler: BlockchainEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, handler: BlockchainEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Start listening for blockchain events
   */
  async startListening(): Promise<void> {
    if (this.isListening || !this.suiClient || !this.packageId) {
      return;
    }

    this.isListening = true;
    // Starting blockchain event listener...

    try {
      // Subscribe to TodoNFT creation events
      await this.subscribeToTodoEvents();
      
      // If wallet address is available, subscribe to wallet-specific events
      if (this.walletAddress) {
        await this.subscribeToWalletEvents(this.walletAddress);
      }
    } catch (error) {
      // Failed to start blockchain event listening
      this.isListening = false;
    }
  }

  /**
   * Stop listening for blockchain events
   */
  stopListening(): void {
    this.isListening = false;
    
    // Clean up all subscriptions
    this.subscriptions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        // Error cleaning up subscription
      }
    });
    this.subscriptions.clear();
    
    // Blockchain event listener stopped
  }

  /**
   * Update wallet address and restart subscriptions
   */
  async updateWalletAddress(walletAddress: string): Promise<void> {
    this.walletAddress = walletAddress;
    
    if (this.isListening) {
      // Restart subscriptions with new wallet
      this.stopListening();
      await this.startListening();
    }
  }

  /**
   * Subscribe to general TodoNFT events
   */
  private async subscribeToTodoEvents(): Promise<void> {
    if (!this.suiClient || !this.packageId) return;

    try {
      // Subscribe to all events from the TodoNFT module
      const subscription = await this.suiClient.subscribeEvent({
        filter: {
          MoveModule: {
            package: this.packageId,
            module: 'todo_nft'
          }
        },
        onMessage: (eventData: any) => {
          this.processBlockchainEvent(eventData);
        }
      });

      // Store cleanup function
      this.subscriptions.set('todo_events', () => {
        // Subscription cleanup will be handled by the return value
      });

      // Subscribed to TodoNFT events
    } catch (error) {
      // Failed to subscribe to TodoNFT events
    }
  }

  /**
   * Subscribe to wallet-specific events
   */
  private async subscribeToWalletEvents(walletAddress: string): Promise<void> {
    if (!this.suiClient) return;

    try {
      // Subscribe to object changes for the wallet
      const subscription = await this.suiClient.subscribeEvent({
        filter: {
          Sender: walletAddress
        },
        onMessage: (eventData: any) => {
          this.processWalletEvent(walletAddress, eventData);
        }
      });

      // Store cleanup function
      this.subscriptions.set(`wallet_${walletAddress}`, () => {
        // Subscription cleanup will be handled by the return value
      });

      // Subscribed to wallet events
    } catch (error) {
      // Failed to subscribe to wallet events
    }
  }

  /**
   * Process blockchain events and emit typed events
   */
  private processBlockchainEvent(eventData: any): void {
    try {
      const { parsedJson, type, timestampMs, id } = eventData;
      
      if (!type || !type.includes('todo_nft')) {
        return; // Skip non-TodoNFT events
      }

      let eventType: string;
      let todoData: any = null;

      // Parse event type and data based on the Move event structure
      if (type.includes('TodoNFTCreated') || type.includes('TodoCreated')) {
        eventType = TodoEventType.TODO_CREATED;
        todoData = this.parseCreatedEvent(parsedJson);
      } else if (type.includes('TodoNFTCompleted') || type.includes('TodoCompleted')) {
        eventType = TodoEventType.TODO_COMPLETED;
        todoData = this.parseCompletedEvent(parsedJson);
      } else if (type.includes('TodoNFTUpdated')) {
        eventType = TodoEventType.TODO_UPDATED;
        todoData = this.parseUpdatedEvent(parsedJson);
      } else if (type.includes('TodoNFTTransferred') || type.includes('TodoTransferred')) {
        eventType = TodoEventType.TODO_TRANSFERRED;
        todoData = this.parseTransferredEvent(parsedJson);
      } else {
        // Generic todo update
        eventType = TodoEventType.TODO_UPDATED;
        todoData = parsedJson;
      }

      // Emit the processed event
      this.emitEvent({
        type: eventType,
        data: todoData,
        timestamp: new Date(timestampMs || Date.now()).toISOString(),
        transactionId: id?.txDigest,
        objectId: parsedJson?.todo_id || parsedJson?.object_id
      });
    } catch (error) {
      // Error processing blockchain event
    }
  }

  /**
   * Process wallet-specific events
   */
  private processWalletEvent(walletAddress: string, eventData: any): void {
    // Process events specifically for this wallet
    this.processBlockchainEvent(eventData);
  }

  /**
   * Parse TodoCreated event data
   */
  private parseCreatedEvent(parsedJson: any): Partial<Todo> | null {
    if (!parsedJson) return null;

    return {
      id: parsedJson.todo_id || parsedJson.object_id,
      title: parsedJson.title,
      description: parsedJson.description,
      completed: false,
      blockchainStored: true,
      objectId: parsedJson.todo_id || parsedJson.object_id,
      createdAt: new Date().toISOString(),
      priority: 'medium' as const,
    };
  }

  /**
   * Parse TodoCompleted event data
   */
  private parseCompletedEvent(parsedJson: any): Partial<Todo> | null {
    if (!parsedJson) return null;

    return {
      id: parsedJson.todo_id || parsedJson.object_id,
      objectId: parsedJson.todo_id || parsedJson.object_id,
      completed: true,
      completedAt: new Date(parseInt(parsedJson.timestamp) || Date.now()).toISOString(),
      isNFT: true,
      nftData: {
        owner: parsedJson.owner,
        completedAt: parseInt(parsedJson.timestamp) || Date.now(),
      }
    };
  }

  /**
   * Parse TodoUpdated event data
   */
  private parseUpdatedEvent(parsedJson: any): Partial<Todo> | null {
    if (!parsedJson) return null;

    return {
      id: parsedJson.todo_id || parsedJson.object_id,
      objectId: parsedJson.todo_id || parsedJson.object_id,
      title: parsedJson.title,
      description: parsedJson.description,
      updatedAt: new Date(parseInt(parsedJson.timestamp) || Date.now()).toISOString(),
      isNFT: true,
      nftData: {
        owner: parsedJson.owner,
        updatedAt: parseInt(parsedJson.timestamp) || Date.now(),
      }
    };
  }

  /**
   * Parse TodoTransferred event data
   */
  private parseTransferredEvent(parsedJson: any): any {
    if (!parsedJson) return null;

    return {
      todo_id: parsedJson.todo_id || parsedJson.object_id,
      from: parsedJson.from || parsedJson.sender,
      to: parsedJson.to || parsedJson.recipient,
      owner: parsedJson.to || parsedJson.recipient,
      timestamp: parsedJson.timestamp || Date.now().toString()
    };
  }

  /**
   * Emit event to all registered handlers
   */
  private emitEvent(event: BlockchainEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          // Error in event handler
        }
      });
    }

    // Also emit to wildcard listeners
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          // Error in wildcard event handler
        }
      });
    }

    // Blockchain event emitted
  }

  /**
   * Subscribe to events (wrapper for startListening)
   */
  async subscribeToEvents(owner?: string): Promise<void> {
    if (owner) {
      await this.updateWalletAddress(owner);
    }
    await this.startListening();
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeAll(): void {
    this.stopListening();
    this.handlers.clear();
  }

  /**
   * Destroy the event manager
   */
  destroy(): void {
    this.unsubscribeAll();
    this.suiClient = null;
    this.packageId = null;
    this.walletAddress = null;
  }

  /**
   * Get connection state (returns full state object)
   */
  getConnectionState(): EventConnectionState {
    return {
      connected: this.isListening && this.suiClient !== null,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: this.subscriptions.size,
    };
  }

  /**
   * Get connection status (simple boolean)
   */
  getConnectionStatus(): boolean {
    return this.isListening && this.suiClient !== null;
  }

  /**
   * Manually trigger an event (for testing)
   */
  simulateEvent(eventType: string, data: any): void {
    this.emitEvent({
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton instance
export const blockchainEventManager = new BlockchainEventManager();

// Legacy interface for backward compatibility
export interface EventConnectionState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastReconnectAttempt: number;
  reconnectAttempts: number;
  subscriptionCount?: number;
}

export interface TodoNFTEvent {
  type: 'created' | 'completed' | 'updated' | 'deleted' | 'transferred';
  data: {
    todo_id: string;
    title?: string;
    owner: string;
    timestamp: string;
    from?: string;
    to?: string;
  };
}

export type EventListener = (event: TodoNFTEvent) => void;

// Legacy function for backward compatibility
export function getEventManager(): BlockchainEventManager {
  return blockchainEventManager;
}

export function transformEventToTodoUpdate(event: TodoNFTEvent): any {
  return {
    id: event.data.todo_id,
    title: event.data.title || 'Updated Todo',
    owner: event.data.owner,
    blockchainStored: true,
    objectId: event.data.todo_id,
    updatedAt: new Date(event.data.timestamp).getTime(),
  };
}

export default blockchainEventManager;