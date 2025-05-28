'use client';

import React from 'react';
import { ReactQueryTodoList } from '@/components/ReactQueryTodoList';
import { useWebSocket } from '@/lib/websocket';
import { useTodoStore } from '@/stores/todoStore';
import { useWalletContext } from '@/contexts/WalletContext';

export default function RealtimeDemoPage() {
  const { connected, account } = useWalletContext();
  const { connected: wsConnected, socketId } = useWebSocket();
  const { 
    uiState: { activeList },
    lists,
    settings,
    updateSettings,
    setActiveList,
    createList 
  } = useTodoStore();

  const handleCreateList = () => {
    const name = prompt('Enter list name:');
    if (name && !lists.includes(name)) {
      createList(name);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🌊 Real-time Todo Demo
          </h1>
          <p className="text-gray-600">
            React Query + WebSocket + Zustand integration showcase
          </p>
        </div>

        {/* Status Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Wallet Status */}
          <div className="bg-white rounded-lg p-4 border shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">💳 Wallet</h3>
            <div className="space-y-1 text-sm">
              <div className={`flex items-center space-x-2`}>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{connected ? 'Connected' : 'Disconnected'}</span>
              </div>
              {connected && account && (
                <div className="text-xs text-gray-500 font-mono">
                  {account.address.slice(0, 8)}...{account.address.slice(-6)}
                </div>
              )}
            </div>
          </div>

          {/* WebSocket Status */}
          <div className="bg-white rounded-lg p-4 border shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">🔌 WebSocket</h3>
            <div className="space-y-1 text-sm">
              <div className={`flex items-center space-x-2`}>
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{wsConnected ? 'Connected' : 'Connecting'}</span>
              </div>
              {socketId && (
                <div className="text-xs text-gray-500 font-mono">
                  ID: {socketId.slice(0, 8)}
                </div>
              )}
            </div>
          </div>

          {/* Store Status */}
          <div className="bg-white rounded-lg p-4 border shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">🗄️ Store</h3>
            <div className="space-y-1 text-sm">
              <div>Lists: {lists.length}</div>
              <div>Active: {activeList}</div>
              <div className="text-xs text-gray-500">
                Auto-sync: {settings.autoSync ? 'On' : 'Off'}
              </div>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="bg-white rounded-lg p-4 border shadow-sm mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">⚙️ Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.autoSync}
                onChange={(e) => updateSettings({ autoSync: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Auto Sync</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.syncToWalrus}
                onChange={(e) => updateSettings({ syncToWalrus: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Sync to Walrus</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.syncToBlockchain}
                onChange={(e) => updateSettings({ syncToBlockchain: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Sync to Blockchain</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => updateSettings({ notifications: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Notifications</span>
            </label>
          </div>
        </div>

        {/* List Management */}
        <div className="bg-white rounded-lg p-4 border shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">📋 Lists</h3>
            <button
              onClick={handleCreateList}
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
            >
              + New List
            </button>
          </div>
          
          <div className="flex space-x-2 overflow-x-auto">
            {lists.map((list) => (
              <button
                key={list}
                onClick={() => setActiveList(list)}
                className={`px-3 py-1 rounded text-sm whitespace-nowrap ${
                  activeList === list
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {list}
              </button>
            ))}
          </div>
        </div>

        {/* Main Todo List */}
        <div className="bg-white rounded-lg p-6 border shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📝 {activeList} Todos
          </h2>
          
          {connected ? (
            <ReactQueryTodoList listName={activeList} />
          ) : (
            <div className="text-center py-12">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-yellow-800 font-medium mb-2">Wallet Required</h3>
                <p className="text-yellow-700 text-sm mb-4">
                  Connect your wallet to start using real-time todos with React Query and WebSocket integration.
                </p>
                <div className="text-xs text-yellow-600">
                  Features available after connection:
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Real-time todo synchronization across devices</li>
                    <li>Optimistic updates with React Query</li>
                    <li>WebSocket live notifications</li>
                    <li>Zustand state management</li>
                    <li>Blockchain integration</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Technical Info */}
        <div className="mt-8 bg-gray-50 rounded-lg p-4 border">
          <h4 className="font-medium text-gray-900 mb-2">🔧 Technical Stack</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">State Management</div>
              <div className="text-gray-600">Zustand + React Query</div>
            </div>
            <div>
              <div className="font-medium">Real-time</div>
              <div className="text-gray-600">Socket.IO WebSocket</div>
            </div>
            <div>
              <div className="font-medium">Data Fetching</div>
              <div className="text-gray-600">React Query + Optimistic Updates</div>
            </div>
            <div>
              <div className="font-medium">Storage</div>
              <div className="text-gray-600">API + Walrus + Blockchain</div>
            </div>
          </div>
        </div>

        {/* Development Tools */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Development mode: React Query DevTools available in bottom-right corner
            </p>
          </div>
        )}
      </div>
    </div>
  );
}