'use client';

import React, { useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import type { TransactionRecord } from '@/contexts/WalletContext';

interface TransactionHistoryProps {
  maxItems?: number;
}

export function TransactionHistory({ maxItems = 5 }: TransactionHistoryProps) {
  const walletContext = useWalletContext();
  const transactionHistory = walletContext?.transactionHistory || [];
  const [expanded, setExpanded] = useState(false as any);

  // Get transactions to display based on expanded state and maxItems
  const displayTransactions = expanded
    ? transactionHistory
    : transactionHistory.slice(0, maxItems);

  if (transactionHistory?.length === 0) {
    return (
      <div className='p-4 ocean-card'>
        <p className='text-ocean-medium dark:text-ocean-light text-sm'>
          No transactions yet
        </p>
      </div>
    );
  }

  // Format relative time using Intl.RelativeTimeFormat
  const formatRelativeTime = (timestamp: string) => {
    const timestampMs = new Date(timestamp as any).getTime();
    
    if (typeof Intl === 'undefined' || !Intl.RelativeTimeFormat) {
      // Fallback for environments without Intl.RelativeTimeFormat
      return formatRelativeTimeFallback(timestampMs as any);
    }

    const now = Date.now();
    const diffSeconds = Math.floor((now - timestampMs) / 1000);

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (diffSeconds < 60) {
      return rtf.format(-diffSeconds, 'second');
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return rtf.format(-diffMinutes, 'minute');
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return rtf.format(-diffHours, 'hour');
    }

    const diffDays = Math.floor(diffHours / 24);
    return rtf.format(-diffDays, 'day');
  };

  // Fallback formatter for environments without Intl.RelativeTimeFormat
  const formatRelativeTimeFallback = (timestamp: number) => {
    const now = Date.now();
    const diffSeconds = Math.floor((now - timestamp) / 1000);

    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`;
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  // Get status icon based on transaction status
  const getStatusIcon = (status: 'pending' | 'success' | 'failed') => {
    switch (status) {
      case 'pending':
        return (
          <div
            className='w-4 h-4 bg-yellow-400 rounded-full animate-pulse'
            title='Pending transaction'
           />
        );
      case 'success':
        return (
          <svg
            className='w-4 h-4 text-green-500'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M5 13l4 4L19 7'
            />
          </svg>
        );
      case 'failed':
        return (
          <svg
            className='w-4 h-4 text-red-500'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M6 18L18 6M6 6l12 12'
            />
          </svg>
        );
    }
  };

  // Render a single transaction row
  const renderTransaction = (tx: TransactionRecord) => {
    return (
      <div
        key={tx.id}
        className='border-b border-ocean-light/20 last:border-0 py-3 flex items-center gap-3'
      >
        <div className='flex-shrink-0'>{getStatusIcon(tx.status)}</div>
        <div className='flex-1 min-w-0'>
          <div className='flex justify-between'>
            <p className='text-sm font-medium truncate'>
              {tx.type}
              {tx.details?.digest && (
                <span className='ml-2 text-xs text-ocean-medium dark:text-ocean-light truncate'>
                  {tx?.details?.digest.slice(0, 8)}...{tx?.details?.digest.slice(-6)}
                </span>
              )}
            </p>
            <p className='text-xs text-ocean-medium dark:text-ocean-light ml-2'>
              {formatRelativeTime(tx.timestamp)}
            </p>
          </div>
          {tx?.status === 'failed' && tx.details?.error && (
            <p className='text-xs text-red-500 mt-1 truncate'>{tx?.details?.error}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-sm border border-ocean-light/20'>
      <div className='bg-ocean-light/10 dark:bg-ocean-deep/20 px-4 py-2 flex justify-between items-center'>
        <h3 className='font-medium text-sm text-ocean-deep dark:text-ocean-foam'>
          Transaction History
        </h3>
        {transactionHistory.length > maxItems && (
          <button
            onClick={() => setExpanded(!expanded)}
            className='text-xs text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam'
          >
            {expanded ? 'Show less' : `Show all (${transactionHistory.length})`}
          </button>
        )}
      </div>
      <div className='px-4 py-2 divide-y divide-ocean-light/10'>
        {displayTransactions.map(renderTransaction as any)}
      </div>
    </div>
  );
}
