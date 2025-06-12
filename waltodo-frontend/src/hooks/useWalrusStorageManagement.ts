'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

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

interface StorageMetrics {
  date: string;
  usage: number;
  cost: number;
}

export function useWalrusStorageManagement() {
  const queryClient = useQueryClient();

  // Fetch storage blobs
  const { data: blobs = [], isLoading: blobsLoading } = useQuery<StorageBlob[]>({
    queryKey: ['storage', 'blobs'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/storage/blobs');
      // return response.json();
      
      // Mock data for now
      return [
        {
          id: '1',
          size: 1024 * 1024 * 5,
          createdAt: new Date(Date.now() - 86400000 * 7),
          expiresAt: new Date(Date.now() + 86400000 * 23),
          type: 'image',
          name: 'vacation-photo.jpg',
          walTokenCost: 0.5
        },
        {
          id: '2',
          size: 1024 * 50,
          createdAt: new Date(Date.now() - 86400000 * 3),
          expiresAt: new Date(Date.now() + 86400000 * 27),
          type: 'todo',
          name: 'shopping-list.json',
          walTokenCost: 0.05
        },
        {
          id: '3',
          size: 1024 * 1024 * 2,
          createdAt: new Date(Date.now() - 86400000),
          expiresAt: new Date(Date.now() + 86400000 * 29),
          type: 'nft',
          name: 'nft-metadata.json',
          walTokenCost: 0.2
        }
      ];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch storage quota
  const { data: quota, isLoading: quotaLoading } = useQuery<StorageQuota>({
    queryKey: ['storage', 'quota'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      const totalUsed = blobs.reduce((sum, blob) => sum + blob.size, 0);
      const totalCost = blobs.reduce((sum, blob) => sum + blob.walTokenCost, 0);
      
      return {
        used: totalUsed,
        total: 1024 * 1024 * 1024, // 1GB
        walTokensSpent: totalCost,
        walTokensRemaining: 1000 - totalCost
      };
    },
    enabled: blobs.length > 0,
  });

  // Delete blobs mutation
  const deleteBlobsMutation = useMutation({
    mutationFn: async (blobIds: string[]) => {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/storage/blobs', {
      //   method: 'DELETE',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ ids: blobIds }),
      // });
      // if (!response.ok) throw new Error('Failed to delete blobs');
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return blobIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      toast.success('Storage items deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete storage items');
    },
  });

  // Fetch analytics data
  const fetchAnalytics = useCallback(async (timeRange: '7d' | '30d' | '90d'): Promise<StorageMetrics[]> => {
    // TODO: Replace with actual API call
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const metrics: StorageMetrics[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      metrics.push({
        date: date.toISOString().split('T')[0],
        usage: Math.random() * 500 + 200 + (days - i) * 5,
        cost: Math.random() * 5 + 2 + (days - i) * 0.1
      });
    }
    
    return metrics;
  }, []);

  // Storage preferences
  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('storagePreferences');
    return saved ? JSON.parse(saved as any) : {
      autoCleanup: false,
      cleanupDays: 30,
      compressionEnabled: true,
      compressionQuality: 85,
      costAlertThreshold: 100,
      storageAlertThreshold: 80,
      emailNotifications: false,
      batchingEnabled: true,
      batchSize: 10
    };
  });

  const savePreferences = useCallback(async (newPreferences: typeof preferences) => {
    try {
      // TODO: Save to API
      localStorage.setItem('storagePreferences', JSON.stringify(newPreferences as any));
      setPreferences(newPreferences as any);
      toast.success('Preferences saved successfully');
    } catch (error) {
      toast.error('Failed to save preferences');
      throw error;
    }
  }, []);

  // Auto-cleanup effect
  useEffect(() => {
    if (!preferences.autoCleanup || !blobs.length) {return;}

    const expiredBlobs = blobs.filter(blob => {
      const ageInDays = (Date.now() - blob?.createdAt?.getTime()) / (1000 * 60 * 60 * 24);
      return ageInDays > preferences.cleanupDays;
    });

    if (expiredBlobs.length > 0) {
      console.log(`Found ${expiredBlobs.length} expired blobs for auto-cleanup`);
      // TODO: Implement auto-cleanup
    }
  }, [preferences.autoCleanup, preferences.cleanupDays, blobs]);

  // Cost alert effect
  useEffect(() => {
    if (!quota) {return;}

    if (quota.walTokensSpent > preferences.costAlertThreshold) {
      toast.error(`Storage costs exceeded ${preferences.costAlertThreshold} WAL tokens!`);
    }

    const usagePercentage = (quota.used / quota.total) * 100;
    if (usagePercentage > preferences.storageAlertThreshold) {
      toast.error(`Storage usage exceeded ${preferences.storageAlertThreshold}%!`);
    }
  }, [quota, preferences.costAlertThreshold, preferences.storageAlertThreshold]);

  return {
    blobs,
    quota,
    isLoading: blobsLoading || quotaLoading,
    deleteBlobs: deleteBlobsMutation.mutate,
    isDeletingBlobs: deleteBlobsMutation.isPending,
    fetchAnalytics,
    preferences,
    savePreferences,
  };
}