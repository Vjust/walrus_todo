'use client';

import React, { useState } from 'react';
import { TodoNFTGrid } from '@/components/TodoNFTGrid';
import { TodoNFTListView } from '@/components/TodoNFTListView';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useSuiClient } from '@/hooks/useSuiClient';
import { Todo } from '@/types/todo-nft';
import { TodoNFTDisplay, todoToNFTDisplay } from '@/types/nft-display';
import { useDebounce } from '@/hooks/useDebounce';

type ViewMode = 'grid' | 'list';
type SortOption = 'date' | 'title' | 'priority';
type FilterOption = 'all' | 'completed' | 'active';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

const ITEMS_PER_PAGE = 50;

export default function NFTListDemoPage() {
  const currentAccount = useCurrentAccount();
  const { getClient } = useSuiClient();
  const address = currentAccount?.address;

  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('list');
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
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!address) {
        return { nfts: [], nextCursor: null };
      }

      const suiClient = await getClient();
      if (!suiClient) {
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
          cursor: pageParam || undefined,
          limit: ITEMS_PER_PAGE,
        });

        // Transform to TodoNFTDisplay format
        const nfts: TodoNFTDisplay[] = ownedObjects
          .filter(obj => obj.data?.content?.dataType === 'moveObject')
          .map(obj => {
            const content = obj.data?.content;
            if (!content || content.dataType !== 'moveObject') return null;
            const fields = content.fields as any;
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
          })
          .filter(Boolean) as TodoNFTDisplay[];

        return { nfts, nextCursor };
      } catch (err) {
        console.error('Error fetching NFTs:', err);
        throw err;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!address,
  });

  // Flatten pages of data
  const allNFTs = React.useMemo(() => {
    return data?.pages.flatMap(page => page.nfts) || [];
  }, [data]);

  // Filter and sort NFTs
  const filteredAndSortedNFTs = React.useMemo(() => {
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

  // Handle complete action
  const handleComplete = async (todoId: string) => {
    // Implement your complete logic here
    console.log('Complete todo:', todoId);
  };

  // Handle transfer action
  const handleTransfer = async (todoId: string, recipient: string) => {
    // Implement your transfer logic here
    console.log('Transfer todo:', todoId, 'to:', recipient);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Todo NFT Collection
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage your Todo NFTs in grid or list view
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              View Mode:
            </span>
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Grid View
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List View
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Total NFTs:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
                {allNFTs.length}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Filtered:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
                {filteredAndSortedNFTs.length}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 320px)' }}>
          {viewMode === 'grid' ? (
            <TodoNFTGrid className="h-full" />
          ) : (
            <TodoNFTListView
              nfts={filteredAndSortedNFTs}
              loading={isLoading}
              error={isError ? error as Error : null}
              onComplete={handleComplete}
              onTransfer={handleTransfer}
              onLoadMore={fetchNextPage}
              hasMore={hasNextPage}
              filters={{
                searchQuery,
                sortOption,
                filterOption,
                priorityFilter,
                dateRange,
              }}
              className="h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}