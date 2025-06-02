'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { ClientOnly } from '@/components/ClientOnly';
import { TodoNFTCard } from '@/components/TodoNFTCard';
import { TodoNFTDisplay, todoToNFTDisplay } from '@/types/nft-display';
import { Todo } from '@/types/todo-nft';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import Link from 'next/link';

// Allow dynamic rendering for client-side wallet features
export const dynamic = 'force-dynamic';

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
  const [demoMode, setDemoMode] = useState<'showcase' | 'interactive'>('showcase');
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Demo showcase steps
  const demoSteps = [
    { title: 'Task Creation', description: 'User creates a new task with rich metadata' },
    { title: 'NFT Minting', description: 'Task is automatically minted as an NFT on Sui blockchain' },
    { title: 'Walrus Storage', description: 'All data stored permanently on decentralized Walrus network' },
    { title: 'Marketplace Ready', description: 'NFT can be traded, collected, or used as proof of work' }
  ];

  // Auto-advance demo
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % demoSteps.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, demoSteps.length]);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Enhanced Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  TodoNFT Live Demo
                </h1>
                <p className="text-gray-600">
                  Experience the future of productivity NFTs in action
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setDemoMode('showcase')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    demoMode === 'showcase' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Showcase
                </button>
                <button
                  onClick={() => setDemoMode('interactive')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    demoMode === 'interactive' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Interactive
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {demoMode === 'showcase' ? (
          /* Investor Showcase Mode */
          <div className="space-y-12">
            {/* Hero Demo Section */}
            <motion.section 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-8">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></span>
                Live Demo Environment
              </div>
              
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                See TodoNFT Technology in Action
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                Watch how everyday tasks transform into valuable, tradeable NFTs through our innovative blockchain integration.
              </p>
              
              {/* Auto-playing Demo Steps */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-8 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Creation Process Demo</h3>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isPlaying 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {isPlaying ? '⏸️ Pause' : '▶️ Play'} Demo
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {demoSteps.map((step, index) => (
                    <motion.div
                      key={index}
                      className={`p-4 rounded-xl border-2 transition-all duration-500 ${
                        currentStep === index
                          ? 'border-blue-500 bg-blue-50 shadow-lg'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                      animate={{
                        scale: currentStep === index ? 1.05 : 1,
                        y: currentStep === index ? -5 : 0
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-3 mx-auto ${
                        currentStep === index ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">{step.title}</h4>
                      <p className="text-sm text-gray-600">{step.description}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
              
              {/* Live Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200/50">
                  <div className="text-2xl font-bold text-blue-600">1,247</div>
                  <div className="text-sm text-gray-600">TodoNFTs Created</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200/50">
                  <div className="text-2xl font-bold text-green-600">89</div>
                  <div className="text-sm text-gray-600">Active Users</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200/50">
                  <div className="text-2xl font-bold text-purple-600">3,421</div>
                  <div className="text-sm text-gray-600">Transactions</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200/50">
                  <div className="text-2xl font-bold text-indigo-600">2.45 ETH</div>
                  <div className="text-sm text-gray-600">Total Value</div>
                </div>
              </div>
            </motion.section>
            
            {/* Featured NFT Examples */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Featured TodoNFT Examples
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {nftTodos.map((todo, index) => (
                  <motion.div
                    key={todo.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1, duration: 0.6 }}
                  >
                    <ClientOnly fallback={
                      <div className="w-full h-96 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
                        <span className="text-gray-500">Loading NFT...</span>
                      </div>
                    }>
                      <TodoNFTCard
                        todo={todo}
                        displayMode="gallery"
                        onComplete={handleComplete}
                        onTransfer={handleTransfer}
                        onClick={handleCardClick}
                        showActions={true}
                        enableFlip={true}
                      />
                    </ClientOnly>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          </div>
        ) : (

          /* Interactive Mode */
          <div className="space-y-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Interactive TodoNFT Gallery
              </h2>
              <p className="text-xl text-gray-600">
                Try all the features - click, flip, and interact with real TodoNFTs
              </p>
            </div>
          {/* Gallery View */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Gallery View</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nftTodos.map((todo) => (
                <ClientOnly key={todo.id} fallback={
                  <div className="w-full h-96 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
                    <span className="text-gray-500">Loading NFT...</span>
                  </div>
                }>
                  <TodoNFTCard
                    todo={todo}
                    displayMode="gallery"
                    onComplete={handleComplete}
                    onTransfer={handleTransfer}
                    onClick={handleCardClick}
                    showActions={true}
                    enableFlip={true}
                  />
                </ClientOnly>
              ))}
            </div>
          </section>

          {/* Thumbnail View */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Thumbnail View</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {nftTodos.map((todo) => (
                <ClientOnly key={`thumb-${todo.id}`} fallback={
                  <div className="w-full h-32 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
                    <span className="text-gray-500 text-xs">Loading...</span>
                  </div>
                }>
                  <TodoNFTCard
                    todo={todo}
                    displayMode="thumbnail"
                    showActions={false}
                    enableFlip={false}
                    onClick={handleCardClick}
                  />
                </ClientOnly>
              ))}
            </div>
          </section>

          {/* Loading State Demo */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Loading States</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ClientOnly fallback={
                <div className="w-full h-64 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
                  <span className="text-gray-500">Loading NFT...</span>
                </div>
              }>
                <TodoNFTCard
                  todo={nftTodos[0]}
                  displayMode="preview"
                  loading={true}
                />
              </ClientOnly>
              <ClientOnly fallback={
                <div className="w-full h-64 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
                  <span className="text-gray-500">Loading NFT...</span>
                </div>
              }>
                <TodoNFTCard
                  todo={{ ...nftTodos[1], loadingState: 'error', imageLoadError: 'Failed to load image from Walrus' }}
                  displayMode="preview"
                />
              </ClientOnly>
              <ClientOnly fallback={
                <div className="w-full h-64 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
                  <span className="text-gray-500">Loading NFT...</span>
                </div>
              }>
                <TodoNFTCard
                  todo={nftTodos[2]}
                  displayMode="preview"
                  showActions={true}
                />
              </ClientOnly>
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
                <ClientOnly key={`interactive-${todo.id}`} fallback={
                  <div className="w-full h-96 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
                    <span className="text-gray-500">Loading NFT...</span>
                  </div>
                }>
                  <TodoNFTCard
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
                </ClientOnly>
              ))}
            </div>
          </section>

          {/* Different Priority Examples */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Priority Variations</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['high', 'medium', 'low'] as const).map((priority, index) => (
                <ClientOnly key={`priority-${priority}`} fallback={
                  <div className="w-full h-64 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
                    <span className="text-gray-500">Loading NFT...</span>
                  </div>
                }>
                  <TodoNFTCard
                    todo={{
                      ...nftTodos[index],
                      priority,
                      title: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority Task`,
                    }}
                    displayMode="preview"
                    showActions={true}
                    enableFlip={true}
                  />
                </ClientOnly>
              ))}
            </div>
          </section>
          </div>
        )}
      </div>
    </div>
  );
}