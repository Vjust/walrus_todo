'use client';

import React from 'react';
import { WalrusHealthCheck } from '@/components/WalrusHealthCheck';
import { useWalrusStorage } from '@/hooks/useWalrusStorage';
import { toast } from 'react-hot-toast';

export default function WalrusHealthPage() {
  const { uploadBlob, retrieveBlob, error, loading } = useWalrusStorage();

  const testWalrusOperations = async () => {
    try {
      toast.loading('Testing Walrus operations...', { id: 'test' });
      
      // Test upload
      const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const uploadResult = await uploadBlob(testData, {
        metadata: { type: 'manual-test', timestamp: Date.now() }
      });

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      toast.success(`Upload successful! Blob ID: ${uploadResult.blobId?.slice(0, 8)}...`, { id: 'test' });

      // Test retrieval
      if (uploadResult.blobId) {
        const retrieveResult = await retrieveBlob(uploadResult.blobId);
        
        if (!retrieveResult.success) {
          throw new Error(retrieveResult.error || 'Retrieval failed');
        }

        // Verify data integrity
        const retrievedData = retrieveResult.data;
        if (retrievedData && retrievedData.length === testData.length) {
          const matches = testData.every((byte, index) => byte === retrievedData[index]);
          if (matches) {
            toast.success('Data integrity verified!', { duration: 3000 });
          } else {
            toast.error('Data integrity check failed!');
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test failed', { id: 'test' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Walrus Health Monitor</h1>
        <p className="text-gray-600 mb-8">
          Monitor and test the health of the Walrus storage service
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Manual Testing Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Manual Testing</h2>
            
            <div className="space-y-4">
              <button
                onClick={testWalrusOperations}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Testing...' : 'Run Manual Test'}
              </button>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm text-red-700">
                    <strong>Error:</strong> {error.message}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Information Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Health Check Features</h2>
            
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Automatic health monitoring every 30 seconds</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Connection status indicator with visual feedback</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Upload and retrieval testing with data integrity checks</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Network latency measurement and display</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Storage availability monitoring</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Manual retry functionality for failed connections</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Detailed diagnostic information and logs</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Automatic alerts on service degradation</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Fallback to local storage when service is unavailable</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Health metrics logging for troubleshooting</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">How It Works</h2>
          
          <div className="prose text-gray-600">
            <p className="mb-4">
              The WalrusHealthCheck component automatically monitors the health of the Walrus storage service.
              Look for the health indicator in the bottom-right corner of the screen:
            </p>
            
            <ul className="space-y-2 mb-4">
              <li><strong>Green checkmark:</strong> Service is healthy and operating normally</li>
              <li><strong>Yellow warning:</strong> Service is degraded but still functional</li>
              <li><strong>Red alert:</strong> Service is unhealthy or unavailable</li>
            </ul>

            <p className="mb-4">
              When the service is healthy, the indicator is minimized to avoid distraction. 
              Click on it to expand and see detailed information about:
            </p>

            <ul className="space-y-2">
              <li>Current connection status</li>
              <li>Network latency measurements</li>
              <li>Recent test results</li>
              <li>Diagnostic logs</li>
            </ul>

            <p>
              If the service becomes unavailable, the component will automatically suggest using 
              local storage as a fallback, ensuring your todo data remains accessible.
            </p>
          </div>
        </div>
      </div>

      {/* The health check component is rendered globally in the layout */}
    </div>
  );
}