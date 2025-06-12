/**
 * Core types and interfaces for Zustand stores
 */

import { ReactNode } from 'react';
import type { Todo, TodoList } from '@/types/todo';
import type { NetworkType, TransactionResult } from '@/types/wallet';

// ========== Store Action Types ==========
export interface StoreActions<T> {
  set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  get: () => T;
  reset: () => void;
}

// ========== UI Store Types ==========
export interface CreateTodoFormState {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  tags: string[];
  category: string;
  private: boolean;
  templateId?: string;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

export interface EditTodoFormState {
  todoId: string | null;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  tags: string[];
  category: string;
  private: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

export interface UIState {
  // Modal management
  modals: {
    createTodo: boolean;
    walletConnect: boolean;
    todoDetail: string | null;
    nftGallery: boolean;
    editTodo: string | null;
    confirmDelete: string | null;
  };
  
  // Loading states
  loading: {
    app: boolean;
    blockchain: boolean;
    transactions: Record<string, boolean>;
    todos: boolean;
    nfts: boolean;
  };
  
  // Form state
  forms: {
    createTodo: CreateTodoFormState;
    editTodo: EditTodoFormState;
  };
  
  // Navigation & layout
  navigation: {
    currentPage: string;
    sidebarOpen: boolean;
    mobileMenuOpen: boolean;
  };
  
  // Theme & preferences
  preferences: {
    theme: 'light' | 'dark' | 'system';
    currency: string;
    language: string;
    todoDisplayMode: 'list' | 'grid' | 'kanban';
    itemsPerPage: number;
    autoSave: boolean;
  };
  
  // Error handling
  errors: {
    global: string | null;
    form: Record<string, string>;
    transaction: Record<string, string>;
    network: string | null;
  };
  
  // Search and filtering
  search: {
    query: string;
    filters: {
      status: 'all' | 'pending' | 'completed';
      priority: 'all' | 'high' | 'medium' | 'low';
      category: string | null;
      tags: string[];
      dateRange: {
        start: string | null;
        end: string | null;
      };
    };
    sortBy: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title';
    sortOrder: 'asc' | 'desc';
  };
}

export interface UIActions {
  // Modal actions
  openModal: (modal: keyof UIState?.["modals"], data?: any) => void;
  closeModal: (modal: keyof UIState?.["modals"]) => void;
  closeAllModals: () => void;
  
  // Form actions
  updateForm: <K extends keyof UIState?.["forms"]>(
    form: K, 
    updates: Partial<UIState?.["forms"][K]>
  ) => void;
  resetForm: (form: keyof UIState?.["forms"]) => void;
  setFormError: (form: keyof UIState?.["forms"], field: string, error: string) => void;
  clearFormErrors: (form: keyof UIState?.["forms"]) => void;
  
  // Error actions
  setError: (key: string, error: string | null) => void;
  clearErrors: () => void;
  setGlobalError: (error: string | null) => void;
  setNetworkError: (error: string | null) => void;
  
  // Loading actions
  setLoading: (key: keyof UIState?.["loading"] | string, loading: boolean) => void;
  setTransactionLoading: (txId: string, loading: boolean) => void;
  
  // Navigation actions
  setCurrentPage: (page: string) => void;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  
  // Preference actions
  setTheme: (theme: UIState?.["preferences"]['theme']) => void;
  setDisplayMode: (mode: UIState?.["preferences"]['todoDisplayMode']) => void;
  updatePreferences: (updates: Partial<UIState?.["preferences"]>) => void;
  
  // Search actions
  setSearchQuery: (query: string) => void;
  setFilter: <K extends keyof UIState?.["search"]['filters']>(
    filter: K,
    value: UIState?.["search"]['filters'][K]
  ) => void;
  setSorting: (sortBy: UIState?.["search"]['sortBy'], sortOrder: UIState?.["search"]['sortOrder']) => void;
  clearFilters: () => void;
  resetSearch: () => void;
}

// ========== Wallet Store Types ==========
export interface TransactionRecord {
  id: string;
  status: 'pending' | 'success' | 'failed';
  type: string;
  timestamp: string;
  digest?: string;
  error?: string;
  details?: any;
}

export interface WalletState {
  // Connection state
  connection: {
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    address: string | null;
    network: NetworkType;
    chainId: string | null;
    name: string | null;
  };
  
  // Session management
  session: {
    lastActivity: number;
    expired: boolean;
    timeoutWarning: boolean;
    autoDisconnectTime?: number;
  };
  
  // Transaction state
  transactions: {
    history: TransactionRecord[];
    pending: Record<string, TransactionRecord>;
    lastTransaction?: TransactionRecord;
  };
  
  // Capabilities
  capabilities: {
    signAndExecute: boolean;
    nftSupport: boolean;
    walrusSupport: boolean;
    networkSwitching: boolean;
  };
  
  // Error state
  error: string | null;
  
  // Modal state
  modalOpen: boolean;
}

export interface WalletActions {
  // Connection actions
  connect: () => void;
  disconnect: () => void;
  setConnectionStatus: (status: WalletState?.["connection"]['status']) => void;
  setAccount: (address: string | null, name?: string | null) => void;
  setNetwork: (network: NetworkType, chainId?: string | null) => void;
  
  // Session actions
  updateActivity: () => void;
  setSessionExpired: (expired: boolean) => void;
  setTimeoutWarning: (warning: boolean) => void;
  resetSession: () => void;
  
  // Transaction actions
  addTransaction: (transaction: Omit<TransactionRecord, 'timestamp'>) => void;
  updateTransaction: (id: string, updates: Partial<TransactionRecord>) => void;
  removeTransaction: (id: string) => void;
  clearTransactionHistory: () => void;
  
  // Error actions
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Modal actions
  openModal: () => void;
  closeModal: () => void;
  
  // Capabilities
  setCapabilities: (capabilities: Partial<WalletState?.["capabilities"]>) => void;
}

// ========== Todo Store Types ==========
export interface TodoState {
  // Local state
  todos: Record<string, Todo[]>; // keyed by list name
  lists: TodoList[];
  currentList: string;
  
  // Blockchain state
  blockchainTodos: Record<string, Todo[]>; // keyed by address
  nftMetadata: Record<string, any>; // keyed by NFT object ID
  
  // Sync state
  lastSync: Record<string, number>; // timestamp by list/address
  syncInProgress: boolean;
  
  // Cache state
  cache: {
    size: number;
    maxSize: number;
    lastCleanup: number;
  };
}

export interface TodoActions {
  // Local todo management
  addTodo: (listName: string, todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTodo: (listName: string, todoId: string, updates: Partial<Todo>) => void;
  deleteTodo: (listName: string, todoId: string) => void;
  completeTodo: (listName: string, todoId: string) => void;
  
  // List management
  createList: (list: Omit<TodoList, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => void;
  updateList: (listId: string, updates: Partial<TodoList>) => void;
  deleteList: (listId: string) => void;
  setCurrentList: (listName: string) => void;
  
  // Blockchain integration
  setBlockchainTodos: (address: string, todos: Todo[]) => void;
  updateBlockchainTodo: (address: string, todoId: string, updates: Partial<Todo>) => void;
  setNFTMetadata: (objectId: string, metadata: any) => void;
  
  // Sync management
  setSyncStatus: (inProgress: boolean) => void;
  updateLastSync: (key: string, timestamp: number) => void;
  
  // Cache management
  clearCache: () => void;
  updateCacheSize: (size: number) => void;
  
  // Bulk operations
  bulkUpdateTodos: (listName: string, updates: Array<{ id: string; updates: Partial<Todo> }>) => void;
  replaceTodos: (listName: string, todos: Todo[]) => void;
}

// ========== App Store Types ==========
export interface AppState {
  // Initialization
  initialized: boolean;
  hydrated: boolean;
  version: string;
  
  // Network health
  network: {
    sui: {
      status: 'healthy' | 'degraded' | 'offline';
      latency: number;
      lastCheck: number;
    };
    walrus: {
      status: 'healthy' | 'degraded' | 'offline';
      latency: number;
      lastCheck: number;
    };
    api: {
      status: 'healthy' | 'degraded' | 'offline';
      latency: number;
      lastCheck: number;
    };
  };
  
  // Feature flags
  features: {
    aiEnabled: boolean;
    blockchainVerification: boolean;
    encryptedStorage: boolean;
    offlineMode: boolean;
    debugMode: boolean;
  };
  
  // Performance monitoring
  performance: {
    renderCount: number;
    lastRenderTime: number;
    avgRenderTime: number;
    memoryUsage: number;
  };
  
  // Environment info
  environment: {
    isClient: boolean;
    isMobile: boolean;
    isTouch: boolean;
    browserName: string;
    browserVersion: string;
  };
}

export interface AppActions {
  // Initialization
  setInitialized: (initialized: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  
  // Network health
  updateNetworkStatus: (
    service: keyof AppState?.["network"],
    status: AppState?.["network"][keyof AppState?.["network"]]['status'],
    latency?: number
  ) => void;
  
  // Feature flags
  toggleFeature: (feature: keyof AppState?.["features"]) => void;
  setFeatures: (features: Partial<AppState?.["features"]>) => void;
  
  // Performance tracking
  recordRender: (renderTime: number) => void;
  updateMemoryUsage: (usage: number) => void;
  
  // Environment detection
  setEnvironment: (env: Partial<AppState?.["environment"]>) => void;
}

// ========== Combined Store Type ==========
export interface RootState {
  ui: UIState;
  wallet: WalletState;
  todos: TodoState;
  app: AppState;
}

export interface RootActions {
  ui: UIActions;
  wallet: WalletActions;
  todos: TodoActions;
  app: AppActions;
}