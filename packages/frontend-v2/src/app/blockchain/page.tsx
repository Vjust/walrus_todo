'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/navbar'
import { getTodosFromBlockchain } from '@/lib/sui-client'

export default function BlockchainPage() {
  const [nftTodos, setNftTodos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Client-side code only
    const loadBlockchainTodos = async () => {
      try {
        setIsLoading(true)
        const todos = await getTodosFromBlockchain()
        setNftTodos(todos)
        setIsLoading(false)
      } catch (err) {
        console.error('Error loading blockchain todos:', err)
        setError('Failed to load NFT todos')
        setIsLoading(false)
      }
    }

    // Only run in browser environment
    if (typeof window !== 'undefined') {
      loadBlockchainTodos()
    }
  }, [])

  return (
    <div className="max-w-6xl mx-auto">
      <Navbar currentPage="blockchain" />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 text-ocean-deep dark:text-ocean-foam">NFT Todos</h1>
        <p className="text-ocean-medium dark:text-ocean-light">
          Manage your blockchain-stored todo NFTs
        </p>
      </div>

      <div className="ocean-card">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 rounded-full border-4 border-ocean-light border-t-ocean-deep animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            {error}
          </div>
        ) : nftTodos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-ocean-medium dark:text-ocean-light mb-4">No NFT todos found.</p>
            <p className="text-sm text-ocean-medium/70 dark:text-ocean-light/70 max-w-md mx-auto">
              You can create NFT todos by clicking "Store on Blockchain" for any of your existing todos in the dashboard.
            </p>
            <button 
              className="mt-6 ocean-button"
              onClick={() => window.location.href = '/dashboard'}
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4 text-ocean-deep dark:text-ocean-foam">
              Your NFT Todos
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nftTodos.map((todo) => (
                <div 
                  key={todo.id} 
                  className="p-4 rounded-lg bg-white/30 dark:bg-ocean-deep/40 backdrop-blur-md border border-ocean-foam/50 dark:border-ocean-light/20 shadow-dreamy"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full flex-shrink-0 border-2 border-dream-purple bg-dream-purple/20">
                      <span className="sr-only">NFT</span>
                    </div>
                    
                    <div className="flex-grow">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-ocean-deep dark:text-ocean-foam">
                          {todo.title}
                        </h3>
                        
                        <span className="text-xs px-2 py-0.5 rounded-full bg-dream-purple/20 text-dream-purple">
                          NFT
                        </span>
                      </div>
                      
                      {todo.description && (
                        <p className="mt-1 text-sm text-ocean-medium dark:text-ocean-light/80">
                          {todo.description}
                        </p>
                      )}
                      
                      <div className="mt-2 text-xs text-ocean-medium dark:text-ocean-light flex flex-col">
                        <span className="font-mono">Object ID: {todo.objectId || 'Unknown'}</span>
                        <span>Status: {todo.completed ? 'Completed' : 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-ocean-light/20 dark:border-ocean-medium/20 flex justify-end gap-2">
                    <button className="text-xs text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam transition-colors">
                      View on Explorer
                    </button>
                    <button className="text-xs text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam transition-colors">
                      Transfer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}