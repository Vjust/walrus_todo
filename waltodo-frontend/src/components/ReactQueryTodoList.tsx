'use client';

import React, { useState } from 'react';
import { 
  useTodos, 
  useCreateTodo, 
  useUpdateTodo, 
  useDeleteTodo, 
  useCompleteTodo 
} from '@/hooks/useTodoQueries';
import { useWebSocket } from '@/lib/websocket';
import { useTodoStore } from '@/stores/todoStore';
import { Todo } from '@/types/todo';

interface ReactQueryTodoListProps {
  listName?: string;
}

export function ReactQueryTodoList({ listName = 'default' }: ReactQueryTodoListProps) {
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [isAddingTodo, setIsAddingTodo] = useState(false);

  // React Query hooks
  const { data: todos = [], isLoading, error } = useTodos(listName);
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const completeTodo = useCompleteTodo();

  // Zustand store
  const { 
    uiState: { filter, sortBy, syncInProgress },
    setFilter,
    setSortBy 
  } = useTodoStore();

  // WebSocket status
  const { connected: wsConnected, socketId } = useWebSocket();

  // Filter todos based on store settings
  const filteredTodos = React.useMemo(() => {
    if (!todos.length) return [];
    
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
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'priority':
          const priorityOrder = { low: 1, medium: 2, high: 3 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'created':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [todos, filter, sortBy]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    setIsAddingTodo(true);
    try {
      await createTodo.mutateAsync({
        todo: {
          title: newTodoTitle.trim(),
          priority: 'medium' as const,
        },
        listName,
      });
      setNewTodoTitle('');
    } catch (error) {
      console.error('Failed to create todo:', error);
    } finally {
      setIsAddingTodo(false);
    }
  };

  const handleToggleComplete = (todo: Todo) => {
    if (todo.completed) {
      updateTodo.mutate({
        id: todo.id,
        updates: { completed: false, completedAt: undefined },
      });
    } else {
      completeTodo.mutate(todo.id);
    }
  };

  const handleDeleteTodo = (todoId: string) => {
    if (confirm('Are you sure you want to delete this todo?')) {
      deleteTodo.mutate(todoId);
    }
  };

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading todos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error loading todos</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Real-time status indicator */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {wsConnected ? 'Real-time sync active' : 'Connecting...'}
          </span>
          {socketId && (
            <span className="text-xs text-gray-400">({socketId.slice(0, 8)})</span>
          )}
        </div>
        
        {/* Filter controls */}
        <div className="flex space-x-2">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
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
          onChange={(e) => setNewTodoTitle(e.target.value)}
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
        {filteredTodos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No todos found.</p>
            <p className="text-sm">
              {filter === 'all' 
                ? 'Add your first todo above!' 
                : `No ${filter} todos.`
              }
            </p>
          </div>
        ) : (
          filteredTodos.map((todo) => (
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
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              )}
              
              {/* Complete checkbox */}
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => handleToggleComplete(todo)}
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