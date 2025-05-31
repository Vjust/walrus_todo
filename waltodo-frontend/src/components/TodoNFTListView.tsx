'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  useReactTable,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  ExpandedState,
  RowSelectionState,
  VisibilityState,
} from '@tanstack/react-table';
import { format, formatDistanceToNow } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TodoNFTDisplay } from '../types/nft-display';
import { TodoNFTImage } from './TodoNFTImage';
import { useDebounce } from '../hooks/useDebounce';
import { toast } from 'react-hot-toast';
import { useWalletContext } from '../contexts/WalletContext';
import { useSuiClient } from '../hooks/useSuiClient';
import { Transaction } from '@mysten/sui/transactions';
import { useSignTransaction } from '@mysten/dapp-kit';

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

// Priority color mapping
const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800'
};

// Status color mapping
const STATUS_COLORS = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-gray-100 text-gray-800'
};

// Helper function to truncate address
function truncateAddress(address: string, startLength = 6, endLength = 4): string {
  if (!address || address.length <= startLength + endLength + 3) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

// Row Actions Component
const RowActions: React.FC<{
  todo: TodoNFTDisplay;
  onComplete?: (todoId: string) => Promise<void>;
  onTransfer?: (todoId: string, recipient: string) => Promise<void>;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}> = ({ todo, onComplete, onTransfer, isProcessing, setIsProcessing }) => {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAddress, setTransferAddress] = useState('');

  const handleComplete = async () => {
    if (!onComplete || todo.completed || isProcessing) return;
    
    setIsProcessing(true);
    try {
      await onComplete(todo.id);
      toast.success('Todo marked as completed!');
    } catch (error) {
      console.error('Failed to complete todo:', error);
      toast.error('Failed to complete todo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransfer = async () => {
    if (!onTransfer || !transferAddress || isProcessing) return;
    
    // Validate Sui address format
    if (!transferAddress.startsWith('0x') || transferAddress.length !== 66) {
      toast.error('Invalid Sui address format');
      return;
    }
    
    setIsProcessing(true);
    try {
      await onTransfer(todo.id, transferAddress);
      toast.success('NFT transferred successfully!');
      setShowTransferModal(false);
      setTransferAddress('');
    } catch (error) {
      console.error('Failed to transfer NFT:', error);
      toast.error('Failed to transfer NFT');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewOnExplorer = () => {
    if (!todo.objectId) return;
    const explorerUrl = `https://suiexplorer.com/object/${todo.objectId}?network=testnet`;
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {!todo.completed && onComplete && (
          <button
            onClick={handleComplete}
            disabled={isProcessing}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50"
            title="Complete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
        
        {onTransfer && (
          <button
            onClick={() => setShowTransferModal(true)}
            disabled={isProcessing}
            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-md disabled:opacity-50"
            title="Transfer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" 
              />
            </svg>
          </button>
        )}
        
        {todo.objectId && (
          <button
            onClick={handleViewOnExplorer}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
            title="View on Explorer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
              />
            </svg>
          </button>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div 
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Transfer NFT</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the Sui address to transfer "{todo.title}" to:
            </p>
            <input
              type="text"
              value={transferAddress}
              onChange={(e) => setTransferAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleTransfer}
                disabled={!transferAddress || isProcessing}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Transferring...' : 'Transfer'}
              </button>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferAddress('');
                }}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Expanded Row Content Component
const ExpandedRowContent: React.FC<{ todo: TodoNFTDisplay }> = ({ todo }) => {
  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image Preview */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Image Preview</h4>
          <div className="relative h-64 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            <TodoNFTImage
              url={todo.imageUrl || todo.displayImageUrl || ''}
              alt={todo.title}
              mode="preview"
              className="w-full h-full object-contain"
              expandable={true}
              showSkeleton={true}
              enableHover={true}
              priority={false}
            />
          </div>
        </div>

        {/* Detailed Information */}
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Details</h4>
            <dl className="space-y-2 text-sm">
              {todo.description && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Description:</dt>
                  <dd className="mt-1">{todo.description}</dd>
                </div>
              )}
              
              {todo.tags && todo.tags.length > 0 && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Tags:</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {todo.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </dd>
                </div>
              )}

              {todo.dueDate && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Due Date:</dt>
                  <dd className="mt-1">{format(new Date(todo.dueDate), 'MMM d, yyyy')}</dd>
                </div>
              )}

              {todo.completedAt && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Completed At:</dt>
                  <dd className="mt-1">{format(new Date(todo.completedAt), 'MMM d, yyyy HH:mm')}</dd>
                </div>
              )}

              {todo.walrusBlobId && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Walrus Blob ID:</dt>
                  <dd className="mt-1 font-mono text-xs break-all">{todo.walrusBlobId}</dd>
                </div>
              )}

              {todo.objectId && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Object ID:</dt>
                  <dd className="mt-1 font-mono text-xs break-all">{todo.objectId}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Metadata */}
          {todo.metadata && (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Metadata</h4>
              <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs overflow-x-auto">
                {JSON.stringify(JSON.parse(todo.metadata), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
  // State management
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  const debouncedGlobalFilter = useDebounce(globalFilter, 300);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { account } = useWalletContext();

  // Column definitions
  const columnHelper = createColumnHelper<TodoNFTDisplay>();

  const columns = useMemo(() => [
    // Selection column
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          className="cursor-pointer"
        />
      ),
      size: 40,
    }),

    // Expand column
    columnHelper.display({
      id: 'expand',
      header: () => null,
      cell: ({ row }) => (
        <button
          onClick={row.getToggleExpandedHandler()}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          {row.getIsExpanded() ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      ),
      size: 40,
    }),

    // Image column
    columnHelper.accessor('imageUrl', {
      header: 'Image',
      cell: (info) => {
        const todo = info.row.original;
        return (
          <div className="w-16 h-16 relative">
            <TodoNFTImage
              url={todo.imageUrl || todo.displayImageUrl || ''}
              alt={todo.title}
              mode="thumbnail"
              className="w-full h-full object-cover rounded-md"
              expandable={false}
              showSkeleton={true}
              enableHover={false}
              priority={false}
            />
          </div>
        );
      },
      size: 80,
      enableSorting: false,
    }),

    // Title column
    columnHelper.accessor('title', {
      header: 'Title',
      cell: (info) => (
        <div className="min-w-0">
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {info.getValue()}
          </div>
          {info.row.original.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {info.row.original.description}
            </div>
          )}
        </div>
      ),
      size: 250,
      enableSorting: true,
    }),

    // Status column
    columnHelper.accessor('completed', {
      header: 'Status',
      cell: (info) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          info.getValue() ? STATUS_COLORS.completed : STATUS_COLORS.pending
        }`}>
          {info.getValue() ? 'Completed' : 'Pending'}
        </span>
      ),
      size: 100,
      enableSorting: true,
    }),

    // Priority column
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: (info) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${PRIORITY_COLORS[info.getValue()]}`}>
          {info.getValue()}
        </span>
      ),
      size: 100,
      enableSorting: true,
    }),

    // Owner column
    columnHelper.accessor('owner', {
      header: 'Owner',
      cell: (info) => (
        <div className="font-mono text-xs" title={info.getValue() || account?.address || 'Unknown'}>
          {truncateAddress(info.getValue() || account?.address || 'Unknown')}
        </div>
      ),
      size: 120,
      enableSorting: true,
    }),

    // Date column
    columnHelper.accessor('createdAt', {
      header: 'Created',
      cell: (info) => {
        const date = info.getValue();
        if (!date) return 'N/A';
        try {
          return (
            <div className="text-sm">
              <div>{format(new Date(date), 'MMM d, yyyy')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatDistanceToNow(new Date(date), { addSuffix: true })}
              </div>
            </div>
          );
        } catch {
          return 'Invalid date';
        }
      },
      size: 140,
      enableSorting: true,
    }),

    // Actions column
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <RowActions
          todo={row.original}
          onComplete={onComplete}
          onTransfer={onTransfer}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
        />
      ),
      size: 120,
    }),
  ], [account?.address, onComplete, onTransfer, isProcessing]);

  // Create table instance
  const table = useReactTable({
    data: nfts,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: debouncedGlobalFilter,
      columnVisibility,
      rowSelection,
      expanded,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    enableRowSelection: true,
    enableMultiRowSelection: true,
  });

  // Virtualization for better performance
  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!tableContainerRef.current) return;

      const selectedRows = table.getSelectedRowModel().rows;
      if (selectedRows.length === 0) return;

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
  }, [table, rows]);

  // Bulk actions
  const handleBulkComplete = async () => {
    if (!onComplete) return;
    
    const selectedRows = table.getSelectedRowModel().rows;
    const incompleteTodos = selectedRows.filter(row => !row.original.completed);
    
    if (incompleteTodos.length === 0) {
      toast.error('No incomplete todos selected');
      return;
    }

    setIsProcessing(true);
    try {
      await Promise.all(incompleteTodos.map(row => onComplete(row.original.id)));
      toast.success(`Completed ${incompleteTodos.length} todos`);
      table.resetRowSelection();
    } catch (error) {
      console.error('Failed to complete todos:', error);
      toast.error('Failed to complete some todos');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportSelected = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error('No rows selected for export');
      return;
    }

    const data = selectedRows.map(row => ({
      id: row.original.id,
      title: row.original.title,
      description: row.original.description,
      status: row.original.completed ? 'completed' : 'pending',
      priority: row.original.priority,
      owner: row.original.owner,
      createdAt: row.original.createdAt,
      completedAt: row.original.completedAt,
      tags: row.original.tags,
      objectId: row.original.objectId,
      imageUrl: row.original.imageUrl,
    }));

    if (exportFormat === 'json') {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `todo-nfts-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV export
      const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Owner', 'Created At', 'Completed At', 'Tags', 'Object ID', 'Image URL'];
      const csvRows = [headers.join(',')];
      
      data.forEach(row => {
        const values = [
          row.id,
          `"${row.title.replace(/"/g, '""')}"`,
          `"${(row.description || '').replace(/"/g, '""')}"`,
          row.status,
          row.priority,
          row.owner || '',
          row.createdAt || '',
          row.completedAt || '',
          `"${(row.tags || []).join(', ')}"`,
          row.objectId || '',
          row.imageUrl || '',
        ];
        csvRows.push(values.join(','));
      });

      const csvStr = csvRows.join('\n');
      const blob = new Blob([csvStr], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `todo-nfts-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    toast.success(`Exported ${selectedRows.length} items`);
  };

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
      <div className="flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 space-y-4">
        {/* Search and column visibility */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search all columns..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          
          <div className="relative">
            <button
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Columns
            </button>
            {/* Column visibility dropdown would go here */}
          </div>
        </div>

        {/* Bulk actions */}
        {Object.keys(rowSelection).length > 0 && (
          <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-sm font-medium">
              {Object.keys(rowSelection).length} item(s) selected
            </span>
            <div className="flex items-center gap-2">
              {onComplete && (
                <button
                  onClick={handleBulkComplete}
                  disabled={isProcessing}
                  className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Complete Selected
                </button>
              )}
              <div className="flex items-center gap-2">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                  className="px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
                <button
                  onClick={handleExportSelected}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Export Selected
                </button>
              </div>
              <button
                onClick={() => table.resetRowSelection()}
                className="px-3 py-1 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {table.getFilteredRowModel().rows.length} of {nfts.length} NFTs
        </div>
      </div>

      {/* Table */}
      <div 
        ref={tableContainerRef}
        className="flex-1 overflow-auto bg-white dark:bg-gray-800"
      >
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-2 ${
                          header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-gray-400">
                            {{
                              asc: '↑',
                              desc: '↓',
                            }[header.column.getIsSorted() as string] ?? '↕'}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const row = rows[virtualRow.index];
              return (
                <React.Fragment key={row.id}>
                  <tr
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      row.getIsSelected() ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    } ${row.original.loadingState === 'loading' ? 'opacity-50' : ''}`}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start - virtualRow.index * virtualRow.size}px)`,
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className="px-4 py-4 whitespace-nowrap text-sm"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr>
                      <td colSpan={columns.length} className="p-0">
                        <ExpandedRowContent todo={row.original} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load more indicator */}
      {hasMore && (
        <div className="flex-shrink-0 p-4 text-center border-t dark:border-gray-700">
          <button
            onClick={onLoadMore}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Load more NFTs...
          </button>
        </div>
      )}
    </div>
  );
};