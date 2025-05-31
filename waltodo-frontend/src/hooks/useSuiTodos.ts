/**
 * React hook for TodoNFT operations with wallet integration
 * Provides easy-to-use interface for blockchain todo operations
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// Use unified types
import type { 
  Todo, 
  CreateTodoParams, 
  UpdateTodoParams,
  TransactionResult as TodoTransactionResult,
  NetworkType
} from '@/types/todo-nft';

interface UseSuiTodosState {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  networkHealth: boolean;
  refreshing: boolean;
  hasNextPage: boolean;
  nextCursor?: string;
}

interface UseSuiTodosActions {
  createTodo: (params: CreateTodoParams) => Promise<TodoTransactionResult>;
  updateTodo: (params: UpdateTodoParams) => Promise<TodoTransactionResult>;
  completeTodo: (objectId: string) => Promise<TodoTransactionResult>;
  deleteTodo: (objectId: string) => Promise<TodoTransactionResult>;
  refreshTodos: () => Promise<void>;
  loadMore: () => Promise<void>;
  filterTodos: (filter: { completed?: boolean; priority?: 'low' | 'medium' | 'high'; tags?: string[] }) => Promise<void>;
  switchToNetwork: (network: NetworkType) => Promise<void>;
  checkHealth: () => Promise<void>;
  clearError: () => void;
  invalidateCache: () => void;
}

interface UseSuiTodosReturn {
  state: UseSuiTodosState;
  actions: UseSuiTodosActions;
  network: NetworkType;
  isWalletReady: boolean;
}

import { useWalletContext } from '@/contexts/WalletContext';
import {
  retrieveTodosFromBlockchain,
  completeTodoOnBlockchain,
  transferTodoNFT,
  addTodo,
  getTodos,
  getTodoList,
  updateTodo as updateLocalTodo,
  deleteTodo as deleteLocalTodo,
  type WalletSigner,
} from '@/lib/todo-service';
import { 
  getTodosFromBlockchain as getBlockchainTodos,
  withSuiClient,
  getPackageId,
  storeTodoOnBlockchain,
} from '@/lib/sui-client';
import type { SuiClient, PaginatedObjectsResponse, SuiObjectResponse, SuiMoveObject } from '@mysten/sui/client';
import { walrusClient } from '@/lib/walrus-client';
import { loadAppConfig } from '@/lib/config-loader';
import type { TodoList } from '@/types/todo-nft';
import type { TodoNFTDisplay, TodoNFTMetadata, ChecklistItem } from '@/types/nft-display';

// Cache for NFT data with TTL
interface CachedNFTData {
  data: Todo;
  timestamp: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  metadata?: TodoNFTMetadata;
}

const NFT_CACHE = new Map<string, CachedNFTData>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const IMAGE_CACHE = new Map<string, string>(); // Cache transformed URLs

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  backoffMultiplier: 2,
};

// Helper function for exponential backoff retry
async function withRetry<T>(
  operation: () => Promise<T>,
  config = RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < config.maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (
        lastError.message.includes('Wallet not connected') ||
        lastError.message.includes('User rejected')
      ) {
        throw lastError;
      }
      
      // Wait before retrying (exponential backoff)
      if (i < config.maxRetries - 1) {
        const delay = config.retryDelay * Math.pow(config.backoffMultiplier, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

// Helper to transform walrus:// URLs to HTTP URLs with caching
function transformWalrusUrl(walrusUrl: string | undefined, options?: { size?: 'thumbnail' | 'preview' | 'full' }): string | undefined {
  if (!walrusUrl) return undefined;
  
  // Check cache first
  const cacheKey = `${walrusUrl}_${options?.size || 'full'}`;
  const cached = IMAGE_CACHE.get(cacheKey);
  if (cached) return cached;
  
  let transformedUrl: string;
  
  // Check if it's a walrus:// URL
  if (walrusUrl.startsWith('walrus://')) {
    const blobId = walrusUrl.replace('walrus://', '');
    transformedUrl = walrusClient.getBlobUrl(blobId);
    
    // Add size parameters if specified
    if (options?.size && options.size !== 'full') {
      const url = new URL(transformedUrl);
      if (options.size === 'thumbnail') {
        url.searchParams.set('w', '150');
        url.searchParams.set('h', '150');
        url.searchParams.set('q', '85');
      } else if (options.size === 'preview') {
        url.searchParams.set('w', '300');
        url.searchParams.set('h', '300');
        url.searchParams.set('q', '90');
      }
      transformedUrl = url.toString();
    }
  } else {
    // Return as-is if it's already an HTTP URL
    transformedUrl = walrusUrl;
  }
  
  // Cache the transformed URL
  IMAGE_CACHE.set(cacheKey, transformedUrl);
  return transformedUrl;
}

// Helper to parse metadata JSON with extended fields
function parseMetadata(metadata: string | undefined): { 
  priority?: 'low' | 'medium' | 'high'; 
  tags?: string[]; 
  checklist?: ChecklistItem[];
  notes?: string;
  links?: string[];
  attachments?: string[];
} {
  if (!metadata) return {};
  
  try {
    const parsed = JSON.parse(metadata);
    return {
      priority: parsed.priority || 'medium',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
      notes: parsed.notes || '',
      links: Array.isArray(parsed.links) ? parsed.links : [],
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : []
    };
  } catch {
    return {};
  }
}

// Enhanced transform function with metadata parsing and image URL transformation
function transformSuiObjectToTodo(suiObject: SuiObjectResponse): Todo | null {
  if (
    !suiObject.data?.content ||
    suiObject.data.content.dataType !== 'moveObject'
  ) {
    return null;
  }

  const moveObject = suiObject.data.content as SuiMoveObject;
  const fields = moveObject.fields as any;

  if (!fields) {
    return null;
  }

  try {
    // Parse extended metadata
    const { priority, tags, checklist, notes, links, attachments } = parseMetadata(fields.metadata);
    
    // Transform walrus URLs to HTTP URLs with different sizes
    const imageUrl = transformWalrusUrl(fields.image_url);
    const thumbnailUrl = transformWalrusUrl(fields.image_url, { size: 'thumbnail' });
    const previewUrl = transformWalrusUrl(fields.image_url, { size: 'preview' });
    
    // Extract blob ID from walrus URL if present
    let walrusBlobId: string | undefined;
    if (fields.image_url && fields.image_url.startsWith('walrus://')) {
      walrusBlobId = fields.image_url.replace('walrus://', '');
    }

    const todo: Todo = {
      id: suiObject.data.objectId,
      objectId: suiObject.data.objectId,
      title: fields.title || 'Untitled',
      description: fields.description || '',
      completed: fields.completed === true,
      priority: priority || 'medium',
      tags: tags || [],
      blockchainStored: true,
      imageUrl,
      createdAt: fields.created_at 
        ? new Date(parseInt(fields.created_at)).toISOString() 
        : new Date().toISOString(),
      completedAt: fields.completed_at
        ? new Date(parseInt(fields.completed_at)).toISOString()
        : undefined,
      owner: fields.owner,
      metadata: fields.metadata || '',
      isPrivate: fields.is_private === true,
    };
    
    // Cache with extended data
    NFT_CACHE.set(suiObject.data.objectId, {
      data: todo,
      timestamp: Date.now(),
      imageUrl,
      thumbnailUrl,
      previewUrl,
      metadata: {
        title: fields.title,
        description: fields.description,
        image_url: fields.image_url,
        completed: fields.completed,
        created_at: parseInt(fields.created_at || '0'),
        completed_at: fields.completed_at ? parseInt(fields.completed_at) : undefined,
        owner: fields.owner,
        metadata: fields.metadata,
        is_private: fields.is_private,
        attributes: [
          { trait_type: 'Priority', value: priority || 'medium' },
          { trait_type: 'Status', value: fields.completed ? 'Completed' : 'Pending' },
          { trait_type: 'Private', value: fields.is_private === true },
          ...(tags && tags.length > 0 ? [{ trait_type: 'Tags', value: tags.join(', ') }] : [])
        ]
      }
    });

    return todo;
  } catch (error) {
    console.error('Error transforming Sui object to Todo:', error);
    return null;
  }
}

// Helper to get cached NFT data
function getCachedNFTData(objectId: string): CachedNFTData | null {
  const cached = NFT_CACHE.get(objectId);
  if (!cached) return null;
  
  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    NFT_CACHE.delete(objectId);
    return null;
  }
  
  return cached;
}

// Enhanced function to get todos with pagination and filtering
async function getTodosFromBlockchain(
  ownerAddress: string,
  options?: {
    cursor?: string;
    limit?: number;
    filter?: {
      completed?: boolean;
      priority?: 'low' | 'medium' | 'high';
      tags?: string[];
    };
  }
): Promise<{ todos: Todo[]; hasNextPage: boolean; nextCursor?: string }> {
  try {
    if (!ownerAddress) {
      throw new Error('Wallet not connected');
    }

    return await withRetry(async () => {
      return await withSuiClient(async (client) => {
      const appConfig = await loadAppConfig();
      const packageId = appConfig?.deployment.packageId || getPackageId();
      
      // Get all objects owned by the address with pagination
      const response: PaginatedObjectsResponse = await client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${packageId}::todo_nft::TodoNFT`,
        },
        options: {
          showContent: true,
          showOwner: true,
          showType: true,
        },
        cursor: options?.cursor,
        limit: options?.limit || 50,
      });

      // Transform Sui objects to Todo format
      let todos: Todo[] = response.data
        .map(transformSuiObjectToTodo)
        .filter((todo): todo is Todo => todo !== null);

      // Apply client-side filtering if needed
      if (options?.filter) {
        const { completed, priority, tags } = options.filter;
        
        if (completed !== undefined) {
          todos = todos.filter(todo => todo.completed === completed);
        }
        
        if (priority) {
          todos = todos.filter(todo => todo.priority === priority);
        }
        
        if (tags && tags.length > 0) {
          todos = todos.filter(todo => 
            tags.some(tag => todo.tags?.includes(tag))
          );
        }
      }

      // Cache NFT data is now handled in transformSuiObjectToTodo

      return {
        todos,
        hasNextPage: response.hasNextPage,
        nextCursor: response.nextCursor
      };
      });
    });
  } catch (error) {
    console.error('Error fetching todos from blockchain:', error);
    throw error;
  }
}

/**
 * Hook for managing TodoNFTs on Sui blockchain
 */
export function useSuiTodos(): UseSuiTodosReturn {
  const walletContext = useWalletContext();
  const connected = walletContext?.connected || false;
  const address = walletContext?.address || null;
  const trackTransaction = walletContext?.trackTransaction || null;
  const walletError = walletContext?.error || null;
  const clearWalletError = useMemo(() => walletContext?.clearError || (() => {}), [walletContext?.clearError]);

  const [state, setState] = useState<UseSuiTodosState>({
    todos: [],
    loading: false,
    error: null,
    networkHealth: true,
    refreshing: false,
    hasNextPage: false,
    nextCursor: undefined,
  });

  const [currentNetwork, setCurrentNetwork] = useState<NetworkType>('testnet');
  const [currentFilter, setCurrentFilter] = useState<{
    completed?: boolean;
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
  }>({});

  // Check if wallet is ready for operations
  const isWalletReady = useMemo(() => {
    return Boolean(connected && address && !walletError);
  }, [connected, address, walletError]);

  // Set error helper
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  // Set loading helper
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  // Set refreshing helper
  const setRefreshing = useCallback((refreshing: boolean) => {
    setState(prev => ({ ...prev, refreshing }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    clearWalletError();
  }, [setError, clearWalletError]);

  // Check network health
  const checkHealth = useCallback(async () => {
    try {
      // Mock health check - always returns healthy
      setState(prev => ({ ...prev, networkHealth: true }));
    } catch (error) {
      setState(prev => ({ ...prev, networkHealth: false }));
      setError(
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [setError]);

  // Clear cache helper
  const invalidateCache = useCallback(() => {
    NFT_CACHE.clear();
    IMAGE_CACHE.clear();
  }, []);

  // Prefetch Walrus images for better performance
  const prefetchImages = useCallback(async (todos: Todo[]) => {
    const imagesToPrefetch = todos
      .filter(todo => todo.imageUrl && todo.imageUrl.startsWith('http'))
      .map(todo => todo.imageUrl!);
    
    // Prefetch images in background
    imagesToPrefetch.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  // Fetch todos from blockchain and local storage
  const refreshTodos = useCallback(async () => {
    if (!address) {
      // Load anonymous todos when no wallet connected
      const localTodos = getTodos('default');
      setState(prev => ({ ...prev, todos: localTodos, hasNextPage: false, nextCursor: undefined }));
      return;
    }

    setRefreshing(true);
    setError(null);

    try {
      // Fetch todos from blockchain with pagination and filtering
      const { todos: blockchainTodos, hasNextPage, nextCursor } = await getTodosFromBlockchain(address, {
        filter: currentFilter,
        limit: 50,
      });

      // Also get local todos for this wallet
      const localTodos = getTodos('default', address);

      // Merge blockchain and local todos (blockchain takes precedence for duplicates)
      const todoMap = new Map<string, Todo>();

      // Add local todos first
      localTodos.forEach(todo => {
        todoMap.set(todo.id, todo);
      });

      // Add/override with blockchain todos
      blockchainTodos.forEach(todo => {
        todoMap.set(todo.id, todo);
      });

      const mergedTodos = Array.from(todoMap.values());

      setState(prev => ({ 
        ...prev, 
        todos: mergedTodos,
        hasNextPage,
        nextCursor,
        error: null 
      }));
      
      // Prefetch images in background
      prefetchImages(mergedTodos);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch todos';
      setError(errorMessage);
      console.error('Error fetching todos:', error);

      // Fallback to local todos only
      const localTodos = getTodos('default', address);
      setState(prev => ({ 
        ...prev, 
        todos: localTodos,
        hasNextPage: false,
        nextCursor: undefined 
      }));
    } finally {
      setRefreshing(false);
    }
  }, [address, currentFilter, setError, setRefreshing, prefetchImages]);

  // Load more todos (pagination)
  const loadMore = useCallback(async () => {
    if (!address || !state.hasNextPage || !state.nextCursor) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { todos: moreTodos, hasNextPage, nextCursor } = await getTodosFromBlockchain(address, {
        cursor: state.nextCursor,
        filter: currentFilter,
        limit: 50,
      });

      setState(prev => ({
        ...prev,
        todos: [...prev.todos, ...moreTodos],
        hasNextPage,
        nextCursor,
      }));
      
      // Prefetch images for new todos
      prefetchImages(moreTodos);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load more todos';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [address, state.hasNextPage, state.nextCursor, currentFilter, setError, setLoading, prefetchImages]);

  // Filter todos
  const filterTodos = useCallback(async (filter: {
    completed?: boolean;
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
  }) => {
    setCurrentFilter(filter);
    // Will trigger refreshTodos through effect
  }, []);

  // Switch to different network
  const switchToNetwork = useCallback(
    async (network: NetworkType) => {
      setLoading(true);
      setError(null);

      try {
        // Update network state
        setCurrentNetwork(network);

        // Refresh todos after network switch
        if (isWalletReady) {
          await refreshTodos();
        }
      } catch (error) {
        setError(`Failed to switch to ${network} network`);
        // Network switch error
      } finally {
        setLoading(false);
      }
    },
    [isWalletReady, refreshTodos, setError, setLoading]
  );

  // Create todo (locally first, then optionally on blockchain)
  const createTodo = useCallback(
    async (params: CreateTodoParams): Promise<TodoTransactionResult> => {
      setLoading(true);
      setError(null);

      try {
        // Prepare metadata with priority and tags
        const metadata = JSON.stringify({
          priority: params.priority || 'medium',
          tags: params.tags || [],
          dueDate: params.dueDate instanceof Date ? params.dueDate.toISOString() : params.dueDate,
        });

        // First, create the todo locally
        const newTodo = addTodo(
          'default',
          {
            title: params.title,
            description: params.description,
            completed: false,
            priority: params.priority || 'medium',
            tags: params.tags,
            dueDate: params.dueDate instanceof Date ? params.dueDate.toISOString() : params.dueDate,
          },
          address || undefined
        );

        // If wallet is connected, also store on blockchain
        if (
          isWalletReady &&
          address &&
          walletContext?.signAndExecuteTransaction
        ) {
          const walletSigner: WalletSigner = {
            signAndExecuteTransaction: walletContext?.signAndExecuteTransaction,
            address,
          };

          // Create params with metadata for blockchain storage
          const blockchainParams: CreateTodoParams = {
            title: params.title,
            description: params.description,
            priority: params.priority,
            tags: params.tags,
            dueDate: params.dueDate,
            imageUrl: params.imageUrl,
            metadata: metadata,
            isPrivate: params.isPrivate,
          };

          const todoPromise = storeTodoOnBlockchain(
            blockchainParams,
            walletContext.signAndExecuteTransaction,
            address
          );

          const result = trackTransaction 
            ? await trackTransaction(todoPromise, 'Create Todo NFT')
            : await todoPromise;

          if (result.success && result.objectId) {
            // Update local todo with blockchain info
            newTodo.objectId = result.objectId;
            newTodo.blockchainStored = true;
            updateLocalTodo('default', newTodo, address);
            
            // Refresh to get updated blockchain state
            await refreshTodos();
            return { success: true, digest: result.digest, objectId: result.objectId };
          }
        }

        // For local-only todos, still refresh to update UI
        await refreshTodos();
        return { success: true, digest: newTodo.id };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to create todo';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [
      isWalletReady,
      address,
      trackTransaction,
      refreshTodos,
      setError,
      setLoading,
      walletContext?.signAndExecuteTransaction,
    ]
  );

  // Update todo on blockchain
  const updateTodo = useCallback(
    async (params: UpdateTodoParams): Promise<TodoTransactionResult> => {
      if (!isWalletReady || !address || !walletContext?.signAndExecuteTransaction) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        // Find the current todo
        const currentTodo = state.todos.find(t => t.objectId === params.objectId);
        if (!currentTodo) {
          throw new Error('Todo not found');
        }

        // Prepare updated metadata
        const metadata = JSON.stringify({
          priority: params.priority || currentTodo.priority || 'medium',
          tags: params.tags || currentTodo.tags || [],
          dueDate: params.dueDate || currentTodo.dueDate,
        });

        // Update params with metadata
        const updateParams: UpdateTodoParams = {
          ...params,
          metadata,
        };

        // Execute blockchain update with retry
        const result = await withRetry(async () => {
          const { updateTodoOnBlockchain } = await import('@/lib/sui-client');
          return await updateTodoOnBlockchain(
            updateParams,
            walletContext.signAndExecuteTransaction,
            address
          );
        });

        if (result.success) {
          // Update local state
          setState(prev => ({
            ...prev,
            todos: prev.todos.map(todo =>
              todo.objectId === params.objectId
                ? {
                    ...todo,
                    title: params.title || todo.title,
                    description: params.description || todo.description,
                    priority: params.priority || todo.priority,
                    tags: params.tags || todo.tags,
                    dueDate: params.dueDate ? (params.dueDate instanceof Date ? params.dueDate.toISOString() : params.dueDate) : todo.dueDate,
                    metadata,
                    updatedAt: new Date().toISOString(),
                  }
                : todo
            ),
          }));

          // Invalidate cache for this todo
          NFT_CACHE.delete(params.objectId);
        }

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to update todo';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [isWalletReady, address, state.todos, setError, setLoading, walletContext?.signAndExecuteTransaction]
  );

  // Complete todo
  const completeTodo = useCallback(
    async (todoId: string): Promise<TodoTransactionResult> => {
      setLoading(true);
      setError(null);

      try {
        // Find the todo
        const todo = state.todos.find(
          t => t.id === todoId || t.objectId === todoId
        );
        if (!todo) {
          throw new Error('Todo not found');
        }

        // Update locally first
        todo.completed = true;
        todo.completedAt = new Date().toISOString();
        updateLocalTodo('default', todo, address || undefined);

        // If it's a blockchain todo and wallet is connected, complete on blockchain
        if (
          todo.blockchainStored &&
          todo.objectId &&
          isWalletReady &&
          address &&
          walletContext?.signAndExecuteTransaction
        ) {
          const walletSigner: WalletSigner = {
            signAndExecuteTransaction: walletContext?.signAndExecuteTransaction,
            address,
          };

          const completePromise = withRetry(async () => {
            const { completeTodoOnBlockchain: completeOnChain } = await import('@/lib/sui-client');
            return await completeOnChain(
              todo.objectId,
              walletContext.signAndExecuteTransaction,
              address
            );
          });

          const result = trackTransaction 
            ? await trackTransaction(completePromise, 'Complete Todo NFT')
            : await completePromise;
          const success = result.success;

          if (!success) {
            throw new Error('Failed to complete todo on blockchain');
          }
        }

        // Refresh todos
        await refreshTodos();
        return { success: true, digest: todo.objectId || todo.id };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to complete todo';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [
      state.todos,
      isWalletReady,
      address,
      trackTransaction,
      refreshTodos,
      setError,
      setLoading,
      walletContext?.signAndExecuteTransaction,
    ]
  );

  // Transfer todo NFT (delete locally after transfer)
  const deleteTodo = useCallback(
    async (todoId: string): Promise<TodoTransactionResult> => {
      setLoading(true);
      setError(null);

      try {
        // Find the todo
        const todo = state.todos.find(
          t => t.id === todoId || t.objectId === todoId
        );
        if (!todo) {
          throw new Error('Todo not found');
        }

        // For blockchain todos, we can't delete - only transfer
        // For local todos, we can delete directly
        if (!todo.blockchainStored) {
          // Delete local todo
          const deleted = deleteLocalTodo(
            'default',
            todo.id,
            address || undefined
          );
          if (deleted) {
            await refreshTodos();
            return { success: true, digest: todo.id };
          }
        } else {
          // For blockchain todos, inform user they need to transfer it
          throw new Error(
            'Blockchain todos cannot be deleted, only transferred to another address'
          );
        }

        return { success: false, error: 'Failed to delete todo' };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete todo';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [state.todos, address, refreshTodos, setError, setLoading]
  );

  // Auto-refresh todos when wallet connects or filter changes
  useEffect(() => {
    if (!isWalletReady) return;
    
    let isMounted = true;
    
    const loadInitialTodos = async () => {
      if (!isMounted) return;
      
      await refreshTodos();
      if (isMounted) {
        await checkHealth();
      }
    };

    loadInitialTodos();
    
    return () => {
      isMounted = false;
    };
  }, [isWalletReady, address, currentFilter, refreshTodos, checkHealth]);

  // Invalidate cache and refresh on wallet change
  useEffect(() => {
    if (address) {
      invalidateCache();
    }
  }, [address, invalidateCache]);

  // Auto-check health periodically
  useEffect(() => {
    if (!isWalletReady) return;

    const interval = setInterval(() => {
      checkHealth();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isWalletReady, checkHealth]);

  return {
    state,
    actions: {
      createTodo,
      updateTodo,
      completeTodo,
      deleteTodo,
      refreshTodos,
      loadMore,
      filterTodos,
      switchToNetwork,
      checkHealth,
      clearError,
      invalidateCache,
    },
    network: currentNetwork,
    isWalletReady,
  };
}

// Helper hook to get a single todo with cached data and TodoNFTDisplay compatibility
export function useTodoWithCache(objectId: string | undefined) {
  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nftData, setNftData] = useState<CachedNFTData | null>(null);

  useEffect(() => {
    if (!objectId) {
      setTodo(null);
      setNftData(null);
      return;
    }

    // Check cache first
    const cached = getCachedNFTData(objectId);
    if (cached) {
      setTodo(cached.data);
      setNftData(cached);
      return;
    }

    // Fetch from blockchain
    setLoading(true);
    setError(null);

    withRetry(async () => {
      return await withSuiClient(async (client) => {
        const response = await client.getObject({
          id: objectId,
          options: {
            showContent: true,
            showOwner: true,
            showType: true,
          },
        });
        
        if (response.data) {
          const transformedTodo = transformSuiObjectToTodo(response);
          if (transformedTodo) {
            setTodo(transformedTodo);
            // Get cached data created by transform
            const cachedData = getCachedNFTData(objectId);
            if (cachedData) {
              setNftData(cachedData);
            }
          } else {
            setError('Invalid todo format');
          }
        } else {
          setError('Todo not found');
        }
      });
    })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to fetch todo');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [objectId]);

  return { todo, loading, error, nftData };
}

// Helper hook for individual todo operations
export function useTodoOperation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TodoTransactionResult | null>(null);

  const executeOperation = useCallback(
    async (operation: () => Promise<TodoTransactionResult>) => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const operationResult = await operation();
        setResult(operationResult);
        return operationResult;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Operation failed';
        setError(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearState = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return {
    loading,
    error,
    result,
    executeOperation,
    clearState,
  };
}

export type {
  Todo,
  CreateTodoParams,
  UpdateTodoParams,
  TodoTransactionResult as TransactionResult,
  NetworkType,
  UseSuiTodosState,
  UseSuiTodosActions,
  UseSuiTodosReturn,
  CachedNFTData,
  TodoNFTDisplay,
  TodoNFTMetadata,
  ChecklistItem,
};

// Helper to convert Todo to TodoNFTDisplay format
export function convertTodoToNFTDisplay(todo: Todo, cached?: CachedNFTData): TodoNFTDisplay {
  return {
    ...todo,
    displayImageUrl: cached?.imageUrl || todo.imageUrl || '',
    walrusImageBlobId: cached?.metadata?.image_url?.replace('walrus://', ''),
    nftTokenId: todo.objectId,
    loadingState: 'loaded' as const,
    thumbnailUrl: cached?.thumbnailUrl,
    previewUrl: cached?.previewUrl,
    nftMetadata: cached?.metadata,
    displayConfig: {
      mode: 'thumbnail',
      enableLazyLoading: true,
      showPlaceholder: true,
      cacheImages: true,
    },
    contentData: {
      attachments: [],
      notes: '',
      checklist: [],
      links: [],
    },
  };
}

// Helper to prefetch NFT image
export async function prefetchNFTImage(imageUrl: string | undefined) {
  if (!imageUrl || !imageUrl.startsWith('http')) return;
  
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = imageUrl;
  });
}

// Helper to get multiple todos with cache
export async function getTodosWithCache(objectIds: string[]): Promise<Todo[]> {
  const todos: Todo[] = [];
  const uncachedIds: string[] = [];
  
  // Get cached todos
  for (const id of objectIds) {
    const cached = getCachedNFTData(id);
    if (cached) {
      todos.push(cached.data);
    } else {
      uncachedIds.push(id);
    }
  }
  
  // Fetch uncached todos
  if (uncachedIds.length > 0) {
    try {
      await withSuiClient(async (client) => {
        const responses = await client.multiGetObjects({
          ids: uncachedIds,
          options: {
            showContent: true,
            showOwner: true,
            showType: true,
          },
        });
        
        for (const response of responses) {
          const todo = transformSuiObjectToTodo(response);
          if (todo) {
            todos.push(todo);
          }
        }
      });
    } catch (error) {
      console.error('Error fetching uncached todos:', error);
    }
  }
  
  return todos;
}

// Export utility functions
export { 
  transformWalrusUrl, 
  parseMetadata, 
  getCachedNFTData,
  withRetry,
};
