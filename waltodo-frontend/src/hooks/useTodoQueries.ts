'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { queryKeys, invalidateQueries } from '../lib/queryClient';
import { Todo } from '../types/todo';
import { useTodoStore } from '../stores/todoStore';

// Query hooks
export function useTodos(listName: string = 'default') {
  return useQuery({
    queryKey: queryKeys.todos.list(listName),
    queryFn: () => apiClient.getTodos(listName),
    staleTime: 30000,
    enabled: !!listName,
  });
}

export function useTodo(id: string) {
  return useQuery({
    queryKey: queryKeys.todos.detail(id),
    queryFn: () => apiClient.getTodo(id),
    enabled: !!id,
  });
}

export function useTodoLists() {
  return useQuery({
    queryKey: queryKeys.todos.lists(),
    queryFn: () => apiClient.getLists(),
    staleTime: 60000, // Lists change less frequently
  });
}

export function useSyncStatus(todoId: string) {
  return useQuery({
    queryKey: queryKeys.todos.sync(todoId),
    queryFn: () => apiClient.getSyncStatus(todoId),
    enabled: !!todoId,
    refetchInterval: 5000, // Poll every 5 seconds for sync status
  });
}

// Mutation hooks
export function useCreateTodo() {
  const queryClient = useQueryClient();
  const { addTodo, setSyncInProgress } = useTodoStore();

  return useMutation({
    mutationFn: ({ todo, listName = 'default' }: { todo: Partial<Todo>; listName?: string }) =>
      apiClient.createTodo(todo, listName),
    
    onMutate: async ({ todo, listName = 'default' }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.todos.list(listName) });

      // Snapshot previous value
      const previousTodos = queryClient.getQueryData(queryKeys.todos.list(listName));

      // Optimistically update to the new value
      const optimisticTodo: Todo = {
        id: `temp_${Date.now()}`,
        title: todo.title || '',
        description: todo.description || '',
        completed: false,
        priority: todo.priority || 'medium',
        tags: todo.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: false,
        ...todo,
      };

      queryClient.setQueryData(queryKeys.todos.list(listName), (old: Todo[] | undefined) => {
        return old ? [...old, optimisticTodo] : [optimisticTodo];
      });

      // Also update Zustand store for local state
      addTodo(optimisticTodo, listName);

      return { previousTodos, optimisticTodo, listName };
    },

    onError: (err, { listName = 'default' }, context) => {
      // Revert the optimistic update
      if (context?.previousTodos) {
        queryClient.setQueryData(queryKeys.todos.list(listName), context.previousTodos);
      }
      console.error('Failed to create todo:', err);
    },

    onSuccess: (newTodo, { listName = 'default' }) => {
      // Replace optimistic update with real data
      queryClient.setQueryData(queryKeys.todos.list(listName), (old: Todo[] | undefined) => {
        if (!old) return [newTodo];
        return old.map(todo => 
          todo.id.startsWith('temp_') ? newTodo : todo
        );
      });
      invalidateQueries.todos(listName);
    },
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  const { updateTodo } = useTodoStore();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Todo> }) =>
      apiClient.updateTodo(id, updates),

    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.todos.detail(id) });

      // Snapshot previous value
      const previousTodo = queryClient.getQueryData(queryKeys.todos.detail(id));

      // Optimistically update
      queryClient.setQueryData(queryKeys.todos.detail(id), (old: Todo | undefined) => {
        return old ? { ...old, ...updates, updatedAt: new Date() } : undefined;
      });

      // Update Zustand store
      updateTodo(id, updates);

      return { previousTodo, id };
    },

    onError: (err, { id }, context) => {
      // Revert optimistic update
      if (context?.previousTodo) {
        queryClient.setQueryData(queryKeys.todos.detail(id), context.previousTodo);
      }
      console.error('Failed to update todo:', err);
    },

    onSuccess: (updatedTodo, { id }) => {
      queryClient.setQueryData(queryKeys.todos.detail(id), updatedTodo);
      invalidateQueries.todoDetail(id);
      invalidateQueries.allTodos();
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  const { deleteTodo } = useTodoStore();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTodo(id),

    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.todos.detail(id) });

      // Snapshot previous value
      const previousTodo = queryClient.getQueryData(queryKeys.todos.detail(id));

      // Optimistically remove
      queryClient.removeQueries({ queryKey: queryKeys.todos.detail(id) });

      // Update Zustand store
      deleteTodo(id);

      return { previousTodo, id };
    },

    onError: (err, id, context) => {
      // Revert optimistic update
      if (context?.previousTodo) {
        queryClient.setQueryData(queryKeys.todos.detail(id), context.previousTodo);
      }
      console.error('Failed to delete todo:', err);
    },

    onSuccess: () => {
      invalidateQueries.allTodos();
    },
  });
}

export function useCompleteTodo() {
  const { mutate: updateTodo, ...rest } = useUpdateTodo();

  const completeTodo = (id: string) => {
    updateTodo({
      id,
      updates: { completed: true, completedAt: new Date().toISOString() }
    });
  };

  return {
    ...rest,
    mutate: completeTodo,
  };
}

// Sync mutations
export function useSyncToWalrus() {
  const { setSyncInProgress } = useTodoStore();

  return useMutation({
    mutationFn: (todoId: string) => apiClient.syncTodoToWalrus(todoId),
    
    onMutate: (todoId) => {
      setSyncInProgress(todoId, true);
    },
    
    onSettled: (data, error, todoId) => {
      setSyncInProgress(todoId, false);
    },
    
    onSuccess: (data, todoId) => {
      invalidateQueries.todoDetail(todoId);
    },
  });
}

export function useSyncToBlockchain() {
  const { setSyncInProgress } = useTodoStore();

  return useMutation({
    mutationFn: (todoId: string) => apiClient.syncTodoToBlockchain(todoId),
    
    onMutate: (todoId) => {
      setSyncInProgress(todoId, true);
    },
    
    onSettled: (data, error, todoId) => {
      setSyncInProgress(todoId, false);
    },
    
    onSuccess: (data, todoId) => {
      invalidateQueries.todoDetail(todoId);
    },
  });
}

export function useBatchSync() {
  const { setSyncInProgress } = useTodoStore();

  return useMutation({
    mutationFn: (todoIds: string[]) => apiClient.batchSync(todoIds),
    
    onMutate: (todoIds) => {
      todoIds.forEach(id => setSyncInProgress(id, true));
    },
    
    onSettled: (data, error, todoIds) => {
      todoIds.forEach(id => setSyncInProgress(id, false));
    },
    
    onSuccess: () => {
      invalidateQueries.allTodos();
    },
  });
}

// AI mutations
export function useAISuggestions() {
  return useMutation({
    mutationFn: (context: { existingTodos: Todo[]; preferences?: any }) =>
      apiClient.suggestTasks(context),
  });
}

export function useAISummarize() {
  return useMutation({
    mutationFn: (todos: Todo[]) => apiClient.summarizeTodos(todos),
  });
}

export function useAICategorize() {
  return useMutation({
    mutationFn: (todos: Todo[]) => apiClient.categorizeTodos(todos),
  });
}

export function useAIPrioritize() {
  return useMutation({
    mutationFn: (todos: Todo[]) => apiClient.prioritizeTodos(todos),
  });
}