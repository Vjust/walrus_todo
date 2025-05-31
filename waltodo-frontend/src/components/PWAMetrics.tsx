'use client';

import React, { useState, useEffect } from 'react';
import { pwaManager } from '@/lib/pwa-manager';
import { BarChart3, Download, Bell, Wifi, WifiOff, Database } from 'lucide-react';

export function PWAMetrics() {
  const [metrics, setMetrics] = useState(pwaManager.getMetrics());
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Update metrics every 5 seconds
    const interval = setInterval(() => {
      setMetrics(pwaManager.getMetrics());
    }, 5000);

    // Monitor online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const cacheHitRate = metrics.cacheHits + metrics.cacheMisses > 0
    ? ((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(1)
    : '0';

  return (
    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-sky-500" />
          PWA Metrics
        </h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
          isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Install Metrics */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Download className="w-4 h-4" />
            <span className="text-sm">Install</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Prompts Shown</span>
              <span className="text-sm font-medium text-slate-300">{metrics.installPromptShown}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Accepted</span>
              <span className="text-sm font-medium text-emerald-400">{metrics.installAccepted}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Dismissed</span>
              <span className="text-sm font-medium text-slate-400">{metrics.installDismissed}</span>
            </div>
          </div>
        </div>

        {/* Notification Status */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Bell className="w-4 h-4" />
            <span className="text-sm">Notifications</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Permission</span>
            <span className={`text-sm font-medium px-2 py-1 rounded-full ${
              metrics.notificationPermission === 'granted' 
                ? 'bg-emerald-500/20 text-emerald-400'
                : metrics.notificationPermission === 'denied'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {metrics.notificationPermission}
            </span>
          </div>
        </div>

        {/* Offline Usage */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm">Offline</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Sessions</span>
            <span className="text-sm font-medium text-slate-300">{metrics.offlineUsage}</span>
          </div>
        </div>

        {/* Cache Performance */}
        <div className="bg-slate-800/50 rounded-lg p-4 col-span-2 sm:col-span-3">
          <div className="flex items-center gap-2 text-slate-400 mb-3">
            <Database className="w-4 h-4" />
            <span className="text-sm">Cache Performance</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-slate-500">Hits</span>
              <p className="text-lg font-medium text-emerald-400">{metrics.cacheHits}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Misses</span>
              <p className="text-lg font-medium text-red-400">{metrics.cacheMisses}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Hit Rate</span>
              <p className="text-lg font-medium text-slate-300">{cacheHitRate}%</p>
            </div>
          </div>
          
          {/* Cache hit rate bar */}
          <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${cacheHitRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => pwaManager.clearNFTCache()}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Clear NFT Cache
        </button>
        <button
          onClick={() => pwaManager.requestNotificationPermission()}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
          disabled={metrics.notificationPermission === 'granted'}
        >
          Enable Notifications
        </button>
        <button
          onClick={() => {
            pwaManager.registerSync('sync-todos');
            pwaManager.registerSync('sync-nfts');
          }}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Force Sync
        </button>
      </div>
    </div>
  );
}