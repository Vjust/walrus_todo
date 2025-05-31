'use client';

import React, { useState, useEffect } from 'react';
import { TodoNFTSearch } from '../../components/TodoNFTSearch';
import { TodoNFT } from '../../types/todo-nft';
import { useSuiClient } from '../../hooks/useSuiClient';
import { useWalletContext } from '../../contexts/WalletContext';

// Mock data for demonstration
const mockNFTs: TodoNFT[] = [
  {
    id: '1',
    objectId: '0x123',
    title: 'Complete project documentation',
    description: 'Write comprehensive documentation for the new API endpoints',
    completed: false,
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
    owner: '0xowner1',
    metadata: {
      tags: ['documentation', 'api', 'urgent'],
      priority: 'high',
      category: 'Development'
    },
    imageUrl: 'https://via.placeholder.com/150',
    walrusUrl: ''
  },
  {
    id: '2',
    objectId: '0x124',
    title: 'Review code changes',
    description: 'Review and approve pending pull requests for the frontend refactor',
    completed: true,
    createdAt: '2024-01-19T14:30:00Z',
    updatedAt: '2024-01-21T09:15:00Z',
    owner: '0xowner1',
    metadata: {
      tags: ['review', 'frontend', 'code-review'],
      priority: 'medium',
      category: 'Development'
    },
    imageUrl: 'https://via.placeholder.com/150',
    walrusUrl: ''
  },
  {
    id: '3',
    objectId: '0x125',
    title: 'Update deployment scripts',
    description: 'Modify CI/CD pipeline to include new environment variables',
    completed: false,
    createdAt: '2024-01-18T08:45:00Z',
    updatedAt: '2024-01-18T08:45:00Z',
    owner: '0xowner1',
    metadata: {
      tags: ['deployment', 'devops', 'infrastructure'],
      priority: 'low',
      category: 'Operations'
    },
    imageUrl: 'https://via.placeholder.com/150',
    walrusUrl: ''
  },
  {
    id: '4',
    objectId: '0x126',
    title: 'Design new user interface',
    description: 'Create mockups for the new dashboard layout with improved UX',
    completed: false,
    createdAt: '2024-01-17T16:20:00Z',
    updatedAt: '2024-01-20T11:30:00Z',
    owner: '0xowner1',
    metadata: {
      tags: ['design', 'ui', 'ux', 'dashboard'],
      priority: 'high',
      category: 'Design'
    },
    imageUrl: 'https://via.placeholder.com/150',
    walrusUrl: ''
  },
  {
    id: '5',
    objectId: '0x127',
    title: 'Fix authentication bug',
    description: 'Resolve issue where users are logged out after browser refresh',
    completed: true,
    createdAt: '2024-01-16T12:00:00Z',
    updatedAt: '2024-01-17T15:45:00Z',
    owner: '0xowner1',
    metadata: {
      tags: ['bug', 'authentication', 'urgent', 'security'],
      priority: 'critical',
      category: 'Bug Fix'
    },
    imageUrl: 'https://via.placeholder.com/150',
    walrusUrl: ''
  }
];

export default function NFTSearchDemoPage() {
  const [nfts, setNfts] = useState<TodoNFT[]>(mockNFTs);
  const [searchResults, setSearchResults] = useState<TodoNFT[]>(mockNFTs);
  const [activeFilters, setActiveFilters] = useState<any>({});
  const { connectedAddress } = useWalletContext();
  const suiClient = useSuiClient();

  // In a real app, you would fetch NFTs from the blockchain
  useEffect(() => {
    if (connectedAddress && suiClient) {
      // fetchUserNFTs();
    }
  }, [connectedAddress, suiClient]);

  const handleSearchResults = (results: TodoNFT[]) => {
    setSearchResults(results);
  };

  const handleFilterChange = (filters: any) => {
    setActiveFilters(filters);
    // Apply additional filters if needed
  };

  const highlightedResultsHtml = (nft: TodoNFT) => {
    // This would be populated by the search component with highlighted matches
    return {
      title: nft.title,
      description: nft.description
    };
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">NFT Search Demo</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Try searching with operators like "design AND urgent", "NOT completed", or "review OR documentation"
        </p>

        {/* Search Component */}
        <div className="mb-8">
          <TodoNFTSearch
            nfts={nfts}
            onSearchResults={handleSearchResults}
            onFilterChange={handleFilterChange}
            className="mb-4"
          />
        </div>

        {/* Search Results Stats */}
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Found {searchResults.length} of {nfts.length} NFTs
          {Object.keys(activeFilters).length > 0 && (
            <span className="ml-2">
              with {Object.keys(activeFilters).length} active filters
            </span>
          )}
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {searchResults.map((nft) => {
            const highlighted = highlightedResultsHtml(nft);
            return (
              <div
                key={nft.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 
                         hover:shadow-lg transition-shadow bg-white dark:bg-gray-800"
              >
                {/* NFT Image */}
                <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded mb-4 
                              flex items-center justify-center overflow-hidden">
                  {nft.imageUrl ? (
                    <img
                      src={nft.imageUrl}
                      alt={nft.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-400">No image</span>
                  )}
                </div>

                {/* NFT Details */}
                <h3
                  className="font-semibold text-lg mb-2"
                  dangerouslySetInnerHTML={{ __html: highlighted.title }}
                />
                <p
                  className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: highlighted.description }}
                />

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {nft.metadata.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 
                               text-blue-700 dark:text-blue-300 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Metadata */}
                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                  <span className={`px-2 py-1 rounded ${
                    nft.metadata.priority === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                    nft.metadata.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                    nft.metadata.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {nft.metadata.priority}
                  </span>
                  <span className={nft.completed ? 'text-green-600' : 'text-gray-400'}>
                    {nft.completed ? '✓ Completed' : '○ Pending'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {searchResults.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No NFTs found matching your search.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Try adjusting your search terms or filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}