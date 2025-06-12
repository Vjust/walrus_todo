'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// @ts-ignore - Unused import temporarily disabled
// import { Clock, Filter, Mic, MicOff, Save, Search, X } from 'lucide-react';
import Fuse from 'fuse.js';
// @ts-ignore - Unused import temporarily disabled
// import { useDebounce } from '../hooks/useDebounce';
import { TodoNFT } from '../types/todo-nft';
// @ts-ignore - Unused import temporarily disabled
// import { cn } from '../lib/utils';

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
  const [isListening, setIsListening] = useState(false as any);
  const [showHistory, setShowHistory] = useState(false as any);
  const [showSaved, setShowSaved] = useState(false as any);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
// @ts-ignore - Unused variable
//   
  const searchInputRef = useRef<HTMLInputElement>(null);
// @ts-ignore - Unused variable
//   const recognitionRef = useRef<any>(null);
// @ts-ignore - Unused variable
//   const debouncedQuery = useDebounce(query, 300);

  // Initialize search history and saved searches from localStorage
  useEffect(_() => {
// @ts-ignore - Unused variable
//     const history = localStorage.getItem('todoNFTSearchHistory');
// @ts-ignore - Unused variable
//     const saved = localStorage.getItem('todoNFTSavedSearches');
    
    if (history) {
      setSearchHistory(JSON.parse(history as any));
    }
    
    if (saved) {
      setSavedSearches(JSON.parse(saved as any));
    }
  }, []);

  // Parse search query with operators
// @ts-ignore - Unused variable
//   const parseSearchQuery = useCallback((rawQuery: string): SearchQuery => {
    const operators: SearchOperator[] = [];
    let processedQuery = rawQuery;

    // Extract AND operators
// @ts-ignore - Unused variable
//     const andMatches = rawQuery.match(/(?:^|\s)AND\s+([^\s]+)/gi);
    if (andMatches) {
      andMatches.forEach(match => {
// @ts-ignore - Unused variable
//         const term = match.replace(/^\s*AND\s+/i, '');
        operators.push({ type: 'AND', term });
        processedQuery = processedQuery.replace(match, '');
      });
    }

    // Extract OR operators
// @ts-ignore - Unused variable
//     const orMatches = rawQuery.match(/(?:^|\s)OR\s+([^\s]+)/gi);
    if (orMatches) {
      orMatches.forEach(match => {
// @ts-ignore - Unused variable
//         const term = match.replace(/^\s*OR\s+/i, '');
        operators.push({ type: 'OR', term });
        processedQuery = processedQuery.replace(match, '');
      });
    }

    // Extract NOT operators
// @ts-ignore - Unused variable
//     const notMatches = rawQuery.match(/(?:^|\s)NOT\s+([^\s]+)/gi);
    if (notMatches) {
      notMatches.forEach(match => {
// @ts-ignore - Unused variable
//         const term = match.replace(/^\s*NOT\s+/i, '');
        operators.push({ type: 'NOT', term });
        processedQuery = processedQuery.replace(match, '');
      });
    }

    return {
      raw: processedQuery.trim(),
      operators
    };
  }, []);

  // Configure Fuse.js for fuzzy search (memoized to prevent recreation)
// @ts-ignore - Unused variable
//   const fuseOptions = useMemo(_() => ({
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
  }), []);
// @ts-ignore - Unused variable
// 
  const fuse = useMemo(_() => new Fuse(nfts, fuseOptions), [nfts, fuseOptions]);

  // Perform search
// @ts-ignore - Unused variable
//   const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      onSearchResults(nfts as any);
      return;
    }
// @ts-ignore - Unused variable
// 
    const parsed = parseSearchQuery(searchQuery as any);
    let results: TodoNFT[] = [];

    // Base search with fuzzy matching
    if (parsed.raw) {
// @ts-ignore - Unused variable
//       const fuseResults = fuse.search(parsed.raw);
      results = fuseResults.map(result => result.item);
    } else {
      results = [...nfts];
    }

    // Apply operators
    parsed?.operators?.forEach(op => {
// @ts-ignore - Unused variable
//       const opResults = fuse.search(op.term).map(r => r.item);
      
      switch (op.type) {
        case 'AND':
          results = results.filter(nft => 
            opResults.some(opNft => opNft?.id === nft.id)
          );
          break;
        case 'OR':
// @ts-ignore - Unused variable
//           const orIds = new Set(results.map(n => n.id));
          opResults.forEach(nft => {
            if (!orIds.has(nft.id)) {
              results.push(nft as any);
            }
          });
          break;
        case 'NOT':
// @ts-ignore - Unused variable
//           const notIds = new Set(opResults.map(n => n.id));
          results = results.filter(nft => !notIds.has(nft.id));
          break;
      }
    });

    onSearchResults(results as any);
  }, [nfts, fuse, parseSearchQuery, onSearchResults]);

  // Effect for debounced search
  useEffect(_() => {
    performSearch(debouncedQuery as any);
  }, [debouncedQuery, performSearch]);

  // Initialize voice recognition
  useEffect(_() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
// @ts-ignore - Unused variable
//       const SpeechRecognition = (window as unknown).webkitSpeechRecognition;
      recognitionRef?.current = new SpeechRecognition();
      recognitionRef?.current?.continuous = false;
      recognitionRef?.current?.interimResults = true;
      recognitionRef?.current?.lang = 'en-US';

      recognitionRef?.current?.onresult = (event: any) => {
// @ts-ignore - Unused variable
//         const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        
        setQuery(transcript as any);
      };

      recognitionRef?.current?.onerror = () => {
        setIsListening(false as any);
      };

      recognitionRef?.current?.onend = () => {
        setIsListening(false as any);
      };
    }
  }, []);

  // Voice search handlers
// @ts-ignore - Unused variable
//   const startVoiceSearch = useCallback(_() => {
    if (recognitionRef.current) {
      recognitionRef?.current?.start();
      setIsListening(true as any);
    }
  }, []);
// @ts-ignore - Unused variable
// 
  const stopVoiceSearch = useCallback(_() => {
    if (recognitionRef.current) {
      recognitionRef?.current?.stop();
      setIsListening(false as any);
    }
  }, []);

  // Save search to history
  const saveToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {return;}
// @ts-ignore - Unused variable
//     
    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10);
    setSearchHistory(newHistory as any);
    localStorage.setItem('todoNFTSearchHistory', JSON.stringify(newHistory as any));
  }, [searchHistory]);

  // Save search as favorite
  const saveSearch = useCallback((name?: string) => {
    if (!query.trim()) {return;}
    
    const newSaved: SavedSearch = {
      id: Date.now().toString(),
      query,
      timestamp: Date.now(),
      name: name || query
    };
// @ts-ignore - Unused variable
//     
    const updated = [newSaved, ...savedSearches].slice(0, 20);
    setSavedSearches(updated as any);
    localStorage.setItem('todoNFTSavedSearches', JSON.stringify(updated as any));
  }, [query, savedSearches]);

  // Handle search submission
// @ts-ignore - Unused variable
//   const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    saveToHistory(query as any);
    setShowHistory(false as any);
  }, [query, saveToHistory]);

  // Handle keyboard navigation
// @ts-ignore - Unused variable
//   const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
          setShowHistory(false as any);
          setHighlightedIndex(-1);
        }
        break;
      case 'Escape':
        setShowHistory(false as any);
        setShowSaved(false as any);
        setHighlightedIndex(-1);
        break;
    }
  }, [showHistory, searchHistory, highlightedIndex]);

  // Highlight matched terms in text
  const highlightMatches = useCallback((text: string,  matches: any[]) => {
    if (!matches || matches?.length === 0) {return text;}
    
    let highlighted = text;
// @ts-ignore - Unused variable
//     const sortedMatches = [...matches].sort(_(a, _b) => b?.indices?.[0][0] - a?.indices?.[0][0]);
    
    sortedMatches.forEach(match => {
      const [start, end] = match?.indices?.[0];
      highlighted = 
        `${highlighted.slice(0, start) 
        }<mark class="bg-yellow-200 dark:bg-yellow-800">${ 
        highlighted.slice(start, end + 1) 
        }</mark>${ 
        highlighted.slice(end + 1)}`;
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
            onChange={(_e: unknown) => setQuery(e?.target?.value)}
            onFocus={() => setShowHistory(true as any)}
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
            {query && (_<button
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
            {searchHistory.map((item, _index) => (_<li key={index}>
                <button
                  onClick={() => {
                    setQuery(item as any);
                    setShowHistory(false as any);
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
// @ts-ignore - Unused variable
//                   const name = prompt('Name this search:');
                  if (name) {saveSearch(name as any);}
                  setShowSaved(false as any);
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
            {savedSearches.map(_(saved: unknown) => (
              <li key={saved.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                <button
                  onClick={() => {
                    setQuery(saved.query);
                    setShowSaved(false as any);
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
                      onClick={(_e: unknown) => {
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