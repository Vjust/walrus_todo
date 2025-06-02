/**
 * Comprehensive TodoNFT management component
 * Demonstrates all blockchain operations with proper error handling
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  useSuiTodos,
  useTodoOperation,
  NetworkType,
  Todo,
  CreateTodoParams,
  UpdateTodoParams,
} from '@/hooks/useSuiTodos';
import { useWalletContext } from '@/contexts/WalletContext';
import { useSuiClient } from '@/hooks/useSuiClient';
import { TransactionSafetyManager } from '@/lib/transaction-safety';
import {
  storeTodoOnBlockchainSafely,
  updateTodoOnBlockchainSafely,
  completeTodoOnBlockchainSafely,
  transferTodoNFTSafely,
  deleteTodoNFTSafely,
} from '@/lib/sui-client-safe';
import toast from 'react-hot-toast';

// TodoNFT creation form component
function CreateTodoForm({
  onSubmit,
  loading,
}: {
  onSubmit: (params: CreateTodoParams) => Promise<void>;
  loading: boolean;
}) {
  const [formData, setFormData] = useState<CreateTodoParams>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: undefined,
    tags: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be 100 characters or less';
    }

    if (formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    // Priority is always valid since it has a default
    // Tags and dueDate are optional

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);

      // Reset form on success
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: undefined,
        tags: [],
      });
      setErrors({});
      toast.success('TodoNFT created successfully!', {
        duration: 3000,
        icon: '🎉',
      });
    } catch (error) {
      console.error('Create todo error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create TodoNFT';
      toast.error(errorMessage, {
        duration: 5000,
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='bg-white p-6 rounded-lg shadow-md space-y-4'
    >
      <h3 className='text-lg font-semibold text-gray-900'>Create TodoNFT</h3>

      <div>
        <label
          htmlFor='title'
          className='block text-sm font-medium text-gray-700 mb-1'
        >
          Title *
        </label>
        <input
          type='text'
          id='title'
          value={formData.title}
          onChange={e =>
            setFormData(prev => ({ ...prev, title: e.target.value }))
          }
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.title ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder='Enter todo title'
          disabled={loading}
        />
        {errors.title && (
          <p className='text-red-500 text-sm mt-1'>{errors.title}</p>
        )}
      </div>

      <div>
        <label
          htmlFor='description'
          className='block text-sm font-medium text-gray-700 mb-1'
        >
          Description
        </label>
        <textarea
          id='description'
          value={formData.description}
          onChange={e =>
            setFormData(prev => ({ ...prev, description: e.target.value }))
          }
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${
            errors.description ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder='Enter todo description'
          rows={3}
          disabled={loading}
        />
        {errors.description && (
          <p className='text-red-500 text-sm mt-1'>{errors.description}</p>
        )}
      </div>

      <div>
        <label
          htmlFor='priority'
          className='block text-sm font-medium text-gray-700 mb-1'
        >
          Priority
        </label>
        <select
          id='priority'
          value={formData.priority || 'medium'}
          onChange={e =>
            setFormData(prev => ({
              ...prev,
              priority: e.target.value as 'low' | 'medium' | 'high',
            }))
          }
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          disabled={loading}
        >
          <option value='low'>Low</option>
          <option value='medium'>Medium</option>
          <option value='high'>High</option>
        </select>
      </div>

      <div>
        <label
          htmlFor='dueDate'
          className='block text-sm font-medium text-gray-700 mb-1'
        >
          Due Date
        </label>
        <input
          type='date'
          id='dueDate'
          value={typeof formData.dueDate === 'string' ? formData.dueDate : (formData.dueDate instanceof Date ? formData.dueDate.toISOString().split('T')[0] : '')}
          onChange={e =>
            setFormData(prev => ({
              ...prev,
              dueDate: e.target.value || undefined,
            }))
          }
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          disabled={loading}
        />
      </div>

      <div>
        <label
          htmlFor='tags'
          className='block text-sm font-medium text-gray-700 mb-1'
        >
          Tags (comma-separated)
        </label>
        <input
          type='text'
          id='tags'
          value={formData.tags?.join(', ') || ''}
          onChange={e =>
            setFormData(prev => ({
              ...prev,
              tags: e.target.value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0),
            }))
          }
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          placeholder='work, urgent, blockchain'
          disabled={loading}
        />
      </div>

      <button
        type='submit'
        disabled={loading}
        className='w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
      >
        {loading ? 'Creating...' : 'Create TodoNFT'}
      </button>
    </form>
  );
}

// Individual todo item component
function TodoItem({
  todo,
  onUpdate,
  onComplete,
  onDelete,
  loading,
}: {
  todo: Todo;
  onUpdate: (params: UpdateTodoParams) => Promise<void>;
  onComplete: (objectId: string) => Promise<void>;
  onDelete: (objectId: string) => Promise<void>;
  loading: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: todo.title,
    description: todo.description || '',
  });

  const { executeOperation, loading: operationLoading } = useTodoOperation();

  const handleSave = async () => {
    if (!todo.objectId) return;

    await executeOperation(async () => {
      await onUpdate({
        objectId: todo.objectId!,
        title: editForm.title,
        description: editForm.description,
      });
      setIsEditing(false);
      // Return a mock TransactionResult since onUpdate returns void
      return { success: true };
    });
  };

  const handleComplete = async () => {
    if (!todo.objectId) return;

    await executeOperation(async () => {
      await onComplete(todo.objectId!);
      return { success: true };
    });
  };

  const handleDelete = async () => {
    if (!todo.objectId) return;

    if (window.confirm('Are you sure you want to delete this TodoNFT?')) {
      await executeOperation(async () => {
        await onDelete(todo.objectId!);
        toast.success('TodoNFT deleted successfully!', {
          duration: 3000,
          icon: '🗑️',
        });
        return { success: true };
      });
    }
  };

  const isLoading = loading || operationLoading;

  return (
    <div
      className={`bg-white p-4 rounded-lg shadow-md border-l-4 ${
        todo.completed ? 'border-green-500 bg-green-50' : 'border-blue-500'
      }`}
    >
      <div className='flex justify-between items-start mb-2'>
        {isEditing ? (
          <input
            type='text'
            value={editForm.title}
            onChange={e =>
              setEditForm(prev => ({ ...prev, title: e.target.value }))
            }
            className='text-lg font-semibold bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500 flex-1 mr-2'
            disabled={isLoading}
          />
        ) : (
          <h4
            className={`text-lg font-semibold ${
              todo.completed ? 'line-through text-gray-500' : 'text-gray-900'
            }`}
          >
            {todo.title}
          </h4>
        )}

        <div className='flex space-x-2'>
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className='text-green-600 hover:text-green-800 disabled:opacity-50'
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
                className='text-gray-600 hover:text-gray-800 disabled:opacity-50'
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                disabled={isLoading || todo.completed}
                className='text-blue-600 hover:text-blue-800 disabled:opacity-50'
              >
                Edit
              </button>
              {!todo.completed && (
                <button
                  onClick={handleComplete}
                  disabled={isLoading}
                  className='text-green-600 hover:text-green-800 disabled:opacity-50'
                >
                  Complete
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className='text-red-600 hover:text-red-800 disabled:opacity-50'
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className='space-y-2'>
          <textarea
            value={editForm.description}
            onChange={e =>
              setEditForm(prev => ({ ...prev, description: e.target.value }))
            }
            className='w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical'
            placeholder='Description'
            rows={2}
            disabled={isLoading}
          />
        </div>
      ) : (
        <>
          {todo.description && (
            <p
              className={`text-gray-600 mb-2 ${
                todo.completed ? 'line-through' : ''
              }`}
            >
              {todo.description}
            </p>
          )}

          <div className='flex justify-between items-center text-sm text-gray-500'>
            <div>
              <span className='mr-4'>Object ID: {todo.objectId}</span>
              {todo.createdAt && (
                <span>
                  Created: {new Date(todo.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Network switcher component
function NetworkSwitcher({
  currentNetwork,
  onSwitch,
  disabled,
}: {
  currentNetwork: NetworkType;
  onSwitch: (network: NetworkType) => Promise<void>;
  disabled: boolean;
}) {
  const networks: { value: NetworkType; label: string }[] = [
    { value: 'mainnet', label: 'Mainnet' },
    { value: 'testnet', label: 'Testnet' },
    { value: 'devnet', label: 'Devnet' },
    { value: 'localnet', label: 'Local' },
  ];

  return (
    <div className='flex items-center space-x-2'>
      <label className='text-sm font-medium text-gray-700'>Network:</label>
      <select
        value={currentNetwork}
        onChange={e => onSwitch(e.target.value as NetworkType)}
        disabled={disabled}
        className='px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'
      >
        {networks.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Main TodoNFT management component
export default function BlockchainTodoManager() {
  const [mounted, setMounted] = useState(false);
  const walletContext = useWalletContext();
  const connected = walletContext?.connected || false;
  const connecting = walletContext?.connecting || false;
  const address = walletContext?.address || null;
  const { state, actions, network, isWalletReady } = useSuiTodos();

  const [showCreateForm, setShowCreateForm] = useState(false);

  // SSR/Hydration safety
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <BlockchainTodoManagerSkeleton />;
  }

  if (!connected && !connecting) {
    return (
      <div className='max-w-4xl mx-auto p-6'>
        <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center'>
          <h2 className='text-xl font-semibold text-yellow-800 mb-2'>
            Wallet Connection Required
          </h2>
          <p className='text-yellow-700'>
            Please connect your wallet to manage TodoNFTs on the Sui blockchain.
          </p>
        </div>
      </div>
    );
  }

  if (connecting) {
    return (
      <div className='max-w-4xl mx-auto p-6'>
        <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 text-center'>
          <h2 className='text-xl font-semibold text-blue-800 mb-2'>
            Connecting Wallet...
          </h2>
          <p className='text-blue-700'>
            Please check your wallet and approve the connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto p-6 space-y-6'>
      {/* Header */}
      <div className='bg-white p-6 rounded-lg shadow-md'>
        <div className='flex justify-between items-center mb-4'>
          <h1 className='text-2xl font-bold text-gray-900'>TodoNFT Manager</h1>
          <NetworkSwitcher
            currentNetwork={network}
            onSwitch={actions.switchToNetwork}
            disabled={state.loading}
          />
        </div>

        <div className='flex justify-between items-center'>
          <div className='text-sm text-gray-600'>
            <p>
              Connected:{' '}
              <code className='bg-gray-100 px-2 py-1 rounded'>{address}</code>
            </p>
            <p>
              Network: {network} {state.networkHealth ? '✅' : '❌'}
            </p>
          </div>

          <div className='space-x-2'>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors'
            >
              {showCreateForm ? 'Hide Form' : 'Create TodoNFT'}
            </button>
            <button
              onClick={actions.refreshTodos}
              disabled={state.refreshing}
              className='bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors'
            >
              {state.refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
          <div className='flex justify-between items-center'>
            <div>
              <h3 className='text-red-800 font-medium'>Error</h3>
              <p className='text-red-700'>{state.error}</p>
            </div>
            <button
              onClick={actions.clearError}
              className='text-red-600 hover:text-red-800'
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <CreateTodoForm
          onSubmit={async params => {
            // Convert CreateTodoParams to hook's simpler format
            await actions.createTodo({
              title: params.title,
              description: params.description,
              priority: 'medium', // Default priority since CreateTodoParams doesn't have it
              dueDate: undefined, // Default dueDate since CreateTodoParams doesn't have it
            });
          }}
          loading={state.loading}
        />
      )}

      {/* Todo List */}
      <div className='space-y-4'>
        <h2 className='text-xl font-semibold text-gray-900'>
          Your TodoNFTs ({state.todos.length})
        </h2>

        {state.loading && state.todos.length === 0 ? (
          <div className='bg-gray-50 p-8 rounded-lg text-center'>
            <p className='text-gray-600'>Loading your TodoNFTs...</p>
          </div>
        ) : state.todos.length === 0 ? (
          <div className='bg-gray-50 p-8 rounded-lg text-center'>
            <p className='text-gray-600'>
              No TodoNFTs found. Create your first TodoNFT to get started!
            </p>
          </div>
        ) : (
          <div className='space-y-4'>
            {state.todos.map(todo => (
              <TodoItem
                key={todo.objectId}
                todo={todo}
                onUpdate={async params => {
                  await actions.updateTodo(params);
                }}
                onComplete={async objectId => {
                  await actions.completeTodo(objectId);
                }}
                onDelete={async objectId => {
                  await actions.deleteTodo(objectId);
                }}
                loading={state.loading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Skeleton component for loading state during hydration
function BlockchainTodoManagerSkeleton() {
  return (
    <div className='max-w-4xl mx-auto p-6'>
      <div className='bg-white p-6 rounded-lg shadow-md'>
        <div className='flex justify-center items-center py-12'>
          <div className='w-12 h-12 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin'></div>
          <div className='ml-4'>
            <p className='text-sm text-gray-500 animate-pulse'>
              Initializing blockchain manager...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
