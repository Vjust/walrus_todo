/**
 * Mock blockchain events manager to prevent console errors
 * In a real implementation, this would connect to Sui blockchain events
 */

export interface EventConnectionState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastReconnectAttempt: number;
  reconnectAttempts: number;
  subscriptionCount?: number;
}

export interface TodoNFTEvent {
  type: 'created' | 'completed' | 'updated' | 'deleted';
  data: {
    todo_id: string;
    title?: string;
    owner: string;
    timestamp: string;
  };
}

export type EventListener = (event: TodoNFTEvent) => void;

export class BlockchainEventManager {
  private connected = false;
  private listeners: Map<string, EventListener[]> = new Map();

  async initialize(): Promise<void> {
    console.log('Initializing blockchain event manager (mock)');
    this.connected = true;
  }

  async subscribeToEvents(owner?: string): Promise<void> {
    console.log('Subscribing to blockchain events (mock)', owner);
  }

  unsubscribeAll(): void {
    console.log('Unsubscribing from all events (mock)');
    this.listeners.clear();
  }

  addEventListener(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
    
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  removeEventListener(eventType: string, listener: EventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  getConnectionState(): EventConnectionState {
    return {
      connected: this.connected,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: this.listeners.size
    };
  }

  destroy(): void {
    this.connected = false;
    this.listeners.clear();
  }
}

// Global event manager instance
let eventManager: BlockchainEventManager | null = null;

export function getEventManager(options?: { autoReconnect?: boolean }): BlockchainEventManager {
  if (!eventManager) {
    console.log('Creating new blockchain event manager instance');
    eventManager = new BlockchainEventManager();
    // Initialize immediately to prevent "not initialized" errors
    eventManager.initialize().catch(console.error);
  }
  return eventManager;
}

export function transformEventToTodoUpdate(event: TodoNFTEvent): any {
  return {
    id: event.data.todo_id,
    title: event.data.title || 'Updated Todo',
    owner: event.data.owner,
    blockchainStored: true,
    objectId: event.data.todo_id,
    updatedAt: new Date(event.data.timestamp).getTime()
  };
}