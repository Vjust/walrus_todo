'use client';

import React, { useMemo } from 'react';
import { TodoNFTCard } from '@/components/TodoNFTCard';
import { TodoNFTDisplay, todoToNFTDisplay } from '@/types/nft-display';
import { Todo } from '@/types/todo-nft';
import { toast } from 'react-hot-toast';

// Mock todo data for demonstration
const mockTodos: Todo[] = [
  {
    id: '1',
    title: 'Launch NFT Collection',
    description: 'Create and deploy our first NFT collection on Sui blockchain with stunning artwork',
    completed: false,
    priority: 'high',
    dueDate: '2024-12-31',
    tags: ['blockchain', 'nft', 'launch'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    private: false,
    walrusBlobId: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
    nftObjectId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    objectId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    blockchainStored: true,
    imageUrl: 'walrus://abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
    category: 'Project',
    listName: 'Q1 Goals',
  },
  {
    id: '2',
    title: 'Smart Contract Audit',
    description: 'Complete security audit for our Move smart contracts',
    completed: true,
    priority: 'medium',
    tags: ['security', 'smart-contract'],
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    completedAt: '2024-01-20T14:30:00Z',
    private: false,
    walrusBlobId: 'def456ghi789jkl012mno345pqr678stu901vwx234yz567abc123',
    nftObjectId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    objectId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    blockchainStored: true,
    imageUrl: 'walrus://def456ghi789jkl012mno345pqr678stu901vwx234yz567abc123',
    category: 'Development',
    listName: 'Q1 Goals',
  },
  {
    id: '3',
    title: 'Community Building',
    description: 'Grow our Discord community to 10,000 members with active engagement',
    completed: false,
    priority: 'low',
    dueDate: '2024-03-31',
    tags: ['community', 'marketing', 'growth'],
    createdAt: '2024-01-05T08:00:00Z',
    updatedAt: '2024-01-05T08:00:00Z',
    private: false,
    walrusBlobId: 'ghi789jkl012mno345pqr678stu901vwx234yz567abc123def456',
    nftObjectId: '0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234',
    objectId: '0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234',
    blockchainStored: true,
    imageUrl: 'walrus://ghi789jkl012mno345pqr678stu901vwx234yz567abc123def456',
    category: 'Marketing',
    listName: 'Q1 Goals',
  },
];

export default function NFTDemoPage() {
  // Convert todos to NFT display format
  const nftTodos: TodoNFTDisplay[] = useMemo(() => {
    return mockTodos.map(todo => todoToNFTDisplay(todo, {
      mode: 'gallery',
      enableLazyLoading: true,
    }));
  }, []);

  // Handle complete action
  const handleComplete = async (todoId: string) => {
    console.log('Completing todo:', todoId);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success(`Todo ${todoId} marked as completed!`);
  };

  // Handle transfer action
  const handleTransfer = async (todoId: string, recipient: string) => {
    console.log('Transferring todo:', todoId, 'to:', recipient);
    // Simulate blockchain transaction
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast.success(`NFT transferred to ${recipient}`);
  };

  // Handle card click
  const handleCardClick = (todo: TodoNFTDisplay) => {
    console.log('Card clicked:', todo);
    toast(`Clicked on: ${todo.title}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Todo NFT Gallery</h1>
          <p className="mt-2 text-gray-600">
            Interactive NFT cards with flip animation and rich metadata display
          </p>
        </div>

        {/* Display Mode Demos */}
        <div className="space-y-12">
          {/* Gallery View */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Gallery View</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nftTodos.map((todo) => (
                <TodoNFTCard
                  key={todo.id}
                  todo={todo}
                  displayMode="gallery"
                  onComplete={handleComplete}
                  onTransfer={handleTransfer}
                  onClick={handleCardClick}
                  showActions={true}
                  enableFlip={true}
                />
              ))}
            </div>
          </section>

          {/* Thumbnail View */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Thumbnail View</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {nftTodos.map((todo) => (
                <TodoNFTCard
                  key={`thumb-${todo.id}`}
                  todo={todo}
                  displayMode="thumbnail"
                  showActions={false}
                  enableFlip={false}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          </section>

          {/* Loading State Demo */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Loading States</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <TodoNFTCard
                todo={nftTodos[0]}
                displayMode="preview"
                loading={true}
              />
              <TodoNFTCard
                todo={{ ...nftTodos[1], loadingState: 'error', imageLoadError: 'Failed to load image from Walrus' }}
                displayMode="preview"
              />
              <TodoNFTCard
                todo={nftTodos[2]}
                displayMode="preview"
                showActions={true}
              />
            </div>
          </section>

          {/* Interactive Features */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Interactive Features</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-800">
                <strong>Try these interactions:</strong>
              </p>
              <ul className="list-disc list-inside mt-2 text-blue-700">
                <li>Click on any card to flip it and see detailed metadata</li>
                <li>Use the "Complete" button to mark todos as done</li>
                <li>Click "Transfer" to see the NFT transfer modal</li>
                <li>Click the external link icon to view on Sui Explorer</li>
              </ul>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {nftTodos.slice(0, 2).map((todo) => (
                <TodoNFTCard
                  key={`interactive-${todo.id}`}
                  todo={{
                    ...todo,
                    metadata: JSON.stringify({
                      version: '1.0',
                      created_by: 'WalTodo App',
                      chain: 'Sui Testnet',
                      contract: '0xabc...def',
                      attributes: {
                        rarity: 'common',
                        edition: 1,
                        max_supply: 1000,
                      }
                    }),
                    contentData: {
                      attachments: ['file1.pdf', 'file2.jpg'],
                      checklist: [
                        { text: 'Design mockups', completed: true },
                        { text: 'Implement smart contract', completed: true },
                        { text: 'Deploy to testnet', completed: false },
                      ],
                      links: ['https://github.com/example/repo'],
                      customFields: {
                        notes: 'This is an important milestone for our project.',
                      },
                    }
                  }}
                  displayMode="full"
                  onComplete={handleComplete}
                  onTransfer={handleTransfer}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          </section>

          {/* Different Priority Examples */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Priority Variations</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['high', 'medium', 'low'] as const).map((priority, index) => (
                <TodoNFTCard
                  key={`priority-${priority}`}
                  todo={{
                    ...nftTodos[index],
                    priority,
                    title: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority Task`,
                  }}
                  displayMode="preview"
                  showActions={true}
                  enableFlip={true}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}