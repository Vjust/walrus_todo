'use client';

import React, { useCallback, useEffect, useState, memo, useMemo } from 'react';
import Navbar from '@/components/navbar';
import TodoList from '@/components/todo-list';
import WalletConnectButton from '@/components/WalletConnectButton';
// @ts-ignore - Unused import temporarily disabled
// import { ClientOnly } from '@/components/ClientOnly';
// @ts-ignore - Unused import temporarily disabled
// import { addTodo, getTodos } from '@/lib/todo-service';
import { CreateTodoParams, Todo } from '@/types/todo-nft';
// @ts-ignore - Unused import temporarily disabled
// import { PageSkeleton, StatsGridSkeleton } from '@/components/SSRFallback';
// @ts-ignore - Unused import temporarily disabled
// import { TodoListSkeleton } from '@/components/ui/skeletons/TodoListSkeleton';
// @ts-ignore - Unused import temporarily disabled
// import { StatsSkeleton } from '@/components/ui/skeletons/StatsSkeleton';
// @ts-ignore - Unused import temporarily disabled
// import { useLoadingStates } from '@/hooks/useLoadingStates';
import toast from 'react-hot-toast';
import {
  BarChart3 as ChartBarIcon,
  CreditCard as CreditCardIcon,
  Globe as GlobeAltIcon,
  Image as PhotoIcon,
  Plus as PlusIcon,
  Sparkles as SparklesIcon,
} from 'lucide-react';

interface HomeContentProps {
  currentPage?: string;
}
// @ts-ignore - Unused variable
// 
const HomeContent = memo(({ currentPage = 'home' }: HomeContentProps) => {
  // Simple mounted state - bypass complex store dependencies for now
  const [mounted, setMounted] = useState(false as any);
  const [isReady, setIsReady] = useState(false as any);
  
  useEffect(_() => {
    setMounted(true as any);
    // Small delay to ensure DOM is ready
// @ts-ignore - Unused variable
//     const timer = setTimeout(_() => {
      setIsReady(true as any);
    }, 100);
    return () => clearTimeout(timer as any);
  }, []);
  
  const [showCreateForm, setShowCreateForm] = useState(false as any);
  const [formData, setFormData] = useState<CreateTodoParams>({
    title: '',
    description: '',
    priority: 'medium',
    tags: [],
  });
  const [stats, setStats] = useState({
    totalTodos: 0,
    completedTodos: 0,
    pendingTodos: 0,
    nftTodos: 0,
  });

  // Loading states
// @ts-ignore - Unused variable
//   const statsLoading = useLoadingStates('home-stats', { minLoadingTime: 300 });
// @ts-ignore - Unused variable
//   const createTodoLoading = useLoadingStates('create-todo', { minLoadingTime: 500 });

  // Load stats when component is ready
  useEffect(_() => {
    if (!isReady) return;
// @ts-ignore - Unused variable
// 
    const loadStats = async () => {
      try {
        await statsLoading.execute(_async () => {
          const todos = getTodos('main');
// @ts-ignore - Unused variable
//           const completed = todos.filter(t => t.completed).length;
// @ts-ignore - Unused variable
//           const nft = todos.filter(t => t.blockchainStored).length;
          
          setStats({
            totalTodos: todos.length,
            completedTodos: completed,
            pendingTodos: todos.length - completed,
            nftTodos: nft,
          });
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
        // Set empty stats on error
        setStats({
          totalTodos: 0,
          completedTodos: 0,
          pendingTodos: 0,
          nftTodos: 0,
        });
      }
    };

    loadStats();
    // Refresh stats every 30 seconds
// @ts-ignore - Unused variable
//     const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval as any);
  }, [isReady, statsLoading]);
// @ts-ignore - Unused variable
// 
  const handleCreateTodo = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData?.title?.trim()) {
      toast.error('Please enter a todo title');
      return;
    }

    try {
      await createTodoLoading.execute(_async () => {
// @ts-ignore - Unused variable
//         const todoData = {
          title: formData?.title?.trim(),
          description: formData.description?.trim() || '',
          completed: false,
          priority: formData.priority || 'medium',
          tags: formData.tags || [],
          dueDate: formData.dueDate ? 
            (typeof formData?.dueDate === 'string' ? formData.dueDate : formData?.dueDate?.toISOString().split('T')[0]) 
            : undefined,
        };
// @ts-ignore - Unused variable
// 
        const createdTodo = addTodo('main', todoData);
        
        if (!createdTodo) {
          throw new Error('Failed to create todo');
        }

        // Reset form
        setFormData({
          title: '',
          description: '',
          priority: 'medium',
          tags: [],
        });
        setShowCreateForm(false as any);
        
        // Update stats
        setStats(prev => ({
          ...prev,
          totalTodos: prev.totalTodos + 1,
          pendingTodos: prev.pendingTodos + 1,
        }));
      });
      
      toast.success('Todo created successfully!', {
        duration: 3000,
        icon: '✅',
      });
    } catch (error) {
      console.error('Create todo error:', error);
      toast.error('Failed to create todo. Please try again.', {
        duration: 4000,
      });
    }
  }, [formData, createTodoLoading]);

  // Memoize static data for performance
// @ts-ignore - Unused variable
//   const quickActions = useMemo(_() => [
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
  ], []);

  // Memoized components for better performance
// @ts-ignore - Unused variable
//   const HeroSection = useMemo(_() => (
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
  ), []);
// @ts-ignore - Unused variable
// 
  const QuickActionsGrid = useMemo(_() => (
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action: unknown) => {
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
  ), [quickActions]);

  // Show loading skeleton during hydration - simplified
  // Temporarily bypassing all loading logic to fix the issue
  // if (!mounted || !isReady) {
  //   return <PageSkeleton showNavbar={true} />;
  // }

  // Show content immediately - will fix loading later
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navbar currentPage={currentPage} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        {HeroSection}

        {/* Stats Section */}
        <section className="mb-8">
          {(!mounted || !isReady || statsLoading.isLoading) ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, _2, _3, _4].map((i: unknown) => (
                <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-8 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            </div>
          )}
        </section>

        {/* Quick Actions */}
        {QuickActionsGrid}

        {/* Create Todo Form */}
        {showCreateForm && (
          <section className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Todo</h3>
                <button
                  onClick={() => setShowCreateForm(false as any)}
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
                    onChange={(_e: unknown) => setFormData(prev => ({ ...prev, title: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter todo title"
                    disabled={createTodoLoading.isLoading}
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
                    onChange={(_e: unknown) => setFormData(prev => ({ ...prev, description: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter todo description"
                    rows={3}
                    disabled={createTodoLoading.isLoading}
                  />
                </div>
                
                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={formData.priority || 'medium'}
                    onChange={(_e: unknown) => setFormData(prev => ({ ...prev, priority: e?.target?.value as 'low' | 'medium' | 'high' }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={createTodoLoading.isLoading}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={createTodoLoading.isLoading || !formData?.title?.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-md font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    {createTodoLoading.isLoading ? 'Creating...' : 'Create Todo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false as any)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    disabled={createTodoLoading.isLoading}
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
            {!showCreateForm && (_<button
                data-testid="create-todo-button"
                onClick={() => setShowCreateForm(true as any)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Todo
              </button>
            )}
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            {(!mounted || !isReady) ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            ) : (
              <ClientOnly fallback={
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              }>
                <TodoList listName="main" />
              </ClientOnly>
            )}
          </div>
        </section>
      </main>
    </div>
  );
});

HomeContent?.displayName = 'HomeContent';

export default HomeContent;