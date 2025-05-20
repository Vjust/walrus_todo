'use client'

import { useState } from 'react'
import Navbar from '@/components/navbar'
import TodoList from '@/components/todo-list'
import CreateTodoForm from '@/components/create-todo-form'

export default function Dashboard() {
  const [selectedList, setSelectedList] = useState('default')
  
  // Mock data - will be replaced with actual data from backend
  const mockLists = ['default', 'work', 'personal', 'shopping']
  
  return (
    <div className="max-w-6xl mx-auto">
      <Navbar currentPage="dashboard" />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 text-ocean-deep dark:text-ocean-foam">Dashboard</h1>
        <p className="text-ocean-medium dark:text-ocean-light">Manage your todos across different lists</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <div className="ocean-card h-full">
            <h2 className="text-xl font-semibold mb-4 text-ocean-deep dark:text-ocean-foam">Your Lists</h2>
            
            <ul className="space-y-2">
              {mockLists.map((list) => (
                <li key={list} className="mb-1">
                  <button
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedList === list 
                        ? 'bg-ocean-medium text-white font-medium' 
                        : 'hover:bg-ocean-light/30 dark:hover:bg-ocean-medium/30'
                    }`}
                    onClick={() => setSelectedList(list)}
                  >
                    {list.charAt(0).toUpperCase() + list.slice(1)}
                  </button>
                </li>
              ))}
            </ul>
            
            <div className="mt-6">
              <button className="ocean-button w-full">
                <span>Create New List</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-3">
          <div className="ocean-card mb-6">
            <h2 className="text-xl font-semibold mb-4 text-ocean-deep dark:text-ocean-foam">
              Add New Todo
            </h2>
            <CreateTodoForm listName={selectedList} />
          </div>
          
          <div className="ocean-card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-ocean-deep dark:text-ocean-foam">
                {selectedList.charAt(0).toUpperCase() + selectedList.slice(1)} List
              </h2>
              
              <div className="flex space-x-2">
                <button className="px-3 py-1 text-sm bg-ocean-light/50 dark:bg-ocean-medium/50 rounded-lg hover:bg-ocean-light dark:hover:bg-ocean-medium transition-colors">
                  All
                </button>
                <button className="px-3 py-1 text-sm bg-ocean-light/30 dark:bg-ocean-medium/30 rounded-lg hover:bg-ocean-light dark:hover:bg-ocean-medium transition-colors">
                  Pending
                </button>
                <button className="px-3 py-1 text-sm bg-ocean-light/30 dark:bg-ocean-medium/30 rounded-lg hover:bg-ocean-light dark:hover:bg-ocean-medium transition-colors">
                  Completed
                </button>
              </div>
            </div>
            
            <TodoList listName={selectedList} />
          </div>
        </div>
      </div>
    </div>
  )
}