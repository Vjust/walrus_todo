# Blockchain Event Integration Guide

This guide explains how to integrate real-time Sui blockchain event subscriptions into your frontend application for TodoNFT events.

## Overview

The blockchain event system provides real-time updates for TodoNFT smart contract events including:
- **TodoNFTCreated** - When a new todo NFT is created
- **TodoNFTCompleted** - When a todo is marked as completed
- **TodoNFTUpdated** - When todo metadata is updated
- **TodoNFTDeleted** - When a todo NFT is deleted

## Architecture

The event system consists of three main components:

1. **BlockchainEventManager** - Core event subscription and connection management
2. **React Hooks** - React integration with automatic state management
3. **UI Components** - Visual indicators and real-time updates

## Setup

### 1. Import Required Components

```typescript
import { useBlockchainEvents, useTodoEvents, useTodoStateSync } from '@/hooks/useBlockchainEvents';
import { BlockchainEventStatus, BlockchainEventIndicator } from '@/components/BlockchainEventStatus';
import { RealtimeTodoList } from '@/components/RealtimeTodoList';
```

### 2. Basic Event Subscription

```typescript
// Simple event subscription hook
function MyComponent() {
  const { isConnected, startSubscription, stopSubscription } = useBlockchainEvents({
    autoStart: true,
    owner: walletAddress, // Optional: filter events by owner
    enableReconnect: true,
  });

  return (
    <div>
      <p>Event Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
    </div>
  );
}
```

### 3. Handle Individual Todo Events

```typescript
function TodoEventHandler() {
  const { recentEvents } = useTodoEvents({
    autoStart: true,
    owner: walletAddress,
    onTodoCreated: (todo) => {
      console.log('New todo created:', todo);
      // Update local state or show notification
    },
    onTodoCompleted: (todo) => {
      console.log('Todo completed:', todo);
      // Update UI
    },
    onTodoUpdated: (todo) => {
      console.log('Todo updated:', todo);
      // Refresh todo details
    },
    onTodoDeleted: (todoId) => {
      console.log('Todo deleted:', todoId);
      // Remove from UI
    },
  });

  return (
    <div>
      <h3>Recent Events: {recentEvents.length}</h3>
    </div>
  );
}
```

### 4. Automatic State Synchronization

```typescript
function SyncedTodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  
  const { syncedTodos, isConnected } = useTodoStateSync({
    todos,
    onTodoChange: (updatedTodos) => {
      setTodos(updatedTodos);
      // Optionally persist to local storage
    },
    owner: walletAddress,
    autoStart: true,
  });

  return (
    <div>
      <h3>Synced Todos ({syncedTodos.length})</h3>
      {syncedTodos.map(todo => (
        <div key={todo.id}>{todo.title}</div>
      ))}
    </div>
  );
}
```

## Advanced Usage

### Real-time Todo List Component

```typescript
function MyTodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  
  return (
    <RealtimeTodoList
      initialTodos={todos}
      listName="My Todos"
      onTodoUpdate={(updatedTodos) => setTodos(updatedTodos)}
      onTodoComplete={async (todo) => {
        // Handle completion logic
        await completeTodoOnBlockchain(todo.objectId!, signTransaction);
      }}
      onTodoDelete={async (todoId) => {
        // Handle deletion logic
        await deleteTodoFromBlockchain(todoId);
      }}
      showEventIndicator={true}
    />
  );
}
```

### Connection Status Indicator

```typescript
function AppHeader() {
  return (
    <div className="flex items-center justify-between p-4">
      <h1>My Todo App</h1>
      
      {/* Simple indicator */}
      <BlockchainEventIndicator />
      
      {/* Detailed status */}
      <BlockchainEventStatus 
        showReconnectButton={true}
        showDetails={true}
      />
    </div>
  );
}
```

### Manual Event Manager Usage

```typescript
import { getEventManager } from '@/lib/blockchain-events';

function AdvancedEventHandling() {
  const [eventManager, setEventManager] = useState(null);
  
  useEffect(() => {
    const manager = getEventManager({
      maxReconnectAttempts: 3,
      reconnectDelay: 5000,
      autoReconnect: true,
    });
    
    // Initialize and start subscriptions
    manager.initialize().then(() => {
      manager.subscribeToEvents(walletAddress);
    });
    
    // Add custom event listeners
    const unsubscribe = manager.addEventListener('*', (event) => {
      console.log('Received event:', event);
      // Custom event handling logic
    });
    
    setEventManager(manager);
    
    return () => {
      unsubscribe();
      manager.destroy();
    };
  }, []);
  
  return <div>Advanced event handling active</div>;
}
```

## Integration with Existing Components

### Update Existing TodoList Component

```typescript
// Before: Static TodoList
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <div>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}

// After: Real-time TodoList
function TodoList({ todos }: { todos: Todo[] }) {
  const { syncedTodos } = useTodoStateSync({
    todos,
    onTodoChange: (updatedTodos) => {
      // Handle live updates
    },
    autoStart: true,
  });
  
  return (
    <div>
      <BlockchainEventIndicator />
      {syncedTodos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}
```

### Add to Wallet Context

```typescript
// Update WalletContext to include event management
function WalletContextProvider({ children }) {
  const [eventManager, setEventManager] = useState(null);
  
  const connect = useCallback(async () => {
    // ... existing connect logic
    
    // Start event subscriptions after wallet connection
    if (eventManager) {
      await eventManager.subscribeToEvents(address);
    }
  }, [eventManager, address]);
  
  const disconnect = useCallback(async () => {
    // ... existing disconnect logic
    
    // Stop event subscriptions
    if (eventManager) {
      eventManager.unsubscribeAll();
    }
  }, [eventManager]);
  
  // ... rest of context
}
```

## Configuration Options

### Event Manager Configuration

```typescript
const config = {
  packageId: '0x123...', // TodoNFT package ID
  eventTypes: ['TodoNFTCreated', 'TodoNFTCompleted'], // Filter specific events
  maxReconnectAttempts: 5, // Maximum reconnection attempts
  reconnectDelay: 3000, // Base reconnection delay (ms)
  autoReconnect: true, // Enable automatic reconnection
};
```

### Hook Options

```typescript
// useBlockchainEvents options
const eventOptions = {
  autoStart: true, // Start subscriptions automatically
  owner: walletAddress, // Filter events by owner
  enableReconnect: true, // Enable reconnection on failure
};

// useTodoEvents options
const todoOptions = {
  autoStart: true,
  owner: walletAddress,
  onTodoCreated: (todo) => { /* handler */ },
  onTodoUpdated: (todo) => { /* handler */ },
  onTodoCompleted: (todo) => { /* handler */ },
  onTodoDeleted: (todoId) => { /* handler */ },
};
```

## Error Handling

### Connection Errors

```typescript
function ErrorHandling() {
  const { error, isConnected, restartSubscription } = useBlockchainEvents();
  
  if (error) {
    return (
      <div className="error-state">
        <p>Connection error: {error.message}</p>
        <button onClick={restartSubscription}>
          Retry Connection
        </button>
      </div>
    );
  }
  
  return <div>Connected: {isConnected}</div>;
}
```

### Event Processing Errors

```typescript
// Individual event errors are logged but don't break the subscription
// Check browser console for detailed error information
```

## Performance Considerations

1. **Event Filtering**: Use owner filters to reduce unnecessary events
2. **Reconnection**: Configure appropriate reconnection delays
3. **Memory Management**: Properly cleanup subscriptions when components unmount
4. **Throttling**: Events are throttled to prevent excessive updates

## Debugging

### Enable Development Mode

```typescript
// Add to your environment variables
NEXT_PUBLIC_NODE_ENV=development
```

### Debug Information

The `RealtimeTodoList` component shows recent events in development mode.

### Console Logging

Event subscriptions, connections, and errors are logged to the browser console.

## Troubleshooting

### Common Issues

1. **Events not received**: Check network connection and package ID
2. **Connection drops**: Ensure WebSocket connections are allowed
3. **Memory leaks**: Verify cleanup functions are called on unmount
4. **Duplicate events**: Use proper filtering and deduplication logic

### Network Configuration

Ensure your Sui client is configured for the correct network:

```typescript
// Testnet configuration
const client = new SuiClient({ 
  url: 'https://fullnode.testnet.sui.io:443' 
});
```

## Next Steps

1. Implement the basic event subscription in your app
2. Add visual indicators for connection status
3. Integrate with existing todo management logic
4. Test with actual blockchain transactions
5. Add error handling and reconnection logic

This event system provides a foundation for real-time blockchain integration that can be extended for other smart contract events beyond TodoNFT.