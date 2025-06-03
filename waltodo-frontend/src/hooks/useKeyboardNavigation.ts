/**
 * Keyboard navigation hook for accessible component interaction
 * Supports grid navigation, list navigation, and custom keyboard shortcuts
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  KeyboardKeys,
  isActionKey,
  isNavigationKey,
  announceToScreenReader,
  debounceAnnouncement
} from '@/lib/accessibility-utils';

export interface NavigationConfig {
  /** Enable arrow key navigation */
  enableArrowKeys?: boolean;
  /** Enable home/end navigation */
  enableHomeEnd?: boolean;
  /** Enable page up/down navigation */
  enablePageNavigation?: boolean;
  /** Wrap navigation at boundaries */
  wrap?: boolean;
  /** Orientation for navigation */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /** Custom key handlers */
  customHandlers?: Record<string, (event: KeyboardEvent) => void>;
  /** Announce navigation changes */
  announceChanges?: boolean;
  /** Role for screen reader context */
  role?: string;
}

export interface GridNavigationConfig extends NavigationConfig {
  /** Number of columns in grid */
  columns: number;
  /** Total number of items */
  totalItems: number;
}

export interface ListNavigationConfig extends NavigationConfig {
  /** Total number of items */
  totalItems: number;
  /** Enable type-ahead search */
  enableTypeAhead?: boolean;
}

/**
 * Hook for managing keyboard navigation in grid layouts
 */
export const useGridNavigation = (config: GridNavigationConfig) => {
  const {
    columns,
    totalItems,
    enableArrowKeys = true,
    enableHomeEnd = true,
    wrap = false,
    announceChanges = true,
    role = 'grid',
    customHandlers = {},
  } = config;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const containerRef = useRef<HTMLElement>(null);

  // Calculate row and column from index
  const updatePosition = useCallback((index: number) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    setCurrentIndex(index);
    setCurrentRow(row);
    setCurrentCol(col);
    
    if (announceChanges) {
      const totalRows = Math.ceil(totalItems / columns);
      debounceAnnouncement(
        `Item ${index + 1} of ${totalItems}, row ${row + 1} of ${totalRows}, column ${col + 1} of ${columns}`,
        'low'
      );
    }
  }, [columns, totalItems, announceChanges]);

  // Navigate to specific index
  const navigateToIndex = useCallback((index: number) => {
    if (index < 0 || index >= totalItems) {
      if (!wrap) return false;
      index = index < 0 ? totalItems - 1 : 0;
    }
    updatePosition(index);
    return true;
  }, [totalItems, wrap, updatePosition]);

  // Navigation handlers
  const navigateUp = useCallback(() => {
    const newIndex = currentIndex - columns;
    if (newIndex >= 0) {
      navigateToIndex(newIndex);
    } else if (wrap) {
      // Wrap to bottom of same column
      const bottomRowStart = Math.floor((totalItems - 1) / columns) * columns;
      const targetIndex = bottomRowStart + currentCol;
      navigateToIndex(Math.min(targetIndex, totalItems - 1));
    }
  }, [currentIndex, currentCol, columns, totalItems, wrap, navigateToIndex]);

  const navigateDown = useCallback(() => {
    const newIndex = currentIndex + columns;
    if (newIndex < totalItems) {
      navigateToIndex(newIndex);
    } else if (wrap) {
      // Wrap to top of same column
      navigateToIndex(currentCol);
    }
  }, [currentIndex, currentCol, columns, totalItems, wrap, navigateToIndex]);

  const navigateLeft = useCallback(() => {
    const newIndex = currentIndex - 1;
    if (currentCol > 0) {
      navigateToIndex(newIndex);
    } else if (wrap) {
      // Wrap to end of previous row or last item
      const targetIndex = currentRow > 0 
        ? Math.min(currentIndex + columns - 1, (currentRow * columns) + columns - 1)
        : totalItems - 1;
      navigateToIndex(targetIndex);
    }
  }, [currentIndex, currentCol, currentRow, columns, totalItems, wrap, navigateToIndex]);

  const navigateRight = useCallback(() => {
    const newIndex = currentIndex + 1;
    const maxColInRow = Math.min(columns - 1, totalItems - (currentRow * columns) - 1);
    
    if (currentCol < maxColInRow) {
      navigateToIndex(newIndex);
    } else if (wrap) {
      // Wrap to start of next row or first item
      const targetIndex = newIndex < totalItems ? (currentRow + 1) * columns : 0;
      navigateToIndex(targetIndex);
    }
  }, [currentIndex, currentCol, currentRow, columns, totalItems, wrap, navigateToIndex]);

  const navigateHome = useCallback(() => {
    navigateToIndex(0);
  }, [navigateToIndex]);

  const navigateEnd = useCallback(() => {
    navigateToIndex(totalItems - 1);
  }, [navigateToIndex, totalItems]);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Handle custom key handlers first
    if (customHandlers[event.key]) {
      customHandlers[event.key](event);
      return;
    }

    if (!enableArrowKeys && isNavigationKey(event.key)) return;

    let handled = false;

    switch (event.key) {
      case KeyboardKeys.ARROW_UP:
        event.preventDefault();
        navigateUp();
        handled = true;
        break;
      case KeyboardKeys.ARROW_DOWN:
        event.preventDefault();
        navigateDown();
        handled = true;
        break;
      case KeyboardKeys.ARROW_LEFT:
        event.preventDefault();
        navigateLeft();
        handled = true;
        break;
      case KeyboardKeys.ARROW_RIGHT:
        event.preventDefault();
        navigateRight();
        handled = true;
        break;
      case KeyboardKeys.HOME:
        if (enableHomeEnd) {
          event.preventDefault();
          navigateHome();
          handled = true;
        }
        break;
      case KeyboardKeys.END:
        if (enableHomeEnd) {
          event.preventDefault();
          navigateEnd();
          handled = true;
        }
        break;
    }

    if (handled && announceChanges) {
      // Announce the navigation context
      debounceAnnouncement(`Navigating ${role}`, 'low');
    }
  }, [
    customHandlers,
    enableArrowKeys,
    enableHomeEnd,
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    navigateHome,
    navigateEnd,
    announceChanges,
    role,
  ]);

  // Set up keyboard event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    currentIndex,
    currentRow,
    currentCol,
    navigateToIndex,
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    navigateHome,
    navigateEnd,
    containerRef,
    handleKeyDown,
  };
};

/**
 * Hook for managing keyboard navigation in list layouts
 */
export const useListNavigation = (config: ListNavigationConfig) => {
  const {
    totalItems,
    enableArrowKeys = true,
    enableHomeEnd = true,
    enablePageNavigation = true,
    enableTypeAhead = true,
    wrap = false,
    announceChanges = true,
    role = 'listbox',
    customHandlers = {},
  } = config;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [typeAheadQuery, setTypeAheadQuery] = useState('');
  const typeAheadTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLElement>(null);

  // Navigate to specific index
  const navigateToIndex = useCallback((index: number) => {
    if (index < 0 || index >= totalItems) {
      if (!wrap) return false;
      index = index < 0 ? totalItems - 1 : 0;
    }
    
    setCurrentIndex(index);
    
    if (announceChanges) {
      debounceAnnouncement(
        `Item ${index + 1} of ${totalItems}`,
        'low'
      );
    }
    
    return true;
  }, [totalItems, wrap, announceChanges]);

  // Navigation handlers
  const navigateUp = useCallback(() => {
    const newIndex = currentIndex - 1;
    if (newIndex >= 0) {
      navigateToIndex(newIndex);
    } else if (wrap) {
      navigateToIndex(totalItems - 1);
    }
  }, [currentIndex, totalItems, wrap, navigateToIndex]);

  const navigateDown = useCallback(() => {
    const newIndex = currentIndex + 1;
    if (newIndex < totalItems) {
      navigateToIndex(newIndex);
    } else if (wrap) {
      navigateToIndex(0);
    }
  }, [currentIndex, totalItems, wrap, navigateToIndex]);

  const navigateHome = useCallback(() => {
    navigateToIndex(0);
  }, [navigateToIndex]);

  const navigateEnd = useCallback(() => {
    navigateToIndex(totalItems - 1);
  }, [navigateToIndex, totalItems]);

  const navigatePageUp = useCallback(() => {
    const pageSize = 10; // Configurable page size
    const newIndex = Math.max(0, currentIndex - pageSize);
    navigateToIndex(newIndex);
  }, [currentIndex, navigateToIndex]);

  const navigatePageDown = useCallback(() => {
    const pageSize = 10; // Configurable page size
    const newIndex = Math.min(totalItems - 1, currentIndex + pageSize);
    navigateToIndex(newIndex);
  }, [currentIndex, totalItems, navigateToIndex]);

  // Type-ahead search
  const handleTypeAhead = useCallback((char: string, getItemText?: (index: number) => string) => {
    if (!enableTypeAhead || !getItemText) return false;

    // Clear previous timeout
    if (typeAheadTimeoutRef.current) {
      clearTimeout(typeAheadTimeoutRef.current);
    }

    // Update query
    const newQuery = typeAheadQuery + char.toLowerCase();
    setTypeAheadQuery(newQuery);

    // Search for matching item
    for (let i = 0; i < totalItems; i++) {
      const itemText = getItemText(i).toLowerCase();
      if (itemText.startsWith(newQuery)) {
        navigateToIndex(i);
        break;
      }
    }

    // Clear query after delay
    typeAheadTimeoutRef.current = setTimeout(() => {
      setTypeAheadQuery('');
    }, 1000);

    return true;
  }, [enableTypeAhead, typeAheadQuery, totalItems, navigateToIndex]);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent, getItemText?: (index: number) => string) => {
    // Handle custom key handlers first
    if (customHandlers[event.key]) {
      customHandlers[event.key](event);
      return;
    }

    let handled = false;

    // Handle type-ahead for printable characters
    if (enableTypeAhead && event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      handled = handleTypeAhead(event.key, getItemText);
      if (handled) {
        event.preventDefault();
        return;
      }
    }

    if (!enableArrowKeys && isNavigationKey(event.key)) return;

    switch (event.key) {
      case KeyboardKeys.ARROW_UP:
        event.preventDefault();
        navigateUp();
        handled = true;
        break;
      case KeyboardKeys.ARROW_DOWN:
        event.preventDefault();
        navigateDown();
        handled = true;
        break;
      case KeyboardKeys.HOME:
        if (enableHomeEnd) {
          event.preventDefault();
          navigateHome();
          handled = true;
        }
        break;
      case KeyboardKeys.END:
        if (enableHomeEnd) {
          event.preventDefault();
          navigateEnd();
          handled = true;
        }
        break;
      case KeyboardKeys.PAGE_UP:
        if (enablePageNavigation) {
          event.preventDefault();
          navigatePageUp();
          handled = true;
        }
        break;
      case KeyboardKeys.PAGE_DOWN:
        if (enablePageNavigation) {
          event.preventDefault();
          navigatePageDown();
          handled = true;
        }
        break;
    }

    if (handled && announceChanges) {
      debounceAnnouncement(`Navigating ${role}`, 'low');
    }
  }, [
    customHandlers,
    enableArrowKeys,
    enableHomeEnd,
    enablePageNavigation,
    enableTypeAhead,
    navigateUp,
    navigateDown,
    navigateHome,
    navigateEnd,
    navigatePageUp,
    navigatePageDown,
    handleTypeAhead,
    announceChanges,
    role,
  ]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (typeAheadTimeoutRef.current) {
        clearTimeout(typeAheadTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentIndex,
    navigateToIndex,
    navigateUp,
    navigateDown,
    navigateHome,
    navigateEnd,
    navigatePageUp,
    navigatePageDown,
    handleTypeAhead,
    typeAheadQuery,
    containerRef,
    handleKeyDown,
  };
};

/**
 * Hook for managing keyboard shortcuts
 */
export const useKeyboardShortcuts = (shortcuts: Record<string, () => void>) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Create key combination string
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');
    
    const key = event.key.toLowerCase();
    const combination = [...modifiers, key].join('+');
    
    if (shortcuts[combination]) {
      event.preventDefault();
      shortcuts[combination]();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { handleKeyDown };
};

export default {
  useGridNavigation,
  useListNavigation,
  useKeyboardShortcuts,
};