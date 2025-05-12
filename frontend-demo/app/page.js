'use client'

import { useState } from 'react'

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false)
  
  const handleConnect = () => {
    setIsConnecting(true)
    setTimeout(() => setIsConnecting(false), 1500)
  }

  const todoLists = [
    {
      name: 'Default',
      count: 3,
      completed: 1,
    },
    {
      name: 'Work',
      count: 5,
      completed: 2,
    },
    {
      name: 'Personal',
      count: 2,
      completed: 0,
    }
  ]

  return (
    <div>
      <header className="header">
        <div className="logo">WT</div>
        <h1 className="title">Walrus Todo</h1>
        <p className="subtitle">
          A dreamy, oceanic Web3 task management experience powered by Sui blockchain
        </p>
      </header>
      
      <div className="card-grid">
        {todoLists.map((list) => (
          <div key={list.name} className="card">
            <h2 className="card-title">{list.name}</h2>
            <div className="progress-container">
              <span>{list.completed}/{list.count} completed</span>
              <span>{Math.round((list.completed / list.count) * 100) || 0}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(list.completed / list.count) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <button 
          className="button"
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    </div>
  )
}