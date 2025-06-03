import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { UIActions, UIState } from './types';
import { defaultStorageConfig, persistSelectors, storageKeys } from './middleware/persist';
import { logger } from './middleware/logger';

/**
 * Initial state for UI store
 */
const initialUIState: UIState = {
  // Modal management
  modals: {
    createTodo: false,
    walletConnect: false,
    todoDetail: null,
    nftGallery: false,
    editTodo: null,
    confirmDelete: null,
  },
  
  // Loading states
  loading: {
    app: false,
    blockchain: false,
    transactions: {},
    todos: false,
    nfts: false,
  },
  
  // Form state
  forms: {
    createTodo: {
      title: '',
      description: '',
      priority: 'medium',
      dueDate: '',
      tags: [],
      category: '',
      private: false,
      templateId: undefined,
      isSubmitting: false,
      errors: {},
    },
    editTodo: {
      todoId: null,
      title: '',
      description: '',
      priority: 'medium',
      dueDate: '',
      tags: [],
      category: '',
      private: false,
      isSubmitting: false,
      errors: {},
    },
  },
  
  // Navigation & layout
  navigation: {
    currentPage: '/',
    sidebarOpen: false,
    mobileMenuOpen: false,
  },
  
  // Theme & preferences
  preferences: {
    theme: 'system',
    currency: 'USD',
    language: 'en',
    todoDisplayMode: 'list',
    itemsPerPage: 20,
    autoSave: true,
  },
  
  // Error handling
  errors: {
    global: null,
    form: {},
    transaction: {},
    network: null,
  },
  
  // Search and filtering
  search: {
    query: '',
    filters: {
      status: 'all',
      priority: 'all',
      category: null,
      tags: [],
      dateRange: {
        start: null,
        end: null,
      },
    },
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
};

/**
 * UI Store with comprehensive state management
 */
export const useUIStore = create<UIState & UIActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        logger(
          'UI Store',
          immer((set, get) => ({
            ...initialUIState,

            // Modal actions
            openModal: (modal, data) => {
              set((state) => {
                (state.modals as any)[modal] = data ?? true;
              });
            },

            closeModal: (modal) => {
              set((state) => {
                if (modal === 'todoDetail' || modal === 'editTodo' || modal === 'confirmDelete') {
                  (state.modals as any)[modal] = null;
                } else {
                  (state.modals as any)[modal] = false;
                }
              });
            },

            closeAllModals: () => {
              set((state) => {
                state.modals = {
                  createTodo: false,
                  walletConnect: false,
                  todoDetail: null,
                  nftGallery: false,
                  editTodo: null,
                  confirmDelete: null,
                };
              });
            },

            // Form actions
            updateForm: (form, updates) => {
              set((state) => {
                Object.assign(state.forms[form], updates);
              });
            },

            resetForm: (form) => {
              set((state) => {
                if (form === 'createTodo') {
                  state.forms.createTodo = { ...initialUIState.forms.createTodo };
                } else if (form === 'editTodo') {
                  state.forms.editTodo = { ...initialUIState.forms.editTodo };
                }
              });
            },

            setFormError: (form, field, error) => {
              set((state) => {
                state.forms[form].errors[field] = error;
              });
            },

            clearFormErrors: (form) => {
              set((state) => {
                state.forms[form].errors = {};
              });
            },

            // Error actions
            setError: (key, error) => {
              set((state) => {
                state.errors.form[key] = error;
              });
            },

            clearErrors: () => {
              set((state) => {
                state.errors.form = {};
                state.errors.transaction = {};
              });
            },

            setGlobalError: (error) => {
              set((state) => {
                state.errors.global = error;
              });
            },

            setNetworkError: (error) => {
              set((state) => {
                state.errors.network = error;
              });
            },

            // Loading actions
            setLoading: (key, loading) => {
              set((state) => {
                if (key in state.loading) {
                  (state.loading as any)[key] = loading;
                }
              });
            },

            setTransactionLoading: (txId, loading) => {
              set((state) => {
                if (loading) {
                  state.loading.transactions[txId] = true;
                } else {
                  delete state.loading.transactions[txId];
                }
              });
            },

            // Navigation actions
            setCurrentPage: (page) => {
              set((state) => {
                state.navigation.currentPage = page;
              });
            },

            toggleSidebar: () => {
              set((state) => {
                state.navigation.sidebarOpen = !state.navigation.sidebarOpen;
              });
            },

            toggleMobileMenu: () => {
              set((state) => {
                state.navigation.mobileMenuOpen = !state.navigation.mobileMenuOpen;
              });
            },

            // Preference actions
            setTheme: (theme) => {
              set((state) => {
                state.preferences.theme = theme;
              });
            },

            setDisplayMode: (mode) => {
              set((state) => {
                state.preferences.todoDisplayMode = mode;
              });
            },

            updatePreferences: (updates) => {
              set((state) => {
                Object.assign(state.preferences, updates);
              });
            },

            // Search actions
            setSearchQuery: (query) => {
              set((state) => {
                state.search.query = query;
              });
            },

            setFilter: (filter, value) => {
              set((state) => {
                (state.search.filters as any)[filter] = value;
              });
            },

            setSorting: (sortBy, sortOrder) => {
              set((state) => {
                state.search.sortBy = sortBy;
                state.search.sortOrder = sortOrder;
              });
            },

            clearFilters: () => {
              set((state) => {
                state.search.filters = { ...initialUIState.search.filters };
              });
            },

            resetSearch: () => {
              set((state) => {
                state.search = { ...initialUIState.search };
              });
            },
          }))
        )
      ),
      {
        name: storageKeys.ui,
        ...defaultStorageConfig,
        partialize: persistSelectors.ui,
        version: 1,
      }
    ),
    {
      name: 'WalTodo UI Store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Selectors for performance optimization
export const useUIModals = () => useUIStore((state) => state.modals);
export const useUILoading = () => useUIStore((state) => state.loading);
export const useUIErrors = () => useUIStore((state) => state.errors);
export const useUINavigation = () => useUIStore((state) => state.navigation);
export const useUIPreferences = () => useUIStore((state) => state.preferences);
export const useUISearch = () => useUIStore((state) => state.search);
export const useUIForms = () => useUIStore((state) => state.forms);

// Specific modal selectors
export const useCreateTodoModal = () => useUIStore((state) => state.modals.createTodo);
export const useWalletConnectModal = () => useUIStore((state) => state.modals.walletConnect);
export const useNFTGalleryModal = () => useUIStore((state) => state.modals.nftGallery);
export const useTodoDetailModal = () => useUIStore((state) => state.modals.todoDetail);

// Form selectors
export const useCreateTodoForm = () => useUIStore((state) => state.forms.createTodo);
export const useEditTodoForm = () => useUIStore((state) => state.forms.editTodo);

// Action selectors
export const useUIActions = () => useUIStore((state) => ({
  openModal: state.openModal,
  closeModal: state.closeModal,
  closeAllModals: state.closeAllModals,
  updateForm: state.updateForm,
  resetForm: state.resetForm,
  setFormError: state.setFormError,
  clearFormErrors: state.clearFormErrors,
  setError: state.setError,
  clearErrors: state.clearErrors,
  setGlobalError: state.setGlobalError,
  setNetworkError: state.setNetworkError,
  setLoading: state.setLoading,
  setTransactionLoading: state.setTransactionLoading,
  setCurrentPage: state.setCurrentPage,
  toggleSidebar: state.toggleSidebar,
  toggleMobileMenu: state.toggleMobileMenu,
  setTheme: state.setTheme,
  setDisplayMode: state.setDisplayMode,
  updatePreferences: state.updatePreferences,
  setSearchQuery: state.setSearchQuery,
  setFilter: state.setFilter,
  setSorting: state.setSorting,
  clearFilters: state.clearFilters,
  resetSearch: state.resetSearch,
}));

// Theme-specific selectors
export const useTheme = () => useUIStore((state) => state.preferences.theme);
export const useDisplayMode = () => useUIStore((state) => state.preferences.todoDisplayMode);

// Loading state selectors
export const useAppLoading = () => useUIStore((state) => state.loading.app);
export const useBlockchainLoading = () => useUIStore((state) => state.loading.blockchain);
export const useTodosLoading = () => useUIStore((state) => state.loading.todos);
export const useTransactionLoading = (txId: string) => 
  useUIStore((state) => state.loading.transactions[txId] || false);

// Error selectors
export const useGlobalError = () => useUIStore((state) => state.errors.global);
export const useNetworkError = () => useUIStore((state) => state.errors.network);
export const useFormErrors = () => useUIStore((state) => state.errors.form);

// Search selectors
export const useSearchQuery = () => useUIStore((state) => state.search.query);
export const useSearchFilters = () => useUIStore((state) => state.search.filters);
export const useSearchSorting = () => useUIStore((state) => ({
  sortBy: state.search.sortBy,
  sortOrder: state.search.sortOrder,
}));

/**
 * Store hydration helper
 */
export const hydrateUIStore = () => {
  if (typeof window !== 'undefined') {
    useUIStore.persist.rehydrate();
  }
};