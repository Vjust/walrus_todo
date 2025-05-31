'use client';

import React from 'react';
import WalrusStorageIndicator from '../components/WalrusStorageIndicator';
import type { Todo } from '../types/todo';

// Example usage of the WalrusStorageIndicator component
export default function WalrusStorageIndicatorExample() {
  // Example todo with Walrus storage
  const exampleTodo: Todo = {
    id: '123',
    title: 'Complete project documentation',
    description: 'Write comprehensive documentation for the new feature',
    completed: false,
    priority: 'high',
    tags: ['documentation', 'important'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: false,
    storageLocation: 'blockchain',
    walrusBlobId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    blockchainStored: true,
    nftObjectId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
  };

  // Example with additional metadata
  const walrusMetadata = {
    size: 2048, // 2KB
    storageCost: 0.001,
    expiryEpoch: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
    uploadedAt: new Date().toISOString(),
    syncStatus: 'synced' as const
  };

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Walrus Storage Indicator Examples</h1>
      
      {/* Example 1: Basic usage */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Basic Usage</h2>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">{exampleTodo.title}</span>
            <WalrusStorageIndicator todo={exampleTodo} />
          </div>
        </div>
      </div>

      {/* Example 2: With metadata */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">With Additional Metadata</h2>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">{exampleTodo.title}</span>
            <WalrusStorageIndicator 
              todo={exampleTodo} 
              walrusMetadata={walrusMetadata}
            />
          </div>
        </div>
      </div>

      {/* Example 3: Different sync states */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Different Sync States</h2>
        
        {/* Syncing state */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Uploading todo...</span>
            <WalrusStorageIndicator 
              todo={exampleTodo} 
              walrusMetadata={{ ...walrusMetadata, syncStatus: 'syncing' }}
            />
          </div>
        </div>

        {/* Error state */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Failed to sync</span>
            <WalrusStorageIndicator 
              todo={exampleTodo} 
              walrusMetadata={{ ...walrusMetadata, syncStatus: 'error' }}
            />
          </div>
        </div>
      </div>

      {/* Example 4: Expired storage */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Expired Storage</h2>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Old todo</span>
            <WalrusStorageIndicator 
              todo={exampleTodo} 
              walrusMetadata={{
                ...walrusMetadata,
                expiryEpoch: Math.floor(Date.now() / 1000) - (24 * 60 * 60) // Expired yesterday
              }}
            />
          </div>
        </div>
      </div>

      {/* Example 5: In a todo list */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">In a Todo List</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 last:border-0"
            >
              <div className="flex items-center space-x-3">
                <input type="checkbox" className="rounded" />
                <div>
                  <p className="text-gray-700 dark:text-gray-300">Todo item {i}</p>
                  <p className="text-sm text-gray-500">Due tomorrow</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                  High
                </span>
                <WalrusStorageIndicator 
                  todo={{
                    ...exampleTodo,
                    id: `todo-${i}`,
                    title: `Todo item ${i}`
                  }} 
                  walrusMetadata={{
                    ...walrusMetadata,
                    uploadedAt: new Date(Date.now() - i * 1000).toISOString() // Different upload times
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Example 6: Without Walrus storage */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Local-only Todo (No Indicator)</h2>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Local todo without Walrus</span>
            <WalrusStorageIndicator 
              todo={{
                ...exampleTodo,
                walrusBlobId: undefined,
                storageLocation: 'local' as const
              }} 
            />
            <span className="text-sm text-gray-500">(No indicator shown for local-only todos)</span>
          </div>
        </div>
      </div>
    </div>
  );
}