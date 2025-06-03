'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon, Filter as FunnelIcon, X as XMarkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useMounted, useSafeLocalStorage } from './SSRSafe';

export interface TodoNFTFilter {
  ownerAddress?: string;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  storageSizeRange?: {
    min?: number;
    max?: number;
  };
  tags?: string[];
  priorities?: ('low' | 'medium' | 'high')[];
  preset?: 'my-nfts' | 'recent' | 'large-files' | 'high-priority' | null;
}

interface FilterPreset {
  id: 'my-nfts' | 'recent' | 'large-files' | 'high-priority';
  name: string;
  description: string;
  apply: (currentAddress?: string) => Partial<TodoNFTFilter>;
}

interface TodoNFTFiltersProps {
  onFilterChange: (filters: TodoNFTFilter) => void;
  currentUserAddress?: string;
  availableTags?: string[];
  className?: string;
}

const STORAGE_KEY = 'todo-nft-filters';

const filterPresets: FilterPreset[] = [
  {
    id: 'my-nfts',
    name: 'My NFTs',
    description: 'Show only NFTs you own',
    apply: (address) => ({ ownerAddress: address, preset: 'my-nfts' })
  },
  {
    id: 'recent',
    name: 'Recent',
    description: 'Created in the last 7 days',
    apply: () => ({
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      preset: 'recent'
    })
  },
  {
    id: 'large-files',
    name: 'Large Files',
    description: 'Storage size > 1MB',
    apply: () => ({
      storageSizeRange: { min: 1048576 }, // 1MB in bytes
      preset: 'large-files'
    })
  },
  {
    id: 'high-priority',
    name: 'High Priority',
    description: 'Only high priority items',
    apply: () => ({
      priorities: ['high'],
      preset: 'high-priority'
    })
  }
];

export default function TodoNFTFilters({
  onFilterChange,
  currentUserAddress,
  availableTags = [],
  className = ''
}: TodoNFTFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<TodoNFTFilter>({});
  const [ownerInput, setOwnerInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minSize, setMinSize] = useState('');
  const [maxSize, setMaxSize] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<('low' | 'medium' | 'high')[]>([]);

  const [savedFilters, setSavedFilters, isStorageLoaded] = useSafeLocalStorage<TodoNFTFilter>(STORAGE_KEY, {});
  const mounted = useMounted();

  // Load saved filters on mount
  useEffect(() => {
    if (mounted && isStorageLoaded && Object.keys(savedFilters).length > 0) {
      try {
        // Restore dates if present
        if (savedFilters.dateRange) {
          if (savedFilters.dateRange.start) {
            const startDate = new Date(savedFilters.dateRange.start);
            setStartDate(format(startDate, 'yyyy-MM-dd'));
          }
          if (savedFilters.dateRange.end) {
            const endDate = new Date(savedFilters.dateRange.end);
            setEndDate(format(endDate, 'yyyy-MM-dd'));
          }
        }
        // Restore other fields
        if (savedFilters.ownerAddress) {setOwnerInput(savedFilters.ownerAddress);}
        if (savedFilters.storageSizeRange) {
          if (savedFilters.storageSizeRange.min) {setMinSize(String(savedFilters.storageSizeRange.min));}
          if (savedFilters.storageSizeRange.max) {setMaxSize(String(savedFilters.storageSizeRange.max));}
        }
        if (savedFilters.tags) {setSelectedTags(savedFilters.tags);}
        if (savedFilters.priorities) {setSelectedPriorities(savedFilters.priorities);}
        
        setFilters(savedFilters);
      } catch (error) {
        console.error('Failed to load saved filters:', error);
      }
    }
  }, [mounted, isStorageLoaded, savedFilters]);

  // Save filters to localStorage and notify parent
  useEffect(() => {
    if (mounted && isStorageLoaded) {
      setSavedFilters(filters);
    }
    onFilterChange(filters);
  }, [filters, onFilterChange, mounted, isStorageLoaded, setSavedFilters]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.ownerAddress) {count++;}
    if (filters.dateRange?.start || filters.dateRange?.end) {count++;}
    if (filters.storageSizeRange?.min || filters.storageSizeRange?.max) {count++;}
    if (filters.tags && filters.tags.length > 0) {count++;}
    if (filters.priorities && filters.priorities.length > 0) {count++;}
    return count;
  }, [filters]);

  const updateFilters = (updates: Partial<TodoNFTFilter>) => {
    setFilters(prev => ({ ...prev, ...updates, preset: null }));
  };

  const applyPreset = (preset: FilterPreset) => {
    const presetFilters = preset.apply(currentUserAddress);
    setFilters(presetFilters);
    
    // Update input fields
    setOwnerInput(presetFilters.ownerAddress || '');
    setStartDate(presetFilters.dateRange?.start ? format(presetFilters.dateRange.start, 'yyyy-MM-dd') : '');
    setEndDate(presetFilters.dateRange?.end ? format(presetFilters.dateRange.end, 'yyyy-MM-dd') : '');
    setMinSize(presetFilters.storageSizeRange?.min ? String(presetFilters.storageSizeRange.min) : '');
    setMaxSize(presetFilters.storageSizeRange?.max ? String(presetFilters.storageSizeRange.max) : '');
    setSelectedTags(presetFilters.tags || []);
    setSelectedPriorities(presetFilters.priorities || []);
  };

  const clearAllFilters = () => {
    setFilters({});
    setOwnerInput('');
    setStartDate('');
    setEndDate('');
    setMinSize('');
    setMaxSize('');
    setSelectedTags([]);
    setSelectedPriorities([]);
  };

  const handleOwnerChange = (value: string) => {
    setOwnerInput(value);
    updateFilters({ ownerAddress: value || undefined });
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
      updateFilters({
        dateRange: {
          ...filters.dateRange,
          start: value ? new Date(value) : undefined
        }
      });
    } else {
      setEndDate(value);
      updateFilters({
        dateRange: {
          ...filters.dateRange,
          end: value ? new Date(value) : undefined
        }
      });
    }
  };

  const handleSizeChange = (type: 'min' | 'max', value: string) => {
    const numValue = value ? parseInt(value, 10) : undefined;
    if (type === 'min') {
      setMinSize(value);
      updateFilters({
        storageSizeRange: {
          ...filters.storageSizeRange,
          min: numValue
        }
      });
    } else {
      setMaxSize(value);
      updateFilters({
        storageSizeRange: {
          ...filters.storageSizeRange,
          max: numValue
        }
      });
    }
  };

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
    updateFilters({ tags: newTags.length > 0 ? newTags : undefined });
  };

  const handlePriorityToggle = (priority: 'low' | 'medium' | 'high') => {
    const newPriorities = selectedPriorities.includes(priority)
      ? selectedPriorities.filter(p => p !== priority)
      : [...selectedPriorities, priority];
    setSelectedPriorities(newPriorities);
    updateFilters({ priorities: newPriorities.length > 0 ? newPriorities : undefined });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) {return '0 Bytes';}
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
          {/* Filter Presets */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Filters</h3>
            <div className="grid grid-cols-2 gap-2">
              {filterPresets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    filters.preset === preset.id
                      ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Owner Address Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Owner Address
            </label>
            <input
              type="text"
              value={ownerInput}
              onChange={(e) => handleOwnerChange(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Storage Size Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Storage Size (Bytes)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={minSize}
                onChange={(e) => handleSizeChange('min', e.target.value)}
                placeholder="Min"
                min="0"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <input
                type="number"
                value={maxSize}
                onChange={(e) => handleSizeChange('max', e.target.value)}
                placeholder="Max"
                min="0"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            {(minSize || maxSize) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {minSize && `Min: ${formatBytes(parseInt(minSize))}`}
                {minSize && maxSize && ' - '}
                {maxSize && `Max: ${formatBytes(parseInt(maxSize))}`}
              </p>
            )}
          </div>

          {/* Tags Filter */}
          {availableTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Priority Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <div className="flex gap-3">
              {(['low', 'medium', 'high'] as const).map(priority => (
                <label key={priority} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedPriorities.includes(priority)}
                    onChange={() => handlePriorityToggle(priority)}
                    className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {priority}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Clear Filters Button */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <XMarkIcon className="h-4 w-4" />
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}