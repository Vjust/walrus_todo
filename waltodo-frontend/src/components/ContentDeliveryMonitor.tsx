'use client';

import { useEffect, useState } from 'react';
import { useWalrusStorage } from '@/hooks/useWalrusStorage';

interface DeliveryMetrics {
  latency: number;
  successRate: number;
  errorCount: number;
  totalRequests: number;
}

export default function ContentDeliveryMonitor() {
  const [metrics, setMetrics] = useState<DeliveryMetrics>({
    latency: 0,
    successRate: 100,
    errorCount: 0,
    totalRequests: 0
  });
  const [isVisible, setIsVisible] = useState(false);
  const { loading, error } = useWalrusStorage();
  const isConnected = !loading && !error;

  useEffect(() => {
    // Only show monitor in development or when specifically enabled
    const shouldShow = process.env.NODE_ENV === 'development' || 
                      process.env.NEXT_PUBLIC_SHOW_CDN_MONITOR === 'true';
    setIsVisible(shouldShow && isConnected);
  }, [isConnected]);

  useEffect(() => {
    if (!isVisible) {return;}

    const monitorInterval = setInterval(() => {
      // Mock monitoring - replace with actual CDN monitoring logic
      setMetrics(prev => ({
        ...prev,
        latency: Math.floor(Math.random() * 100) + 50,
        totalRequests: prev.totalRequests + 1,
        successRate: Math.max(95, 100 - Math.floor(Math.random() * 5))
      }));
    }, 5000);

    return () => clearInterval(monitorInterval);
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-3 text-xs border z-50">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="font-semibold">CDN Status</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-gray-600">
        <div>Latency: {metrics.latency}ms</div>
        <div>Success: {metrics.successRate}%</div>
        <div>Errors: {metrics.errorCount}</div>
        <div>Requests: {metrics.totalRequests}</div>
      </div>
    </div>
  );
}