'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/navbar';
import TodoList from '@/components/todo-list';
import WalletConnectButton from '@/components/WalletConnectButton';
import { ClientOnly } from '@/components/ClientOnly';
import { getTodos, addTodo } from '@/lib/todo-service';
import { Todo, CreateTodoParams } from '@/types/todo-nft';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  SparklesIcon,
  ChartBarIcon,
  PhotoIcon,
  CreditCardIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

interface HomeContentProps {
  currentPage?: string;
}

function HomeContent({ currentPage = 'home' }: HomeContentProps) {
  const [mounted, setMounted] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<CreateTodoParams>({
    title: '',
    description: '',
    priority: 'medium',
    tags: [],
  });
  const [isCreating, setIsCreating] = useState(false);
  const [stats, setStats] = useState({
    totalTodos: 0,
    completedTodos: 0,
    pendingTodos: 0,
    nftTodos: 0,
  });

  // SSR safety - only render after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load stats when component mounts
  useEffect(() => {
    if (!mounted) return;

    const loadStats = () => {
      try {
        const todos = getTodos('main');
        const completed = todos.filter(t => t.completed).length;
        const nft = todos.filter(t => t.blockchainStored).length;
        
        setStats({
          totalTodos: todos.length,
          completedTodos: completed,
          pendingTodos: todos.length - completed,
          nftTodos: nft,
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };

    loadStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [mounted]);

  const handleCreateTodo = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Please enter a todo title');
      return;
    }

    setIsCreating(true);
    
    try {
      const todoData = {
        title: formData.title.trim(),
        description: formData.description?.trim() || '',
        completed: false,
        priority: formData.priority || 'medium',
        tags: formData.tags || [],
        dueDate: formData.dueDate,
      };

      const createdTodo = addTodo('main', todoData);
      
      if (createdTodo) {
        toast.success('Todo created successfully!', {
          duration: 3000,
          icon: '✅',
        });
        
        // Reset form
        setFormData({
          title: '',
          description: '',
          priority: 'medium',
          tags: [],
        });
        setShowCreateForm(false);
        
        // Update stats
        setStats(prev => ({
          ...prev,
          totalTodos: prev.totalTodos + 1,
          pendingTodos: prev.pendingTodos + 1,
        }));
      } else {
        throw new Error('Failed to create todo');
      }
    } catch (error) {
      console.error('Create todo error:', error);
      toast.error('Failed to create todo. Please try again.', {
        duration: 4000,
      });
    } finally {
      setIsCreating(false);
    }
  }, [formData]);

  const quickActions = [
    {
      name: 'NFT Gallery',
      href: '/nft-gallery',
      icon: PhotoIcon,
      description: 'View your todo NFTs',
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: ChartBarIcon,
      description: 'Analytics & insights',
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      name: 'Create NFT',
      href: '/create-nft',
      icon: SparklesIcon,
      description: 'Mint a new todo NFT',
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      name: 'Walrus Health',
      href: '/walrus-health',
      icon: GlobeAltIcon,
      description: 'Check storage status',
      color: 'bg-orange-500 hover:bg-orange-600',
    },
  ];

  // Show loading skeleton during hydration
  if (!mounted) {
    return <HomeContentSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navbar currentPage={currentPage} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <section className="text-center py-12">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Transform Tasks into{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Valuable NFTs
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              The first decentralized productivity platform where your completed tasks 
              become tradeable digital assets on Sui blockchain, stored permanently on Walrus.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <ClientOnly>
                <WalletConnectButton size="lg" />
              </ClientOnly>
              
              <a
                href="/nft-gallery"
                className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-6 py-3 rounded-lg font-medium transition-colors no-underline"
              >
                <PhotoIcon className="w-5 h-5" />
                Explore NFTs
              </a>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Todos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalTodos}</p>
              </div>
              <CreditCardIcon className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completedTodos}</p>
              </div>
              <SparklesIcon className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.pendingTodos}</p>
              </div>
              <ChartBarIcon className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">NFTs</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.nftTodos}</p>
              </div>
              <PhotoIcon className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <a
                  key={action.name}
                  href={action.href}
                  className={`${action.color} text-white p-6 rounded-lg shadow-sm transition-all hover:shadow-md hover:scale-105 no-underline`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-6 h-6" />
                    <h3 className="font-medium">{action.name}</h3>
                  </div>
                  <p className="text-sm opacity-90">{action.description}</p>
                </a>
              );
            })}
          </div>
        </section>

        {/* Create Todo Form */}
        {showCreateForm && (
          <section className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Todo</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleCreateTodo} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter todo title"
                    disabled={isCreating}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter todo description"
                    rows={3}
                    disabled={isCreating}
                  />
                </div>
                
                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={formData.priority || 'medium'}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={isCreating}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isCreating || !formData.title.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-md font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    {isCreating ? 'Creating...' : 'Create Todo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* Todo List Section */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Todos</h2>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Todo
              </button>
            )}
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <ClientOnly fallback={<TodoListSkeleton />}>
              <TodoList listName="main" />
            </ClientOnly>
          </div>
        </section>
      </main>
    </div>
  );
}

// Skeleton component for loading state during hydration
function HomeContentSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="w-96 h-12 bg-gray-200 rounded-lg mx-auto mb-4 animate-pulse"></div>
          <div className="w-64 h-6 bg-gray-200 rounded-lg mx-auto mb-8 animate-pulse"></div>
          <div className="flex gap-4 justify-center">
            <div className="w-32 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="w-32 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
              <div className="w-16 h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="w-12 h-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="w-32 h-6 bg-gray-200 rounded animate-pulse mb-4"></div>
          <TodoListSkeleton />
        </div>
      </div>
    </div>
  );
}

// Todo list skeleton
function TodoListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-gray-200 rounded-full animate-pulse flex-shrink-0 mt-1"></div>
            <div className="flex-grow space-y-2">
              <div className="w-3/4 h-5 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-1/2 h-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default HomeContent;