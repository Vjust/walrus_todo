'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, X, Mic, MicOff, Clock, Save, Filter } from 'lucide-react';
import Fuse from 'fuse.js';
import { useDebounce } from '../hooks/useDebounce';
import { TodoNFT } from '../types/todo-nft';
import { cn } from '../lib/utils';

interface SearchOperator {
  type: 'AND' | 'OR' | 'NOT';
  term: string;
}

interface SearchQuery {
  raw: string;
  operators: SearchOperator[];
}

interface SavedSearch {
  id: string;
  query: string;
  timestamp: number;
  name?: string;
}

interface TodoNFTSearchProps {
  nfts: TodoNFT[];
  onSearchResults: (results: TodoNFT[]) => void;
  onFilterChange?: (filters: any) => void;
  className?: string;
}

export function TodoNFTSearch({
  nfts,
  onSearchResults,
  onFilterChange,
  className
}: TodoNFTSearchProps) {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Initialize search history and saved searches from localStorage
  useEffect(() => {
    const history = localStorage.getItem('todoNFTSearchHistory');
    const saved = localStorage.getItem('todoNFTSavedSearches');
    
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
    
    if (saved) {
      setSavedSearches(JSON.parse(saved));
    }
  }, []);

  // Parse search query with operators
  const parseSearchQuery = useCallback((rawQuery: string): SearchQuery => {
    const operators: SearchOperator[] = [];
    let processedQuery = rawQuery;

    // Extract AND operators
    const andMatches = rawQuery.match(/(?:^|\s)AND\s+([^\s]+)/gi);
    if (andMatches) {
      andMatches.forEach(match => {
        const term = match.replace(/^\s*AND\s+/i, '');
        operators.push({ type: 'AND', term });
        processedQuery = processedQuery.replace(match, '');
      });
    }

    // Extract OR operators
    const orMatches = rawQuery.match(/(?:^|\s)OR\s+([^\s]+)/gi);
    if (orMatches) {
      orMatches.forEach(match => {
        const term = match.replace(/^\s*OR\s+/i, '');
        operators.push({ type: 'OR', term });
        processedQuery = processedQuery.replace(match, '');
      });
    }

    // Extract NOT operators
    const notMatches = rawQuery.match(/(?:^|\s)NOT\s+([^\s]+)/gi);
    if (notMatches) {
      notMatches.forEach(match => {
        const term = match.replace(/^\s*NOT\s+/i, '');
        operators.push({ type: 'NOT', term });
        processedQuery = processedQuery.replace(match, '');
      });
    }

    return {
      raw: processedQuery.trim(),
      operators
    };
  }, []);

  // Configure Fuse.js for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'title', weight: 0.4 },
      { name: 'description', weight: 0.3 },
      { name: 'metadata.tags', weight: 0.3 }
    ],
    threshold: 0.3,
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    useExtendedSearch: true
  };

  const fuse = useMemo(() => new Fuse(nfts, fuseOptions), [nfts]);

  // Perform search
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      onSearchResults(nfts);
      return;
    }

    const parsed = parseSearchQuery(searchQuery);
    let results: TodoNFT[] = [];

    // Base search with fuzzy matching
    if (parsed.raw) {
      const fuseResults = fuse.search(parsed.raw);
      results = fuseResults.map(result => result.item);
    } else {
      results = [...nfts];
    }

    // Apply operators
    parsed.operators.forEach(op => {
      const opResults = fuse.search(op.term).map(r => r.item);
      
      switch (op.type) {
        case 'AND':
          results = results.filter(nft => 
            opResults.some(opNft => opNft.id === nft.id)
          );
          break;
        case 'OR':
          const orIds = new Set(results.map(n => n.id));
          opResults.forEach(nft => {
            if (!orIds.has(nft.id)) {
              results.push(nft);
            }
          });
          break;
        case 'NOT':
          const notIds = new Set(opResults.map(n => n.id));
          results = results.filter(nft => !notIds.has(nft.id));
          break;
      }
    });

    onSearchResults(results);
  }, [nfts, fuse, parseSearchQuery, onSearchResults]);

  // Effect for debounced search
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  // Initialize voice recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        
        setQuery(transcript);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Voice search handlers
  const startVoiceSearch = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, []);

  const stopVoiceSearch = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  // Save search to history
  const saveToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('todoNFTSearchHistory', JSON.stringify(newHistory));
  }, [searchHistory]);

  // Save search as favorite
  const saveSearch = useCallback((name?: string) => {
    if (!query.trim()) return;
    
    const newSaved: SavedSearch = {
      id: Date.now().toString(),
      query: query,
      timestamp: Date.now(),
      name: name || query
    };
    
    const updated = [newSaved, ...savedSearches].slice(0, 20);
    setSavedSearches(updated);
    localStorage.setItem('todoNFTSavedSearches', JSON.stringify(updated));
  }, [query, savedSearches]);

  // Handle search submission
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    saveToHistory(query);
    setShowHistory(false);
  }, [query, saveToHistory]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const suggestions = showHistory ? searchHistory : [];
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > -1 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          e.preventDefault();
          setQuery(suggestions[highlightedIndex]);
          setShowHistory(false);
          setHighlightedIndex(-1);
        }
        break;
      case 'Escape':
        setShowHistory(false);
        setShowSaved(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [showHistory, searchHistory, highlightedIndex]);

  // Highlight matched terms in text
  const highlightMatches = useCallback((text: string, matches: any[]) => {
    if (!matches || matches.length === 0) return text;
    
    let highlighted = text;
    const sortedMatches = [...matches].sort((a, b) => b.indices[0][0] - a.indices[0][0]);
    
    sortedMatches.forEach(match => {
      const [start, end] = match.indices[0];
      highlighted = 
        highlighted.slice(0, start) +
        `<mark class="bg-yellow-200 dark:bg-yellow-800">` +
        highlighted.slice(start, end + 1) +
        '</mark>' +
        highlighted.slice(end + 1);
    });
    
    return highlighted;
  }, []);

  return (
    <div className={cn('relative w-full', className)}>
      <form onSubmit={handleSearch} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-5 w-5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowHistory(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search NFTs... (use AND, OR, NOT operators)"
            className="w-full pl-10 pr-24 py-2 border rounded-lg bg-white dark:bg-gray-800 
                     border-gray-300 dark:border-gray-600 focus:outline-none 
                     focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="absolute right-2 flex items-center gap-2">
            {/* Voice Search Button */}
            {recognitionRef.current && (
              <button
                type="button"
                onClick={isListening ? stopVoiceSearch : startVoiceSearch}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isListening 
                    ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400" 
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            )}
            
            {/* Save Search Button */}
            <button
              type="button"
              onClick={() => setShowSaved(!showSaved)}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Save className="h-4 w-4" />
            </button>
            
            {/* Clear Button */}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Search History Dropdown */}
      {showHistory && searchHistory.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 
                      border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Searches
            </h3>
          </div>
          <ul className="max-h-60 overflow-auto">
            {searchHistory.map((item, index) => (
              <li key={index}>
                <button
                  onClick={() => {
                    setQuery(item);
                    setShowHistory(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                    highlightedIndex === index && "bg-gray-100 dark:bg-gray-700"
                  )}
                >
                  <span className="text-sm">{item}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Saved Searches Dropdown */}
      {showSaved && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 
                      border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Saved Searches
            </h3>
            {query && (
              <button
                onClick={() => {
                  const name = prompt('Name this search:');
                  if (name) saveSearch(name);
                  setShowSaved(false);
                }}
                className="w-full text-left px-3 py-2 bg-blue-50 dark:bg-blue-900/20 
                         text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 
                         dark:hover:bg-blue-900/30 transition-colors text-sm"
              >
                Save current search
              </button>
            )}
          </div>
          <ul className="max-h-60 overflow-auto">
            {savedSearches.map((saved) => (
              <li key={saved.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                <button
                  onClick={() => {
                    setQuery(saved.query);
                    setShowSaved(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 
                           dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{saved.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {saved.query}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSavedSearches(prev => prev.filter(s => s.id !== saved.id));
                        localStorage.setItem(
                          'todoNFTSavedSearches',
                          JSON.stringify(savedSearches.filter(s => s.id !== saved.id))
                        );
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Search Tips */}
      {query && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <p>Tips: Use "AND", "OR", "NOT" for advanced search. Example: "todo AND urgent NOT completed"</p>
        </div>
      )}
    </div>
  );
}