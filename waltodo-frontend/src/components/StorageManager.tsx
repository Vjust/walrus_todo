'use client';

import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, AlertCircle, TrendingUp, Clock, Database } from 'lucide-react';

interface StorageBlob {
  id: string;
  size: number;
  createdAt: Date;
  expiresAt: Date;
  type: 'todo' | 'image' | 'nft';
  name: string;
  walTokenCost: number;
}

interface StorageQuota {
  used: number;
  total: number;
  walTokensSpent: number;
  walTokensRemaining: number;
}

export default function StorageManager() {
  const [blobs, setBlobs] = useState<StorageBlob[]>([]);
  const [quota, setQuota] = useState<StorageQuota>({
    used: 0,
    total: 1024 * 1024 * 1024, // 1GB default
    walTokensSpent: 0,
    walTokensRemaining: 1000
  });
  const [selectedBlobs, setSelectedBlobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'size' | 'date' | 'expiry'>('date');

  useEffect(() => {
    fetchStorageData();
  }, []);

  const fetchStorageData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API calls
      const mockBlobs: StorageBlob[] = [
        {
          id: '1',
          size: 1024 * 1024 * 5, // 5MB
          createdAt: new Date(Date.now() - 86400000 * 7),
          expiresAt: new Date(Date.now() + 86400000 * 23),
          type: 'image',
          name: 'vacation-photo.jpg',
          walTokenCost: 0.5
        },
        {
          id: '2',
          size: 1024 * 50, // 50KB
          createdAt: new Date(Date.now() - 86400000 * 3),
          expiresAt: new Date(Date.now() + 86400000 * 27),
          type: 'todo',
          name: 'shopping-list.json',
          walTokenCost: 0.05
        },
        {
          id: '3',
          size: 1024 * 1024 * 2, // 2MB
          createdAt: new Date(Date.now() - 86400000),
          expiresAt: new Date(Date.now() + 86400000 * 29),
          type: 'nft',
          name: 'nft-metadata.json',
          walTokenCost: 0.2
        }
      ];
      
      setBlobs(mockBlobs);
      const totalUsed = mockBlobs.reduce((sum, blob) => sum + blob.size, 0);
      const totalCost = mockBlobs.reduce((sum, blob) => sum + blob.walTokenCost, 0);
      
      setQuota({
        used: totalUsed,
        total: 1024 * 1024 * 1024,
        walTokensSpent: totalCost,
        walTokensRemaining: 1000 - totalCost
      });
    } catch (error) {
      console.error('Failed to fetch storage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'bg-blue-100 text-blue-800';
      case 'todo': return 'bg-green-100 text-green-800';
      case 'nft': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDelete = async (blobIds: string[]) => {
    if (!confirm(`Delete ${blobIds.length} item(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      // TODO: Implement actual deletion
      setBlobs(prev => prev.filter(blob => !blobIds.includes(blob.id)));
      setSelectedBlobs(new Set());
      await fetchStorageData();
    } catch (error) {
      console.error('Failed to delete blobs:', error);
    }
  };

  const sortedBlobs = [...blobs].sort((a, b) => {
    switch (sortBy) {
      case 'size': return b.size - a.size;
      case 'date': return b.createdAt.getTime() - a.createdAt.getTime();
      case 'expiry': return a.expiresAt.getTime() - b.expiresAt.getTime();
      default: return 0;
    }
  });

  const toggleSelection = (blobId: string) => {
    setSelectedBlobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blobId)) {
        newSet.delete(blobId);
      } else {
        newSet.add(blobId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedBlobs.size === blobs.length) {
      setSelectedBlobs(new Set());
    } else {
      setSelectedBlobs(new Set(blobs.map(b => b.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Storage Overview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <Database className="mr-2" />
          Storage Overview
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Storage Usage */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Storage Usage</h3>
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>{formatBytes(quota.used)} of {formatBytes(quota.total)}</span>
                <span>{((quota.used / quota.total) * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(quota.used / quota.total) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* WAL Token Usage */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">WAL Token Usage</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Spent:</span>
                <span className="font-semibold">{quota.walTokensSpent.toFixed(2)} WAL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Remaining:</span>
                <span className="font-semibold text-green-600">{quota.walTokensRemaining.toFixed(2)} WAL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Avg Cost/MB:</span>
                <span className="text-sm">{(quota.walTokensSpent / (quota.used / (1024 * 1024))).toFixed(4)} WAL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Blob Management */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Storage Items</h3>
          <div className="flex items-center space-x-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="date">Sort by Date</option>
              <option value="size">Sort by Size</option>
              <option value="expiry">Sort by Expiry</option>
            </select>
            {selectedBlobs.size > 0 && (
              <button
                onClick={() => handleDelete(Array.from(selectedBlobs))}
                className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete ({selectedBlobs.size})
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2">
                  <input
                    type="checkbox"
                    checked={selectedBlobs.size === blobs.length && blobs.length > 0}
                    onChange={selectAll}
                    className="rounded"
                  />
                </th>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Size</th>
                <th className="text-left py-2">Created</th>
                <th className="text-left py-2">Expires</th>
                <th className="text-left py-2">Cost</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedBlobs.map((blob) => {
                const isExpiringSoon = blob.expiresAt.getTime() - Date.now() < 86400000 * 7; // 7 days
                return (
                  <tr key={blob.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={selectedBlobs.has(blob.id)}
                        onChange={() => toggleSelection(blob.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="py-2 font-medium">{blob.name}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${getTypeColor(blob.type)}`}>
                        {blob.type}
                      </span>
                    </td>
                    <td className="py-2 text-sm">{formatBytes(blob.size)}</td>
                    <td className="py-2 text-sm text-gray-600">
                      {formatDistanceToNow(blob.createdAt, { addSuffix: true })}
                    </td>
                    <td className="py-2 text-sm">
                      <div className="flex items-center">
                        {isExpiringSoon && <AlertCircle className="w-4 h-4 text-orange-500 mr-1" />}
                        <span className={isExpiringSoon ? 'text-orange-600' : 'text-gray-600'}>
                          {formatDistanceToNow(blob.expiresAt, { addSuffix: true })}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-sm">{blob.walTokenCost.toFixed(3)} WAL</td>
                    <td className="py-2">
                      <button
                        onClick={() => handleDelete([blob.id])}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {blobs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No storage items found
            </div>
          )}
        </div>
      </div>

      {/* Storage Tips */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Storage Optimization Tips
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Delete expired items regularly to free up space</li>
          <li>• Compress images before uploading to reduce storage costs</li>
          <li>• Use batch operations to optimize WAL token usage</li>
          <li>• Set up auto-cleanup for items older than 30 days</li>
        </ul>
      </div>
    </div>
  );
}