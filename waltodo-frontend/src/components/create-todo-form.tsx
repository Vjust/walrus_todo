'use client';

import { useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { addTodo } from '@/lib/todo-service';
import { storeTodoOnBlockchain } from '@/lib/sui-client';
import { useSuiClient } from '@/hooks/useSuiClient';
import React, { useEffect } from 'react';
import toast from 'react-hot-toast';

type CreateTodoFormProps = {
  listName: string;
  onTodoAdded?: () => void; // Callback to refresh the todo list
};

export default function CreateTodoForm({
  listName,
  onTodoAdded,
}: CreateTodoFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [tags, setTags] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingOnChain, setIsCreatingOnChain] = useState(false);
  const [createOnBlockchain, setCreateOnBlockchain] = useState(true); // Default to blockchain creation
  const [componentMounted, setComponentMounted] = useState(false);

  // Safe wallet context access
  const walletContext = useWalletContext();
  const { address, connected, signAndExecuteTransaction } = walletContext || {};
  const { isInitialized: suiClientInitialized, isInitializing: suiClientInitializing, error: suiClientError } = useSuiClient('testnet');

  // Component mount effect
  useEffect(() => {
    setComponentMounted(true);
    return () => {
      setComponentMounted(false);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Safety guard
    if (!componentMounted) return;

    if (!title.trim()) return;

    // Allow creating todos without wallet connection (local storage only)
    // if (!connected) {
    //   setError('Please connect your wallet to add todos')
    //   return
    // }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create the todo object
      const todoData = {
        title: title.trim(),
        description: description.trim() || undefined,
        completed: false,
        priority,
        tags: tags
          ? tags
              .split(',')
              .map(tag => tag.trim())
              .filter(Boolean)
          : undefined,
        dueDate: dueDate || undefined,
      };

      let newTodo;

      // Always create local todo first
      newTodo = addTodo(listName, todoData, address || undefined);

      // Attempt blockchain creation only if explicitly requested and wallet is fully connected
      if (
        createOnBlockchain &&
        connected &&
        address &&
        signAndExecuteTransaction &&
        suiClientInitialized
      ) {
        setIsCreatingOnChain(true);

        try {
          const blockchainParams = {
            title: todoData.title,
            description: todoData.description || '',
            imageUrl: 'https://walrus-todo.vercel.app/images/todo-default.png', // Default image
            metadata: JSON.stringify({
              priority: todoData.priority,
              tags: todoData.tags,
              dueDate: todoData.dueDate,
              listName,
            }),
            isPrivate: false,
          };

          const blockchainResult = await storeTodoOnBlockchain(
            blockchainParams,
            signAndExecuteTransaction,
            address
          );

          if (
            blockchainResult.success &&
            newTodo &&
            blockchainResult.objectId
          ) {
            // Mark as blockchain stored after creation
            newTodo.blockchainStored = true;
            newTodo.objectId = blockchainResult.objectId;
            // Todo created on blockchain
          }
        } catch (blockchainError) {
          // Blockchain creation failed, but local todo was created
          // Show warning toast but don't fail the entire operation
          toast.error('Todo created locally but blockchain storage failed. It will be retried later.', {
            duration: 5000,
            icon: '⚠️',
          });
          // Don't throw - local todo creation succeeded
        }
      }

      // Reset form on success
      setTitle('');
      setDescription('');
      setPriority('medium');
      setTags('');
      setDueDate('');
      setUseAI(false);

      // Notify parent component to refresh
      onTodoAdded?.();

      // Todo created successfully

      // Show success message
      if (createOnBlockchain && newTodo.blockchainStored) {
        toast.success('Todo NFT created on Sui blockchain!', {
          duration: 5000,
          icon: '🎉',
        });
      } else {
        toast.success('Todo created successfully!', {
          duration: 3000,
        });
      }
    } catch (error) {
      // Failed to create todo
      const errorMessage = error instanceof Error ? error.message : 'Failed to create todo';
      setError(errorMessage);
      
      // Show error toast
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
      setIsCreatingOnChain(false);
    }
  };

  // Prevent render until component is mounted
  if (!componentMounted) {
    return (
      <div className='flex justify-center py-4'>
        <div className='w-6 h-6 rounded-full border-2 border-ocean-light border-t-ocean-deep animate-spin'></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {/* Error display */}
      {error && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-3'>
          <p className='text-sm text-red-700'>{error}</p>
        </div>
      )}

      {/* Wallet connection warning */}
      {!connected && (
        <div className='bg-amber-50 border border-amber-200 rounded-lg p-3'>
          <p className='text-sm text-amber-700'>
            Connect your wallet to create and manage your personal todos
          </p>
        </div>
      )}

      <div>
        <input
          type='text'
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder='What needs to be done?'
          className='ocean-input w-full'
          required
        />
      </div>

      <div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder='Add a description (optional)'
          className='ocean-input w-full h-20 resize-none'
        />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div>
          <label className='block text-sm text-ocean-medium dark:text-ocean-light mb-1'>
            Priority
          </label>
          <select
            value={priority}
            onChange={e =>
              setPriority(e.target.value as 'low' | 'medium' | 'high')
            }
            className='ocean-input w-full'
          >
            <option value='low'>Low</option>
            <option value='medium'>Medium</option>
            <option value='high'>High</option>
          </select>
        </div>

        <div>
          <label className='block text-sm text-ocean-medium dark:text-ocean-light mb-1'>
            Tags (comma separated)
          </label>
          <input
            type='text'
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder='work, important, etc.'
            className='ocean-input w-full'
          />
        </div>

        <div>
          <label className='block text-sm text-ocean-medium dark:text-ocean-light mb-1'>
            Due Date (optional)
          </label>
          <input
            type='date'
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className='ocean-input w-full'
          />
        </div>
      </div>

      <div className='space-y-3'>
        <div className='flex items-center'>
          <input
            type='checkbox'
            id='useAI'
            checked={useAI}
            onChange={e => setUseAI(e.target.checked)}
            className='w-4 h-4 rounded text-ocean-medium focus:ring-ocean-light'
          />
          <label
            htmlFor='useAI'
            className='ml-2 text-sm text-ocean-medium dark:text-ocean-light'
          >
            Use AI to suggest tags and priority
          </label>
        </div>

        {connected && (
          <div className='flex items-center'>
            <input
              type='checkbox'
              id='createOnBlockchain'
              checked={createOnBlockchain}
              onChange={e => setCreateOnBlockchain(e.target.checked)}
              className='w-4 h-4 rounded text-ocean-medium focus:ring-ocean-light'
            />
            <label
              htmlFor='createOnBlockchain'
              className='ml-2 text-sm text-ocean-medium dark:text-ocean-light'
            >
              Create as NFT on Sui blockchain
              {isCreatingOnChain && (
                <span className='ml-2 text-xs text-blue-600 animate-pulse'>
                  Creating on-chain...
                </span>
              )}
            </label>
          </div>
        )}
      </div>

      <div className='flex justify-between items-center pt-2'>
        <div className='text-sm text-ocean-medium dark:text-ocean-light'>
          Adding to: <span className='font-medium'>{listName}</span>
        </div>

        <button
          type='submit'
          disabled={
            isSubmitting || 
            !title.trim() || 
            (createOnBlockchain && (!connected || !suiClientInitialized))
          }
          className={`ocean-button ${
            isSubmitting || 
            !title.trim() || 
            (createOnBlockchain && (!connected || !suiClientInitialized))
              ? 'opacity-70 cursor-not-allowed' 
              : ''
          }`}
        >
          {isSubmitting
            ? isCreatingOnChain
              ? 'Creating NFT...'
              : 'Adding...'
            : createOnBlockchain && !connected
              ? 'Connect Wallet for NFT'
              : createOnBlockchain && connected && !suiClientInitialized
                ? suiClientInitializing
                  ? 'Initializing Blockchain...'
                  : 'Blockchain Not Ready'
                : createOnBlockchain && connected && suiClientInitialized
                  ? 'Create NFT Todo'
                  : 'Add Todo'}
        </button>
      </div>
    </form>
  );
}
