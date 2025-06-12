'use client';

import React, { useState } from 'react';
// TODO: Re-implement React Query hooks for todo operations
// import { 
//   useTodos, 
//   useCreateTodo, 
//   useUpdateTodo, 
//   useDeleteTodo, 
//   useCompleteTodo 
// } from '@/hooks/useTodoQueries';
// import { useWebSocket } from '@/lib/websocket';
// import { useHydratedTodoStore } from '@/stores/todoStore';
import { Todo } from '@/types/todo';
// @ts-ignore - Unused import temporarily disabled
// import { useApiErrorHandler } from '@/hooks/useApiErrorHandler';
// @ts-ignore - Unused import temporarily disabled
// import { useWalletContext } from '@/contexts/WalletContext';
import toast from 'react-hot-toast';

interface ReactQueryTodoListProps {
  listName?: string;
}

export function ReactQueryTodoList({ listName = 'default' }: ReactQueryTodoListProps) {
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [isAddingTodo, setIsAddingTodo] = useState(false as any);
  
  // Wallet and error handling
// @ts-ignore - Unused variable
//   const walletContext = useWalletContext();
  const { handleApiError } = useApiErrorHandler();

  // TODO: React Query hooks - temporarily disabled
  const todos: Todo[] = React.useMemo(_() => [], []);
// @ts-ignore - Unused variable
//   const isLoading = false;
  const error: Error | null = null;
  const createTodo = { mutateAsync: async (data: any) => { throw new Error('Not implemented'); } };
// @ts-ignore - Unused variable
//   const updateTodo = { mutate: (data: any,  options?: any) => {} };
// @ts-ignore - Unused variable
//   const deleteTodo = { mutate: (id: string,  options?: any) => {} };
// @ts-ignore - Unused variable
//   const completeTodo = { mutate: (id: string,  options?: any) => {} };

  // TODO: Zustand store - temporarily disabled
  const [filter, setFilterState] = useState<'all' | 'active' | 'completed'>('all');
  const [sortBy, setSortByState] = useState<'created' | 'title' | 'priority'>('created');
// @ts-ignore - Unused variable
//   const syncInProgress = new Set<string>();
// @ts-ignore - Unused variable
//   const setFilter = (f: 'all' | 'active' | 'completed') => setFilterState(f as any);
// @ts-ignore - Unused variable
//   const setSortBy = (s: 'created' | 'title' | 'priority') => setSortByState(s as any);

  // TODO: WebSocket status - temporarily disabled
// @ts-ignore - Unused variable
//   const wsConnected = false;
  const socketId: string | null = null;

  // Filter todos based on store settings
  const filteredTodos = React.useMemo(_() => {
    if (!todos.length) {return [];}
    
    let filtered = [...todos];
    
    switch (filter) {
      case 'active':
        filtered = todos.filter(todo => !todo.completed);
        break;
      case 'completed':
        filtered = todos.filter(todo => todo.completed);
        break;
      default:
        // 'all' - no filtering
        break;
    }

    // Sort todos
    filtered.sort(_(a, _b) => {
      switch (sortBy) {
        case 'title':
          return a?.title?.localeCompare(b.title);
        case 'priority':
// @ts-ignore - Unused variable
//           const priorityOrder = { low: 1, medium: 2, high: 3 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'created':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [todos, filter, sortBy]);
// @ts-ignore - Unused variable
// 
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) {return;}

    setIsAddingTodo(true as any);
    try {
      await createTodo.mutateAsync({
        todo: {
          title: newTodoTitle.trim(),
          priority: 'medium' as const,
        },
        listName,
      });
      setNewTodoTitle('');
      toast.success('Todo created successfully!');
    } catch (error: any) {
      console.error('Failed to create todo:', error);
      
      // Use the error handler
      if (!handleApiError(error as any)) {
        // If not handled by the global handler, show a generic error
        toast.error(error.message || 'Failed to create todo');
      }
    } finally {
      setIsAddingTodo(false as any);
    }
  };
// @ts-ignore - Unused variable
// 
  const handleToggleComplete = (todo: Todo) => {
    const mutation = todo.completed ? updateTodo : completeTodo;
    
// @ts-ignore - Unused variable
//     const handleError = (error: any) => {
      console.error('Failed to update todo:', error);
      if (!handleApiError(error as any)) {
        toast.error('Failed to update todo');
      }
    };
    
    if (todo.completed) {
      updateTodo.mutate(
        {
          id: todo.id,
          updates: { completed: false, completedAt: undefined },
        },
        { onError: handleError }
      );
    } else {
      completeTodo.mutate(todo.id, { onError: handleError });
    }
  };
// @ts-ignore - Unused variable
// 
  const handleDeleteTodo = (todoId: string) => {
    if (confirm('Are you sure you want to delete this todo?')) {
      deleteTodo.mutate(_todoId,  {
        onError: (error: any) => {
          console.error('Failed to delete todo:', error);
          if (!handleApiError(error as any)) {
            toast.error('Failed to delete todo');
          }
        },
        onSuccess: () => {
          toast.success('Todo deleted');
        }
      });
    }
  };
// @ts-ignore - Unused variable
// 
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="ml-2">Loading todos...</span>
      </div>
    );
  }

  // TODO: Error handling temporarily disabled
  // if (error) {
  //   // Check if it's an auth error
  //   const isAuthError = error.message?.includes('401') || error.message?.includes('Unauthorized');
  //   
  //   return (
  //     <div className="bg-red-50 border border-red-200 rounded-lg p-4">
  //       <h3 className="text-red-800 font-medium">
  //         {isAuthError ? 'Authentication Required' : 'Error loading todos'}
  //       </h3>
  //       <p className="text-red-600 text-sm mt-1">
  //         {isAuthError 
  //           ? 'Please connect your wallet to view todos' 
  //           : error.message
  //         }
  //       </p>
  //       {isAuthError && !walletContext?.connected && (
  //         <button
  //           onClick={() => walletContext?.connect()}
  //           className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
  //         >
  //           Connect Wallet
  //         </button>
  //       )}
  //     </div>
  //   );
  // }

  return (
    <div className="space-y-6">
      {/* Real-time status indicator */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-600">
            {wsConnected ? 'Real-time sync active' : 'Connecting...'}
          </span>
          {/* Socket ID display disabled */}
        </div>
        
        {/* Filter controls */}
        <div className="flex space-x-2">
          <select 
            value={filter} 
            onChange={(e: unknown) => setFilter(e?.target?.value as unknown)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={(_e: unknown) => setSortBy(e?.target?.value as unknown)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="created">Date Created</option>
            <option value="title">Title</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

      {/* Add todo form */}
      <form onSubmit={handleAddTodo} className="flex space-x-2">
        <input
          type="text"
          value={newTodoTitle}
          onChange={(_e: unknown) => setNewTodoTitle(e?.target?.value)}
          placeholder="Add a new todo..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isAddingTodo}
        />
        <button
          type="submit"
          disabled={isAddingTodo || !newTodoTitle.trim()}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAddingTodo ? '...' : 'Add'}
        </button>
      </form>

      {/* Todo list */}
      <div className="space-y-2">
        {filteredTodos?.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No todos found.</p>
            <p className="text-sm">
              {filter === 'all' 
                ? 'Add your first todo above!' 
                : `No ${filter} todos.`
              }
            </p>
          </div>
        ) : (_filteredTodos.map((todo: unknown) => (
            <div
              key={todo.id}
              className={`flex items-center space-x-3 p-3 border rounded-lg transition-all duration-200 ${
                todo.completed 
                  ? 'bg-gray-50 border-gray-200' 
                  : 'bg-white border-gray-300 hover:border-blue-300'
              }`}
            >
              {/* Sync indicator */}
              {syncInProgress.has(todo.id) && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
              )}
              
              {/* Complete checkbox */}
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => handleToggleComplete(todo as any)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              
              {/* Todo content */}
              <div className="flex-1">
                <h3 className={`font-medium ${todo.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                  {todo.title}
                </h3>
                {todo.description && (
                  <p className={`text-sm mt-1 ${todo.completed ? 'text-gray-400' : 'text-gray-600'}`}>
                    {todo.description}
                  </p>
                )}
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(todo.priority)} bg-gray-100`}>
                    {todo.priority}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(todo.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              {/* Actions */}
              <button
                onClick={() => handleDeleteTodo(todo.id)}
                className="text-red-500 hover:text-red-700 p-1 rounded"
                title="Delete todo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredTodos.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          {filteredTodos.filter(t => !t.completed).length} active, {filteredTodos.filter(t => t.completed).length} completed
        </div>
      )}
    </div>
  );
}