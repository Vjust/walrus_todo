'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import type { Todo, TodoNFT } from '@/types/todo-nft';

// Analytics event types
type EventType = 'view' | 'click' | 'create' | 'complete' | 'transfer' | 'error' | 'load';

interface AnalyticsEvent {
  id: string;
  type: EventType;
  nftId?: string;
  timestamp: number;
  duration?: number; // For performance metrics
  metadata?: Record<string, any>;
  variant?: 'A' | 'B'; // For A/B testing
  userId?: string; // Anonymous ID for privacy
}

interface PerformanceMetric {
  operation: string;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  count: number;
  p95Duration: number; // 95th percentile
}

interface UsagePattern {
  hourOfDay: number[];
  dayOfWeek: number[];
  commonActions: { action: string; count: number }[];
  peakHours: number[];
}

interface NFTAnalyticsProps {
  anonymousUserId?: string; // Optional anonymous user ID
  enableExport?: boolean;
  testVariant?: 'A' | 'B'; // For A/B testing
}

export function NFTAnalytics({ 
  anonymousUserId, 
  enableExport = true,
  testVariant = 'A' 
}: NFTAnalyticsProps) {
  const walletContext = useWalletContext();
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'interactions' | 'performance' | 'errors'>('interactions');
  
  // Privacy-respecting user ID (could be session-based or wallet-based hash)
  const userId = anonymousUserId || (walletContext?.account ? 
    btoa(walletContext.account.address).slice(0, 8) : // Simple hash for demo
    'anonymous'
  );

  // Track an analytics event
  const trackEvent = useCallback((
    type: EventType, 
    nftId?: string, 
    duration?: number, 
    metadata?: Record<string, any>
  ) => {
    const event: AnalyticsEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      nftId,
      timestamp: Date.now(),
      duration,
      metadata,
      variant: testVariant,
      userId
    };
    
    setEvents(prev => [...prev, event]);
    
    // Store in localStorage for persistence (with size limit)
    try {
      const stored = localStorage.getItem('nft_analytics_events');
      const existingEvents = stored ? JSON.parse(stored) : [];
      const allEvents = [...existingEvents, event].slice(-1000); // Keep last 1000 events
      localStorage.setItem('nft_analytics_events', JSON.stringify(allEvents));
    } catch (e) {
      console.warn('Failed to store analytics event:', e);
    }
  }, [testVariant, userId]);

  // Load stored events on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('nft_analytics_events');
      if (stored) {
        setEvents(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load analytics events:', e);
    }
  }, []);

  // Filter events by time range
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const ranges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      'all': Infinity
    };
    
    const cutoff = now - ranges[timeRange];
    return events.filter(e => e.timestamp >= cutoff);
  }, [events, timeRange]);

  // Calculate performance metrics
  const performanceMetrics = useMemo((): PerformanceMetric[] => {
    const metricsMap = new Map<string, number[]>();
    
    filteredEvents.forEach(event => {
      if (event.duration) {
        const key = event.type;
        if (!metricsMap.has(key)) {
          metricsMap.set(key, []);
        }
        metricsMap.get(key)!.push(event.duration);
      }
    });
    
    return Array.from(metricsMap.entries()).map(([operation, durations]) => {
      durations.sort((a, b) => a - b);
      const sum = durations.reduce((a, b) => a + b, 0);
      const p95Index = Math.floor(durations.length * 0.95);
      
      return {
        operation,
        avgDuration: sum / durations.length,
        minDuration: durations[0] || 0,
        maxDuration: durations[durations.length - 1] || 0,
        count: durations.length,
        p95Duration: durations[p95Index] || 0
      };
    });
  }, [filteredEvents]);

  // Calculate usage patterns
  const usagePatterns = useMemo((): UsagePattern => {
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    const actionCounts = new Map<string, number>();
    
    filteredEvents.forEach(event => {
      const date = new Date(event.timestamp);
      hourCounts[date.getHours()]++;
      dayCounts[date.getDay()]++;
      
      const action = event.type;
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    });
    
    // Find peak hours (top 3)
    const hoursWithCounts = hourCounts.map((count, hour) => ({ hour, count }));
    hoursWithCounts.sort((a, b) => b.count - a.count);
    const peakHours = hoursWithCounts.slice(0, 3).map(h => h.hour);
    
    return {
      hourOfDay: hourCounts,
      dayOfWeek: dayCounts,
      commonActions: Array.from(actionCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count),
      peakHours
    };
  }, [filteredEvents]);

  // Calculate error rate
  const errorMetrics = useMemo(() => {
    const errorEvents = filteredEvents.filter(e => e.type === 'error');
    const totalEvents = filteredEvents.length;
    const errorRate = totalEvents > 0 ? (errorEvents.length / totalEvents) * 100 : 0;
    
    // Group errors by type
    const errorTypes = new Map<string, number>();
    errorEvents.forEach(event => {
      const errorType = event.metadata?.errorType || 'unknown';
      errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
    });
    
    return {
      rate: errorRate,
      count: errorEvents.length,
      types: Array.from(errorTypes.entries()).map(([type, count]) => ({ type, count }))
    };
  }, [filteredEvents]);

  // A/B test metrics
  const abTestMetrics = useMemo(() => {
    const variantA = filteredEvents.filter(e => e.variant === 'A');
    const variantB = filteredEvents.filter(e => e.variant === 'B');
    
    const calculateConversion = (events: AnalyticsEvent[]) => {
      const creates = events.filter(e => e.type === 'create').length;
      const completes = events.filter(e => e.type === 'complete').length;
      return creates > 0 ? (completes / creates) * 100 : 0;
    };
    
    return {
      A: {
        count: variantA.length,
        conversionRate: calculateConversion(variantA)
      },
      B: {
        count: variantB.length,
        conversionRate: calculateConversion(variantB)
      }
    };
  }, [filteredEvents]);

  // Export data functionality
  const exportData = useCallback(() => {
    const data = {
      events: filteredEvents,
      performanceMetrics,
      usagePatterns,
      errorMetrics,
      abTestMetrics,
      exportDate: new Date().toISOString(),
      timeRange
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nft-analytics-${timeRange}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredEvents, performanceMetrics, usagePatterns, errorMetrics, abTestMetrics, timeRange]);

  // Chart rendering helpers
  const renderSparkline = (data: number[], width = 100, height = 30) => {
    const max = Math.max(...data, 1);
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <svg width={width} height={height} className="inline-block">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
          className="text-ocean-medium"
        />
      </svg>
    );
  };

  return (
    <div className="space-y-6 p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-ocean-deep dark:text-ocean-foam">
          NFT Analytics Dashboard
        </h2>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-1 rounded border border-ocean-light/20 bg-white dark:bg-slate-700 text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          {enableExport && (
            <button
              onClick={exportData}
              className="px-3 py-1 bg-ocean-medium text-white rounded hover:bg-ocean-deep text-sm"
            >
              Export Data
            </button>
          )}
        </div>
      </div>

      {/* Metric Tabs */}
      <div className="flex gap-4 border-b border-ocean-light/20">
        <button
          onClick={() => setSelectedMetric('interactions')}
          className={`pb-2 px-1 ${selectedMetric === 'interactions' ? 'border-b-2 border-ocean-medium' : ''}`}
        >
          Interactions
        </button>
        <button
          onClick={() => setSelectedMetric('performance')}
          className={`pb-2 px-1 ${selectedMetric === 'performance' ? 'border-b-2 border-ocean-medium' : ''}`}
        >
          Performance
        </button>
        <button
          onClick={() => setSelectedMetric('errors')}
          className={`pb-2 px-1 ${selectedMetric === 'errors' ? 'border-b-2 border-ocean-medium' : ''}`}
        >
          Errors
        </button>
      </div>

      {/* Metrics Content */}
      {selectedMetric === 'interactions' && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-ocean-light/10 rounded">
              <p className="text-sm text-ocean-medium">Total Events</p>
              <p className="text-2xl font-semibold">{filteredEvents.length}</p>
            </div>
            <div className="p-4 bg-ocean-light/10 rounded">
              <p className="text-sm text-ocean-medium">Unique NFTs</p>
              <p className="text-2xl font-semibold">
                {new Set(filteredEvents.filter(e => e.nftId).map(e => e.nftId)).size}
              </p>
            </div>
            <div className="p-4 bg-ocean-light/10 rounded">
              <p className="text-sm text-ocean-medium">Peak Hour</p>
              <p className="text-2xl font-semibold">
                {usagePatterns.peakHours[0] || 0}:00
              </p>
            </div>
            <div className="p-4 bg-ocean-light/10 rounded">
              <p className="text-sm text-ocean-medium">Most Common</p>
              <p className="text-2xl font-semibold">
                {usagePatterns.commonActions[0]?.action || 'N/A'}
              </p>
            </div>
          </div>

          {/* Usage Pattern Chart */}
          <div className="p-4 bg-ocean-light/5 rounded">
            <h3 className="text-sm font-medium mb-2">Activity by Hour</h3>
            <div className="h-20">
              {renderSparkline(usagePatterns.hourOfDay, 300, 60)}
            </div>
          </div>

          {/* Action Breakdown */}
          <div className="p-4 bg-ocean-light/5 rounded">
            <h3 className="text-sm font-medium mb-2">Action Breakdown</h3>
            <div className="space-y-2">
              {usagePatterns.commonActions.slice(0, 5).map(({ action, count }) => (
                <div key={action} className="flex justify-between items-center">
                  <span className="text-sm">{action}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-ocean-light/20 rounded-full h-2">
                      <div 
                        className="bg-ocean-medium h-2 rounded-full"
                        style={{ width: `${(count / filteredEvents.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-ocean-medium">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedMetric === 'performance' && (
        <div className="space-y-4">
          {/* Performance Metrics Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ocean-light/20">
                  <th className="text-left py-2">Operation</th>
                  <th className="text-right py-2">Avg (ms)</th>
                  <th className="text-right py-2">Min (ms)</th>
                  <th className="text-right py-2">Max (ms)</th>
                  <th className="text-right py-2">P95 (ms)</th>
                  <th className="text-right py-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {performanceMetrics.map(metric => (
                  <tr key={metric.operation} className="border-b border-ocean-light/10">
                    <td className="py-2">{metric.operation}</td>
                    <td className="text-right">{metric.avgDuration.toFixed(0)}</td>
                    <td className="text-right">{metric.minDuration.toFixed(0)}</td>
                    <td className="text-right">{metric.maxDuration.toFixed(0)}</td>
                    <td className="text-right">{metric.p95Duration.toFixed(0)}</td>
                    <td className="text-right">{metric.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Loading Time Distribution */}
          <div className="p-4 bg-ocean-light/5 rounded">
            <h3 className="text-sm font-medium mb-2">Loading Time Distribution</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-ocean-medium">Fast (&lt;100ms)</p>
                <p className="text-lg font-semibold">
                  {filteredEvents.filter(e => e.duration && e.duration < 100).length}
                </p>
              </div>
              <div>
                <p className="text-ocean-medium">Normal (100-500ms)</p>
                <p className="text-lg font-semibold">
                  {filteredEvents.filter(e => e.duration && e.duration >= 100 && e.duration < 500).length}
                </p>
              </div>
              <div>
                <p className="text-ocean-medium">Slow (&gt;500ms)</p>
                <p className="text-lg font-semibold">
                  {filteredEvents.filter(e => e.duration && e.duration >= 500).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedMetric === 'errors' && (
        <div className="space-y-4">
          {/* Error Summary */}
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-red-700 dark:text-red-300">Error Rate</p>
                <p className="text-2xl font-semibold text-red-800 dark:text-red-200">
                  {errorMetrics.rate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-red-700 dark:text-red-300">Total Errors</p>
                <p className="text-2xl font-semibold text-red-800 dark:text-red-200">
                  {errorMetrics.count}
                </p>
              </div>
            </div>
          </div>

          {/* Error Types */}
          {errorMetrics.types.length > 0 && (
            <div className="p-4 bg-ocean-light/5 rounded">
              <h3 className="text-sm font-medium mb-2">Error Types</h3>
              <div className="space-y-2">
                {errorMetrics.types.map(({ type, count }) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm">{type}</span>
                    <span className="text-sm text-ocean-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* A/B Test Results */}
      {(abTestMetrics.A.count > 0 || abTestMetrics.B.count > 0) && (
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded">
          <h3 className="text-sm font-medium mb-2">A/B Test Results</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-purple-700 dark:text-purple-300">Variant A</p>
              <p className="text-lg font-semibold">
                {abTestMetrics.A.conversionRate.toFixed(1)}% conversion
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                {abTestMetrics.A.count} events
              </p>
            </div>
            <div>
              <p className="text-sm text-purple-700 dark:text-purple-300">Variant B</p>
              <p className="text-lg font-semibold">
                {abTestMetrics.B.conversionRate.toFixed(1)}% conversion
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                {abTestMetrics.B.count} events
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="text-xs text-ocean-medium dark:text-ocean-light">
        <p>Privacy Notice: Analytics data is stored locally and uses anonymous identifiers.</p>
        <p>User ID: {userId} (anonymized)</p>
      </div>
    </div>
  );
}

// Export analytics tracking hook for use in other components
export function useNFTAnalytics() {
  const [startTime] = useState(Date.now());
  
  const trackEvent = useCallback((
    type: EventType,
    nftId?: string,
    metadata?: Record<string, any>
  ) => {
    const duration = Date.now() - startTime;
    // This would typically send to the analytics component
    // For now, we'll store directly to localStorage
    const event: AnalyticsEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      nftId,
      timestamp: Date.now(),
      duration,
      metadata,
      variant: 'A', // Default variant
      userId: 'anonymous'
    };
    
    try {
      const stored = localStorage.getItem('nft_analytics_events');
      const events = stored ? JSON.parse(stored) : [];
      events.push(event);
      localStorage.setItem('nft_analytics_events', JSON.stringify(events.slice(-1000)));
    } catch (e) {
      console.warn('Failed to track analytics event:', e);
    }
  }, [startTime]);
  
  return { trackEvent };
}