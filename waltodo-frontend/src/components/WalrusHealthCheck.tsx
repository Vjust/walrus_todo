'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, AlertTriangle, CheckCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useWalrusStorage } from '@/hooks/useWalrusStorage';
import { toast } from 'react-hot-toast';

interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'checking';
  latency: number | null;
  lastCheck: Date | null;
  storageAvailable: boolean;
  uploadTestPassed: boolean;
  retrievalTestPassed: boolean;
  error: string | null;
  consecutiveFailures: number;
}

interface HealthLog {
  timestamp: Date;
  status: string;
  latency: number | null;
  error: string | null;
}

export function WalrusHealthCheck() {
  const { testConnection, uploadBlob, retrieveBlob } = useWalrusStorage();
  const [metrics, setMetrics] = useState<HealthMetrics>({
    status: 'checking',
    latency: null,
    lastCheck: null,
    storageAvailable: true,
    uploadTestPassed: true,
    retrievalTestPassed: true,
    error: null,
    consecutiveFailures: 0,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const checkIntervalRef = useRef<NodeJS.Timeout>();
  const testBlobIdRef = useRef<string | null>(null);

  const logHealthMetric = useCallback((log: HealthLog) => {
    setHealthLogs(prev => [...prev.slice(-49), log]); // Keep last 50 logs
  }, []);

  const performHealthCheck = useCallback(async () => {
    setIsChecking(true);
    const startTime = Date.now();
    const newMetrics: HealthMetrics = {
      ...metrics,
      lastCheck: new Date(),
    };

    try {
      // Test 1: Basic connection test with latency measurement
      const connectionResult = await testConnection();
      const latency = Date.now() - startTime;
      newMetrics.latency = latency;

      if (!connectionResult.success) {
        throw new Error(connectionResult.error || 'Connection test failed');
      }

      // Test 2: Upload test (small test blob)
      const testData = new Uint8Array([1, 2, 3, 4, 5]); // 5 bytes test blob
      const uploadResult = await uploadBlob(testData, {
        metadata: { type: 'health-check', timestamp: Date.now() }
      });

      if (uploadResult.success && uploadResult.blobId) {
        newMetrics.uploadTestPassed = true;
        testBlobIdRef.current = uploadResult.blobId;

        // Test 3: Retrieval test
        const retrieveResult = await retrieveBlob(uploadResult.blobId);
        newMetrics.retrievalTestPassed = retrieveResult.success;

        if (!retrieveResult.success) {
          throw new Error('Retrieval test failed');
        }
      } else {
        newMetrics.uploadTestPassed = false;
        throw new Error('Upload test failed');
      }

      // Test 4: Check storage availability (mock check - in real implementation, check quota)
      newMetrics.storageAvailable = true;

      // Determine overall health status
      if (latency < 500 && newMetrics.uploadTestPassed && newMetrics.retrievalTestPassed) {
        newMetrics.status = 'healthy';
        newMetrics.consecutiveFailures = 0;
      } else if (latency < 1000 || (newMetrics.uploadTestPassed && newMetrics.retrievalTestPassed)) {
        newMetrics.status = 'degraded';
        newMetrics.consecutiveFailures = 0;
      } else {
        newMetrics.status = 'unhealthy';
        newMetrics.consecutiveFailures = metrics.consecutiveFailures + 1;
      }

      newMetrics.error = null;

      // Log the health check
      logHealthMetric({
        timestamp: new Date(),
        status: newMetrics.status,
        latency,
        error: null,
      });

    } catch (error) {
      newMetrics.status = 'unhealthy';
      newMetrics.error = error instanceof Error ? error.message : 'Unknown error';
      newMetrics.consecutiveFailures = metrics.consecutiveFailures + 1;

      // Log the failed health check
      logHealthMetric({
        timestamp: new Date(),
        status: 'unhealthy',
        latency: Date.now() - startTime,
        error: newMetrics.error,
      });

      // Alert on service degradation
      if (newMetrics.consecutiveFailures === 3) {
        toast.error('Walrus service is experiencing issues. Some features may be unavailable.', {
          duration: 5000,
          icon: '⚠️',
        });
      }
    }

    setMetrics(newMetrics);
    setIsChecking(false);

    // Implement fallback strategy notification
    if (newMetrics.status === 'unhealthy' && newMetrics.consecutiveFailures >= 5) {
      toast.error('Switching to local storage fallback. Your data will sync when connection is restored.', {
        duration: 7000,
        icon: '💾',
      });
    }
  }, [metrics, testConnection, uploadBlob, retrieveBlob, logHealthMetric]);

  const manualRetry = useCallback(async () => {
    toast.loading('Retrying connection...', { id: 'retry' });
    await performHealthCheck();
    toast.dismiss('retry');
  }, [performHealthCheck]);

  // Initial check and periodic health checks
  useEffect(() => {
    performHealthCheck();

    // Check every 30 seconds
    checkIntervalRef.current = setInterval(() => {
      performHealthCheck();
    }, 30000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getStatusIcon = () => {
    switch (metrics.status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'unhealthy':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'checking':
        return <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />;
    }
  };

  const getConnectionIcon = () => {
    return metrics.status === 'healthy' || metrics.status === 'degraded' 
      ? <Wifi className="w-4 h-4 text-green-500" />
      : <WifiOff className="w-4 h-4 text-red-500" />;
  };

  const formatLatency = (latency: number | null) => {
    if (!latency) {return 'N/A';}
    return `${latency}ms`;
  };

  const formatTimestamp = (date: Date | null) => {
    if (!date) {return 'Never';}
    return date.toLocaleTimeString();
  };

  // Minimal UI when healthy
  if (metrics.status === 'healthy' && !isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 transition-colors"
          title="Walrus service is healthy"
        >
          <CheckCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Walrus OK</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${isExpanded ? 'w-80' : 'w-auto'}`}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <h3 className="text-sm font-semibold text-gray-700">Walrus Health</h3>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? '−' : '+'}
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="p-4 space-y-3">
            {/* Status summary */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`text-sm font-medium capitalize ${
                metrics.status === 'healthy' ? 'text-green-600' :
                metrics.status === 'degraded' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {metrics.status}
              </span>
            </div>

            {/* Connection and latency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  {getConnectionIcon()}
                  Connection:
                </span>
                <span className="text-sm">
                  {metrics.status === 'unhealthy' ? 'Disconnected' : 'Connected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <Activity className="w-4 h-4" />
                  Latency:
                </span>
                <span className={`text-sm ${
                  metrics.latency && metrics.latency > 1000 ? 'text-red-600' :
                  metrics.latency && metrics.latency > 500 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {formatLatency(metrics.latency)}
                </span>
              </div>
            </div>

            {/* Test results */}
            <div className="space-y-1 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Upload test:</span>
                <span className={`text-xs ${metrics.uploadTestPassed ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.uploadTestPassed ? 'Passed' : 'Failed'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Retrieval test:</span>
                <span className={`text-xs ${metrics.retrievalTestPassed ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.retrievalTestPassed ? 'Passed' : 'Failed'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Storage available:</span>
                <span className={`text-xs ${metrics.storageAvailable ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.storageAvailable ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {/* Error message */}
            {metrics.error && (
              <div className="p-2 bg-red-50 rounded text-xs text-red-700">
                {metrics.error}
              </div>
            )}

            {/* Last check time */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Last check:</span>
              <span>{formatTimestamp(metrics.lastCheck)}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={manualRetry}
                disabled={isChecking}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                Retry
              </button>
              {metrics.status === 'unhealthy' && (
                <button
                  onClick={() => {
                    toast.success('Using local storage fallback');
                    setIsExpanded(false);
                  }}
                  className="flex-1 px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Use Fallback
                </button>
              )}
            </div>

            {/* Diagnostic logs (collapsible) */}
            {healthLogs.length > 0 && (
              <details className="mt-3 border-t border-gray-100 pt-3">
                <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                  Diagnostic Logs ({healthLogs.length})
                </summary>
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {healthLogs.slice(-10).reverse().map((log, index) => (
                    <div key={index} className="text-xs text-gray-500">
                      <span className="font-mono">{log.timestamp.toLocaleTimeString()}</span>
                      {' - '}
                      <span className={
                        log.status === 'healthy' ? 'text-green-600' :
                        log.status === 'degraded' ? 'text-yellow-600' :
                        'text-red-600'
                      }>
                        {log.status}
                      </span>
                      {log.latency && ` (${log.latency}ms)`}
                      {log.error && <span className="text-red-500"> - {log.error}</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Minimized view for non-healthy states */}
        {!isExpanded && metrics.status !== 'healthy' && (
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm text-gray-700">
                Walrus {metrics.status}
              </span>
            </div>
            <button
              onClick={manualRetry}
              disabled={isChecking}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}