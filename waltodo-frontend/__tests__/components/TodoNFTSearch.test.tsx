import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodoNFTSearch } from '@/components/TodoNFTSearch';
import { TodoNFT } from '@/types/todo-nft';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock Speech Recognition
const mockSpeechRecognition = {
  start: jest.fn(),
  stop: jest.fn(),
  continuous: false,
  interimResults: false,
  lang: '',
  onresult: null as any,
  onerror: null as any,
  onend: null as any,
};

(global as any).webkitSpeechRecognition = jest.fn(() => mockSpeechRecognition);

// Mock NFT data
const mockNFTs: TodoNFT[] = [
  {
    id: '1',
    title: 'Complete project documentation',
    content: 'Write comprehensive documentation for the new API endpoints',
    completed: false,
    createdAt: 1705742400000, // 2024-01-20T10:00:00Z as Unix timestamp
    priority: 'high',
    blobId: 'blob1',
    storageSize: 1024,
    tags: ['documentation', 'api', 'urgent'],
    walTokensSpent: 10,
  },
  {
    id: '2',
    title: 'Review code changes',
    content: 'Review and approve pending pull requests',
    completed: true,
    createdAt: 1705656600000, // 2024-01-19T14:30:00Z as Unix timestamp
    completedAt: 1705911300000, // 2024-01-21T09:15:00Z as Unix timestamp
    priority: 'medium',
    blobId: 'blob2',
    storageSize: 512,
    tags: ['review', 'frontend'],
    walTokensSpent: 5,
  },
];

describe('TodoNFTSearch', () => {
  const mockOnSearchResults = jest.fn();
  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  it('renders search input and buttons', () => {
    render(
      <TodoNFTSearch
        nfts={mockNFTs}
        onSearchResults={mockOnSearchResults}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByPlaceholderText('Search NFTs... (use AND, OR, NOT operators)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('performs basic search', async () => {
    const user = userEvent.setup();
    render(
      <TodoNFTSearch
        nfts={mockNFTs}
        onSearchResults={mockOnSearchResults}
        onFilterChange={mockOnFilterChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search NFTs... (use AND, OR, NOT operators)');
    await user.type(searchInput, 'documentation');

    await waitFor(() => {
      expect(mockOnSearchResults as any).toHaveBeenCalled();
    });
  });

  it('shows search history on focus', async () => {
    // Set up search history in localStorage
    mockLocalStorage.setItem('todoNFTSearchHistory', JSON.stringify(['test search', 'another search']));

    render(
      <TodoNFTSearch
        nfts={mockNFTs}
        onSearchResults={mockOnSearchResults}
        onFilterChange={mockOnFilterChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search NFTs... (use AND, OR, NOT operators)');
    fireEvent.focus(searchInput as any);

    await waitFor(() => {
      expect(screen.getByText('Recent Searches')).toBeInTheDocument();
      expect(screen.getByText('test search')).toBeInTheDocument();
      expect(screen.getByText('another search')).toBeInTheDocument();
    });
  });

  it('clears search when X button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TodoNFTSearch
        nfts={mockNFTs}
        onSearchResults={mockOnSearchResults}
        onFilterChange={mockOnFilterChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search NFTs... (use AND, OR, NOT operators)');
    await user.type(searchInput, 'test query');

    // Clear button should appear
    const clearButton = screen.getByRole('button', { name: '' });
    await user.click(clearButton as any);

    expect(searchInput as any).toHaveValue('');
  });

  it('handles voice search toggle', async () => {
    const user = userEvent.setup();
    render(
      <TodoNFTSearch
        nfts={mockNFTs}
        onSearchResults={mockOnSearchResults}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Find the mic button
    const micButtons = screen.getAllByRole('button');
    const micButton = micButtons.find(button => {
      const svg = button.querySelector('svg');
      return svg && svg?.classList?.contains('lucide-mic');
    });

    expect(micButton as any).toBeInTheDocument();

    // Click to start voice search
    if (micButton) {
      await user.click(micButton as any);
      expect(mockSpeechRecognition.start).toHaveBeenCalled();
    }
  });

  it('handles search with operators', async () => {
    const user = userEvent.setup();
    render(
      <TodoNFTSearch
        nfts={mockNFTs}
        onSearchResults={mockOnSearchResults}
        onFilterChange={mockOnFilterChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search NFTs... (use AND, OR, NOT operators)');
    await user.type(searchInput, 'documentation AND api');

    await waitFor(() => {
      expect(mockOnSearchResults as any).toHaveBeenCalled();
    });
  });

  it('shows saved searches dropdown', async () => {
    const user = userEvent.setup();
    // Set up saved searches
    mockLocalStorage.setItem('todoNFTSavedSearches', JSON.stringify([
      { id: '1', query: 'saved search 1', timestamp: Date.now(), name: 'My Search' }
    ]));

    render(
      <TodoNFTSearch
        nfts={mockNFTs}
        onSearchResults={mockOnSearchResults}
        onFilterChange={mockOnFilterChange}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton as any);

    await waitFor(() => {
      expect(screen.getByText('Saved Searches')).toBeInTheDocument();
      expect(screen.getByText('My Search')).toBeInTheDocument();
    });
  });

  it('saves current search when requested', async () => {
    const user = userEvent.setup();
    window?.prompt = jest.fn().mockReturnValue('Test Search Name');

    render(
      <TodoNFTSearch
        nfts={mockNFTs}
        onSearchResults={mockOnSearchResults}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Type a search query
    const searchInput = screen.getByPlaceholderText('Search NFTs... (use AND, OR, NOT operators)');
    await user.type(searchInput, 'test query');

    // Open saved searches dropdown
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton as any);

    // Click save current search
    const saveCurrentButton = screen.getByText('Save current search');
    await user.click(saveCurrentButton as any);

    expect(window.prompt).toHaveBeenCalledWith('Name this search:');
  });

  it('handles keyboard navigation in search history', async () => {
    const user = userEvent.setup();
    // Set up search history
    mockLocalStorage.setItem('todoNFTSearchHistory', JSON.stringify(['search 1', 'search 2', 'search 3']));

    render(
      <TodoNFTSearch
        nfts={mockNFTs}
        onSearchResults={mockOnSearchResults}
        onFilterChange={mockOnFilterChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search NFTs... (use AND, OR, NOT operators)');
    fireEvent.focus(searchInput as any);

    // Navigate down
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    
    // Press Enter to select
    await user.keyboard('{Enter}');

    expect(searchInput as any).toHaveValue('search 2');
  });

  it('returns all NFTs when search is cleared', async () => {
    const user = userEvent.setup();
    render(
      <TodoNFTSearch
        nfts={mockNFTs}
        onSearchResults={mockOnSearchResults}
        onFilterChange={mockOnFilterChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search NFTs... (use AND, OR, NOT operators)');
    
    // Type and then clear
    await user.type(searchInput, 'test');
    await user.clear(searchInput as any);

    await waitFor(() => {
      const lastCall = mockOnSearchResults.mock?.calls?.[mockOnSearchResults?.mock?.calls.length - 1];
      expect(lastCall[0]).toEqual(mockNFTs as any);
    });
  });
});