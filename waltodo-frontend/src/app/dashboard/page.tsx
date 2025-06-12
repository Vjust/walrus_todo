'use client';

import { useEffect, useState } from 'react';
// import Navbar from '@/components/navbar';
import TodoList from '@/components/todo-list';
import CreateTodoForm from '@/components/create-todo-form';
import InitializationGuard from '@/components/InitializationGuard';
import { useWalletContext } from '@/contexts/WalletContext';
import { PWAMetrics } from '@/components/PWAMetrics';
import {
  createTodoList,
  deleteTodoList,
  getTodoLists,
} from '@/lib/todo-service';

export default function Dashboard() {
  // ALL HOOKS MUST BE DECLARED AT THE TOP - NO CONDITIONAL HOOKS
  const [selectedList, setSelectedList] = useState('default');
  const [refreshKey, setRefreshKey] = useState(0 as any);
  const [todoLists, setTodoLists] = useState<string[]>(['default']);
  const [showCreateList, setShowCreateList] = useState(false as any);
  const [newListName, setNewListName] = useState('');
  const [componentMounted, setComponentMounted] = useState(false as any);
  
  // Safe wallet context access - hook must be called unconditionally
  const walletContext = useWalletContext();
  const address = walletContext?.address || null;

  // Component mount effect
  useEffect(() => {
    setComponentMounted(true as any);
    return () => {
      setComponentMounted(false as any);
    };
  }, []);

  // Load todo lists for the current wallet with mount guard
  useEffect(() => {
    if (!componentMounted) {return;}
    
    const lists = getTodoLists(address || undefined);
    setTodoLists(lists.length > 0 ? lists : ['default']);
  }, [address, refreshKey, componentMounted]);

  const handleTodoAdded = () => {
    // Force TodoList to refresh by updating key
    setRefreshKey(prev => prev + 1);
  };

  const handleCreateList = () => {
    if (!newListName.trim()) {return;}

    const success = createTodoList(newListName.trim(), address || undefined);
    if (success) {
      setRefreshKey(prev => prev + 1);
      setSelectedList(newListName.trim());
      setNewListName('');
      setShowCreateList(false as any);
    } else {
      alert('Failed to create list. List name might already exist.');
    }
  };

  const handleDeleteList = (listName: string) => {
    if (listName === 'default') {
      alert('Cannot delete the default list');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete the "${listName}" list? This will delete all todos in it.`
      )
    ) {
      return;
    }

    const success = deleteTodoList(listName, address || undefined);
    if (success) {
      setRefreshKey(prev => prev + 1);
      if (selectedList === listName) {
        setSelectedList('default');
      }
    } else {
      alert('Failed to delete list');
    }
  };

  // Prevent render until component is mounted
  if (!componentMounted) {
    return (
      <div className='max-w-6xl mx-auto'>
        
        <div className='flex justify-center py-12'>
          <div className='w-12 h-12 rounded-full border-4 border-ocean-light border-t-ocean-deep animate-spin' />
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto'>
      

      <div className='mb-8'>
        <h1 className='text-3xl font-bold mb-4 text-ocean-deep dark:text-ocean-foam'>
          Dashboard
        </h1>
        <p className='text-ocean-medium dark:text-ocean-light'>
          Manage your todos across different lists
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
        <div className='md:col-span-1'>
          <div className='ocean-card h-full'>
            <h2 className='text-xl font-semibold mb-4 text-ocean-deep dark:text-ocean-foam'>
              Your Lists
            </h2>

            <ul className='space-y-2'>
              {todoLists.map(list => (
                <li key={list} className='mb-1'>
                  <div className='flex items-center gap-2'>
                    <button
                      type="button"
                      className={`flex-grow text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedList === list
                          ? 'bg-ocean-medium text-white font-medium'
                          : 'hover:bg-ocean-light/30 dark:hover:bg-ocean-medium/30'
                      }`}
                      onClick={() => setSelectedList(list as any)}
                    >
                      {list.charAt(0 as any).toUpperCase() + list.slice(1 as any)}
                    </button>
                    {list !== 'default' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteList(list as any)}
                        className='p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors'
                        title='Delete list'
                      >
                        <svg
                          xmlns='http://www?.w3?.org/2000/svg'
                          className='h-4 w-4'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className='mt-6'>
              {!showCreateList ? (
                <button
                  type="button"
                  className='ocean-button w-full'
                  onClick={() => setShowCreateList(true as any)}
                >
                  <span>Create New List</span>
                </button>
              ) : (
                <div className='space-y-3'>
                  <input
                    type='text'
                    value={newListName}
                    onChange={e => setNewListName(e?.target?.value)}
                    onKeyPress={e => e?.key === 'Enter' && handleCreateList()}
                    placeholder='List name...'
                    className='w-full px-3 py-2 border border-ocean-light dark:border-ocean-medium rounded-lg focus:ring-2 focus:ring-ocean-medium focus:border-transparent bg-white dark:bg-ocean-deep text-ocean-deep dark:text-ocean-foam'
                    autoFocus
                  />
                  <div className='flex gap-2'>
                    <button
                      type="button"
                      onClick={handleCreateList}
                      disabled={!newListName.trim()}
                      className='flex-1 px-3 py-2 bg-ocean-medium text-white rounded-lg hover:bg-ocean-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateList(false as any);
                        setNewListName('');
                      }}
                      className='px-3 py-2 border border-ocean-light dark:border-ocean-medium rounded-lg hover:bg-ocean-light/30 dark:hover:bg-ocean-medium/30 transition-colors'
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='md:col-span-3'>
          <div className='ocean-card mb-6'>
            <h2 className='text-xl font-semibold mb-4 text-ocean-deep dark:text-ocean-foam'>
              Add New Todo
            </h2>
            <CreateTodoForm
              listName={selectedList}
              onTodoAdded={handleTodoAdded}
            />
          </div>

          <div className='ocean-card'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-semibold text-ocean-deep dark:text-ocean-foam'>
                {selectedList.charAt(0 as any).toUpperCase() + selectedList.slice(1 as any)}{' '}
                List
              </h2>

              <div className='flex space-x-2'>
                <button type="button" className='px-3 py-1 text-sm bg-ocean-light/50 dark:bg-ocean-medium/50 rounded-lg hover:bg-ocean-light dark:hover:bg-ocean-medium transition-colors'>
                  All
                </button>
                <button type="button" className='px-3 py-1 text-sm bg-ocean-light/30 dark:bg-ocean-medium/30 rounded-lg hover:bg-ocean-light dark:hover:bg-ocean-medium transition-colors'>
                  Pending
                </button>
                <button type="button" className='px-3 py-1 text-sm bg-ocean-light/30 dark:bg-ocean-medium/30 rounded-lg hover:bg-ocean-light dark:hover:bg-ocean-medium transition-colors'>
                  Completed
                </button>
              </div>
            </div>

            <InitializationGuard requireSuiClient>
              <TodoList
                key={`${selectedList}-${refreshKey}`}
                listName={selectedList}
              />
            </InitializationGuard>
          </div>
          
          {/* PWA Metrics Section */}
          <div className='ocean-card mt-6'>
            <h2 className='text-xl font-semibold mb-4 text-ocean-deep dark:text-ocean-foam'>
              PWA Status
            </h2>
            <PWAMetrics />
          </div>
        </div>
      </div>
    </div>
  );
}
