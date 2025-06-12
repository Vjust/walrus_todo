'use client';

import React, { forwardRef } from 'react';
import {
  ColumnDef,
  Table as ReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TodoNFTDisplay } from '../../types/nft-display';
import { TodoNFTTableRow } from './TodoNFTTableRow';
import { TodoNFTTableHeader } from './TodoNFTTableHeader';

interface TodoNFTTableProps {
  table: ReactTable<TodoNFTDisplay>;
  columns: ColumnDef<TodoNFTDisplay>[];
  loading?: boolean;
  className?: string;
  onComplete?: (todoId: string) => Promise<void>;
  onTransfer?: (todoId: string, recipient: string) => Promise<void>;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

export const TodoNFTTable = forwardRef<HTMLDivElement, TodoNFTTableProps>(
  ({ 
    table, 
    columns, 
    loading = false,
    className = '',
    onComplete,
    onTransfer,
    isProcessing,
    setIsProcessing
  }, ref) => {
    const { rows } = table.getRowModel();

    // Virtualization for better performance
    const rowVirtualizer = useVirtualizer({
      count: rows.length,
      getScrollElement: () => ref && typeof ref === 'object' && ref.current || null,
      estimateSize: () => 72,
      overscan: 10,
    });

    return (
      <div 
        ref={ref}
        className={`flex-1 overflow-auto bg-white dark:bg-gray-800 ${className}`}
      >
        <table className="w-full">
          <TodoNFTTableHeader table={table} />
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
            {loading && rows?.length === 0 ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="animate-pulse">
                  {columns.map((_, colIndex) => (
                    <td key={colIndex} className="px-4 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              rowVirtualizer.getVirtualItems().map(virtualRow => {
                const row = rows[virtualRow.index];
                return (
                  <TodoNFTTableRow
                    key={row.id}
                    row={row}
                    columns={columns}
                    virtualRow={virtualRow}
                    onComplete={onComplete}
                    onTransfer={onTransfer}
                    isProcessing={isProcessing}
                    setIsProcessing={setIsProcessing}
                  />
                );
              })
            )}
          </tbody>
        </table>
        
        {/* Empty state when not loading */}
        {!loading && rows?.length === 0 && (
          <div className="flex items-center justify-center h-64">
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
        )}
      </div>
    );
  }
);

TodoNFTTable?.displayName = 'TodoNFTTable';