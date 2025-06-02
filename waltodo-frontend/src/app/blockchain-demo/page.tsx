'use client';

import { useState } from 'react';
import { BlockchainTodoList } from '@/components/blockchain-todo-list';
import { blockchainTodoService } from '@/lib/todo-service-blockchain';
import { useWalletContext } from '@/contexts/WalletContext';
import toast from 'react-hot-toast';

/**
 * Blockchain Demo Page
 * Demonstrates the new CLI-frontend integration using blockchain-first architecture
 */
export default function BlockchainDemo() {
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const walletContext = useWalletContext();
  const { address, connected, signAndExecuteTransaction } = walletContext || {};

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTodoTitle.trim()) {
      toast.error('Please enter a todo title');
      return;
    }

    if (!address || !signAndExecuteTransaction) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsCreating(true);

    try {
      await blockchainTodoService.createTodo({
        title: newTodoTitle.trim(),
        description: newTodoDescription.trim() || '',
        completed: false,
        priority: 'medium',
        tags: [],
        isPrivate: false,
        blockchainStored: true,
      }, {
        walletAddress: address,
        signer: { signAndExecuteTransaction, address }
      });

      // Clear form
      setNewTodoTitle('');
      setNewTodoDescription('');
      
      toast.success('Todo created on blockchain!');
    } catch (error) {
      console.error('Failed to create todo:', error);
      toast.error('Failed to create todo');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Blockchain-First Todo App
          </h1>
          <p className="text-gray-600 max-w-2xl">
            This demo showcases the new CLI-frontend integration where the frontend operates
            as a true blockchain client, matching the CLI's architecture. No API bridge required!
          </p>
        </div>

        {/* Architecture Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">🏗️ Architecture Highlights</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-green-700 mb-2">✅ What We Have Now</h3>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Direct Sui blockchain connectivity</li>
                <li>• Real-time blockchain event subscriptions</li>
                <li>• Walrus decentralized storage integration</li>
                <li>• Blockchain-first data architecture</li>
                <li>• Feature parity with CLI commands</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-blue-700 mb-2">🚀 Benefits</h3>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• No API server dependency</li>
                <li>• True decentralization</li>
                <li>• Real-time updates via blockchain events</li>
                <li>• Consistent data across CLI and frontend</li>
                <li>• Offline capability with local caching</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Create Todo Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">📝 Create New Todo</h2>
          <form onSubmit={handleCreateTodo} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                placeholder="Enter todo title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isCreating || !connected}
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={newTodoDescription}
                onChange={(e) => setNewTodoDescription(e.target.value)}
                placeholder="Enter todo description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isCreating || !connected}
              />
            </div>
            <button
              type="submit"
              disabled={isCreating || !connected || !newTodoTitle.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating on Blockchain...
                </span>
              ) : (
                'Create Todo on Blockchain'
              )}
            </button>
          </form>
          
          {!connected && (
            <p className="text-sm text-amber-600 mt-4 bg-amber-50 p-3 rounded">
              ⚠️ Please connect your wallet to create todos on the blockchain
            </p>
          )}
        </div>

        {/* Todo List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <BlockchainTodoList />
        </div>

        {/* Technical Details */}
        <div className="bg-gray-50 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">🔧 Technical Implementation</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">Frontend Architecture</h3>
              <ul className="space-y-1 text-gray-700">
                <li>• BlockchainTodoService</li>
                <li>• Real-time event subscriptions</li>
                <li>• Optimistic UI updates</li>
                <li>• Local caching for offline</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">CLI Integration</h3>
              <ul className="space-y-1 text-gray-700">
                <li>• Shared Sui smart contracts</li>
                <li>• Shared Walrus storage</li>
                <li>• Same blockchain operations</li>
                <li>• Feature command parity</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">Data Flow</h3>
              <ul className="space-y-1 text-gray-700">
                <li>• Frontend → Sui Blockchain</li>
                <li>• Frontend → Walrus Storage</li>
                <li>• CLI → Same blockchain/storage</li>
                <li>• Real-time sync via events</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}