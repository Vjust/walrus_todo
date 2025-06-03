'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TodoNFTDisplay } from '../types/nft-display';
import { useNFTTableState } from '../hooks/useNFTTableState';
import { TodoNFTTable } from './ui/TodoNFTTable';
import { TodoNFTTableControls } from './ui/TodoNFTTableControls';
import { BulkActions } from './ui/TodoNFTTableActions';

interface TodoNFTListViewProps {
  nfts: TodoNFTDisplay[];
  loading?: boolean;
  error?: Error | null;
  onComplete?: (todoId: string) => Promise<void>;
  onTransfer?: (todoId: string, recipient: string) => Promise<void>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  filters?: {
    searchQuery: string;
    sortOption: 'date' | 'title' | 'priority';
    filterOption: 'all' | 'completed' | 'active';
    priorityFilter: string[];
    dateRange: { start: Date | null; end: Date | null };
  };
  className?: string;
}

export const TodoNFTListView: React.FC<TodoNFTListViewProps> = ({
  nfts,
  loading = false,
  error = null,
  onComplete,
  onTransfer,
  onLoadMore,
  hasMore = false,
  filters,
  className = '',
}) => {
  // SSR/Hydration safety
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Use the table state hook for managing table functionality
  const { 
    table, 
    columns, 
    globalFilter, 
    setGlobalFilter,
    rowSelection,
  } = useNFTTableState({
    nfts,
    onComplete,
    onTransfer,
    isProcessing,
    setIsProcessing,
  });

  // SSR/Hydration safety - prevent rendering until client-side mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!tableContainerRef.current) return;

      const selectedRows = table.getSelectedRowModel().rows;
      if (selectedRows.length === 0) return;

      const rows = table.getRowModel().rows;
      const currentIndex = rows.findIndex(row => row.id === selectedRows[0].id);
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            table.setRowSelection({ [rows[currentIndex - 1].id]: true });
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < rows.length - 1) {
            table.setRowSelection({ [rows[currentIndex + 1].id]: true });
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          const row = rows[currentIndex];
          row.toggleExpanded();
          break;
        case 'Escape':
          e.preventDefault();
          table.resetRowSelection();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [table]);

  // Early returns after all hooks are called
  if (!mounted) {
    return <TodoNFTListSkeleton />;
  }

  // Loading state
  if (loading && nfts.length === 0) {
    return (
      <div className={`${className} p-4`}>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`${className} flex items-center justify-center h-64`}>
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading NFTs</p>
          <p className="text-sm text-gray-500">{error.message}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (nfts.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center h-64`}>
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No NFTs found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating your first Todo NFT
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-col h-full`}>
      {/* Controls */}
      <TodoNFTTableControls
        table={table}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        totalItems={nfts.length}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
      />

      {/* Bulk Actions */}
      {Object.keys(rowSelection).length > 0 && (
        <div className="flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
          <BulkActions
            table={table}
            onComplete={onComplete}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
            exportFormat={exportFormat}
            setExportFormat={setExportFormat}
          />
        </div>
      )}

      {/* Table */}
      <TodoNFTTable
        ref={tableContainerRef}
        table={table}
        columns={columns}
        loading={loading}
        onComplete={onComplete}
        onTransfer={onTransfer}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
      />

      {/* Load more indicator */}
      {hasMore && (
        <div className="flex-shrink-0 p-4 text-center border-t dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={onLoadMore}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            Load more NFTs...
          </button>
        </div>
      )}
    </div>
  );
};

// Skeleton component for loading state during hydration
function TodoNFTListSkeleton() {
  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24" />
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex space-x-3 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};