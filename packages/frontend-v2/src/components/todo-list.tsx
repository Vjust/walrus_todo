'use client'

import { useState, useEffect } from 'react'

type Todo = {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  tags?: string[]
  dueDate?: string
  blockchainStored?: boolean
}

type TodoListProps = {
  listName: string
}

export default function TodoList({ listName }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Mock loading todos - will be replaced with actual API call
  useEffect(() => {
    const loadTodos = async () => {
      setIsLoading(true)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data - will be replaced with real data
      const mockTodos: Todo[] = [
        {
          id: '1',
          title: 'Set up blockchain wallet',
          completed: false,
          priority: 'high',
          tags: ['setup', 'blockchain'],
          blockchainStored: true
        },
        {
          id: '2',
          title: 'Design oceanic UI components',
          description: 'Create reusable Tailwind components with ocean theme',
          completed: true,
          priority: 'medium',
          tags: ['design', 'frontend']
        },
        {
          id: '3',
          title: 'Implement Sui blockchain connectivity',
          completed: false,
          priority: 'high',
          dueDate: '2023-12-01'
        },
        {
          id: '4',
          title: 'Test NFT todo transfers',
          completed: false,
          priority: 'medium',
          tags: ['testing', 'blockchain']
        }
      ]
      
      setTodos(mockTodos)
      setIsLoading(false)
    }
    
    loadTodos()
  }, [listName])

  const toggleTodoCompletion = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 rounded-full border-4 border-ocean-light border-t-ocean-deep animate-spin"></div>
      </div>
    )
  }

  if (todos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ocean-medium dark:text-ocean-light mb-4">No todos in this list yet.</p>
        <p className="text-sm text-ocean-medium/70 dark:text-ocean-light/70">
          Create your first todo using the form above!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {todos.map(todo => (
        <div 
          key={todo.id} 
          className={`p-4 rounded-lg transition-all ${
            todo.completed 
              ? 'bg-green-50/50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50' 
              : 'bg-white/50 dark:bg-ocean-deep/30 border border-ocean-light/20'
          }`}
        >
          <div className="flex items-start gap-3">
            <button 
              onClick={() => toggleTodoCompletion(todo.id)}
              className={`mt-1 w-5 h-5 rounded-full flex-shrink-0 ${
                todo.completed 
                  ? 'bg-green-500 text-white flex items-center justify-center' 
                  : 'border-2 border-ocean-medium'
              }`}
            >
              {todo.completed && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            <div className="flex-grow">
              <div className="flex items-start justify-between">
                <h3 className={`font-medium ${todo.completed ? 'line-through text-ocean-medium/70 dark:text-ocean-light/70' : 'text-ocean-deep dark:text-ocean-foam'}`}>
                  {todo.title}
                </h3>
                
                <div className="flex items-center gap-2">
                  {todo.blockchainStored && (
                    <span className="flex items-center text-xs bg-dream-purple/20 text-dream-purple px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-dream-purple rounded-full mr-1"></span>
                      NFT
                    </span>
                  )}
                  
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    todo.priority === 'high' 
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300' 
                      : todo.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {todo.priority}
                  </span>
                </div>
              </div>
              
              {todo.description && (
                <p className="mt-1 text-sm text-ocean-medium dark:text-ocean-light/80">
                  {todo.description}
                </p>
              )}
              
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {todo.tags && todo.tags.map(tag => (
                  <span key={tag} className="text-xs bg-ocean-light/30 dark:bg-ocean-medium/30 text-ocean-deep dark:text-ocean-foam px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
                
                {todo.dueDate && (
                  <span className="text-xs text-ocean-medium dark:text-ocean-light flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Due: {todo.dueDate}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-ocean-light/20 dark:border-ocean-medium/20 flex justify-end gap-2">
            <button className="text-xs text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam transition-colors">
              Edit
            </button>
            {!todo.blockchainStored && (
              <button className="text-xs text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam transition-colors">
                Store on Blockchain
              </button>
            )}
            <button className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}