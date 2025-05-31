/**
 * Example component demonstrating usage of walrus-url-utils
 * Shows how to convert between walrus:// and HTTP URLs
 */

import React, { useState, useCallback } from 'react';
import {
  isValidBlobId,
  walrusToHttpUrl,
  generateHttpUrl,
  generateWalrusUrl,
  extractBlobId,
  isWalrusUrl,
  WalrusUrlError,
  type WalrusNetwork
} from '@/lib/walrus-url-utils';

interface WalrusUrlDisplayProps {
  /** Initial blob ID or URL to display */
  initialValue?: string;
  /** Network to use for URL generation */
  network?: WalrusNetwork;
  /** Whether to show the URL conversion controls */
  showControls?: boolean;
}

/**
 * Component for displaying and converting Walrus URLs
 * Demonstrates the usage of walrus-url-utils functions
 */
export const WalrusUrlDisplay: React.FC<WalrusUrlDisplayProps> = ({
  initialValue = '',
  network = 'testnet',
  showControls = true
}) => {
  const [input, setInput] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    blobId: string;
    walrusUrl: string;
    httpUrl: string;
    walrusSpaceUrl: string;
  } | null>(null);

  const processInput = useCallback(() => {
    setError(null);
    setResult(null);

    try {
      let blobId: string;

      // Check if input is a URL or just a blob ID
      if (input.includes('://') || input.includes('.')) {
        // It's a URL, extract the blob ID
        if (!isWalrusUrl(input)) {
          throw new WalrusUrlError('Invalid Walrus URL format');
        }
        blobId = extractBlobId(input);
      } else {
        // It's a blob ID, validate it
        if (!isValidBlobId(input)) {
          throw new WalrusUrlError('Invalid blob ID format');
        }
        blobId = input;
      }

      // Generate all URL formats
      setResult({
        blobId,
        walrusUrl: generateWalrusUrl(blobId),
        httpUrl: generateHttpUrl(blobId, network),
        walrusSpaceUrl: generateHttpUrl(blobId, network, true)
      });
    } catch (err) {
      if (err instanceof WalrusUrlError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  }, [input, network]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processInput();
  };

  return (
    <div className="walrus-url-display p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Walrus URL Converter</h3>
      
      {showControls && (
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter blob ID or Walrus URL"
              className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Convert
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="p-3 bg-gray-50 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Blob ID:
            </label>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono break-all">
              {result.blobId}
            </code>
          </div>

          <div className="p-3 bg-gray-50 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Walrus Protocol URL:
            </label>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono break-all">
              {result.walrusUrl}
            </code>
          </div>

          <div className="p-3 bg-gray-50 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HTTP URL (wal.app):
            </label>
            <a
              href={result.httpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline break-all"
            >
              {result.httpUrl}
            </a>
          </div>

          <div className="p-3 bg-gray-50 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HTTP URL (walrus.space):
            </label>
            <a
              href={result.walrusSpaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline break-all"
            >
              {result.walrusSpaceUrl}
            </a>
          </div>

          <div className="text-sm text-gray-600 mt-2">
            Network: <span className="font-medium">{network}</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Hook for working with Walrus URLs in components
 * Provides a convenient way to handle URL conversions with error handling
 */
export function useWalrusUrl(network: WalrusNetwork = 'testnet') {
  const [error, setError] = useState<string | null>(null);

  const convertUrl = useCallback((input: string) => {
    setError(null);
    try {
      if (input.startsWith('walrus://')) {
        return walrusToHttpUrl(input, network);
      } else if (isValidBlobId(input)) {
        return generateHttpUrl(input, network);
      } else {
        throw new WalrusUrlError('Invalid input: must be a blob ID or walrus:// URL');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    }
  }, [network]);

  return { convertUrl, error };
}