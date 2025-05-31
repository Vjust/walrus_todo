'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardIcon, CheckIcon, ExternalLinkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { CloudArrowUpIcon, CloudIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import type { Todo } from '../types/todo';

interface WalrusStorageIndicatorProps {
  todo: Todo;
  className?: string;
  // Optional props for additional metadata not in the base Todo type
  walrusMetadata?: {
    size?: number;
    storageCost?: number;
    expiryEpoch?: number;
    uploadedAt?: string;
    syncStatus?: 'synced' | 'syncing' | 'error';
  };
}

type SyncStatus = 'synced' | 'syncing' | 'error';

export default function WalrusStorageIndicator({ 
  todo, 
  className = '',
  walrusMetadata 
}: WalrusStorageIndicatorProps) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isNewUpload, setIsNewUpload] = useState(false);
  
  // Determine sync status based on todo properties
  const getSyncStatus = (): SyncStatus => {
    if (!todo.walrusBlobId) return 'error';
    if (walrusMetadata?.syncStatus) return walrusMetadata.syncStatus;
    // Check if todo is stored on Walrus based on storageLocation
    if (todo.storageLocation === 'blockchain' || todo.blockchainStored) return 'synced';
    return 'synced';
  };

  const syncStatus = getSyncStatus();

  // Trigger animation for new uploads
  useEffect(() => {
    const uploadTime = walrusMetadata?.uploadedAt 
      ? new Date(walrusMetadata.uploadedAt).getTime()
      : new Date(todo.updatedAt).getTime();
    
    const now = Date.now();
    // Consider upload "new" if within last 5 seconds
    if (now - uploadTime < 5000) {
      setIsNewUpload(true);
      const timer = setTimeout(() => setIsNewUpload(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [todo.updatedAt, walrusMetadata?.uploadedAt]);

  const copyToClipboard = async () => {
    if (todo.walrusBlobId) {
      try {
        await navigator.clipboard.writeText(todo.walrusBlobId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatExpiryDate = (expiryEpoch?: number): string => {
    if (!expiryEpoch) return 'Unknown';
    const date = new Date(expiryEpoch * 1000);
    const now = new Date();
    const daysRemaining = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining < 0) return 'Expired';
    if (daysRemaining === 0) return 'Expires today';
    if (daysRemaining === 1) return 'Expires tomorrow';
    if (daysRemaining < 30) return `${daysRemaining} days remaining`;
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <CloudArrowUpIcon className="h-4 w-4 text-blue-500 animate-pulse" />
        );
      case 'error':
        return (
          <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
        );
      case 'synced':
      default:
        return (
          <CloudIcon className={`h-4 w-4 ${isNewUpload ? 'text-green-500 animate-bounce' : 'text-green-600'}`} />
        );
    }
  };

  const getStatusText = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync error';
      case 'synced':
      default:
        return 'Stored on Walrus';
    }
  };

  // Don't render if no Walrus blob ID
  if (!todo.walrusBlobId) {
    return null;
  }

  const walrusExplorerUrl = `https://walrus-testnet-explorer.blockvision.org/blob/${todo.walrusBlobId}`;

  // Calculate size from description if not provided
  const estimatedSize = walrusMetadata?.size || new Blob([JSON.stringify({
    title: todo.title,
    description: todo.description || '',
    tags: todo.tags,
    priority: todo.priority,
    dueDate: todo.dueDate
  })]).size;

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {/* Main indicator */}
      <div 
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full text-xs
          bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
          transition-all duration-300
          ${isNewUpload ? 'ring-2 ring-green-400 ring-opacity-50' : ''}
        `}
      >
        {/* Status Icon */}
        {getStatusIcon()}
        
        {/* Status Text */}
        <span className="text-gray-700 dark:text-gray-300 font-medium">
          {getStatusText()}
        </span>

        {/* Info Icon with Tooltip Trigger */}
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <InformationCircleIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Copy Blob ID Button */}
        <button
          onClick={copyToClipboard}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Copy blob ID"
        >
          {copied ? (
            <CheckIcon className="h-4 w-4 text-green-600" />
          ) : (
            <ClipboardIcon className="h-4 w-4" />
          )}
        </button>

        {/* External Link */}
        <a
          href={walrusExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="View on Walrus Explorer"
        >
          <ExternalLinkIcon className="h-4 w-4" />
        </a>
      </div>

      {/* Detailed Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 z-50 animate-fadeIn">
          <div className="bg-gray-900 text-white p-4 rounded-lg shadow-xl max-w-sm">
            <div className="space-y-2 text-xs">
              {/* Walrus Explanation */}
              <div className="pb-2 border-b border-gray-700">
                <p className="font-semibold mb-1">Walrus Decentralized Storage</p>
                <p className="text-gray-300">
                  Your todo is securely stored on the Walrus network, a decentralized storage system 
                  that ensures data availability and redundancy across multiple nodes.
                </p>
              </div>

              {/* Storage Details */}
              <div className="space-y-1">
                {/* Blob ID */}
                <div className="flex justify-between">
                  <span className="text-gray-400">Blob ID:</span>
                  <span className="font-mono text-xs truncate max-w-[150px]" title={todo.walrusBlobId}>
                    {todo.walrusBlobId}
                  </span>
                </div>

                {/* Storage Size */}
                <div className="flex justify-between">
                  <span className="text-gray-400">Size:</span>
                  <span>{formatBytes(estimatedSize)}</span>
                </div>

                {/* Storage Cost */}
                {walrusMetadata?.storageCost && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cost:</span>
                    <span>{walrusMetadata.storageCost} WAL</span>
                  </div>
                )}

                {/* Expiry Date */}
                {walrusMetadata?.expiryEpoch && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expires:</span>
                    <span className={`
                      ${walrusMetadata.expiryEpoch * 1000 < Date.now() ? 'text-red-400' : ''}
                    `}>
                      {formatExpiryDate(walrusMetadata.expiryEpoch)}
                    </span>
                  </div>
                )}

                {/* Upload Time */}
                <div className="flex justify-between">
                  <span className="text-gray-400">Uploaded:</span>
                  <span>
                    {new Date(walrusMetadata?.uploadedAt || todo.updatedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                {/* Storage Location */}
                {todo.storageLocation && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Location:</span>
                    <span className="capitalize">{todo.storageLocation}</span>
                  </div>
                )}

                {/* NFT Object ID if available */}
                {todo.nftObjectId && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">NFT ID:</span>
                    <span className="font-mono text-xs truncate max-w-[150px]" title={todo.nftObjectId}>
                      {todo.nftObjectId.slice(0, 8)}...
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tooltip Arrow */}
            <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add CSS for animation only once when component mounts
if (typeof document !== 'undefined' && !document.getElementById('walrus-indicator-styles')) {
  const style = document.createElement('style');
  style.id = 'walrus-indicator-styles';
  style.textContent = `
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out;
    }
  `;
  document.head.appendChild(style);
}