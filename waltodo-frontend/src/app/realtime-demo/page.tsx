'use client';

import { useState, useEffect } from 'react';
import { websocketManager, useWebSocket } from '@/lib/websocket';
import { apiClient } from '@/lib/api-client';
import { Todo } from '@/types/todo';

const TEST_WALLET = '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456';

export default function RealtimeDemoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const { connect, disconnect, joinWallet, leaveWallet } = useWebSocket();

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs(prev => [...prev.slice(-19), `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    // Set up WebSocket event logging
    const handleConnect = () => {
      setIsConnected(true);
      addLog('🔌 WebSocket connected');
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      addLog('🔌 WebSocket disconnected');
    };

    websocketManager.on('connect', handleConnect);
    websocketManager.on('disconnect', handleDisconnect);

    // Connect and join wallet
    connect();
    if (isConnected) {
      joinWallet(TEST_WALLET);
      addLog(`🏠 Joined wallet: ${TEST_WALLET.substring(0, 10)}...`);
    }

    return () => {
      websocketManager.off('connect', handleConnect);
      websocketManager.off('disconnect', handleDisconnect);
      disconnect();
    };
  }, []);

  const loadTodos = async () => {
    try {
      const todoList = await apiClient.getTodos('default');
      setTodos(todoList);
      addLog(`📋 Loaded ${todoList.length} todos from API`);
    } catch (error) {
      addLog(`❌ Failed to load todos: ${error}`);
    }
  };

  const createTodo = async () => {
    if (!newTodoTitle.trim()) return;

    try {
      const newTodo = await apiClient.createTodo({
        title: newTodoTitle,
        description: 'Created via realtime demo',
        completed: false,
        wallet: TEST_WALLET,
      }, 'default');

      addLog(`✅ Created todo: ${newTodo.title}`);
      setNewTodoTitle('');
      await loadTodos();
    } catch (error) {
      addLog(`❌ Failed to create todo: ${error}`);
    }
  };

  const completeTodo = async (todoId: string) => {
    try {
      await apiClient.completeTodo(todoId);
      addLog(`✅ Completed todo: ${todoId.substring(0, 8)}...`);
      await loadTodos();
    } catch (error) {
      addLog(`❌ Failed to complete todo: ${error}`);
    }
  };

  const deleteTodo = async (todoId: string) => {
    try {
      await apiClient.deleteTodo(todoId);
      addLog(`🗑️ Deleted todo: ${todoId.substring(0, 8)}...`);
      await loadTodos();
    } catch (error) {
      addLog(`❌ Failed to delete todo: ${error}`);
    }
  };

  const testApiConnection = async () => {
    try {
      const health = await apiClient.healthCheck();
      addLog(`🏥 API health check: ${JSON.stringify(health)}`);
    } catch (error) {
      addLog(`❌ API health check failed: ${error}`);
    }
  };

  const connectWebSocket = () => {
    connect();
    setTimeout(() => {
      if (websocketManager.connected) {
        joinWallet(TEST_WALLET);
        addLog(`🏠 Joined wallet: ${TEST_WALLET.substring(0, 10)}...`);
      }
    }, 1000);
  };

  const disconnectWebSocket = () => {
    if (websocketManager.connected) {
      leaveWallet(TEST_WALLET);
      addLog(`🚪 Left wallet: ${TEST_WALLET.substring(0, 10)}...`);
    }
    disconnect();
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">
        🔄 Real-time Sync Demo
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls Panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>WebSocket:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Wallet:</span>
                <span className="text-sm font-mono">{TEST_WALLET.substring(0, 12)}...</span>
              </div>
            </div>
            <div className="mt-4 space-x-2">
              <button
                onClick={connectWebSocket}
                disabled={isConnected}
                className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
              >
                Connect
              </button>
              <button
                onClick={disconnectWebSocket}
                disabled={!isConnected}
                className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50"
              >
                Disconnect
              </button>
              <button
                onClick={testApiConnection}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >
                Test API
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Create Todo</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                placeholder="Enter todo title..."
                className="w-full px-3 py-2 border rounded-lg"
                onKeyPress={(e) => e.key === 'Enter' && createTodo()}
              />
              <button
                onClick={createTodo}
                disabled={!newTodoTitle.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                Create Todo
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <button
                onClick={loadTodos}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg"
              >
                Refresh Todos
              </button>
            </div>
          </div>
        </div>

        {/* Display Panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">
              Todos ({todos.length})
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {todos.length === 0 ? (
                <p className="text-gray-500 italic">No todos found</p>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className={`font-medium ${
                        todo.completed ? 'line-through text-gray-500' : ''
                      }`}>
                        {todo.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {todo.description}
                      </p>
                      <p className="text-xs text-gray-400">
                        ID: {todo.id.substring(0, 8)}...
                      </p>
                    </div>
                    <div className="flex space-x-1">
                      {!todo.completed && (
                        <button
                          onClick={() => completeTodo(todo.id)}
                          className="px-2 py-1 bg-green-600 text-white text-sm rounded"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="px-2 py-1 bg-red-600 text-white text-sm rounded"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm">
            <h2 className="text-lg font-semibold mb-2 text-white">Event Log</h2>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <p className="text-gray-500">No events yet...</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Testing Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-blue-800 text-sm">
          <li>Ensure API server is running on localhost:3001</li>
          <li>Start the CLI sync daemon: <code className="bg-blue-200 px-1 rounded">waltodo daemon --wallet {TEST_WALLET.substring(0, 12)}...</code></li>
          <li>Create todos here and watch them sync to CLI file system</li>
          <li>Modify todos via CLI and watch them appear here in real-time</li>
          <li>Check the event log for WebSocket events and sync operations</li>
        </ol>
      </div>
    </div>
  );
}