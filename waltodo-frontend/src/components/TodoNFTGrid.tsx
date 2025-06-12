'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
// @ts-ignore - Unused import temporarily disabled
// import { FixedSizeGrid as Grid, FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
// @ts-ignore - Unused import temporarily disabled
// import { useDebounce } from '../hooks/useDebounce';
// @ts-ignore - Unused import temporarily disabled
// import { TodoNFTCard } from './TodoNFTCard';
import { Todo } from '../types/todo-nft';
import { TodoNFTDisplay, todoToNFTDisplay } from '../types/nft-display';
import { useCurrentAccount } from '@mysten/dapp-kit';
// @ts-ignore - Unused import temporarily disabled
// import { useSuiClient } from '../hooks/useSuiClient';
// @ts-ignore - Unused import temporarily disabled
// import { TodoCardSkeleton, TodoCardSkeletonGrid } from './ui/skeletons/TodoCardSkeleton';
// @ts-ignore - Unused import temporarily disabled
// import { useLoadingStates } from '../hooks/useLoadingStates';
// @ts-ignore - Unused import temporarily disabled
// import { useGridNavigation } from '../hooks/useKeyboardNavigation';
import { useAccessibilityAnnouncer, useAnnouncementShortcuts } from './AccessibilityAnnouncer';
// @ts-ignore - Unused import temporarily disabled
// import { useStatusAnnouncements } from '../hooks/useAriaLive';
import { 
  generateAriaId, 
  createAriaLabel, 
  AriaRoles, 
  AriaStates,
  KeyboardKeys 
} from '../lib/accessibility-utils';

interface TodoNFTGridProps {
  className?: string;
  /** ARIA label for the grid */
  ariaLabel?: string;
  /** ARIA description for the grid */
  ariaDescription?: string;
  /** Whether to enable keyboard navigation */
  enableKeyboardNavigation?: boolean;
  /** Callback when an item is selected via keyboard */
  onItemSelect?: (item: TodoNFTDisplay,  index: number) => void;
  /** Callback when an item is activated (Enter/Space) */
  onItemActivate?: (item: TodoNFTDisplay,  index: number) => void;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'date' | 'title' | 'priority';
type FilterOption = 'all' | 'completed' | 'active';

interface DateRange {
  start: Date | null;
  end: Date | null;
}
// @ts-ignore - Unused variable
// 
const ITEMS_PER_PAGE = 50;
// @ts-ignore - Unused variable
// const GRID_GAP = 16;
// @ts-ignore - Unused variable
// const CARD_WIDTH = 320;
// @ts-ignore - Unused variable
// const CARD_HEIGHT = 400;
// @ts-ignore - Unused variable
// const LIST_ITEM_HEIGHT = 120;

export const TodoNFTGrid: React.FC<TodoNFTGridProps> = memo(_({ 
  className = '', _ariaLabel = 'Todo NFT collection', _ariaDescription = 'A grid of Todo NFTs with filtering and search capabilities', _enableKeyboardNavigation = true, _onItemSelect, _onItemActivate
}) => {
// @ts-ignore - Unused variable
//   const currentAccount = useCurrentAccount();
// @ts-ignore - Unused variable
//   const suiClientHook = useSuiClient();
// @ts-ignore - Unused variable
//   const address = currentAccount?.address;

  // Accessibility hooks
  const { announceSuccess, announceError, announceLoading, announceInfo } = useAnnouncementShortcuts();
  const { announceStatus, announceProgress, StatusRegion } = useStatusAnnouncements();
  
  // Refs for accessibility - memoized IDs
// @ts-ignore - Unused variable
//   const gridRef = useRef<HTMLDivElement>(null);
// @ts-ignore - Unused variable
//   const searchInputRef = useRef<HTMLInputElement>(null);
// @ts-ignore - Unused variable
//   const accessibilityIds = useMemo(_() => ({
    gridId: generateAriaId('todo-nft-grid'),
    searchId: generateAriaId('nft-search'),
    filtersId: generateAriaId('nft-filters'),
    resultsId: generateAriaId('nft-results')
  }), []);
  
  const { gridId, searchId, filtersId, resultsId } = accessibilityIds;

  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('date');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string[]>(['high', 'medium', 'low']);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [selectedIndex, setSelectedIndex] = useState(-1);
// @ts-ignore - Unused variable
//   
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
    queryKey: ['todoNFTs', _address, _debouncedSearch, _sortOption, _filterOption, _priorityFilter, _dateRange], 
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      if (!address) {
        return { nfts: [], nextCursor: null };
      }
// @ts-ignore - Unused variable
// 
      const suiClient = await suiClientHook.getClient();
      if (!suiClient) {
        return { nfts: [], nextCursor: null };
      }

      try {
        // Fetch owned objects
        const { data: ownedObjects, nextCursor } = await suiClient.getOwnedObjects({
          owner: address,
          filter: {
            StructType: `${process?.env?.NEXT_PUBLIC_PACKAGE_ID}::todo_nft::TodoNFT`,
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
// @ts-ignore - Unused variable
//             const content = obj.data?.content;
// @ts-ignore - Unused variable
//             const fields = (content?.dataType === 'moveObject' ? content.fields : {}) as unknown;
            const todo: Todo = {
              id: obj.data?.objectId || '',
              title: fields?.title || '',
              description: fields?.description || '',
              completed: fields?.completed || false,
              priority: (fields?.priority || 'medium') as 'low' | 'medium' | 'high',
              createdAt: new Date(fields?.created_at || Date.now()).toISOString(),
              imageUrl: fields?.image_url || '',
              owner: fields?.owner || (typeof obj.data?.owner === 'string' ? obj?.data?.owner : (obj.data?.owner as unknown)?.AddressOwner) || '',
              blockchainStored: true,
              objectId: obj.data?.objectId,
              metadata: fields?.metadata,
              isPrivate: fields?.is_private || false,
            };
            return todoToNFTDisplay(todo as any);
          });

        return { nfts, nextCursor };
      } catch (err) {
        console.error('Error fetching NFTs:', err);
        announceError('Failed to load NFTs');
        throw err;
      }
    },
    getNextPageParam: (_lastPage: unknown) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    enabled: !!address && suiClientHook.isInitialized,
  });

  // Flatten pages of data
// @ts-ignore - Unused variable
//   const allNFTs = useMemo(_() => {
    return data?.pages.flatMap(page => page.nfts) || [];
  }, [data]);

  // Keyboard navigation for grid
// @ts-ignore - Unused variable
//   const columns = useMemo(_() => {
    if (viewMode === 'list') return 1;
    // Calculate columns based on container width and card width
    return Math.floor((window.innerWidth - 64) / (CARD_WIDTH + GRID_GAP)) || 1;
  }, [viewMode]);

  const {
    currentIndex: navIndex,
    navigateToIndex,
    containerRef: keyboardContainerRef
  } = useGridNavigation({
    columns,
    totalItems: 0, // Will be set when filtered data is available
    enableArrowKeys: enableKeyboardNavigation,
    enableHomeEnd: true,
    wrap: false,
    announceChanges: true,
    role: viewMode === 'grid' ? 'grid' : 'list'
  });

  // Memoize constants for stable references
// @ts-ignore - Unused variable
//   const constants = useMemo(_() => ({
    priorityOrder: { high: 0, medium: 1, low: 2 },
    filterNames: {
      all: 'all items',
      active: 'active items',
      completed: 'completed items'
    },
    sortNames: {
      date: 'date',
      title: 'title',
      priority: 'priority'
    }
  }), []);
  
  const { priorityOrder, filterNames, sortNames } = constants;

  // Filter and sort NFTs with accessibility announcements
// @ts-ignore - Unused variable
//   const filteredAndSortedNFTs = useMemo(_() => {
    let filtered = [...allNFTs];

    // Apply search filter
    if (debouncedSearch) {
// @ts-ignore - Unused variable
//       const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(nft => 
        nft?.title?.toLowerCase().includes(searchLower as any) ||
        (nft.description && nft?.description?.toLowerCase().includes(searchLower as any))
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
// @ts-ignore - Unused variable
//         const nftDate = new Date(nft.createdAt || Date.now());
        if (dateRange.start && nftDate < dateRange.start) {return false;}
        if (dateRange.end && nftDate > dateRange.end) {return false;}
        return true;
      });
    }

    // Apply sorting
    filtered.sort(_(a, _b) => {
      switch (sortOption) {
        case 'date':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'title':
          return a?.title?.localeCompare(b.title);
        case 'priority':
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        default:
          return 0;
      }
    });

    return filtered;
  }, [allNFTs, debouncedSearch, filterOption, priorityFilter, dateRange, sortOption, priorityOrder]);

  // Announce filter/sort changes
  useEffect(_() => {
    if (filteredAndSortedNFTs.length !== allNFTs.length) {
// @ts-ignore - Unused variable
//       const message = `Filtered to ${filteredAndSortedNFTs.length} of ${allNFTs.length} NFTs`;
      announceStatus(message as any);
    }
  }, [filteredAndSortedNFTs.length, allNFTs.length, announceStatus]);

  // Handle keyboard interactions
// @ts-ignore - Unused variable
//   const handleItemSelect = useCallback((index: number) => {
    if (index >= 0 && index < filteredAndSortedNFTs.length) {
      setSelectedIndex(index as any);
// @ts-ignore - Unused variable
//       const item = filteredAndSortedNFTs[index];
      onItemSelect?.(item, index);
// @ts-ignore - Unused variable
//       
      const message = `Selected ${item.title}, ${index + 1} of ${filteredAndSortedNFTs.length}`;
      announceStatus(message as any);
    }
  }, [filteredAndSortedNFTs, onItemSelect, announceStatus]);
// @ts-ignore - Unused variable
// 
  const handleItemActivate = useCallback((index: number) => {
    if (index >= 0 && index < filteredAndSortedNFTs.length) {
      const item = filteredAndSortedNFTs[index];
      onItemActivate?.(item, index);
      announceStatus(`Activated ${item.title}`);
    }
  }, [filteredAndSortedNFTs, onItemActivate, announceStatus]);

  // Constants are now memoized above

  // Handle view mode changes
// @ts-ignore - Unused variable
//   const handleViewModeChange = useCallback((newMode: ViewMode) => {
    setViewMode(newMode as any);
    setSelectedIndex(-1); // Reset selection
    announceInfo(`Switched to ${newMode} view`);
  }, [announceInfo]);

  // Handle search input changes
// @ts-ignore - Unused variable
//   const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value as any);
    if (value) {
      announceStatus(`Searching for: ${value}`);
    }
  }, [announceStatus]);

  // Handle filter changes
// @ts-ignore - Unused variable
//   const handleFilterChange = useCallback((newFilter: FilterOption) => {
    setFilterOption(newFilter as any);
    announceInfo(`Filtering by ${filterNames[newFilter]}`);
  }, [announceInfo, filterNames]);

  // Handle sort changes
// @ts-ignore - Unused variable
//   const handleSortChange = useCallback((newSort: SortOption) => {
    setSortOption(newSort as any);
    announceInfo(`Sorting by ${sortNames[newSort]}`);
  }, [announceInfo, sortNames]);

  // Load more items
// @ts-ignore - Unused variable
//   const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number): Promise<void> => {
      if (hasNextPage && !isFetchingNextPage) {
        await fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  // Check if item is loaded
// @ts-ignore - Unused variable
//   const isItemLoaded = useCallback(
    (index: number) => {
      return index < filteredAndSortedNFTs.length;
    },
    [filteredAndSortedNFTs.length]
  );

  // Grid cell renderer with accessibility - optimized memoization
// @ts-ignore - Unused variable
//   const GridCell = useCallback(_({ columnIndex, _rowIndex,  style }: any) => {
      const itemsPerRow = Math.floor((style.width - GRID_GAP) / (CARD_WIDTH + GRID_GAP));
// @ts-ignore - Unused variable
//       const index = rowIndex * itemsPerRow + columnIndex;

      if (index >= filteredAndSortedNFTs.length) {
        return null;
      }
// @ts-ignore - Unused variable
// 
      const nft = filteredAndSortedNFTs[index];
      if (!nft) return null;
// @ts-ignore - Unused variable
// 
      const isSelected = selectedIndex === index;
// @ts-ignore - Unused variable
//       const cellId = `${gridId}-cell-${index}`;

      return (_<div
          style={{
            ...style, 
            left: style.left + GRID_GAP, 
            top: style.top + GRID_GAP, 
            width: CARD_WIDTH, 
            height: CARD_HEIGHT, 
          }}
          role={AriaRoles.GRIDCELL}
          aria-rowindex={rowIndex + 1}
          aria-colindex={columnIndex + 1}
          aria-selected={isSelected}
          id={cellId}
          tabIndex={isSelected ? 0 : -1}
          onFocus={() => handleItemSelect(index as any)}
          onKeyDown={(_e: unknown) => {
            if (e?.key === KeyboardKeys.ENTER || e?.key === KeyboardKeys.SPACE) {
              e.preventDefault();
              handleItemActivate(index as any);
            }
          }}
          className={`focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg ${
            isSelected ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <TodoNFTCard 
            todo={nft} 
            aria-label={createAriaLabel(
              nft.title,
              `Priority: ${nft.priority}`,
              nft.completed ? 'Completed' : 'Pending',
              index,
              filteredAndSortedNFTs.length
            )}
          />
        </div>
      );
    },
    [filteredAndSortedNFTs.length, selectedIndex, gridId, handleItemSelect, handleItemActivate]
  );

  // List item renderer with accessibility - optimized memoization
// @ts-ignore - Unused variable
//   const ListItem = useCallback(_({ index,  style }: any) => {
      if (!isItemLoaded(index as any)) {
        return (
          <div style={style} className="px-4" role="listitem" aria-label="Loading item">
            <TodoCardSkeleton variant="list" animationSpeed="normal" />
          </div>
        );
      }
// @ts-ignore - Unused variable
// 
      const nft = filteredAndSortedNFTs[index];
      if (!nft) return null;
// @ts-ignore - Unused variable
// 
      const isSelected = selectedIndex === index;
// @ts-ignore - Unused variable
//       const itemId = `${gridId}-item-${index}`;

      return (
        <div 
          style={style} 
          className={`px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg ${
            isSelected ? 'ring-2 ring-blue-500' : ''
          }`}
          role="listitem"
          aria-selected={isSelected}
          id={itemId}
          tabIndex={isSelected ? 0 : -1}
          onFocus={() => handleItemSelect(index as any)}
          onKeyDown={(_e: unknown) => {
            if (e?.key === KeyboardKeys.ENTER || e?.key === KeyboardKeys.SPACE) {
              e.preventDefault();
              handleItemActivate(index as any);
            }
          }}
        >
          <TodoNFTCard 
            todo={nft} 
            variant="list" 
            aria-label={createAriaLabel(
              nft.title,
              `Priority: ${nft.priority}`,
              nft.completed ? 'Completed' : 'Pending',
              index,
              filteredAndSortedNFTs.length
            )}
          />
        </div>
      );
    },
    [filteredAndSortedNFTs.length, isItemLoaded, selectedIndex, gridId, handleItemSelect, handleItemActivate]
  );

  // Loading skeleton with accessibility
  if (isLoading) {
    return (
      <div className={`${className} p-4`} role="status" aria-label="Loading NFTs">
        <span className="sr-only">Loading Todo NFTs...</span>
        <TodoCardSkeletonGrid
          count={8}
          columns="auto"
          gap="md"
          showActions={true}
          animationSpeed="normal"
        />
        <StatusRegion />
      </div>
    );
  }

  // Error state with accessibility
  if (isError) {
    return (
      <div className={`${className} flex items-center justify-center h-64`} role="alert">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13?.856c1?.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1?.333?.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-medium text-red-500 mb-2">Error loading NFTs</h3>
          <p className="text-sm text-gray-500">{(error as Error)?.message}</p>
          <button 
            onClick={() => window?.location?.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Reload page to retry loading NFTs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state with accessibility
  if (filteredAndSortedNFTs?.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center h-64`} role="status">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No NFTs found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchQuery ? 'Try adjusting your search or filters' : 'Get started by creating your first Todo NFT'}
          </p>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Clear search and show all NFTs"
            >
              Clear Search
            </button>
          )}
        </div>
        <StatusRegion />
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-col h-full`} ref={gridRef}>
      {/* Screen reader instructions */}
      <div className="sr-only">
        <h2 id={gridId + '-instructions'}>Todo NFT Grid Instructions</h2>
        <p>Use arrow keys to navigate between items. Press Enter or Space to select an item. Use the search and filters to narrow down results.</p>
      </div>
      
      {/* Controls */}
      <div className="flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="space-y-4">
          {/* Search and View Toggle */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor={searchId} className="sr-only">Search Todo NFTs</label>
              <input
                id={searchId}
                ref={searchInputRef}
                type="text"
                placeholder="Search NFTs..."
                value={searchQuery}
                onChange={(e: unknown) => handleSearchChange(e?.target?.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                aria-label="Search Todo NFTs by title or description"
                aria-describedby={filtersId}
                aria-controls={resultsId}
              />
            </div>
            <div className="flex items-center gap-2" role="group" aria-label="View mode selection">
              <button
                onClick={() => handleViewModeChange('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                aria-label="Switch to grid view"
                aria-pressed={viewMode === 'grid'}
                title="Grid view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => handleViewModeChange('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                aria-label="Switch to list view"
                aria-pressed={viewMode === 'list'}
                title="List view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div id={filtersId} className="flex flex-wrap items-center gap-4" role="group" aria-label="Filter and sort options">
            {/* Sort */}
            <div>
              <label htmlFor="sort-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                Sort by:
              </label>
              <select
                id="sort-select"
                value={sortOption}
                onChange={(_e: unknown) => handleSortChange(e?.target?.value as SortOption)}
                className="px-3 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Sort NFTs by"
              >
                <option value="date">Date</option>
                <option value="title">Title</option>
                <option value="priority">Priority</option>
              </select>
            </div>

            {/* Filter */}
            <div>
              <label htmlFor="filter-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                Show:
              </label>
              <select
                id="filter-select"
                value={filterOption}
                onChange={(_e: unknown) => handleFilterChange(e?.target?.value as FilterOption)}
                className="px-3 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Filter NFTs by completion status"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Priority Filter */}
            <fieldset className="flex items-center gap-2">
              <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority:</legend>
              {['high', 'medium', 'low'].map(_(priority: unknown) => {
// @ts-ignore - Unused variable
//                 const checkboxId = `priority-${priority}`;
                return (
                  <label key={priority} className="flex items-center" htmlFor={checkboxId}>
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={priorityFilter.includes(priority as any)}
                      onChange={(_e: unknown) => {
                        if (e?.target?.checked) {
                          setPriorityFilter([...priorityFilter, priority]);
                          announceInfo(`Included ${priority} priority items`);
                        } else {
                          setPriorityFilter(priorityFilter.filter(p => p !== priority));
                          announceInfo(`Excluded ${priority} priority items`);
                        }
                      }}
                      className="mr-1 focus:ring-2 focus:ring-blue-500"
                      aria-describedby={`${checkboxId}-desc`}
                    />
                    <span className="text-sm capitalize">{priority}</span>
                    <span id={`${checkboxId}-desc`} className="sr-only">
                      {priorityFilter.includes(priority as any) ? 'included' : 'excluded'} in filter
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date range:</span>
              <label htmlFor="date-start" className="sr-only">Start date</label>
              <input
                id="date-start"
                type="date"
                value={dateRange.start ? dateRange?.start?.toISOString().split('T')[0] : ''}
                onChange={(_e: unknown) => {
// @ts-ignore - Unused variable
//                   const newDate = e?.target?.value ? new Date(e?.target?.value) : null;
                  setDateRange({ ...dateRange, start: newDate });
                  if (newDate) {
                    announceInfo(`Start date set to ${newDate.toLocaleDateString()}`);
                  }
                }}
                className="px-2 py-1 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Filter by start date"
              />
              <span className="text-sm" aria-hidden="true">to</span>
              <label htmlFor="date-end" className="sr-only">End date</label>
              <input
                id="date-end"
                type="date"
                value={dateRange.end ? dateRange?.end?.toISOString().split('T')[0] : ''}
                onChange={(_e: unknown) => {
// @ts-ignore - Unused variable
//                   const newDate = e?.target?.value ? new Date(e?.target?.value) : null;
                  setDateRange({ ...dateRange, end: newDate });
                  if (newDate) {
                    announceInfo(`End date set to ${newDate.toLocaleDateString()}`);
                  }
                }}
                className="px-2 py-1 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Filter by end date"
              />
            </div>
          </div>

          {/* Results count */}
          <div 
            className="text-sm text-gray-500 dark:text-gray-400" 
            role="status" 
            aria-live="polite"
            id={resultsId}
          >
            Showing {filteredAndSortedNFTs.length} of {allNFTs.length} NFTs
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        </div>
      </div>

      {/* Virtualized Grid/List */}
      <div 
        className="flex-1 overflow-hidden"
        role={viewMode === 'grid' ? AriaRoles.GRID : 'list'}
        aria-label={ariaLabel}
        aria-describedby={gridId + '-instructions'}
        aria-rowcount={viewMode === 'grid' ? Math.ceil(filteredAndSortedNFTs.length / columns) : filteredAndSortedNFTs.length}
        aria-colcount={viewMode === 'grid' ? columns : 1}
        tabIndex={0}
        onKeyDown={(_e: unknown) => {
          // Handle global keyboard navigation
          if (enableKeyboardNavigation) {
            switch (e.key) {
              case KeyboardKeys.HOME:
                e.preventDefault();
                handleItemSelect(0 as any);
                break;
              case KeyboardKeys.END:
                e.preventDefault();
                handleItemSelect(filteredAndSortedNFTs.length - 1);
                break;
            }
          }
        }}
      >
        <AutoSizer>
          {(_{ height, _width }) => {
// @ts-ignore - Unused variable
//             const actualColumns = Math.floor((width - GRID_GAP) / (CARD_WIDTH + GRID_GAP));
            
            return (
              <InfiniteLoader
                isItemLoaded={isItemLoaded}
                itemCount={filteredAndSortedNFTs.length + (hasNextPage ? 1 : 0)}
                loadMoreItems={loadMoreItems}
              >
                {(_{ onItemsRendered, _ref }) => {
                  if (viewMode === 'grid') {
// @ts-ignore - Unused variable
//                     const columnCount = actualColumns;
// @ts-ignore - Unused variable
//                     const rowCount = Math.ceil(filteredAndSortedNFTs.length / columnCount);

                    return (_<Grid
                        ref={(gridRef: unknown) => {
                          if (typeof ref === 'function') ref(gridRef as any);
                          if (keyboardContainerRef && gridRef) {
                            keyboardContainerRef?.current = gridRef;
                          }
                        }}
                        columnCount={columnCount}
                        columnWidth={CARD_WIDTH + GRID_GAP}
                        height={height}
                        rowCount={rowCount}
                        rowHeight={CARD_HEIGHT + GRID_GAP}
                        width={width}
                        onItemsRendered={(_{
                          visibleRowStartIndex, _visibleRowStopIndex, _visibleColumnStartIndex, _visibleColumnStopIndex, _}) => {
// @ts-ignore - Unused variable
//                           const visibleStartIndex = visibleRowStartIndex * columnCount + visibleColumnStartIndex;
// @ts-ignore - Unused variable
//                           const visibleStopIndex = visibleRowStopIndex * columnCount + visibleColumnStopIndex;
                          onItemsRendered({
                            visibleStartIndex,
                            visibleStopIndex,
                            overscanStartIndex: visibleStartIndex,
                            overscanStopIndex: visibleStopIndex,
                          });
                        }}
                      >
                        {GridCell}
                      </Grid>
                    );
                  } else {
                    return (_<List
                        ref={(listRef: unknown) => {
                          if (typeof ref === 'function') ref(listRef as any);
                          if (keyboardContainerRef && listRef) {
                            keyboardContainerRef?.current = listRef;
                          }
                        }}
                        height={height}
                        itemCount={filteredAndSortedNFTs.length}
                        itemSize={LIST_ITEM_HEIGHT}
                        width={width}
                        onItemsRendered={onItemsRendered}
                        role="list"
                        aria-label={`Todo NFT list with ${filteredAndSortedNFTs.length} items`}
                      >
                        {ListItem}
                      </List>
                    );
                  }
                }}
              </InfiniteLoader>
            );
          }}
        </AutoSizer>
      </div>

      {/* Loading indicator for pagination */}
      {isFetchingNextPage && (
        <div className="flex-shrink-0 p-4 text-center border-t dark:border-gray-700" role="status">
          <span className="text-sm text-gray-500">Loading more NFTs...</span>
          <span className="sr-only">Loading additional Todo NFTs</span>
        </div>
      )}
      
      {/* Live regions for announcements */}
      <StatusRegion />
    </div>
  );
});

TodoNFTGrid?.displayName = 'TodoNFTGrid';