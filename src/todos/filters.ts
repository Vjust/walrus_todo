/**
 * Filter and sort utilities for TODOs
 * Provides functions for filtering, searching, and sorting TODO lists
 */

import { Todo, TodoStatus, Priority } from './todo';

/**
 * Filter functions for TODOs
 */

/**
 * Filter TODOs by completion status
 */
export function filterByStatus(todos: Todo[], status: TodoStatus): Todo[] {
  return todos.filter(todo => todo.status === status);
}

/**
 * Get completed TODOs
 */
export function getCompletedTodos(todos: Todo[]): Todo[] {
  return filterByStatus(todos, 'done');
}

/**
 * Get pending TODOs
 */
export function getPendingTodos(todos: Todo[]): Todo[] {
  return filterByStatus(todos, 'pending');
}

/**
 * Filter TODOs by priority
 */
export function filterByPriority(todos: Todo[], priority: Priority): Todo[] {
  return todos.filter(todo => todo.priority === priority);
}

/**
 * Filter TODOs by tag
 */
export function filterByTag(todos: Todo[], tag: string): Todo[] {
  const normalizedTag = tag.toLowerCase().trim();
  return todos.filter(todo => 
    todo.tags?.some(t => t.toLowerCase() === normalizedTag)
  );
}

/**
 * Filter TODOs by due date
 */
export function filterByDueDate(todos: Todo[], before?: Date, after?: Date): Todo[] {
  return todos.filter(todo => {
    if (!todo.dueDate) return false;
    
    const dueDate = new Date(todo.dueDate);
    
    if (before && dueDate > before) return false;
    if (after && dueDate < after) return false;
    
    return true;
  });
}

/**
 * Get overdue TODOs
 */
export function getOverdueTodos(todos: Todo[]): Todo[] {
  const now = new Date();
  return todos.filter(todo => 
    todo.status === 'pending' && 
    todo.dueDate && 
    new Date(todo.dueDate) < now
  );
}

/**
 * Get TODOs due today
 */
export function getTodosDueToday(todos: Todo[]): Todo[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return filterByDueDate(todos, tomorrow, today);
}

/**
 * Get TODOs due this week
 */
export function getTodosDueThisWeek(todos: Todo[]): Todo[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  return filterByDueDate(todos, nextWeek, today);
}

/**
 * Search functions
 */

/**
 * Search TODOs by text (searches in description and tags)
 */
export function searchTodos(todos: Todo[], searchText: string): Todo[] {
  const normalizedSearch = searchText.toLowerCase().trim();
  
  if (!normalizedSearch) return todos;
  
  return todos.filter(todo => {
    // Search in description
    if (todo.description.toLowerCase().includes(normalizedSearch)) {
      return true;
    }
    
    // Search in tags
    if (todo.tags?.some(tag => tag.toLowerCase().includes(normalizedSearch))) {
      return true;
    }
    
    return false;
  });
}

/**
 * Sort functions
 */

/**
 * Sort TODOs by creation date
 */
export function sortByCreatedDate(todos: Todo[], ascending: boolean = true): Todo[] {
  return [...todos].sort((a, b) => {
    const comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return ascending ? comparison : -comparison;
  });
}

/**
 * Sort TODOs by due date
 */
export function sortByDueDate(todos: Todo[], ascending: boolean = true): Todo[] {
  return [...todos].sort((a, b) => {
    // TODOs without due dates go to the end
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    
    const comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return ascending ? comparison : -comparison;
  });
}

/**
 * Sort TODOs by priority
 */
export function sortByPriority(todos: Todo[], ascending: boolean = true): Todo[] {
  const priorityOrder: Record<Priority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  
  return [...todos].sort((a, b) => {
    const comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
    return ascending ? comparison : -comparison;
  });
}

/**
 * Sort TODOs alphabetically by description
 */
export function sortAlphabetically(todos: Todo[], ascending: boolean = true): Todo[] {
  return [...todos].sort((a, b) => {
    const comparison = a.description.localeCompare(b.description);
    return ascending ? comparison : -comparison;
  });
}

/**
 * Sort TODOs by completion status (pending first)
 */
export function sortByStatus(todos: Todo[], pendingFirst: boolean = true): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.status === b.status) return 0;
    
    if (pendingFirst) {
      return a.status === 'pending' ? -1 : 1;
    } else {
      return a.status === 'done' ? -1 : 1;
    }
  });
}

/**
 * Combined filter and sort function
 */
export interface FilterOptions {
  status?: TodoStatus;
  priority?: Priority;
  tag?: string;
  search?: string;
  overdue?: boolean;
  dueToday?: boolean;
  dueThisWeek?: boolean;
}

export interface SortOptions {
  field: 'created' | 'due' | 'priority' | 'alphabetical' | 'status';
  ascending: boolean;
}

/**
 * Apply multiple filters and sorting to a TODO list
 */
export function filterAndSortTodos(
  todos: Todo[],
  filters?: FilterOptions,
  sort?: SortOptions
): Todo[] {
  let result = [...todos];
  
  // Apply filters
  if (filters) {
    if (filters.status !== undefined) {
      result = filterByStatus(result, filters.status);
    }
    
    if (filters.priority !== undefined) {
      result = filterByPriority(result, filters.priority);
    }
    
    if (filters.tag) {
      result = filterByTag(result, filters.tag);
    }
    
    if (filters.search) {
      result = searchTodos(result, filters.search);
    }
    
    if (filters.overdue) {
      result = getOverdueTodos(result);
    }
    
    if (filters.dueToday) {
      result = getTodosDueToday(result);
    }
    
    if (filters.dueThisWeek) {
      result = getTodosDueThisWeek(result);
    }
  }
  
  // Apply sorting
  if (sort) {
    switch (sort.field) {
      case 'created':
        result = sortByCreatedDate(result, sort.ascending);
        break;
      case 'due':
        result = sortByDueDate(result, sort.ascending);
        break;
      case 'priority':
        result = sortByPriority(result, sort.ascending);
        break;
      case 'alphabetical':
        result = sortAlphabetically(result, sort.ascending);
        break;
      case 'status':
        result = sortByStatus(result, sort.ascending);
        break;
    }
  }
  
  return result;
}