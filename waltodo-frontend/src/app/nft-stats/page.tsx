'use client';

import React, { useEffect, useState } from 'react';
import { DynamicTodoNFTStats } from '../../lib/dynamic-wallet-imports';
import WalletConnectButton from '../../components/WalletConnectButton';
import { ClientOnly } from '../../components/ClientOnly';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function NFTStatsPage() {
  const [liveStats, setLiveStats] = useState({
    totalNFTs: 0,
    activeUsers: 0,
    totalValue: 0,
    transactions: 0,
    avgCompletionTime: 0,
    popularCategories: [] as Array<{name: string, count: number, color: string}>
  });

  const [networkStatus, setNetworkStatus] = useState({ sui: 'online', walrus: 'online' });

  useEffect(() => {
    // Simulate real-time data updates for demo
    const interval = setInterval(() => {
      setLiveStats({
        totalNFTs: 1247 + Math.floor(Math.random() * 10),
        activeUsers: 89 + Math.floor(Math.random() * 5),
        totalValue: 2.45 + Math.random() * 0.1,
        transactions: 3421 + Math.floor(Math.random() * 20),
        avgCompletionTime: 2.3 + Math.random() * 0.5,
        popularCategories: [
          { name: 'Work', count: 45, color: 'bg-blue-500' },
          { name: 'Personal', count: 32, color: 'bg-green-500' },
          { name: 'Health', count: 18, color: 'bg-purple-500' },
          { name: 'Finance', count: 15, color: 'bg-yellow-500' },
          { name: 'Shopping', count: 12, color: 'bg-pink-500' }
        ]
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ClientOnly>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Enhanced Header */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link 
                  href="/"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    TodoNFT Analytics
                  </h1>
                  <p className="text-sm text-gray-500">Real-time network insights</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${networkStatus.sui === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs text-gray-600">Sui</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${networkStatus.walrus === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs text-gray-600">Walrus</span>
                  </div>
                </div>
                <WalletConnectButton />
              </div>
            </div>
          </div>
        </div>

        {/* Live Metrics Dashboard */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Key Metrics */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total TodoNFTs</span>
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-gray-900">{liveStats.totalNFTs.toLocaleString()}</div>
              <div className="text-xs text-green-600">+12.5% this week</div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Active Users</span>
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-gray-900">{liveStats.activeUsers}</div>
              <div className="text-xs text-green-600">+8.3% this week</div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Value</span>
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-gray-900">{liveStats.totalValue.toFixed(2)} ETH</div>
              <div className="text-xs text-green-600">+15.7% this week</div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Transactions</span>
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-gray-900">{liveStats.transactions.toLocaleString()}</div>
              <div className="text-xs text-green-600">+23.1% this week</div>
            </div>
          </motion.div>

          {/* Category Distribution */}
          <motion.div 
            className="bg-white rounded-xl p-8 shadow-lg border border-gray-200/50 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Popular Task Categories</h3>
            <div className="space-y-4">
              {liveStats.popularCategories.map((category, index) => (
                <div key={category.name} className="flex items-center">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{category.name}</span>
                      <span className="text-sm text-gray-500">{category.count}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div 
                        className={`h-2 rounded-full ${category.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${category.count}%` }}
                        transition={{ delay: 0.4 + index * 0.1, duration: 0.8 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Original Stats Component */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <DynamicTodoNFTStats />
          </motion.div>
        </div>
      </div>
    </ClientOnly>
  );
}