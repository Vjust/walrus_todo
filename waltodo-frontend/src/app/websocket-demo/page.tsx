'use client';

import { useState, useEffect } from 'react';
import { useWebSocketContext, useWebSocketStatus } from '@/contexts/WebSocketContext';
import { WebSocketStatus } from '@/components/WebSocketStatus';
import { useWalletContext } from '@/contexts/WalletContext';
import { websocketManager } from '@/lib/websocket';
import toast from 'react-hot-toast';

export default function WebSocketDemoPage() {
  const { isConnected, connect, disconnect } = useWebSocketContext();
  const { statusText, statusColor } = useWebSocketStatus();
  const { address, connected: walletConnected } = useWalletContext();
  const [events, setEvents] = useState<Array<{ id: string; type: string; data: any; timestamp: Date }>>([]);
  const [testTodoId, setTestTodoId] = useState('');

  // Log WebSocket events
  useEffect(() => {
    const socket = websocketManager.getSocket();
    if (!socket) return;
    
    const handlers = {
      'todo-created': (data: any) => {
        setEvents(prev => [{
          id: Date.now().toString(),
          type: 'todo-created',
          data,
          timestamp: new Date()
        }, ...prev.slice(0, 19)]);
        toast.success(`Todo created: ${data.title}`);
      },
      'todo-updated': (data: any) => {
        setEvents(prev => [{
          id: Date.now().toString(),
          type: 'todo-updated',
          data,
          timestamp: new Date()
        }, ...prev.slice(0, 19)]);
        toast.info(`Todo updated: ${data.title}`);
      },
      'todo-deleted': (data: any) => {
        setEvents(prev => [{
          id: Date.now().toString(),
          type: 'todo-deleted',
          data,
          timestamp: new Date()
        }, ...prev.slice(0, 19)]);
        toast.error(`Todo deleted: ${data.id}`);
      },
      'sync-requested': (data: any) => {
        setEvents(prev => [{
          id: Date.now().toString(),
          type: 'sync-requested',
          data,
          timestamp: new Date()
        }, ...prev.slice(0, 19)]);
        toast.success('Sync requested for wallet: ' + data.wallet);
      },
      'auth-success': (data: any) => {
        setEvents(prev => [{
          id: Date.now().toString(),
          type: 'auth-success',
          data,
          timestamp: new Date()
        }, ...prev.slice(0, 19)]);
      },
      'joined-wallet': (data: any) => {
        setEvents(prev => [{
          id: Date.now().toString(),
          type: 'joined-wallet',
          data,
          timestamp: new Date()
        }, ...prev.slice(0, 19)]);
      }
    };

    // Attach all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event as any, handler);
    });

    // Cleanup
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event as any, handler);
      });
    };
  }, []);

  const simulateTodoCreate = async () => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': address,
        },
        body: JSON.stringify({
          title: `Test Todo ${new Date().toLocaleTimeString()}`,
          description: 'Created via WebSocket demo',
          priority: 'medium',
          tags: ['demo', 'websocket'],
          wallet: address,
        }),
      });

      if (!response.ok) throw new Error('Failed to create todo');
      
      const todo = await response.json();
      setTestTodoId(todo.id);
      toast.success('Todo created! Check the events log.');
    } catch (error) {
      toast.error('Failed to create todo');
      console.error(error);
    }
  };

  const simulateTodoUpdate = async () => {
    if (!address || !testTodoId) {
      toast.error('Please create a todo first');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/todos/${testTodoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': address,
        },
        body: JSON.stringify({
          completed: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to update todo');
      
      toast.success('Todo updated! Check the events log.');
    } catch (error) {
      toast.error('Failed to update todo');
      console.error(error);
    }
  };

  const simulateTodoDelete = async () => {
    if (!address || !testTodoId) {
      toast.error('Please create a todo first');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/todos/${testTodoId}`, {
        method: 'DELETE',
        headers: {
          'x-wallet-address': address,
        },
      });

      if (!response.ok) throw new Error('Failed to delete todo');
      
      toast.success('Todo deleted! Check the events log.');
      setTestTodoId('');
    } catch (error) {
      toast.error('Failed to delete todo');
      console.error(error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">WebSocket Demo</h1>

      {/* Connection Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>WebSocket Status:</span>
            <WebSocketStatus size="medium" />
          </div>
          
          <div className="flex items-center justify-between">
            <span>Wallet Connected:</span>
            <span className={walletConnected ? 'text-green-500' : 'text-red-500'}>
              {walletConnected ? 'Yes' : 'No'}
            </span>
          </div>
          
          {address && (
            <div className="flex items-center justify-between">
              <span>Wallet Address:</span>
              <span className="text-xs font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={connect}
            disabled={isConnected}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect WebSocket
          </button>
          
          <button
            onClick={disconnect}
            disabled={!isConnected}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Disconnect WebSocket
          </button>
        </div>
      </div>

      {/* Test Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Test Real-time Updates</h2>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Click the buttons below to simulate todo operations. If WebSocket is connected, 
          you should see real-time events appear in the log below.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={simulateTodoCreate}
            disabled={!isConnected || !walletConnected}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Todo
          </button>
          
          <button
            onClick={simulateTodoUpdate}
            disabled={!isConnected || !testTodoId}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update Todo
          </button>
          
          <button
            onClick={simulateTodoDelete}
            disabled={!isConnected || !testTodoId}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Todo
          </button>
        </div>
        
        {testTodoId && (
          <p className="mt-4 text-sm text-gray-600">
            Test Todo ID: <span className="font-mono">{testTodoId}</span>
          </p>
        )}
      </div>

      {/* Events Log */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Real-time Events Log</h2>
        
        {events.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No events received yet. Try creating a todo above!
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {event.type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {event.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="font-semibold mb-2">How it works:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Connect your wallet using the button in the navbar</li>
          <li>The WebSocket connection will automatically establish</li>
          <li>Create, update, or delete todos using the buttons above</li>
          <li>Watch real-time events appear in the log</li>
          <li>Open this page in multiple tabs to see cross-tab synchronization!</li>
        </ol>
      </div>
    </div>
  );
}