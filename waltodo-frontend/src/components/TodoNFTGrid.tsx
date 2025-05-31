'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FixedSizeGrid as Grid, FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useDebounce } from '../hooks/useDebounce';
import { TodoNFTCard } from './TodoNFTCard';
import { Todo } from '../types/todo-nft';
import { TodoNFTDisplay, todoToNFTDisplay } from '../types/nft-display';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useSuiClient } from '../hooks/useSuiClient';

interface TodoNFTGridProps {
  className?: string;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'date' | 'title' | 'priority';
type FilterOption = 'all' | 'completed' | 'active';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

const ITEMS_PER_PAGE = 50;
const GRID_GAP = 16;
const CARD_WIDTH = 320;
const CARD_HEIGHT = 400;
const LIST_ITEM_HEIGHT = 120;

export const TodoNFTGrid: React.FC<TodoNFTGridProps> = ({ className = '' }) => {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const address = currentAccount?.address;

  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('date');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string[]>(['high', 'medium', 'low']);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch NFTs with infinite scroll
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['todoNFTs', address, debouncedSearch, sortOption, filterOption, priorityFilter, dateRange],
    queryFn: async ({ pageParam = null }) => {
      if (!address || !suiClient) {
        return { nfts: [], nextCursor: null };
      }

      try {
        // Fetch owned objects
        const { data: ownedObjects, nextCursor } = await suiClient.getOwnedObjects({
          owner: address,
          filter: {
            StructType: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::todo_nft::TodoNFT`,
          },
          options: {
            showContent: true,
            showType: true,
            showOwner: true,
            showDisplay: true,
          },
          cursor: pageParam,
          limit: ITEMS_PER_PAGE,
        });

        // Transform to TodoNFTDisplay format
        const nfts: TodoNFTDisplay[] = ownedObjects
          .filter(obj => obj.data?.content?.dataType === 'moveObject')
          .map(obj => {
            const fields = obj.data?.content?.fields as any;
            const todo: Todo = {
              id: obj.data?.objectId || '',
              title: fields?.title || '',
              description: fields?.description || '',
              completed: fields?.completed || false,
              priority: (fields?.priority || 'medium') as 'low' | 'medium' | 'high',
              createdAt: new Date(fields?.created_at || Date.now()).toISOString(),
              imageUrl: fields?.image_url || '',
              owner: fields?.owner || (typeof obj.data?.owner === 'string' ? obj.data.owner : obj.data?.owner?.AddressOwner) || '',
              blockchainStored: true,
              objectId: obj.data?.objectId,
              metadata: fields?.metadata,
              isPrivate: fields?.is_private || false,
            };
            return todoToNFTDisplay(todo);
          });

        return { nfts, nextCursor };
      } catch (err) {
        console.error('Error fetching NFTs:', err);
        throw err;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!address && !!suiClient,
  });

  // Flatten pages of data
  const allNFTs = useMemo(() => {
    return data?.pages.flatMap(page => page.nfts) || [];
  }, [data]);

  // Filter and sort NFTs
  const filteredAndSortedNFTs = useMemo(() => {
    let filtered = [...allNFTs];

    // Apply search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(nft => 
        nft.title.toLowerCase().includes(searchLower) ||
        nft.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply completion filter
    if (filterOption === 'completed') {
      filtered = filtered.filter(nft => nft.completed);
    } else if (filterOption === 'active') {
      filtered = filtered.filter(nft => !nft.completed);
    }

    // Apply priority filter
    filtered = filtered.filter(nft => priorityFilter.includes(nft.priority));

    // Apply date range filter
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(nft => {
        const nftDate = new Date(nft.createdAt);
        if (dateRange.start && nftDate < dateRange.start) return false;
        if (dateRange.end && nftDate > dateRange.end) return false;
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'date':
          return b.createdAt - a.createdAt;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        default:
          return 0;
      }
    });

    return filtered;
  }, [allNFTs, debouncedSearch, filterOption, priorityFilter, dateRange, sortOption]);

  // Load more items
  const loadMoreItems = useCallback(
    (startIndex: number, stopIndex: number) => {
      if (hasNextPage && !isFetchingNextPage) {
        return fetchNextPage();
      }
      return Promise.resolve();
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  // Check if item is loaded
  const isItemLoaded = useCallback(
    (index: number) => {
      return index < filteredAndSortedNFTs.length;
    },
    [filteredAndSortedNFTs.length]
  );

  // Grid cell renderer
  const GridCell = useCallback(
    ({ columnIndex, rowIndex, style }: any) => {
      const itemsPerRow = Math.floor((style.width - GRID_GAP) / (CARD_WIDTH + GRID_GAP));
      const index = rowIndex * itemsPerRow + columnIndex;

      if (index >= filteredAndSortedNFTs.length) {
        return null;
      }

      const nft = filteredAndSortedNFTs[index];
      if (!nft) return null;

      return (
        <div
          style={{
            ...style,
            left: style.left + GRID_GAP,
            top: style.top + GRID_GAP,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
          }}
        >
          <TodoNFTCard todo={nft} />
        </div>
      );
    },
    [filteredAndSortedNFTs]
  );

  // List item renderer
  const ListItem = useCallback(
    ({ index, style }: any) => {
      if (!isItemLoaded(index)) {
        return (
          <div style={style} className="flex items-center justify-center">
            <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg w-full h-24" />
          </div>
        );
      }

      const nft = filteredAndSortedNFTs[index];
      if (!nft) return null;

      return (
        <div style={style} className="px-4">
          <TodoNFTCard todo={nft} variant="list" />
        </div>
      );
    },
    [filteredAndSortedNFTs, isItemLoaded]
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`${className} p-4`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-96" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className={`${className} flex items-center justify-center h-64`}>
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading NFTs</p>
          <p className="text-sm text-gray-500">{(error as Error)?.message}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (filteredAndSortedNFTs.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center h-64`}>
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No NFTs found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchQuery ? 'Try adjusting your search or filters' : 'Get started by creating your first Todo NFT'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-col h-full`}>
      {/* Controls */}
      <div className="flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="space-y-4">
          {/* Search and View Toggle */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search NFTs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                aria-label="Grid view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                aria-label="List view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Sort */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Sort by:</label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="px-3 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="date">Date</option>
                <option value="title">Title</option>
                <option value="priority">Priority</option>
              </select>
            </div>

            {/* Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Show:</label>
              <select
                value={filterOption}
                onChange={(e) => setFilterOption(e.target.value as FilterOption)}
                className="px-3 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority:</label>
              {['high', 'medium', 'low'].map((priority) => (
                <label key={priority} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={priorityFilter.includes(priority)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPriorityFilter([...priorityFilter, priority]);
                      } else {
                        setPriorityFilter(priorityFilter.filter(p => p !== priority));
                      }
                    }}
                    className="mr-1"
                  />
                  <span className="text-sm capitalize">{priority}</span>
                </label>
              ))}
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date:</label>
              <input
                type="date"
                value={dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value ? new Date(e.target.value) : null })}
                className="px-2 py-1 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-sm">to</span>
              <input
                type="date"
                value={dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value ? new Date(e.target.value) : null })}
                className="px-2 py-1 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredAndSortedNFTs.length} of {allNFTs.length} NFTs
          </div>
        </div>
      </div>

      {/* Virtualized Grid/List */}
      <div className="flex-1 overflow-hidden">
        <AutoSizer>
          {({ height, width }) => (
            <InfiniteLoader
              isItemLoaded={isItemLoaded}
              itemCount={filteredAndSortedNFTs.length + (hasNextPage ? 1 : 0)}
              loadMoreItems={loadMoreItems}
            >
              {({ onItemsRendered, ref }) => {
                if (viewMode === 'grid') {
                  const columnCount = Math.floor((width - GRID_GAP) / (CARD_WIDTH + GRID_GAP));
                  const rowCount = Math.ceil(filteredAndSortedNFTs.length / columnCount);

                  return (
                    <Grid
                      ref={ref}
                      columnCount={columnCount}
                      columnWidth={CARD_WIDTH + GRID_GAP}
                      height={height}
                      rowCount={rowCount}
                      rowHeight={CARD_HEIGHT + GRID_GAP}
                      width={width}
                      onItemsRendered={({
                        visibleRowStartIndex,
                        visibleRowStopIndex,
                        visibleColumnStartIndex,
                        visibleColumnStopIndex,
                      }) => {
                        const visibleStartIndex = visibleRowStartIndex * columnCount + visibleColumnStartIndex;
                        const visibleStopIndex = visibleRowStopIndex * columnCount + visibleColumnStopIndex;
                        onItemsRendered({
                          visibleStartIndex,
                          visibleStopIndex,
                        });
                      }}
                    >
                      {GridCell}
                    </Grid>
                  );
                } else {
                  return (
                    <List
                      ref={ref}
                      height={height}
                      itemCount={filteredAndSortedNFTs.length}
                      itemSize={LIST_ITEM_HEIGHT}
                      width={width}
                      onItemsRendered={onItemsRendered}
                    >
                      {ListItem}
                    </List>
                  );
                }
              }}
            </InfiniteLoader>
          )}
        </AutoSizer>
      </div>

      {/* Loading indicator for pagination */}
      {isFetchingNextPage && (
        <div className="flex-shrink-0 p-4 text-center border-t dark:border-gray-700">
          <span className="text-sm text-gray-500">Loading more NFTs...</span>
        </div>
      )}
    </div>
  );
};