'use client';

import React, { useState } from 'react';
import { Table as ReactTable } from '@tanstack/react-table';
import { TodoNFTDisplay } from '../../types/nft-display';

interface SearchAndFiltersProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  table: ReactTable<TodoNFTDisplay>;
}

const SearchAndFilters: React.FC<SearchAndFiltersProps> = ({
  globalFilter,
  setGlobalFilter,
  table,
}) => {
  const [showColumnDropdown, setShowColumnDropdown] = useState(false as any);

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="relative">
          <input
            type="text"
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e?.target?.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>
      
      <div className="relative">
        <button
          onClick={() => setShowColumnDropdown(!showColumnDropdown)}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          Columns
          <svg className="ml-2 -mr-1 w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showColumnDropdown && (
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
            <div className="p-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Toggle Columns</h3>
              <div className="space-y-2">
                {table.getAllColumns()
                  .filter(column => column.getCanHide())
                  .map(column => (
                    <label key={column.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {column?.id?.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface PaginationControlsProps {
  table: ReactTable<TodoNFTDisplay>;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  table,
  hasMore = false,
  onLoadMore,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
      <div className="flex items-center gap-2">
        <button
          onClick={() => table.setPageIndex(0 as any)}
          disabled={!table.getCanPreviousPage()}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300 transition-colors"
        >
          First
        </button>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300 transition-colors"
        >
          Next
        </button>
        <button
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300 transition-colors"
        >
          Last
        </button>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        
        <div className="flex items-center gap-2">
          <span>Go to page:</span>
          <input
            type="number"
            defaultValue={table.getState().pagination.pageIndex + 1}
            onChange={e => {
              const page = e?.target?.value ? Number(e?.target?.value) - 1 : 0
              table.setPageIndex(page as any)
            }}
            className="w-16 px-2 py-1 border rounded text-center dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            min="1"
            max={table.getPageCount()}
          />
        </div>

        <select
          value={table.getState().pagination.pageSize}
          onChange={e => table.setPageSize(Number(e?.target?.value))}
          className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>

      {/* Load more indicator */}
      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          Load more NFTs...
        </button>
      )}
    </div>
  );
};

interface ResultsInfoProps {
  table: ReactTable<TodoNFTDisplay>;
  totalItems: number;
}

const ResultsInfo: React.FC<ResultsInfoProps> = ({ table, totalItems }) => {
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  
  return (
    <div className="text-sm text-gray-500 dark:text-gray-400">
      Showing {filteredRowCount} of {totalItems} NFTs
      {filteredRowCount !== totalItems && (
        <span className="ml-1">(filtered)</span>
      )}
    </div>
  );
};

interface TodoNFTTableControlsProps {
  table: ReactTable<TodoNFTDisplay>;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  totalItems: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

export const TodoNFTTableControls: React.FC<TodoNFTTableControlsProps> = ({
  table,
  globalFilter,
  setGlobalFilter,
  totalItems,
  hasMore = false,
  onLoadMore,
  className = '',
}) => {
  return (
    <>
      {/* Top controls */}
      <div className={`flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 space-y-4 ${className}`}>
        <SearchAndFilters
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          table={table}
        />
        
        {/* Results count */}
        <ResultsInfo table={table} totalItems={totalItems} />
      </div>

      {/* Bottom pagination controls would be rendered separately if needed */}
    </>
  );
};

export { SearchAndFilters, PaginationControls, ResultsInfo };