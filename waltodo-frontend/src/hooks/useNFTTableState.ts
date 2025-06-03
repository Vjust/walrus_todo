'use client';

import { useState, useMemo } from 'react';
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
import { TodoNFTDisplay } from '../types/nft-display';
import { useDebounce } from './useDebounce';


interface UseNFTTableStateProps {
  nfts: TodoNFTDisplay[];
}

export const useNFTTableState = ({ nfts }: UseNFTTableStateProps) => {
  // State management
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const debouncedGlobalFilter = useDebounce(globalFilter, 300);

  // Column definitions - will be handled externally
  const columnHelper = createColumnHelper<TodoNFTDisplay>();

  // Basic column schema
  const columnIds = [
    'select',
    'expand', 
    'imageUrl',
    'title',
    'completed',
    'priority',
    'owner',
    'createdAt',
    'actions'
  ];

  // Table factory function to be used with columns defined elsewhere
  const createTable = (columns: ColumnDef<TodoNFTDisplay>[]) => {
    return useReactTable({
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
  };

  return {
    // State values
    globalFilter,
    setGlobalFilter,
    rowSelection,
    setRowSelection,
    expanded,
    setExpanded,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    columnVisibility,
    setColumnVisibility,
    debouncedGlobalFilter,
    
    // Utilities
    columnHelper,
    columnIds,
    createTable,
  };
};