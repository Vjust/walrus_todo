/**
 * Example usage of the CreateTodoNFTForm component
 * This demonstrates how to integrate the form into your application
 */

import { useState } from 'react';
import CreateTodoNFTForm from '@/components/CreateTodoNFTForm';
import { Todo } from '@/types/todo-nft';
import toast from 'react-hot-toast';

// Example 1: Basic usage in a modal
export function CreateTodoNFTModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);

  const handleTodoCreated = (newTodo: Todo) => {
    // Add the new todo to your local state
    setTodos(prev => [...prev, newTodo]);
    
    // Close the modal
    setIsOpen(false);
    
    // Show success message
    toast.success(`NFT "${newTodo.title}" created successfully!`);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="ocean-button"
      >
        Create Todo NFT
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-ocean-darkest rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <CreateTodoNFTForm
                listName="My NFT Collection"
                onTodoCreated={handleTodoCreated}
                onCancel={() => setIsOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Example 2: Integration with a todo list
export function TodoListWithNFTCreation() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedList, setSelectedList] = useState('Personal');

  const handleTodoCreated = (newTodo: Todo) => {
    setTodos(prev => [...prev, newTodo]);
    setShowCreateForm(false);
  };

  return (
    <div className="space-y-6">
      {/* List selector */}
      <div className="flex items-center justify-between">
        <select
          value={selectedList}
          onChange={(e) => setSelectedList(e.target.value)}
          className="ocean-input"
        >
          <option value="Personal">Personal</option>
          <option value="Work">Work</option>
          <option value="Shopping">Shopping</option>
          <option value="Ideas">Ideas</option>
        </select>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="ocean-button"
        >
          {showCreateForm ? 'Cancel' : 'Create NFT Todo'}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <CreateTodoNFTForm
            listName={selectedList}
            onTodoCreated={handleTodoCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {/* Todo list */}
      <div className="grid gap-4">
        {todos.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No NFT todos yet. Create your first one!
          </p>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {todo.title}
                  </h3>
                  {todo.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {todo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      todo.priority === 'high' 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : todo.priority === 'medium'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {todo.priority}
                    </span>
                    {todo.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {todo.imageUrl && (
                  <img
                    src={todo.imageUrl}
                    alt={todo.title}
                    className="w-16 h-16 rounded-lg object-cover ml-4"
                  />
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>NFT ID: {todo.objectId?.slice(0, 8)}...</span>
                <span>Stored on Walrus: {todo.walrusBlobId?.slice(0, 8)}...</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Example 3: Programmatic usage
export function ProgrammaticNFTCreation() {
  const [isCreating, setIsCreating] = useState(false);

  const createBulkNFTs = async () => {
    setIsCreating(true);

    // Example: Create NFTs from a predefined list
    const todoTemplates = [
      {
        title: 'Review Q4 Financial Report',
        description: 'Analyze revenue trends and prepare summary for board meeting',
        priority: 'high' as const,
        tags: ['finance', 'quarterly', 'urgent'],
        category: 'work',
      },
      {
        title: 'Plan Team Building Event',
        description: 'Organize outdoor activity for engineering team',
        priority: 'medium' as const,
        tags: ['team', 'planning', 'social'],
        category: 'work',
      },
    ];

    // In a real implementation, you would call the Walrus/Sui APIs directly
    // This is just to demonstrate the concept
    for (const template of todoTemplates) {
      console.log('Creating NFT:', template.title);
      // Simulate creation delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsCreating(false);
    toast.success('Bulk NFT creation completed!');
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Bulk NFT Creation</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Create multiple Todo NFTs from templates or imported data.
      </p>
      <button
        onClick={createBulkNFTs}
        disabled={isCreating}
        className="ocean-button"
      >
        {isCreating ? 'Creating NFTs...' : 'Create Bulk NFTs'}
      </button>
    </div>
  );
}

// Example 4: Advanced integration with filters and search
export function AdvancedNFTTodoManager() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState({
    priority: 'all',
    category: 'all',
    completed: 'all',
  });

  const filteredTodos = todos.filter(todo => {
    if (filter.priority !== 'all' && todo.priority !== filter.priority) return false;
    if (filter.category !== 'all' && todo.category !== filter.category) return false;
    if (filter.completed !== 'all') {
      const isCompleted = filter.completed === 'completed';
      if (todo.completed !== isCompleted) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filter.priority}
          onChange={(e) => setFilter(prev => ({ ...prev, priority: e.target.value }))}
          className="ocean-input"
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filter.category}
          onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value }))}
          className="ocean-input"
        >
          <option value="all">All Categories</option>
          <option value="personal">Personal</option>
          <option value="work">Work</option>
          <option value="shopping">Shopping</option>
          <option value="health">Health</option>
          <option value="finance">Finance</option>
        </select>

        <select
          value={filter.completed}
          onChange={(e) => setFilter(prev => ({ ...prev, completed: e.target.value }))}
          className="ocean-input"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm text-blue-600 dark:text-blue-400">Total NFTs</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {todos.length}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <p className="text-sm text-green-600 dark:text-green-400">Completed</p>
          <p className="text-2xl font-bold text-green-900 dark:text-green-100">
            {todos.filter(t => t.completed).length}
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">Pending</p>
          <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
            {todos.filter(t => !t.completed).length}
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <p className="text-sm text-purple-600 dark:text-purple-400">High Priority</p>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {todos.filter(t => t.priority === 'high').length}
          </p>
        </div>
      </div>

      {/* Todo list with filtered results */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Filtered NFTs ({filteredTodos.length})
        </h3>
        {/* Render filtered todos here */}
      </div>
    </div>
  );
}