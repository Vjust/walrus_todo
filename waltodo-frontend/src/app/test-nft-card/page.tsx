'use client';

import React, { useState } from 'react';
import { TodoNFTCard } from '@/components/TodoNFTCard';
import type { Todo } from '@/types/todo-nft';

/**
 * Test page for TodoNFTCard component
 * Demonstrates various states and configurations
 */
export default function TestNFTCardPage() {
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  // Sample todo NFTs with different states
  const sampleTodos: Todo[] = [
    {
      id: '1',
      objectId: '0x123abc456def789012345678901234567890123456789012345678901234567890',
      title: 'Complete Project Documentation',
      description: 'Write comprehensive documentation for the NFT marketplace including user guides, API docs, and deployment instructions.',
      completed: false,
      priority: 'high',
      tags: ['documentation', 'urgent', 'Q4-2024'],
      blockchainStored: true,
      imageUrl: 'walrus://blobId/123abc456def',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      owner: '0xabcdef123456789012345678901234567890123456789012345678901234567890',
      metadata: JSON.stringify({
        category: 'Development',
        effort: 'Large',
        team: 'Engineering',
        version: '1.0.0'
      }),
      isPrivate: false,
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString()
    },
    {
      id: '2',
      objectId: '0x234bcd567efg890123456789012345678901234567890123456789012345678901',
      title: 'Deploy Smart Contracts',
      description: 'Deploy and verify all smart contracts on mainnet.',
      completed: true,
      priority: 'medium',
      tags: ['blockchain', 'deployment'],
      blockchainStored: true,
      imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=400&fit=crop',
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      owner: '0xabcdef123456789012345678901234567890123456789012345678901234567890',
      metadata: JSON.stringify({
        network: 'mainnet',
        gasUsed: '0.5 SUI',
        contractVersion: '2.1.0'
      }),
      isPrivate: false
    },
    {
      id: '3',
      objectId: '0x345cde678fgh901234567890123456789012345678901234567890123456789012',
      title: 'Private Research Notes',
      description: 'Confidential research findings and analysis.',
      completed: false,
      priority: 'low',
      tags: ['research', 'confidential'],
      blockchainStored: true,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      owner: '0xabcdef123456789012345678901234567890123456789012345678901234567890',
      metadata: JSON.stringify({
        classification: 'Confidential',
        department: 'R&D'
      }),
      isPrivate: true
    }
  ];

  const [todos, setTodos] = useState<Todo[]>(sampleTodos);

  const handleUpdate = (updatedTodo: Todo) => {
    setTodos(todos.map(t => t.id === updatedTodo.id ? updatedTodo : t));
    console.log('Todo updated:', updatedTodo);
  };

  const handleDelete = (deletedTodo: Todo) => {
    setTodos(todos.filter(t => t.id !== deletedTodo.id));
    console.log('Todo deleted:', deletedTodo);
  };

  const handleTransfer = (todo: Todo) => {
    setSelectedTodo(todo);
    console.log('Transfer initiated for:', todo);
    alert(`Transfer NFT: ${todo.title}\nObject ID: ${todo.objectId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Todo NFT Card Component Test
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Interactive demonstration of the TodoNFTCard component showing various states,
            priorities, and the flip animation for metadata display.
          </p>
        </div>

        {/* Component States Demo */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Component States</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Loading State */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Loading State</h3>
              <TodoNFTCard
                todo={sampleTodos[0]}
                loading={true}
                showActions={true}
              />
            </div>

            {/* Error State */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Error State</h3>
              <TodoNFTCard
                todo={sampleTodos[0]}
                error="Failed to load NFT data from blockchain"
                showActions={true}
              />
            </div>

            {/* No Actions */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">No Actions</h3>
              <TodoNFTCard
                todo={sampleTodos[1]}
                showActions={false}
              />
            </div>
          </div>
        </div>

        {/* Active NFT Cards */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Active NFT Cards</h2>
          <p className="text-gray-600 mb-6">
            Click the info icon on each card to flip and view detailed metadata.
            Try the action buttons to see the interactions.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {todos.map((todo) => (
              <TodoNFTCard
                key={todo.id}
                todo={todo}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onTransfer={handleTransfer}
                showActions={true}
              />
            ))}
          </div>
        </div>

        {/* Features Showcase */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Component Features</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Visual Features</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  NFT image display with lazy loading and expansion
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  3D flip animation to reveal metadata
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Priority badges with color coding
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Completion status indicators
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Owner address with tooltip
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Interactive Features</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Complete action with blockchain integration
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Transfer NFT functionality
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  View on blockchain explorer
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Loading and error states
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Responsive grid layout
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <h3 className="text-lg font-medium text-gray-700 mb-2">Usage Example</h3>
            <pre className="text-sm overflow-x-auto">
              <code>{`import { TodoNFTCard } from '@/components/TodoNFTCard';

<TodoNFTCard
  todo={todoData}
  onUpdate={handleUpdate}
  onDelete={handleDelete}
  onTransfer={handleTransfer}
  showActions={true}
  loading={false}
  error={null}
  className="custom-class"
/>`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}