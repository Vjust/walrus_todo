import { QueryClient } from '@tanstack/react-query';

// Enhanced React Query configuration for real-time todo management with SSR support
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.message?.includes('4')) {return false;}
        return failureCount < 3;
      },
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: typeof window !== 'undefined', // Only refetch on window focus in browser
      refetchOnReconnect: typeof window !== 'undefined', // Only refetch on reconnect in browser
      refetchInterval: false, // TODO: Will be managed by WebSocket when re-enabled
      // Prevent queries from running during SSR by default
      enabled: typeof window !== 'undefined',
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
        // Could add toast notification here
      },
    },
  },
});

// Query keys factory for consistent key management
export const queryKeys = {
  todos: {
    all: ['todos'] as const,
    lists: () => [...queryKeys.todos.all, 'list'] as const,
    list: (listName: string) => [...queryKeys.todos.lists(), listName] as const,
    detail: (id: string) => [...queryKeys.todos.all, 'detail', id] as const,
    sync: (id: string) => [...queryKeys.todos.all, 'sync', id] as const,
  },
  ai: {
    all: ['ai'] as const,
    suggestions: (context: string) => [...queryKeys.ai.all, 'suggestions', context] as const,
    summary: (todoIds: string[]) => [...queryKeys.ai.all, 'summary', todoIds.join('-')] as const,
  },
  wallet: {
    all: ['wallet'] as const,
    address: () => [...queryKeys.wallet.all, 'address'] as const,
    balance: () => [...queryKeys.wallet.all, 'balance'] as const,
  },
} as const;

// Helper to invalidate related queries
export const invalidateQueries = {
  todos: (listName?: string) => {
    if (listName) {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.list(listName) });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
    }
  },
  allTodos: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
  },
  todoDetail: (id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.todos.detail(id) });
  },
};