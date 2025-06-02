/**
 * Example usage of enhanced blockchain event hooks with NFT support
 * This demonstrates all the new features added to useBlockchainEvents
 */

'use client';

import { useState, useEffect } from 'react';
import { useBlockchainEvents, useTodoEvents, useTodoStateSync } from '@/hooks/useBlockchainEvents';
import type { Todo } from '@/types/todo-nft';

/**
 * Example 1: Basic NFT event monitoring with statistics
 */
export function NFTEventMonitor() {
  const {
    connectionState,
    eventStatistics,
    queryHistoricalEvents,
    clearEventData,
  } = useBlockchainEvents({
    enableHistorical: true,
    debounceConfig: { delay: 300, maxWait: 1000 },
  });

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">NFT Event Monitor</h3>
      
      <div className="space-y-2">
        <p>Connection: {connectionState.connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
        <p>Total Events: {eventStatistics.totalEvents}</p>
        <p>Created: {eventStatistics.createdCount}</p>
        <p>Completed: {eventStatistics.completedCount}</p>
        <p>Updated: {eventStatistics.updatedCount}</p>
        <p>Transferred: {eventStatistics.transferredCount}</p>
      </div>

      <div className="mt-4 space-x-2">
        <button
          onClick={async () => {
            const events = await queryHistoricalEvents({
              startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            });
            console.log('Historical events:', events);
          }}
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Load History
        </button>
        <button
          onClick={clearEventData}
          className="px-3 py-1 bg-gray-500 text-white rounded"
        >
          Clear Data
        </button>
      </div>
    </div>
  );
}

/**
 * Example 2: Filtered event subscription by wallet
 */
export function WalletSpecificEvents({ walletAddress }: { walletAddress: string }) {
  const [eventLog, setEventLog] = useState<string[]>([]);

  const { recentEvents, getEventsByOwner } = useTodoEvents({
    owner: walletAddress,
    filter: {
      owner: walletAddress,
      eventTypes: ['TodoNFTCreated', 'TodoNFTCompleted', 'TodoNFTTransferred'],
    },
    onTodoCreated: (todo) => {
      setEventLog(prev => [...prev, `Created: ${todo.title} (${todo.id})`]);
    },
    onTodoCompleted: (todo) => {
      setEventLog(prev => [...prev, `Completed: ${todo.id}`]);
    },
    onTodoTransferred: ({ todoId, from, to }) => {
      setEventLog(prev => [...prev, `Transferred: ${todoId} from ${from} to ${to}`]);
    },
    debounceConfig: { delay: 500 }, // Debounce rapid updates
  });

  const myEvents = getEventsByOwner(walletAddress);

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Wallet Events: {walletAddress.slice(0, 8)}...</h3>
      
      <div className="mb-4">
        <p>Recent Events: {recentEvents.length}</p>
        <p>My Events: {myEvents.length}</p>
      </div>

      <div className="h-32 overflow-y-auto border p-2 text-sm">
        {eventLog.map((log, index) => (
          <div key={index} className="mb-1">{log}</div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example 3: Real-time todo sync with NFT ownership tracking
 */
export function NFTTodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);

  const {
    syncedTodos,
    nftOwnership,
    getTodosByOwner,
    isOwnedByCurrentUser,
    eventStatistics,
  } = useTodoStateSync({
    todos,
    onTodoChange: setTodos,
    enableHistorical: true,
    debounceConfig: { delay: 300 },
  });

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">NFT Todo List (Real-time Sync)</h3>
      
      <div className="mb-4 text-sm">
        <p>Total Todos: {syncedTodos.length}</p>
        <p>NFT Ownership Tracked: {nftOwnership.size}</p>
        <p>Events Processed: {eventStatistics.totalEvents}</p>
      </div>

      <div className="space-y-2">
        {syncedTodos.map(todo => {
          const isOwned = isOwnedByCurrentUser(todo.id);
          const owner = nftOwnership.get(todo.id);
          
          return (
            <div
              key={todo.id}
              className={`p-2 border rounded ${isOwned ? 'bg-blue-50' : 'bg-gray-50'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{todo.title}</h4>
                  {todo.isNFT && (
                    <p className="text-xs text-gray-600">
                      NFT • Owner: {owner?.slice(0, 8)}...
                      {todo.nftData?.transferredAt && ' • Transferred'}
                    </p>
                  )}
                </div>
                <span className={`text-sm ${todo.completed ? 'text-green-600' : 'text-gray-400'}`}>
                  {todo.completed ? '✓' : '○'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Example 4: Event replay for missed events
 */
export function EventReplayDemo() {
  const {
    connectionState,
    markEventForReplay,
    eventCache,
  } = useBlockchainEvents({
    enableReconnect: true,
    maxReconnectAttempts: 5,
  });

  const simulateDisconnection = () => {
    // Mark some events for replay
    ['todo1', 'todo2', 'todo3'].forEach(todoId => {
      markEventForReplay(todoId);
    });
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Event Replay Demo</h3>
      
      <p className="mb-2">
        Reconnect Attempts: {connectionState.reconnectAttempts} / 5
      </p>
      
      <p className="mb-4">
        Cached Events: {eventCache.length}
      </p>

      <button
        onClick={simulateDisconnection}
        className="px-3 py-1 bg-orange-500 text-white rounded"
      >
        Simulate Missed Events
      </button>
    </div>
  );
}

/**
 * Example 5: Complete dashboard combining all features
 */
export function NFTEventDashboard() {
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">NFT Event Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <NFTEventMonitor />
        
        <EventReplayDemo />
        
        {selectedWallet && (
          <WalletSpecificEvents walletAddress={selectedWallet} />
        )}
        
        <NFTTodoList initialTodos={[]} />
      </div>
      
      <div className="mt-6">
        <input
          type="text"
          placeholder="Enter wallet address to monitor..."
          value={selectedWallet}
          onChange={(e) => setSelectedWallet(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
    </div>
  );
}

export default NFTEventDashboard;