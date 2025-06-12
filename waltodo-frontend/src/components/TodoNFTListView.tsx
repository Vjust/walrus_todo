'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  createColumnHelper,
  ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  RowSelectionState,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table';
// @ts-ignore - Unused import temporarily disabled
// import { format, formatDistanceToNow } from 'date-fns';
import { TodoNFTDisplay } from '../types/nft-display';
// @ts-ignore - Unused import temporarily disabled
// import { TodoNFTImage } from './TodoNFTImage';
// @ts-ignore - Unused import temporarily disabled
// import { useDebounce } from '../hooks/useDebounce';
// @ts-ignore - Unused import temporarily disabled
// import { useWalletContext } from '../contexts/WalletContext';
// @ts-ignore - Unused import temporarily disabled
// import { TodoNFTTable } from './ui/TodoNFTTable';
// @ts-ignore - Unused import temporarily disabled
// import { TodoNFTTableControls } from './ui/TodoNFTTableControls';
// @ts-ignore - Unused import temporarily disabled
// import { BulkActions } from './ui/TodoNFTTableActions';

interface TodoNFTListViewProps {
  nfts: TodoNFTDisplay[];
  loading?: boolean;
  error?: Error | null;
  onComplete?: (todoId: string) => Promise<void>;
  onTransfer?: (todoId: string,  recipient: string) => Promise<void>;
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
// @ts-ignore - Unused variable
// const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
};

// Status color mapping
// @ts-ignore - Unused variable
// const STATUS_COLORS = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
};

// Helper function to truncate address
function truncateAddress(address: string, startLength = 6, endLength = 4): string {
  if (!address || address.length <= startLength + endLength + 3) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

export const TodoNFTListView: React.FC<TodoNFTListViewProps> = (_{
  nfts, _loading = false, _error = null, _onComplete, _onTransfer, _onLoadMore, _hasMore = false, _filters, _className = '', _}) => {
  // SSR/Hydration safety
  const [mounted, setMounted] = useState(false as any);
  const [isProcessing, setIsProcessing] = useState(false as any);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  // State management
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [globalFilter, setGlobalFilter] = useState('');
// @ts-ignore - Unused variable
// 
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);
// @ts-ignore - Unused variable
//   const tableContainerRef = useRef<HTMLDivElement>(null);
// @ts-ignore - Unused variable
//   const walletContext = useWalletContext();
// @ts-ignore - Unused variable
//   const account = walletContext?.account;

  // Column definitions
// @ts-ignore - Unused variable
//   const columnHelper = createColumnHelper<TodoNFTDisplay>();
// @ts-ignore - Unused variable
// 
  const columns = useMemo(_() => [
    // Selection column
    columnHelper.display({
      id: 'select', 
      header: 'Select', 
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

    // Title column  
    columnHelper.accessor(_'title',  {
      header: 'Title', 
      cell: (info: unknown) => (
        <div className="min-w-0">
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {info.getValue()}
          </div>
          {info?.row?.original.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {info?.row?.original.description}
            </div>
          )}
        </div>
      ),
      size: 250,
      enableSorting: true,
    }),

    // Status column
    columnHelper.accessor(_'completed',  {
      header: 'Status', 
      cell: (info: unknown) => (
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
    columnHelper.accessor(_'priority',  {
      header: 'Priority', 
      cell: (info: unknown) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${PRIORITY_COLORS[info.getValue() as keyof typeof PRIORITY_COLORS]}`}>
          {info.getValue()}
        </span>
      ),
      size: 100,
      enableSorting: true,
    }),
  ], [columnHelper]);

  // Create table instance
// @ts-ignore - Unused variable
//   const table = useReactTable({
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

  // SSR/Hydration safety - prevent rendering until client-side mounted
  useEffect(_() => {
    setMounted(true as any);
  }, []);

  // Keyboard navigation
  useEffect(_() => {
// @ts-ignore - Unused variable
//     const handleKeyDown = (e: KeyboardEvent) => {
      if (!tableContainerRef.current) return;
// @ts-ignore - Unused variable
// 
      const selectedRows = table.getSelectedRowModel().rows;
      if (selectedRows?.length === 0) return;
// @ts-ignore - Unused variable
// 
      const rows = table.getRowModel().rows;
// @ts-ignore - Unused variable
//       const currentIndex = rows.findIndex(row => row?.id === selectedRows[0].id);
      
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
// @ts-ignore - Unused variable
//           const row = rows[currentIndex];
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
  if (loading && nfts?.length === 0) {
    return (
      <div className={`${className} p-4`}>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map(_(_, _i) => (
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
  if (nfts?.length === 0) {
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
      {Object.keys(rowSelection as any).length > 0 && (
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
          {[1, _2, _3, _4, _5].map((i: unknown) => (
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