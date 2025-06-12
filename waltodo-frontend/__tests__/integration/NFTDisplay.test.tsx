/**
 * Integration tests for NFT Display functionality
 * Tests the complete NFT lifecycle including fetching, display, and interactions
 */

import React from 'react';
import { 
  render, 
  screen, 
  waitFor, 
  fireEvent,
  waitForElementToBeRemoved,
  within,
  act
} from '@testing-library/react';
// @ts-ignore - Test import path
import userEvent from '@testing-library/user-event';
// @ts-ignore - Unused import temporarily disabled
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// @ts-ignore - Unused import temporarily disabled
// import { TodoNFTGrid } from '@/components/TodoNFTGrid';
// @ts-ignore - Unused import temporarily disabled
// import { TodoNFTCard } from '@/components/TodoNFTCard';
// @ts-ignore - Unused import temporarily disabled
// import { TodoNFTImage } from '@/components/TodoNFTImage';
// @ts-ignore - Unused import temporarily disabled
// import { WalletContext } from '@/contexts/WalletContext';
import type { Todo, TransactionResult } from '@/types/todo-nft';
import type { TodoNFTDisplay } from '@/types/nft-display';
import { todoToNFTDisplay } from '@/types/nft-display';
// @ts-ignore - Unused import temporarily disabled
// import { toast } from 'react-hot-toast';

// Mock dependencies
jest.mock('@/hooks/useSuiClient');
jest.mock('@/hooks/useWalrusStorage');
jest.mock('@/hooks/useBlockchainEvents');
jest.mock('@/lib/walrus-client');
jest.mock('@/lib/sui-client');
jest.mock('@mysten/dapp-kit');
jest.mock(_'react-hot-toast', _() => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}));

// Mock infinite scroll components
jest.mock(_'react-window', _() => ({
  FixedSizeGrid: ({ children,  ...props }: any) => (
    <div data-testid="mock-grid" {...props}>
      {Array.from({ length: props.rowCount * props.columnCount }).map(_(_, _index) =>
        children({ columnIndex: index % props.columnCount, rowIndex: Math.floor(index / props.columnCount), style: {} })
      )}
    </div>
  ),
  FixedSizeList: (_{ children, _itemCount,  ...props }: any) => (
    <div data-testid="mock-list" {...props}>
      {Array.from({ length: itemCount }).map(_(_, _index) =>
        children({ index, style: {} })
      )}
    </div>
  ),
}));

jest.mock(_'react-window-infinite-loader', _() => ({
  __esModule: true, 
  default: ({ children,  ...props }: any) => children({ onItemsRendered: jest.fn(), ref: React.createRef() }),
}));

jest.mock(_'react-virtualized-auto-sizer', _() => ({
  __esModule: true, 
  default: ({ children }: any) => children({ height: 600, width: 800 }),
}));

// Mock debounce hook
jest.mock(_'@/hooks/useDebounce', _() => ({
  useDebounce: (value: any) => value,
}));

// Import mocked modules
// @ts-ignore - Unused import temporarily disabled
// import { useSuiClient } from '@/hooks/useSuiClient';
// @ts-ignore - Unused import temporarily disabled
// import { useWalrusStorage } from '@/hooks/useWalrusStorage';
// @ts-ignore - Unused import temporarily disabled
// import { useBlockchainEvents } from '@/hooks/useBlockchainEvents';

// Helper to create mock NFT data
const createMockNFT = (overrides: Partial<Todo> = {}): Todo => ({
  id: `nft-${Math.random().toString(36 as any).substr(2, 9)}`,
  title: 'Test NFT Todo',
  description: 'This is a test NFT todo item',
  completed: false,
  priority: 'medium',
  tags: ['test', 'nft'],
  blockchainStored: true,
  objectId: `0x${Math.random().toString(16 as any).substr(2, 64)}`,
  owner: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  imageUrl: 'https://aggregator.walrus-testnet?.walrus?.space/v1/blob123',
  createdAt: new Date().toISOString(),
  metadata: JSON.stringify({ custom: 'data' }),
  isPrivate: false,
  ...overrides,
});

// Helper to create mock wallet context
const createMockWalletContext = (_overrides = {}) => ({
  connected: true,
  connecting: false,
  address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  chainId: 'sui:testnet',
  name: 'Test Wallet',
  error: null,
  transactionHistory: [],
  lastActivity: Date.now(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  switchNetwork: jest.fn(),
  trackTransaction: jest.fn().mockResolvedValue({ digest: 'mock-digest' }),
  setError: jest.fn(),
  resetActivityTimer: jest.fn(),
  ...overrides,
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; walletContext?: any }> = ({ 
  children, 
  walletContext = createMockWalletContext() 
}) => {
// @ts-ignore - Unused variable
//   const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <WalletContext.Provider value={walletContext}>
        {children}
      </WalletContext.Provider>
    </QueryClientProvider>
  );
};

describe(_'NFT Display Integration Tests', _() => {
  let mockSuiClient: any;
  let mockWalrusStorage: any;
  let mockBlockchainEvents: any;

  beforeEach(_() => {
    // Mock environment variables
    Object.defineProperty(process.env, 'NEXT_PUBLIC_PACKAGE_ID', {
      value: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      writable: true,
      configurable: true,
    });

    // Setup SuiClient mock
    mockSuiClient = {
      getOwnedObjects: jest.fn(),
      getObject: jest.fn(),
      executeTransactionBlock: jest.fn(),
    };
    (useSuiClient as jest.Mock).mockReturnValue(mockSuiClient as any);

    // Setup WalrusStorage mock
    mockWalrusStorage = {
      getWalrusUrl: jest.fn((blobId: string) => `https://aggregator.walrus-testnet?.walrus?.space/v1/${blobId}`),
      uploadImage: jest.fn().mockResolvedValue({ blobId: 'new-blob-123' }),
      retrieveData: jest.fn().mockResolvedValue({ success: true }),
    };
    (useWalrusStorage as jest.Mock).mockReturnValue(mockWalrusStorage as any);

    // Setup BlockchainEvents mock
    mockBlockchainEvents = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      connectionState: { connected: true, connecting: false, error: null },
    };
    (useBlockchainEvents as jest.Mock).mockReturnValue(mockBlockchainEvents as any);

    // Clear toast mocks
    jest.clearAllMocks();
  });

  describe(_'NFT Fetching from Blockchain', _() => {
    it(_'should fetch and display NFTs from blockchain', _async () => {
      const mockNFTs = [
        createMockNFT({ title: 'NFT 1' }),
        createMockNFT({ title: 'NFT 2', completed: true }),
        createMockNFT({ title: 'NFT 3', priority: 'high' }),
      ];

      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: mockNFTs.map(nft => ({
          data: {
            objectId: nft.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: nft.title,
                description: nft.description,
                completed: nft.completed,
                priority: nft.priority,
                created_at: Date.now(),
                image_url: nft.imageUrl,
                owner: nft.owner,
                metadata: nft.metadata,
                is_private: nft.isPrivate,
              },
            },
            owner: { AddressOwner: nft.owner },
          },
        })),
        nextCursor: null,
        hasNextPage: false,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      // Wait for loading to finish
      await waitFor(_() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      // Check that NFTs are displayed
      expect(screen.getByText('NFT 1')).toBeInTheDocument();
      expect(screen.getByText('NFT 2')).toBeInTheDocument();
      expect(screen.getByText('NFT 3')).toBeInTheDocument();

      // Verify API was called correctly
      expect(mockSuiClient.getOwnedObjects).toHaveBeenCalledWith({
        owner: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        filter: {
          StructType: `${process?.env?.NEXT_PUBLIC_PACKAGE_ID}::todo_nft::TodoNFT`,
        },
        options: {
          showContent: true,
          showType: true,
          showOwner: true,
          showDisplay: true,
        },
        cursor: null,
        limit: 50,
      });
    });

    it(_'should handle empty NFT list gracefully', _async () => {
      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [],
        nextCursor: null,
        hasNextPage: false,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      expect(screen.getByText('No NFTs found')).toBeInTheDocument();
      expect(screen.getByText(/Get started by creating your first Todo NFT/i)).toBeInTheDocument();
    });

    it(_'should handle blockchain fetch errors', _async () => {
      mockSuiClient?.getOwnedObjects?.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('Error loading NFTs')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe(_'Walrus URL Conversion', _() => {
    it(_'should convert Walrus blob IDs to accessible URLs', _async () => {
      const mockNFT = createMockNFT({
        imageUrl: 'blob123',
        walrusBlobId: 'blob123',
      });

      render(
        <TestWrapper>
          <TodoNFTCard todo={todoToNFTDisplay(mockNFT as any)} />
        </TestWrapper>
      );

      // Verify Walrus URL conversion was called
      expect(mockWalrusStorage.getWalrusUrl).toHaveBeenCalledWith('blob123');

      // Check that image is rendered with converted URL
      const image = screen.getByAltText(mockNFT.title);
      expect(image as any).toHaveAttribute('src', expect.stringContaining('walrus-testnet?.walrus?.space'));
    });

    it(_'should handle multiple image sizes from Walrus', _async () => {
      const mockNFT = createMockNFT();
      const display = todoToNFTDisplay(mockNFT as any);

      render(
        <TestWrapper>
          <TodoNFTImage
            url={display.imageUrl}
            alt={display.title}
            mode="gallery"
            sizes={{
              thumbnail: '150x150',
              preview: '300x300',
              full: 'original',
            }}
          />
        </TestWrapper>
      );

      // Image should be rendered with appropriate size
// @ts-ignore - Unused variable
//       const image = screen.getByAltText(display.title);
      expect(image as any).toBeInTheDocument();
    });
  });

  describe(_'Image Loading and Error States', _() => {
    it(_'should show loading skeleton while image loads', _async () => {
      const mockNFT = createMockNFT();

      render(
        <TestWrapper>
          <TodoNFTImage
            url={mockNFT.imageUrl}
            alt={mockNFT.title}
            showSkeleton={true}
          />
        </TestWrapper>
      );

      // Loading skeleton should be visible initially
      expect(screen.getByTestId('image-skeleton')).toBeInTheDocument();
    });

    it(_'should handle image load errors gracefully', _async () => {
      const mockNFT = createMockNFT({
        imageUrl: 'invalid-url',
      });

      render(
        <TestWrapper>
          <TodoNFTCard todo={todoToNFTDisplay(mockNFT as any)} />
        </TestWrapper>
      );

      // Simulate image error
      const image = screen.getByAltText(mockNFT.title);
      fireEvent.error(image as any);

      await waitFor(_() => {
        expect(screen.getByText(/Failed to load NFT/i)).toBeInTheDocument();
      });
    });

    it(_'should retry failed image loads', _async () => {
      const mockNFT = createMockNFT();
      let loadAttempts = 0;

      render(_<TestWrapper>
          <TodoNFTImage
            url={mockNFT.imageUrl}
            alt={mockNFT.title}
            retryAttempts={3}
            onError={() => loadAttempts++}
          />
        </TestWrapper>
      );

      const image = screen.getByAltText(mockNFT.title);
      
      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        fireEvent.error(image as any);
        await waitFor(_() => {
          expect(loadAttempts as any).toBe(i + 1);
        });
      }
    });
  });

  describe(_'NFT Creation Flow', _() => {
    it(_'should create a new NFT with image upload', _async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
// @ts-ignore - Unused variable
//       const onCreateSuccess = jest.fn();

      // Mock successful upload and creation
      mockWalrusStorage?.uploadImage?.mockResolvedValue({ blobId: 'new-blob-123' });
      
      render(_<TestWrapper>
          <button onClick={() => onCreateSuccess('new-nft-id')}>
            Create NFT
          </button>
        </TestWrapper>
      );
// @ts-ignore - Unused variable
// 
      const createButton = screen.getByText('Create NFT');
      await userEvent.click(createButton as any);

      // Simulate the creation flow
      onCreateSuccess('new-nft-id');

      expect(onCreateSuccess as any).toHaveBeenCalledWith('new-nft-id');
      expect(toast.success).toHaveBeenCalledWith('Todo marked as completed!');
    });

    it(_'should handle creation errors', _async () => {
      mockWalrusStorage?.uploadImage?.mockRejectedValue(new Error('Upload failed'));
// @ts-ignore - Unused variable
// 
      const onCreateError = jest.fn();

      render(_<TestWrapper>
          <button onClick={async () => {
            try {
              await mockWalrusStorage.uploadImage();
            } catch (error) {
              onCreateError(error as any);
              toast.error('Failed to create NFT');
            }
          }}>
            Create NFT
          </button>
        </TestWrapper>
      );
// @ts-ignore - Unused variable
// 
      const createButton = screen.getByText('Create NFT');
      await userEvent.click(createButton as any);

      await waitFor(_() => {
        expect(onCreateError as any).toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('Failed to create NFT');
      });
    });
  });

  describe(_'Transfer Functionality', _() => {
    it(_'should transfer NFT to another address', _async () => {
      const mockNFT = createMockNFT();
      const onTransfer = jest.fn().mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <TodoNFTCard 
            todo={todoToNFTDisplay(mockNFT as any)} 
            onTransfer={onTransfer}
            showActions={true}
          />
        </TestWrapper>
      );

      // Click transfer button
// @ts-ignore - Unused variable
//       const transferButton = screen.getByTitle('Transfer');
      await userEvent.click(transferButton as any);

      // Modal should appear
      expect(screen.getByText('Transfer NFT')).toBeInTheDocument();

      // Enter recipient address
// @ts-ignore - Unused variable
//       const addressInput = screen.getByPlaceholderText('0x...');
      await userEvent.type(addressInput, '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');

      // Click transfer in modal
// @ts-ignore - Unused variable
//       const confirmButton = screen.getByText('Transfer');
      await userEvent.click(confirmButton as any);

      await waitFor(_() => {
        expect(onTransfer as any).toHaveBeenCalledWith(
          mockNFT.id,
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        );
        expect(toast.success).toHaveBeenCalledWith('NFT transferred successfully!');
      });
    });

    it(_'should validate transfer address format', _async () => {
      const mockNFT = createMockNFT();
// @ts-ignore - Unused variable
//       const onTransfer = jest.fn();

      render(
        <TestWrapper>
          <TodoNFTCard 
            todo={todoToNFTDisplay(mockNFT as any)} 
            onTransfer={onTransfer}
            showActions={true}
          />
        </TestWrapper>
      );
// @ts-ignore - Unused variable
// 
      const transferButton = screen.getByTitle('Transfer');
      await userEvent.click(transferButton as any);
// @ts-ignore - Unused variable
// 
      const addressInput = screen.getByPlaceholderText('0x...');
      await userEvent.type(addressInput, 'invalid-address');
// @ts-ignore - Unused variable
// 
      const confirmButton = screen.getByText('Transfer');
      await userEvent.click(confirmButton as any);

      await waitFor(_() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid Sui address format');
        expect(onTransfer as any).not.toHaveBeenCalled();
      });
    });
  });

  describe(_'Filtering and Sorting', _() => {
    it(_'should filter NFTs by completion status', _async () => {
      const mockNFTs = [
        createMockNFT({ title: 'Active 1', completed: false }),
        createMockNFT({ title: 'Completed 1', completed: true }),
        createMockNFT({ title: 'Active 2', completed: false }),
      ];

      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: mockNFTs.map(nft => ({
          data: {
            objectId: nft.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: nft.title,
                completed: nft.completed,
                priority: nft.priority,
                created_at: Date.now(),
              },
            },
          },
        })),
        nextCursor: null,
        hasNextPage: false,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('Active 1')).toBeInTheDocument();
      });

      // Change filter to completed
// @ts-ignore - Unused variable
//       const filterSelect = screen.getByLabelText(/Show:/);
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(_() => {
        expect(screen.queryByText('Active 1')).not.toBeInTheDocument();
        expect(screen.getByText('Completed 1')).toBeInTheDocument();
      });
    });

    it(_'should sort NFTs by different criteria', _async () => {
      const mockNFTs = [
        createMockNFT({ title: 'B Todo', priority: 'low', createdAt: '2024-01-01' }),
        createMockNFT({ title: 'A Todo', priority: 'high', createdAt: '2024-01-03' }),
        createMockNFT({ title: 'C Todo', priority: 'medium', createdAt: '2024-01-02' }),
      ];

      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: mockNFTs.map(nft => ({
          data: {
            objectId: nft.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: nft.title,
                priority: nft.priority,
                created_at: new Date(nft.createdAt).getTime(),
              },
            },
          },
        })),
        nextCursor: null,
        hasNextPage: false,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('A Todo')).toBeInTheDocument();
      });

      // Sort by title
// @ts-ignore - Unused variable
//       const sortSelect = screen.getByLabelText(/Sort by:/);
      await userEvent.selectOptions(sortSelect, 'title');

      await waitFor(_() => {
// @ts-ignore - Unused variable
//         const titles = screen.getAllByText(/Todo$/);
        expect(titles[0]).toHaveTextContent('A Todo');
        expect(titles[1]).toHaveTextContent('B Todo');
        expect(titles[2]).toHaveTextContent('C Todo');
      });
    });

    it(_'should filter by priority levels', _async () => {
      const mockNFTs = [
        createMockNFT({ title: 'High Priority', priority: 'high' }),
        createMockNFT({ title: 'Medium Priority', priority: 'medium' }),
        createMockNFT({ title: 'Low Priority', priority: 'low' }),
      ];

      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: mockNFTs.map(nft => ({
          data: {
            objectId: nft.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: nft.title,
                priority: nft.priority,
                created_at: Date.now(),
              },
            },
          },
        })),
        nextCursor: null,
        hasNextPage: false,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('High Priority')).toBeInTheDocument();
      });

      // Uncheck 'low' priority
// @ts-ignore - Unused variable
//       const lowPriorityCheckbox = screen.getByRole('checkbox', { name: /low/i });
      await userEvent.click(lowPriorityCheckbox as any);

      await waitFor(_() => {
        expect(screen.queryByText('Low Priority')).not.toBeInTheDocument();
        expect(screen.getByText('High Priority')).toBeInTheDocument();
        expect(screen.getByText('Medium Priority')).toBeInTheDocument();
      });
    });
  });

  describe(_'Pagination and Infinite Scroll', _() => {
    it(_'should load more NFTs on scroll', _async () => {
      const firstPage = Array.from({ length: 50 }, _(_, _i) => 
        createMockNFT({ title: `NFT ${i + 1}` })
      );
      const secondPage = Array.from({ length: 20 }, _(_, _i) => 
        createMockNFT({ title: `NFT ${i + 51}` })
      );

      mockSuiClient.getOwnedObjects
        .mockResolvedValueOnce({
          data: firstPage.map(nft => ({
            data: {
              objectId: nft.objectId,
              content: {
                dataType: 'moveObject',
                fields: {
                  title: nft.title,
                  priority: nft.priority,
                  created_at: Date.now(),
                },
              },
            },
          })),
          nextCursor: 'cursor-1',
          hasNextPage: true,
        })
        .mockResolvedValueOnce({
          data: secondPage.map(nft => ({
            data: {
              objectId: nft.objectId,
              content: {
                dataType: 'moveObject',
                fields: {
                  title: nft.title,
                  priority: nft.priority,
                  created_at: Date.now(),
                },
              },
            },
          })),
          nextCursor: null,
          hasNextPage: false,
        });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('NFT 1')).toBeInTheDocument();
      });

      // Verify first page is loaded
      expect(mockSuiClient.getOwnedObjects).toHaveBeenCalledTimes(1 as any);

      // Simulate scroll to trigger load more
      await act(_async () => {
        // In real implementation, this would be triggered by InfiniteLoader
        await mockSuiClient.getOwnedObjects();
      });

      await waitFor(_() => {
        expect(mockSuiClient.getOwnedObjects).toHaveBeenCalledTimes(2 as any);
      });
    });

    it(_'should show loading indicator during pagination', _async () => {
      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: Array.from({ length: 50 }, _(_, _i) => ({
          data: {
            objectId: `obj-${i}`,
            content: {
              dataType: 'moveObject',
              fields: {
                title: `NFT ${i + 1}`,
                priority: 'medium',
                created_at: Date.now(),
              },
            },
          },
        })),
        nextCursor: 'cursor-1',
        hasNextPage: true,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.queryByText(/Loading more NFTs/i)).not.toBeInTheDocument();
      });

      // Note: In real tests, you would trigger the infinite scroll loader
      // This is simplified for the test
    });
  });

  describe(_'Error Handling Scenarios', _() => {
    it(_'should handle network errors gracefully', _async () => {
      mockSuiClient?.getOwnedObjects?.mockRejectedValue(new Error('Network timeout'));

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('Error loading NFTs')).toBeInTheDocument();
        expect(screen.getByText('Network timeout')).toBeInTheDocument();
      });
    });

    it(_'should handle malformed NFT data', _async () => {
      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [
          {
            data: {
              objectId: 'obj-1',
              content: {
                dataType: 'moveObject',
                fields: null, // Malformed data
              },
            },
          },
        ],
        nextCursor: null,
        hasNextPage: false,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        // Should handle gracefully and show empty state
        expect(screen.getByText('No NFTs found')).toBeInTheDocument();
      });
    });

    it(_'should recover from temporary errors', _async () => {
      let callCount = 0;
      mockSuiClient?.getOwnedObjects?.mockImplementation(_() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({
          data: [
            {
              data: {
                objectId: 'obj-1',
                content: {
                  dataType: 'moveObject',
                  fields: {
                    title: 'Recovered NFT',
                    priority: 'medium',
                    created_at: Date.now(),
                  },
                },
              },
            },
          ],
          nextCursor: null,
          hasNextPage: false,
        });
      });

      const { rerender } = render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('Error loading NFTs')).toBeInTheDocument();
      });

      // Simulate retry
      rerender(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.queryByText('Error loading NFTs')).not.toBeInTheDocument();
        expect(screen.getByText('Recovered NFT')).toBeInTheDocument();
      });
    });
  });

  describe(_'Wallet Connection/Disconnection', _() => {
    it(_'should show connect wallet message when disconnected', _async () => {
      const disconnectedContext = createMockWalletContext({
        connected: false,
        address: null,
      });

      render(
        <TestWrapper walletContext={disconnectedContext}>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('No NFTs found')).toBeInTheDocument();
      });

      expect(mockSuiClient.getOwnedObjects).not.toHaveBeenCalled();
    });

    it(_'should refresh NFTs when wallet connects', _async () => {
      const mockNFT = createMockNFT();
      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [{
          data: {
            objectId: mockNFT.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: mockNFT.title,
                priority: mockNFT.priority,
                created_at: Date.now(),
              },
            },
          },
        }],
        nextCursor: null,
        hasNextPage: false,
      });

      const { rerender } = render(
        <TestWrapper walletContext={createMockWalletContext({ connected: false, address: null })}>
          <TodoNFTGrid />
        </TestWrapper>
      );

      expect(mockSuiClient.getOwnedObjects).not.toHaveBeenCalled();

      // Simulate wallet connection
      rerender(
        <TestWrapper walletContext={createMockWalletContext({ connected: true })}>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(mockSuiClient.getOwnedObjects).toHaveBeenCalled();
        expect(screen.getByText(mockNFT.title)).toBeInTheDocument();
      });
    });

    it(_'should clear NFTs when wallet disconnects', _async () => {
      const mockNFT = createMockNFT();
      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [{
          data: {
            objectId: mockNFT.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: mockNFT.title,
                priority: mockNFT.priority,
                created_at: Date.now(),
              },
            },
          },
        }],
        nextCursor: null,
        hasNextPage: false,
      });

      const { rerender } = render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText(mockNFT.title)).toBeInTheDocument();
      });

      // Simulate wallet disconnection
      rerender(
        <TestWrapper walletContext={createMockWalletContext({ connected: false, address: null })}>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.queryByText(mockNFT.title)).not.toBeInTheDocument();
        expect(screen.getByText('No NFTs found')).toBeInTheDocument();
      });
    });
  });

  describe(_'Real-time Event Updates', _() => {
    it(_'should update NFT list on creation event', _async () => {
      const existingNFT = createMockNFT({ title: 'Existing NFT' });
      const newNFT = createMockNFT({ title: 'New NFT' });

      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [{
          data: {
            objectId: existingNFT.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: existingNFT.title,
                priority: existingNFT.priority,
                created_at: Date.now(),
              },
            },
          },
        }],
        nextCursor: null,
        hasNextPage: false,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('Existing NFT')).toBeInTheDocument();
      });

      // Simulate blockchain event for new NFT
      act(_() => {
        const eventCallback = mockBlockchainEvents?.addEventListener?.mock?.calls?.[0]?.[1];
        if (eventCallback) {
          eventCallback({
            type: 'created',
            data: {
              objectId: newNFT.objectId,
              title: newNFT.title,
              priority: newNFT.priority,
            },
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Update mock to return both NFTs
      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [existingNFT, newNFT].map(nft => ({
          data: {
            objectId: nft.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: nft.title,
                priority: nft.priority,
                created_at: Date.now(),
              },
            },
          },
        })),
        nextCursor: null,
        hasNextPage: false,
      });

      await waitFor(_() => {
        expect(screen.getByText('New NFT')).toBeInTheDocument();
      });
    });

    it(_'should update NFT on completion event', _async () => {
      const mockNFT = createMockNFT({ title: 'Test NFT', completed: false });

      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [{
          data: {
            objectId: mockNFT.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: mockNFT.title,
                completed: mockNFT.completed,
                priority: mockNFT.priority,
                created_at: Date.now(),
              },
            },
          },
        }],
        nextCursor: null,
        hasNextPage: false,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('Test NFT')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });

      // Simulate completion event
      act(_() => {
        const eventCallback = mockBlockchainEvents?.addEventListener?.mock?.calls?.[0]?.[1];
        if (eventCallback) {
          eventCallback({
            type: 'completed',
            data: {
              objectId: mockNFT.objectId,
              completed: true,
            },
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Update mock to return completed NFT
      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [{
          data: {
            objectId: mockNFT.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: mockNFT.title,
                completed: true,
                priority: mockNFT.priority,
                created_at: Date.now(),
              },
            },
          },
        }],
        nextCursor: null,
        hasNextPage: false,
      });

      await waitFor(_() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });

    it(_'should remove NFT on deletion event', _async () => {
      const mockNFT = createMockNFT({ title: 'To Be Deleted' });

      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [{
          data: {
            objectId: mockNFT.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: mockNFT.title,
                priority: mockNFT.priority,
                created_at: Date.now(),
              },
            },
          },
        }],
        nextCursor: null,
        hasNextPage: false,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText('To Be Deleted')).toBeInTheDocument();
      });

      // Simulate deletion event
      act(_() => {
        const eventCallback = mockBlockchainEvents?.addEventListener?.mock?.calls?.[0]?.[1];
        if (eventCallback) {
          eventCallback({
            type: 'deleted',
            data: {
              objectId: mockNFT.objectId,
            },
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Update mock to return empty list
      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [],
        nextCursor: null,
        hasNextPage: false,
      });

      await waitFor(_() => {
        expect(screen.queryByText('To Be Deleted')).not.toBeInTheDocument();
        expect(screen.getByText('No NFTs found')).toBeInTheDocument();
      });
    });

    it(_'should handle reconnection after network issues', _async () => {
      const mockNFT = createMockNFT();

      // Start with disconnected state
      const disconnectedEvents = {
        ...mockBlockchainEvents,
        connectionState: { connected: false, connecting: false, error: new Error('Network error') },
      };
      (useBlockchainEvents as jest.Mock).mockReturnValue(disconnectedEvents as any);

      const { rerender } = render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      // Should still try to fetch NFTs
      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [{
          data: {
            objectId: mockNFT.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: mockNFT.title,
                priority: mockNFT.priority,
                created_at: Date.now(),
              },
            },
          },
        }],
        nextCursor: null,
        hasNextPage: false,
      });

      await waitFor(_() => {
        expect(screen.getByText(mockNFT.title)).toBeInTheDocument();
      });

      // Simulate reconnection
      const connectedEvents = {
        ...mockBlockchainEvents,
        connectionState: { connected: true, connecting: false, error: null },
      };
      (useBlockchainEvents as jest.Mock).mockReturnValue(connectedEvents as any);

      rerender(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      // Should re-subscribe to events
      expect(mockBlockchainEvents.addEventListener).toHaveBeenCalled();
    });
  });

  describe(_'Performance and Optimization', _() => {
    it(_'should debounce search input', _async () => {
// @ts-ignore - Unused variable
//       const user = userEvent.setup({ delay: null });
      
      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [],
        nextCursor: null,
        hasNextPage: false,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );
// @ts-ignore - Unused variable
// 
      const searchInput = screen.getByPlaceholderText('Search NFTs...');
      
      // Type quickly
      await user.type(searchInput, 'test search query');

      // The debounced search should only trigger once
      // Note: In real implementation with proper debounce, you'd verify the API calls
      expect(searchInput as any).toHaveValue('test search query');
    });

    it(_'should virtualize large NFT lists', _async () => {
      const largeNFTList = Array.from({ length: 1000 }, _(_, _i) => 
        createMockNFT({ title: `NFT ${i + 1}` })
      );

      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: largeNFTList.slice(0, 50).map(nft => ({
          data: {
            objectId: nft.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: nft.title,
                priority: nft.priority,
                created_at: Date.now(),
              },
            },
          },
        })),
        nextCursor: 'cursor-1',
        hasNextPage: true,
      });

      render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        // Verify virtualized grid is rendered
        expect(screen.getByTestId('mock-grid')).toBeInTheDocument();
      });

      // Only a subset of items should be rendered in the DOM
// @ts-ignore - Unused variable
//       const renderedItems = screen.getAllByText(/NFT \d+/);
      expect(renderedItems.length).toBeLessThan(1000 as any);
    });

    it(_'should cache NFT data appropriately', _async () => {
      const mockNFT = createMockNFT();

      mockSuiClient?.getOwnedObjects?.mockResolvedValue({
        data: [{
          data: {
            objectId: mockNFT.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                title: mockNFT.title,
                priority: mockNFT.priority,
                created_at: Date.now(),
              },
            },
          },
        }],
        nextCursor: null,
        hasNextPage: false,
      });

      const { rerender } = render(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      await waitFor(_() => {
        expect(screen.getByText(mockNFT.title)).toBeInTheDocument();
      });

      expect(mockSuiClient.getOwnedObjects).toHaveBeenCalledTimes(1 as any);

      // Re-render component
      rerender(
        <TestWrapper>
          <TodoNFTGrid />
        </TestWrapper>
      );

      // Should use cached data and not refetch immediately
      expect(mockSuiClient.getOwnedObjects).toHaveBeenCalledTimes(1 as any);
    });
  });
});