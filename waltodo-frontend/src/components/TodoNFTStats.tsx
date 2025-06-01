'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useSuiClient } from '../hooks/useSuiClient';
import { useBlockchainEvents } from '../hooks/useBlockchainEvents';
import { TodoNFT } from '../types/todo-nft';
import { formatDistanceToNow } from 'date-fns';
import testnetConfig from '../config/testnet.json';

interface NFTStats {
  totalCount: number;
  completedCount: number;
  completedPercentage: number;
  totalStorageBytes: number;
  averageCompletionTime: number;
  priorityDistribution: { priority: string; count: number; percentage: number }[];
  tagFrequency: { tag: string; count: number }[];
  completionOverTime: { date: string; completed: number; total: number; rate: number }[];
  walTokenUsage: {
    totalSpent: number;
    averagePerTodo: number;
    estimatedRemaining: number;
  };
}

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981'
};

export const TodoNFTStats: React.FC = () => {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { eventCache } = useBlockchainEvents();
  const [nfts, setNfts] = useState<TodoNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch NFTs
  useEffect(() => {
    const fetchNFTs = async () => {
      if (!account?.address || !client) return;

      try {
        setLoading(true);
        setError(null);

        const suiClient = await client.getClient();
        if (!suiClient) return;

        const objects = await suiClient.getOwnedObjects({
          owner: account.address,
          filter: {
            StructType: `${testnetConfig.contracts.todoNft.packageId}::${testnetConfig.contracts.todoNft.moduleName}::${testnetConfig.contracts.todoNft.structName}`
          },
          options: {
            showType: true,
            showContent: true,
            showDisplay: true
          }
        });

        const nftData: TodoNFT[] = [];
        
        for (const obj of objects.data) {
          if (obj.data?.content?.dataType === 'moveObject') {
            const fields = obj.data.content.fields as any;
            nftData.push({
              id: obj.data.objectId,
              title: fields.title || '',
              content: fields.content || '',
              priority: fields.priority || 'medium',
              completed: fields.completed || false,
              blobId: fields.blob_id || '',
              storageSize: parseInt(fields.storage_size || '0'),
              createdAt: parseInt(fields.created_at || Date.now().toString()),
              completedAt: fields.completed_at ? parseInt(fields.completed_at) : undefined,
              tags: fields.tags || [],
              walTokensSpent: parseInt(fields.wal_tokens_spent || '0')
            });
          }
        }

        setNfts(nftData);
      } catch (err) {
        console.error('Error fetching NFTs:', err);
        setError('Failed to fetch NFT statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchNFTs();
  }, [account, client, refreshKey]);

  // Refresh on new events
  useEffect(() => {
    const relevantEvents = eventCache.filter(e => 
      e.type.includes('TodoCreated') || 
      e.type.includes('TodoCompleted') ||
      e.type.includes('TodoDeleted')
    );
    
    if (relevantEvents.length > 0) {
      setRefreshKey(prev => prev + 1);
    }
  }, [eventCache]);

  // Calculate statistics
  const stats = useMemo<NFTStats>(() => {
    if (nfts.length === 0) {
      return {
        totalCount: 0,
        completedCount: 0,
        completedPercentage: 0,
        totalStorageBytes: 0,
        averageCompletionTime: 0,
        priorityDistribution: [],
        tagFrequency: [],
        completionOverTime: [],
        walTokenUsage: {
          totalSpent: 0,
          averagePerTodo: 0,
          estimatedRemaining: 0
        }
      };
    }

    const completedNfts = nfts.filter(nft => nft.completed);
    const completedCount = completedNfts.length;
    const completedPercentage = (completedCount / nfts.length) * 100;

    // Storage calculation
    const totalStorageBytes = nfts.reduce((sum, nft) => sum + nft.storageSize, 0);

    // Average completion time
    const completionTimes = completedNfts
      .filter(nft => nft.completedAt)
      .map(nft => nft.completedAt! - nft.createdAt);
    const averageCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
      : 0;

    // Priority distribution
    const priorityCounts = nfts.reduce((acc, nft) => {
      acc[nft.priority] = (acc[nft.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityDistribution = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority,
      count,
      percentage: (count / nfts.length) * 100
    }));

    // Tag frequency
    const tagCounts = nfts.reduce((acc, nft) => {
      nft.tags.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const tagFrequency = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 tags

    // Completion over time (last 30 days)
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const dailyStats: Record<string, { total: number; completed: number }> = {};

    // Initialize daily stats
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo + (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0];
      dailyStats[dateStr] = { total: 0, completed: 0 };
    }

    // Count NFTs per day
    nfts.forEach(nft => {
      const createdDate = new Date(nft.createdAt).toISOString().split('T')[0];
      if (dailyStats[createdDate]) {
        dailyStats[createdDate].total++;
        if (nft.completed) {
          dailyStats[createdDate].completed++;
        }
      }
    });

    const completionOverTime = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      completed: stats.completed,
      total: stats.total,
      rate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
    }));

    // WAL token usage
    const totalWalSpent = nfts.reduce((sum, nft) => sum + nft.walTokensSpent, 0);
    const averageWalPerTodo = nfts.length > 0 ? totalWalSpent / nfts.length : 0;
    // Estimate remaining based on average usage and assuming 1000 WAL tokens total budget
    const estimatedRemaining = Math.max(0, 1000 - totalWalSpent);

    return {
      totalCount: nfts.length,
      completedCount,
      completedPercentage,
      totalStorageBytes,
      averageCompletionTime,
      priorityDistribution,
      tagFrequency,
      completionOverTime,
      walTokenUsage: {
        totalSpent: totalWalSpent,
        averagePerTodo: averageWalPerTodo,
        estimatedRemaining
      }
    };
  }, [nfts]);

  // Export functionality
  const exportStatistics = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      statistics: stats,
      nfts: nfts.map(nft => ({
        ...nft,
        createdAtFormatted: new Date(nft.createdAt).toISOString(),
        completedAtFormatted: nft.completedAt ? new Date(nft.completedAt).toISOString() : null
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todo-nft-stats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format duration to human readable
  const formatDuration = (ms: number) => {
    if (ms === 0) return 'N/A';
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return '< 1h';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Please connect your wallet to view NFT statistics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with export button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Todo NFT Statistics</h2>
        <button
          onClick={exportStatistics}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Export Statistics
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total NFTs</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalCount}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Completed</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {stats.completedCount} ({stats.completedPercentage.toFixed(1)}%)
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Storage</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {formatBytes(stats.totalStorageBytes)}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Avg Completion Time</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">
            {formatDuration(stats.averageCompletionTime)}
          </p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion Rate Over Time */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Completion Rate Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.completionOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: any) => [`${value}%`, 'Completion Rate']}
              />
              <Area 
                type="monotone" 
                dataKey="rate" 
                stroke="#3b82f6" 
                fill="#93bbfc" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Priority Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.priorityDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ priority, percentage }) => `${priority}: ${percentage.toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {stats.priorityDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.priority as keyof typeof PRIORITY_COLORS]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tag Cloud */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Most Used Tags</h3>
          <div className="flex flex-wrap gap-2">
            {stats.tagFrequency.map((tag, index) => {
              const fontSize = Math.max(0.75, Math.min(2, tag.count / 10)) + 'rem';
              return (
                <span
                  key={index}
                  className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full"
                  style={{ fontSize }}
                >
                  {tag.tag} ({tag.count})
                </span>
              );
            })}
            {stats.tagFrequency.length === 0 && (
              <p className="text-gray-500">No tags found</p>
            )}
          </div>
        </div>

        {/* WAL Token Usage */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">WAL Token Usage</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Spent</span>
                <span className="font-semibold">{stats.walTokenUsage.totalSpent} WAL</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">Average per Todo</span>
                <span className="font-semibold">{stats.walTokenUsage.averagePerTodo.toFixed(2)} WAL</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">Estimated Remaining</span>
                <span className="font-semibold text-green-600">{stats.walTokenUsage.estimatedRemaining} WAL</span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${(stats.walTokenUsage.totalSpent / 1000) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((stats.walTokenUsage.totalSpent / 1000) * 100).toFixed(1)}% of budget used
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Updates Indicator */}
      <div className="text-center text-sm text-gray-500">
        <span className="inline-flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
          Real-time updates enabled • Last updated: {formatDistanceToNow(new Date(), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
};