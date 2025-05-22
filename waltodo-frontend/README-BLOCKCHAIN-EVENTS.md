# Sui Blockchain Real-time Event System

This implementation provides real-time blockchain event subscriptions for TodoNFT smart contracts using the Sui blockchain. The system enables automatic frontend updates when blockchain events occur, creating a seamless Web3 user experience.

## 🏗️ Architecture Overview

The system consists of four main layers:

1. **Event Manager** - Core blockchain event subscription and connection management
2. **React Hooks** - React integration with automatic state management
3. **UI Components** - Visual indicators and real-time updates
4. **Integration Layer** - Seamless integration with existing components

## 📁 File Structure

```
src/
├── lib/
│   └── blockchain-events.ts      # Core event manager and utilities
├── hooks/
│   ├── useBlockchainEvents.ts    # React hooks for event subscriptions
│   └── useInactivityTimer.ts     # Inactivity timer for wallet sessions
├── components/
│   ├── BlockchainEventStatus.tsx # Event connection status components
│   ├── RealtimeTodoList.tsx      # Enhanced todo list with real-time updates
│   └── todo-list.tsx             # Updated existing todo list component
├── types/
│   └── blockchain-events.ts      # TypeScript definitions
├── examples/
│   └── blockchain-events-usage.tsx # Usage examples and demos
└── __tests__/
    └── hooks/
        └── useBlockchainEvents.test.tsx # Comprehensive tests
```

## 🚀 Quick Start

### 1. Basic Event Subscription

```typescript
import { useBlockchainEvents } from '@/hooks/useBlockchainEvents';

function MyComponent() {
  const { isConnected, startSubscription, stopSubscription } = useBlockchainEvents({
    autoStart: true,
    owner: walletAddress,
    enableReconnect: true,
  });

  return (
    <div>
      Status: {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );
}
```

### 2. Handle Todo Events

```typescript
import { useTodoEvents } from '@/hooks/useBlockchainEvents';

function TodoEventHandler() {
  const { recentEvents } = useTodoEvents({
    autoStart: true,
    onTodoCreated: (todo) => console.log('New todo:', todo),
    onTodoCompleted: (todo) => console.log('Todo completed:', todo),
    onTodoUpdated: (todo) => console.log('Todo updated:', todo),
    onTodoDeleted: (todoId) => console.log('Todo deleted:', todoId),
  });

  return <div>Recent events: {recentEvents.length}</div>;
}
```

### 3. Automatic State Synchronization

```typescript
import { useTodoStateSync } from '@/hooks/useBlockchainEvents';

function SyncedTodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  
  const { syncedTodos } = useTodoStateSync({
    todos,
    onTodoChange: (updatedTodos) => setTodos(updatedTodos),
    owner: walletAddress,
    autoStart: true,
  });

  return (
    <div>
      {syncedTodos.map(todo => (
        <div key={todo.id}>{todo.title}</div>
      ))}
    </div>
  );
}
```

### 4. Real-time Todo List Component

```typescript
import { RealtimeTodoList } from '@/components/RealtimeTodoList';

function MyTodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  
  return (
    <RealtimeTodoList
      initialTodos={todos}
      listName="My Todos"
      onTodoUpdate={(updatedTodos) => setTodos(updatedTodos)}
      onTodoComplete={async (todo) => {
        await completeTodoOnBlockchain(todo.objectId!);
      }}
      onTodoDelete={async (todoId) => {
        await deleteTodoFromBlockchain(todoId);
      }}
      showEventIndicator={true}
    />
  );
}
```

## 🎯 Key Features

### Real-time Event Handling
- **TodoNFTCreated** - New todo NFT creation events
- **TodoNFTCompleted** - Todo completion events
- **TodoNFTUpdated** - Todo metadata update events
- **TodoNFTDeleted** - Todo deletion events
- **TodoNFTTransferred** - NFT ownership transfer events

### Connection Management
- **Auto-reconnection** - Automatic reconnection on network issues
- **Error handling** - Comprehensive error handling and recovery
- **Connection status** - Visual indicators for connection state
- **Health monitoring** - Periodic connection health checks

### State Synchronization
- **Optimistic updates** - Immediate UI updates with blockchain confirmation
- **Automatic syncing** - State automatically syncs with blockchain events
- **Conflict resolution** - Handles conflicts between local and blockchain state
- **Memory management** - Proper cleanup to prevent memory leaks

### TypeScript Support
- **Full type safety** - Complete TypeScript definitions
- **Event type guards** - Type-safe event handling
- **Generic hooks** - Flexible, reusable hook patterns
- **Interface compatibility** - Consistent interfaces across components

## 🔧 Configuration Options

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

## 🎨 UI Components

### BlockchainEventStatus
Shows detailed connection status with reconnection options:

```typescript
<BlockchainEventStatus 
  showReconnectButton={true}
  showDetails={true}
  className="mb-4"
/>
```

### BlockchainEventIndicator
Compact status indicator for headers/navbars:

```typescript
<BlockchainEventIndicator className="ml-4" />
```

### RealtimeTodoList
Enhanced todo list with real-time updates:

```typescript
<RealtimeTodoList
  initialTodos={todos}
  listName="My Todos"
  onTodoUpdate={handleTodoUpdate}
  showEventIndicator={true}
/>
```

## 🔄 Event Flow

1. **Connection Setup**
   - Initialize SuiClient
   - Subscribe to TodoNFT events
   - Set up event filters

2. **Event Processing**
   - Receive blockchain events
   - Parse event data
   - Transform to local format

3. **State Updates**
   - Update local state
   - Notify React components
   - Trigger UI updates

4. **Error Handling**
   - Detect connection issues
   - Attempt reconnection
   - Show user feedback

## 🧪 Testing

The implementation includes comprehensive tests covering:

- **Hook behavior** - Event subscription and state management
- **Error scenarios** - Connection failures and recovery
- **State synchronization** - Automatic state updates
- **Memory management** - Proper cleanup on unmount

Run tests with:
```bash
npm test -- --testPathPattern=useBlockchainEvents
```

## 🐛 Troubleshooting

### Common Issues

1. **Events not received**
   - Verify wallet connection
   - Check network configuration
   - Ensure correct package ID

2. **Connection drops**
   - Check WebSocket support
   - Verify network stability
   - Review reconnection settings

3. **Memory leaks**
   - Ensure proper cleanup
   - Check useEffect dependencies
   - Verify event listener removal

4. **Type errors**
   - Update TypeScript definitions
   - Check import paths
   - Verify interface compatibility

### Debug Information

Enable debug logging by adding to your environment:
```bash
NEXT_PUBLIC_NODE_ENV=development
```

Check browser console for detailed logs:
- Event subscriptions
- Connection status
- Error messages
- Performance metrics

## 🚀 Performance Considerations

### Optimization Strategies

1. **Event Filtering**
   - Use owner filters to reduce network traffic
   - Subscribe only to needed event types
   - Implement client-side filtering for complex queries

2. **State Management**
   - Use optimistic updates for better UX
   - Implement proper memoization
   - Avoid unnecessary re-renders

3. **Memory Management**
   - Clean up subscriptions on unmount
   - Use proper dependency arrays
   - Implement event throttling

4. **Network Efficiency**
   - Configure appropriate reconnection delays
   - Use exponential backoff for retries
   - Monitor connection health

## 🛠️ Integration with Existing Code

### Update TodoList Component

The existing `todo-list.tsx` has been enhanced with:
- Real-time event subscriptions
- Blockchain status indicators
- Optimistic UI updates
- Explorer links for on-chain todos

### Wallet Context Integration

The event system integrates with the existing wallet context:
- Automatic subscription on wallet connect
- Proper cleanup on disconnect
- Address-based event filtering

### Local Storage Sync

Events are synchronized with local storage:
- Persistent state across sessions
- Fallback for offline functionality
- Conflict resolution strategies

## 📈 Future Enhancements

Potential improvements and extensions:

1. **Event Persistence**
   - Store events in local database
   - Implement event replay functionality
   - Add event search and filtering

2. **Advanced Filtering**
   - Complex query builders
   - Time-based filters
   - Multi-criteria filtering

3. **Batch Operations**
   - Handle multiple events together
   - Optimize network requests
   - Implement transaction batching

4. **Analytics Integration**
   - Track event patterns
   - Performance monitoring
   - User behavior analysis

## 📚 Additional Resources

- [Integration Guide](../docs/blockchain-event-integration-guide.md)
- [Usage Examples](./src/examples/blockchain-events-usage.tsx)
- [Type Definitions](./src/types/blockchain-events.ts)
- [Test Suite](./src/__tests__/hooks/useBlockchainEvents.test.tsx)

## 🤝 Contributing

When contributing to the event system:

1. **Follow TypeScript best practices**
2. **Add comprehensive tests**
3. **Update documentation**
4. **Consider performance implications**
5. **Test with actual blockchain transactions**

## 📄 License

This blockchain event system is part of the Walrus Todo application and follows the same license terms.