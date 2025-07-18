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
    description: 'Review and approve pending pull requests',
    completed: true,
    createdAt: '2024-01-19T14:30:00Z',
    updatedAt: '2024-01-21T09:15:00Z',
    owner: '0xowner1',
    metadata: {
      tags: ['review', 'frontend'],
      priority: 'medium',
      category: 'Development'
    },
    imageUrl: 'https://via.placeholder.com/150',
    walrusUrl: ''
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
      expect(mockOnSearchResults).toHaveBeenCalled();
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
    fireEvent.focus(searchInput);

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
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
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
      return svg && svg.classList.contains('lucide-mic');
    });

    expect(micButton).toBeInTheDocument();

    // Click to start voice search
    if (micButton) {
      await user.click(micButton);
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
      expect(mockOnSearchResults).toHaveBeenCalled();
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
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Saved Searches')).toBeInTheDocument();
      expect(screen.getByText('My Search')).toBeInTheDocument();
    });
  });

  it('saves current search when requested', async () => {
    const user = userEvent.setup();
    window.prompt = jest.fn().mockReturnValue('Test Search Name');

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
    await user.click(saveButton);

    // Click save current search
    const saveCurrentButton = screen.getByText('Save current search');
    await user.click(saveCurrentButton);

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
    fireEvent.focus(searchInput);

    // Navigate down
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    
    // Press Enter to select
    await user.keyboard('{Enter}');

    expect(searchInput).toHaveValue('search 2');
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
    await user.clear(searchInput);

    await waitFor(() => {
      const lastCall = mockOnSearchResults.mock.calls[mockOnSearchResults.mock.calls.length - 1];
      expect(lastCall[0]).toEqual(mockNFTs);
    });
  });
});